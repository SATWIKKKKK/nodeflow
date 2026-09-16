"""Python sandbox harness and tracer.

Reads one JSON payload on stdin and prints one JSON response on stdout.

Payload
  code, entrypoint, parameters, returnKind, sharedTail?, design?
  input                     single-case mode (Run / live preview)
  cases: [{input}]          batch mode (Test / Submit): no trace, one result per case
  trace: bool               record steps (single-case mode only)
  stepLimit                 recorded steps before the replay is truncated
  visualizeLimit            items kept per list/dict in a snapshot
  caseTimeoutMs             wall-clock budget per case

The trace is recorded with sys.settrace. After `stepLimit` steps recording stops
(the replay is marked truncated) and the program keeps running untraced, so a
correct solution on a larger input still returns its answer. Runaway loops are
stopped by the per-case timer instead.
"""

import ast
import builtins
import contextlib
import io
import json
import signal
import sys
import time
import traceback
import typing
from collections import deque

sys.path.insert(0, "/runner")
try:
    from nf_trace import delta_encode, dumps, jsonable
except ImportError:  # local development without the /runner layout
    import os

    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "common"))
    from nf_trace import delta_encode, dumps, jsonable

USER_FILENAME = "<user_code>"
MAX_OBJECTS = 160
MAX_STRING = 240
MAX_STDOUT = 64_000


class CaseTimeout(Exception):
    pass


class SandboxViolation(Exception):
    def __init__(self, message, lineno=None):
        super().__init__(message)
        self.lineno = lineno


# ---------------------------------------------------------------------------
# Data structure classes available to user code without imports
# ---------------------------------------------------------------------------


class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

    def __repr__(self):
        return f"ListNode({self.val})"


class DListNode:
    def __init__(self, val=0, prev=None, next=None):
        self.val = val
        self.prev = prev
        self.next = next

    def __repr__(self):
        return f"DListNode({self.val})"


class RandomNode:
    def __init__(self, val=0, next=None, random=None):
        self.val = val
        self.next = next
        self.random = random

    def __repr__(self):
        return f"RandomNode({self.val})"


class ChildNode:
    def __init__(self, val=0, next=None, child=None):
        self.val = val
        self.next = next
        self.child = child

    def __repr__(self):
        return f"ChildNode({self.val})"


class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

    def __repr__(self):
        return f"TreeNode({self.val})"


# ---------------------------------------------------------------------------
# Input builders
# ---------------------------------------------------------------------------


def build_list(values):
    head = tail = None
    for value in values or []:
        node = ListNode(value)
        if head is None:
            head = tail = node
        else:
            tail.next = node
            tail = node
    return head


def build_list_nodes(values):
    nodes = [ListNode(value) for value in values or []]
    for left, right in zip(nodes, nodes[1:]):
        left.next = right
    return nodes


def build_dll(values):
    head = tail = None
    for value in values or []:
        node = DListNode(value)
        if head is None:
            head = tail = node
        else:
            tail.next = node
            node.prev = tail
            tail = node
    return head


def build_cyclic(spec):
    spec = spec or {}
    nodes = build_list_nodes(spec.get("values") or [])
    pos = spec.get("pos", -1)
    if nodes and pos is not None and 0 <= pos < len(nodes):
        nodes[-1].next = nodes[pos]
    return nodes[0] if nodes else None


def build_random(pairs):
    pairs = pairs or []
    nodes = [RandomNode(pair[0]) for pair in pairs]
    for index, node in enumerate(nodes):
        if index + 1 < len(nodes):
            node.next = nodes[index + 1]
        target = pairs[index][1] if len(pairs[index]) > 1 else None
        if target is not None and 0 <= target < len(nodes):
            node.random = nodes[target]
    return nodes[0] if nodes else None


def build_child_list(columns):
    heads = []
    for column in columns or []:
        head = tail = None
        for value in column:
            node = ChildNode(value)
            if head is None:
                head = tail = node
            else:
                tail.child = node
                tail = node
        if head is not None:
            heads.append(head)
    for left, right in zip(heads, heads[1:]):
        left.next = right
    return heads[0] if heads else None


def build_tree(values):
    values = list(values or [])
    if not values or values[0] is None:
        return None
    root = TreeNode(values[0])
    queue = deque([root])
    index = 1
    while queue and index < len(values):
        node = queue.popleft()
        if index < len(values) and values[index] is not None:
            node.left = TreeNode(values[index])
            queue.append(node.left)
        index += 1
        if index < len(values) and values[index] is not None:
            node.right = TreeNode(values[index])
            queue.append(node.right)
        index += 1
    return root


def build_value(kind, value, context):
    if kind in ("int", "long"):
        return int(value) if value is not None else 0
    if kind == "double":
        return float(value) if value is not None else 0.0
    if kind == "bool":
        return bool(value)
    if kind == "string":
        return "" if value is None else str(value)
    if kind in ("array", "long_array", "string_array", "bool_array"):
        return list(value or [])
    if kind == "double_array":
        return [float(item) for item in value or []]
    if kind in ("matrix", "graph", "char_matrix", "string_matrix"):
        return [list(row) for row in value or []]
    if kind == "linked_list":
        return build_list(value)
    if kind == "doubly_linked_list":
        return build_dll(value)
    if kind == "cyclic_list":
        return build_cyclic(value)
    if kind == "random_list":
        return build_random(value)
    if kind == "child_list":
        return build_child_list(value)
    if kind == "tree":
        return build_tree(value)
    if kind == "y_list":
        prefix = build_list_nodes(value)
        tail = context.get("shared_tail")
        if prefix:
            prefix[-1].next = tail
            return prefix[0]
        return tail
    return value


# ---------------------------------------------------------------------------
# Output serialisers
# ---------------------------------------------------------------------------


def list_values(head, link="next", limit=500):
    output = []
    seen = set()
    current = head
    while current is not None:
        if id(current) in seen:
            output.append("<cycle>")
            break
        seen.add(id(current))
        output.append(jsonable(getattr(current, "val", None)))
        current = getattr(current, link, None)
        if len(output) >= limit and current is not None:
            output.append("<too long>")
            break
    return output


def dll_values(head):
    output = []
    seen = set()
    previous = None
    current = head
    while current is not None:
        if id(current) in seen:
            output.append("<cycle>")
            break
        seen.add(id(current))
        if getattr(current, "prev", None) is not previous:
            output.append("<prev link broken>")
            break
        output.append(jsonable(current.val))
        previous = current
        current = current.next
        if len(output) > 500:
            break
    return output


def random_values(head):
    nodes = []
    seen = {}
    current = head
    while current is not None and id(current) not in seen and len(nodes) <= 500:
        seen[id(current)] = len(nodes)
        nodes.append(current)
        current = current.next
    output = []
    for node in nodes:
        target = getattr(node, "random", None)
        if target is None:
            index = None
        elif id(target) in seen:
            index = seen[id(target)]
        else:
            index = "<outside list>"
        output.append([jsonable(node.val), index])
    return output


def tree_values(root):
    if root is None:
        return []
    output = []
    queue = deque([root])
    seen = set()
    while queue and len(output) < 2000:
        node = queue.popleft()
        if node is None:
            output.append(None)
            continue
        if id(node) in seen:
            output.append("<cycle>")
            break
        seen.add(id(node))
        output.append(jsonable(node.val))
        queue.append(getattr(node, "left", None))
        queue.append(getattr(node, "right", None))
    while output and output[-1] is None:
        output.pop()
    return output


def serialize_result(kind, value):
    if kind == "void":
        return None
    if kind in ("linked_list", "cyclic_list", "y_list"):
        return list_values(value)
    if kind == "doubly_linked_list":
        return dll_values(value)
    if kind == "random_list":
        return random_values(value)
    if kind == "child_list":
        return list_values(value, link="child")
    if kind == "tree":
        return tree_values(value)
    if kind in ("list_node_value", "tree_node_value"):
        return -1 if value is None else jsonable(getattr(value, "val", value))
    if kind == "bool":
        return bool(value) if isinstance(value, (bool, int)) else jsonable(value)
    if kind in ("int", "long"):
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, float) and value.is_integer():
            return int(value)
        return jsonable(value)
    if kind == "double":
        return float(value) if isinstance(value, (int, float)) else jsonable(value)
    return jsonable(value)


def build_design_args(parameters, values, context):
    values = list(values or [])
    return [
        build_value(parameter["kind"], values[index] if index < len(values) else None, context)
        for index, parameter in enumerate(parameters)
    ]


# ---------------------------------------------------------------------------
# Snapshots
# ---------------------------------------------------------------------------


class Snapshotter:
    def __init__(self, visualize_limit):
        self.visualize_limit = visualize_limit
        self.ids = {}
        self.keepalive = []  # stops id() reuse after garbage collection
        self.next_id = 1

    def ref_for(self, value):
        marker = id(value)
        if marker not in self.ids:
            self.ids[marker] = f"obj_{self.next_id}"
            self.next_id += 1
            self.keepalive.append(value)
        return self.ids[marker]

    def primitive(self, value):
        if isinstance(value, float):
            return jsonable(value)
        if isinstance(value, str) and len(value) > MAX_STRING:
            return value[:MAX_STRING] + "…"
        return value

    def serialize_value(self, value, heap, active):
        if value is None or isinstance(value, (bool, int, float, str)):
            return self.primitive(value)

        if isinstance(value, (list, tuple, deque, set, frozenset)) or isinstance(value, dict) or hasattr(
            value, "__dict__"
        ):
            ref = self.ref_for(value)
            if ref in heap or ref in active:
                return ref
            if len(heap) >= MAX_OBJECTS:
                return ref
            active.add(ref)
            heap[ref] = self.describe(value, heap, active)
            active.discard(ref)
            return ref

        return repr(value)[:MAX_STRING]

    def describe(self, value, heap, active):
        limit = self.visualize_limit
        if isinstance(value, (list, tuple, deque)):
            visible = list(value)[:limit] if not isinstance(value, deque) else list(value)[:limit]
            kind = "list" if isinstance(value, list) else "tuple" if isinstance(value, tuple) else "deque"
            return {
                "type": kind,
                "items": [self.serialize_value(item, heap, active) for item in visible],
                "truncated": max(0, len(value) - len(visible)),
            }
        if isinstance(value, (set, frozenset)):
            items = list(value)
            try:
                items.sort()
            except TypeError:
                pass
            visible = items[:limit]
            return {
                "type": "set",
                "items": [self.serialize_value(item, heap, active) for item in visible],
                "truncated": max(0, len(items) - len(visible)),
            }
        if isinstance(value, dict):
            entries = list(value.items())[:limit]
            type_name = "dict" if type(value) is dict else type(value).__name__
            return {
                "type": type_name,
                "fields": {
                    str(key): self.serialize_value(entry, heap, active) for key, entry in entries
                },
                "truncated": max(0, len(value) - len(entries)),
            }
        fields = {}
        for name, entry in vars(value).items():
            if name.startswith("_"):
                continue
            if callable(entry):
                continue
            fields[name] = self.serialize_value(entry, heap, active)
        return {"type": type(value).__name__, "fields": fields}

    def frame_variables(self, frame, heap, active):
        variables = {}
        for name, value in frame.f_locals.items():
            if name.startswith("__"):
                continue
            # Functions, classes, modules and caches are code, not data.
            if callable(value) or type(value).__name__ == "module":
                continue
            variables[name] = self.serialize_value(value, heap, active)
        return variables

    def capture(self, frame, event):
        frames = []
        current = frame
        while current is not None and current.f_code.co_filename == USER_FILENAME:
            if current.f_code.co_name != "<module>":
                frames.append(current)
            current = current.f_back
        frames.reverse()

        heap = {}
        active = set()
        # Innermost frame first so its objects win the object budget.
        top_variables = self.frame_variables(frame, heap, active)
        stack = []
        if len(frames) > 1:
            for entry in frames:
                variables = top_variables if entry is frame else self.frame_variables(entry, heap, active)
                stack.append(
                    {"function": entry.f_code.co_name, "line": entry.f_lineno, "variables": variables}
                )

        step = {"line": frame.f_lineno, "event": event, "variables": top_variables, "heap": heap}
        if stack:
            step["stack"] = stack
        return step


# ---------------------------------------------------------------------------
# Sandbox policy
# ---------------------------------------------------------------------------

ALLOWED_MODULES = {
    "bisect",
    "collections",
    "copy",
    "functools",
    "heapq",
    "itertools",
    "math",
    "operator",
    "re",
    "string",
    "typing",
}

_real_import = builtins.__import__


def restricted_import(name, globals=None, locals=None, fromlist=(), level=0):
    root = name.split(".")[0]
    if level != 0 or root not in ALLOWED_MODULES:
        raise ImportError(
            f"Module '{name}' is not available in the Noesis sandbox. "
            f"Allowed: {', '.join(sorted(ALLOWED_MODULES))}."
        )
    return _real_import(name, globals, locals, fromlist, level)


SAFE_BUILTIN_NAMES = [
    "abs", "all", "any", "ascii", "bin", "bool", "bytes", "callable", "chr", "classmethod",
    "dict", "divmod", "enumerate", "filter", "float", "format", "frozenset", "hash", "hex",
    "int", "isinstance", "issubclass", "iter", "len", "list", "map", "max", "min", "next",
    "object", "oct", "ord", "pow", "print", "property", "range", "repr", "reversed", "round",
    "set", "slice", "sorted", "staticmethod", "str", "sum", "super", "tuple", "type", "zip",
    "ArithmeticError", "AssertionError", "AttributeError", "Exception", "IndexError",
    "KeyError", "LookupError", "NameError", "NotImplementedError", "OverflowError",
    "RecursionError", "RuntimeError", "StopIteration", "TypeError", "ValueError",
    "ZeroDivisionError", "__build_class__",
]

SAFE_BUILTINS = {name: getattr(builtins, name) for name in SAFE_BUILTIN_NAMES}
SAFE_BUILTINS.update({"None": None, "True": True, "False": False, "__import__": restricted_import})

BLOCKED_NAMES = {
    "__import__", "breakpoint", "compile", "delattr", "dir", "eval", "exec", "getattr",
    "globals", "help", "input", "locals", "memoryview", "open", "setattr", "vars",
}

ALLOWED_DUNDER_ATTRIBUTES = {
    "__init__", "__lt__", "__le__", "__gt__", "__ge__", "__eq__", "__ne__", "__hash__",
    "__repr__", "__str__", "__len__", "__iter__", "__next__", "__contains__",
    "__getitem__", "__setitem__", "__name__",
}


class SandboxPolicy(ast.NodeVisitor):
    def deny(self, node, message):
        raise SandboxViolation(message, getattr(node, "lineno", None))

    def check_module(self, node, name):
        if name.split(".")[0] not in ALLOWED_MODULES:
            self.deny(
                node,
                f"Importing '{name}' is not allowed. Available modules: {', '.join(sorted(ALLOWED_MODULES))}.",
            )

    def visit_Import(self, node):
        for alias in node.names:
            self.check_module(node, alias.name)

    def visit_ImportFrom(self, node):
        if node.level:
            self.deny(node, "Relative imports are not allowed in the Noesis sandbox.")
        self.check_module(node, node.module or "")

    def visit_Name(self, node):
        if node.id in BLOCKED_NAMES:
            self.deny(node, f"`{node.id}` is not available in the Noesis sandbox.")
        if node.id.startswith("__") and node.id != "__name__":
            self.deny(node, "Dunder names are not available in the Noesis sandbox.")

    def visit_Attribute(self, node):
        if node.attr.startswith("__") and node.attr not in ALLOWED_DUNDER_ATTRIBUTES:
            self.deny(node, f"`{node.attr}` is not available in the Noesis sandbox.")
        self.generic_visit(node)


def compile_user_code(code):
    tree = ast.parse(code, USER_FILENAME, "exec")
    SandboxPolicy().visit(tree)
    return compile(tree, USER_FILENAME, "exec")


def user_line(tb):
    line = None
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == USER_FILENAME:
            line = tb.tb_lineno
        tb = tb.tb_next
    return line


def user_traceback(error):
    lines = traceback.format_exception(type(error), error, error.__traceback__)
    keep = [line for line in lines if "tracer.py" not in line]
    return "".join(keep)[-4000:]


# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------


def _on_alarm(signum, frame):
    raise CaseTimeout("Your code ran longer than the time limit.")


@contextlib.contextmanager
def time_limit(ms):
    if ms and hasattr(signal, "setitimer"):
        signal.signal(signal.SIGALRM, _on_alarm)
        signal.setitimer(signal.ITIMER_REAL, ms / 1000)
        try:
            yield
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)
    else:
        yield


def fresh_namespace():
    return {
        "ListNode": ListNode,
        "DListNode": DListNode,
        "RandomNode": RandomNode,
        "ChildNode": ChildNode,
        "TreeNode": TreeNode,
        # LeetCode-style annotations work without an import.
        "List": typing.List,
        "Optional": typing.Optional,
        "Dict": typing.Dict,
        "Set": typing.Set,
        "Tuple": typing.Tuple,
        "__name__": "__noesis_user__",
        "__builtins__": SAFE_BUILTINS,
    }


def invoke(payload, namespace, case_input):
    """Call the user's entrypoint (or replay a design script) for one input."""
    context = {}
    shared_key = payload.get("sharedTail")
    if shared_key:
        context["shared_tail"] = build_list(case_input.get(shared_key))

    design = payload.get("design")
    if design:
        cls = namespace.get(design["className"])
        if not isinstance(cls, type):
            raise NameError(f"Expected a class named '{design['className']}'.")
        methods = {method["name"]: method for method in design["methods"]}
        operations = case_input.get("operations") or []
        arguments = case_input.get("arguments") or []
        instance = None
        output = []
        for index, operation in enumerate(operations):
            values = arguments[index] if index < len(arguments) else []
            if operation == design["className"]:
                instance = cls(*build_design_args(design["constructorParameters"], values, context))
                output.append(None)
                continue
            method = methods.get(operation)
            if method is None or instance is None:
                raise NameError(f"Unknown operation '{operation}'.")
            bound = getattr(instance, operation, None)
            if not callable(bound):
                raise AttributeError(f"{design['className']} has no method '{operation}'.")
            result = bound(*build_design_args(method["parameters"], values, context))
            output.append(serialize_result(method["returnKind"], result))
        return output

    entrypoint = payload["entrypoint"]
    func = namespace.get(entrypoint)
    if not callable(func) or isinstance(func, type):
        # Also accept LeetCode-style `class Solution` with the method inside.
        solution = namespace.get("Solution")
        if isinstance(solution, type) and callable(getattr(solution, entrypoint, None)):
            func = getattr(solution(), entrypoint)
        else:
            raise NameError(f"Expected a function named '{entrypoint}'.")
    args = [
        build_value(parameter["kind"], case_input.get(parameter["name"]), context)
        for parameter in payload["parameters"]
    ]
    return serialize_result(payload["returnKind"], func(*args))


def failure(error_type, message, started, **extra):
    response = {
        "ok": False,
        "errorType": error_type,
        "message": message,
        "runtimeMs": int((time.perf_counter() - started) * 1000),
    }
    response.update({key: value for key, value in extra.items() if value is not None})
    return response


def run_case(payload, compiled, case_input, record):
    """Execute one case. `record` is a dict with a steps list when tracing."""
    started = time.perf_counter()
    namespace = fresh_namespace()
    stdout = io.StringIO()
    tracing = record is not None
    snapshotter = Snapshotter(int(payload.get("visualizeLimit", 64))) if tracing else None
    step_limit = int(payload.get("stepLimit", 3000))
    steps = record["steps"] if tracing else None

    def stop_tracing(frame):
        sys.settrace(None)
        current = frame
        while current is not None:
            current.f_trace = None
            current = current.f_back

    def trace_func(frame, event, arg):
        if frame.f_code.co_filename != USER_FILENAME:
            return None
        if event == "call":
            return trace_func
        if event in ("line", "return"):
            if len(steps) >= step_limit:
                record["truncated"] = True
                stop_tracing(frame)
                return None
            steps.append(snapshotter.capture(frame, event))
        return trace_func

    try:
        with contextlib.redirect_stdout(stdout), time_limit(int(payload.get("caseTimeoutMs", 5000))):
            exec(compiled, namespace)
            if tracing:
                sys.settrace(trace_func)
            try:
                result = invoke(payload, namespace, case_input)
            finally:
                sys.settrace(None)
        return {
            "ok": True,
            "result": result,
            "stdout": stdout.getvalue()[:MAX_STDOUT],
            "runtimeMs": int((time.perf_counter() - started) * 1000),
        }
    except CaseTimeout as error:
        sys.settrace(None)
        return failure("Time Limit Exceeded", str(error), started, stdout=stdout.getvalue()[:MAX_STDOUT])
    except RecursionError as error:
        sys.settrace(None)
        return failure(
            "Runtime Error",
            "Maximum recursion depth exceeded. Check your base case.",
            started,
            traceback=user_traceback(error),
            line=user_line(error.__traceback__),
            stdout=stdout.getvalue()[:MAX_STDOUT],
        )
    except Exception as error:  # noqa: BLE001 - the user's exception is the result
        sys.settrace(None)
        return failure(
            "Runtime Error",
            f"{type(error).__name__}: {error}",
            started,
            traceback=user_traceback(error),
            line=user_line(error.__traceback__),
            stdout=stdout.getvalue()[:MAX_STDOUT],
        )


def compile_or_fail(code, started):
    try:
        return compile_user_code(code), None
    except SyntaxError as error:
        return None, failure(
            "Compile Error",
            f"SyntaxError: {error.msg} (line {error.lineno})",
            started,
            traceback=traceback.format_exc(limit=0),
            line=error.lineno,
        )
    except SandboxViolation as error:
        return None, failure(
            "Sandbox Violation",
            str(error),
            started,
            traceback=f"Line {error.lineno}: {error}" if error.lineno else str(error),
            line=error.lineno,
        )


def run(payload):
    started = time.perf_counter()
    sys.setrecursionlimit(3000)
    compiled, error = compile_or_fail(payload["code"], started)

    if "cases" in payload:
        if error:
            return error
        results = [run_case(payload, compiled, case.get("input") or {}, None) for case in payload["cases"]]
        return {"ok": True, "cases": results}

    if error:
        error["trace"] = []
        return error

    record = {"steps": [], "truncated": False} if payload.get("trace", True) else None
    outcome = run_case(payload, compiled, payload.get("input") or {}, record)
    steps = record["steps"] if record else []
    outcome["trace"] = delta_encode(steps)
    outcome["heapMode"] = "delta"
    if outcome["ok"]:
        outcome["stepsCaptured"] = len(steps)
        if record and record["truncated"]:
            outcome["traceTruncated"] = True
    return outcome


def main():
    try:
        payload = json.loads(sys.stdin.read())
        response = run(payload)
    except Exception:  # noqa: BLE001 - last-resort guard, output must stay JSON
        response = {
            "ok": False,
            "errorType": "Platform Error",
            "message": "The Python harness failed before your code could run.",
            "traceback": traceback.format_exc(),
        }
    sys.stdout.write(dumps(response))


if __name__ == "__main__":
    main()
