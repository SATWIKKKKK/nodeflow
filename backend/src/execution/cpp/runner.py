"""C++ sandbox harness.

Same JSON payload and response shape as the Python tracer (see
python/tracer.py). Input values are baked into the generated program as C++
literals, one function per case; the binary takes the case index as argv[1], so
a crash in one case never hides the others.

The user's code is placed after `#line 1 "user.cpp"`, so compiler messages and
the debugger both report the user's own line numbers. Traces are recorded by
running the same binary under gdb with gdb_tracer.py.
"""

import json
import os
import re
import signal
import subprocess
import sys
import time

sys.path.insert(0, "/runner")
from nf_trace import delta_encode, dumps  # noqa: E402

WORK_DIR = "/tmp/work"
SOURCE_PATH = os.path.join(WORK_DIR, "solution.cpp")
BINARY_PATH = os.path.join(WORK_DIR, "solution")
TRACE_PATH = os.path.join(WORK_DIR, "trace.json")
COMPILE_TIMEOUT = 30
MAX_STDOUT = 64_000

NODE_DEFINITIONS = {
    "ListNode": """struct ListNode {
    int val;
    ListNode* next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode* next) : val(x), next(next) {}
};""",
    "DListNode": """struct DListNode {
    int val;
    DListNode* prev;
    DListNode* next;
    DListNode() : val(0), prev(nullptr), next(nullptr) {}
    DListNode(int x) : val(x), prev(nullptr), next(nullptr) {}
};""",
    "RandomNode": """struct RandomNode {
    int val;
    RandomNode* next;
    RandomNode* random;
    RandomNode(int x) : val(x), next(nullptr), random(nullptr) {}
};""",
    "ChildNode": """struct ChildNode {
    int val;
    ChildNode* next;
    ChildNode* child;
    ChildNode(int x) : val(x), next(nullptr), child(nullptr) {}
};""",
    "TreeNode": """struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode* left, TreeNode* right) : val(x), left(left), right(right) {}
};""",
}

HELPERS = r"""
static const long long NF_NULL = LLONG_MIN;

__attribute__((noinline)) void nf_enter() {}

static string nf_str(const string& s) {
    string o = "\"";
    for (unsigned char c : s) {
        switch (c) {
            case '"': o += "\\\""; break;
            case '\\': o += "\\\\"; break;
            case '\n': o += "\\n"; break;
            case '\t': o += "\\t"; break;
            case '\r': o += "\\r"; break;
            default:
                if (c < 0x20) { char b[8]; snprintf(b, sizeof b, "\\u%04x", c); o += b; }
                else o += (char)c;
        }
    }
    return o + "\"";
}

static string nf_json(int v) { return to_string(v); }
static string nf_json(long v) { return to_string(v); }
static string nf_json(long long v) { return to_string(v); }
static string nf_json(unsigned v) { return to_string(v); }
static string nf_json(unsigned long v) { return to_string(v); }
static string nf_json(unsigned long long v) { return to_string(v); }
static string nf_json(short v) { return to_string(v); }
static string nf_json(bool v) { return v ? "true" : "false"; }
static string nf_json(double v) {
    if (std::isnan(v)) return "\"nan\"";
    if (std::isinf(v)) return v > 0 ? "\"inf\"" : "\"-inf\"";
    char b[64];
    snprintf(b, sizeof b, "%.12g", v);
    return b;
}
static string nf_json(float v) { return nf_json((double)v); }
static string nf_json(char c) { return nf_str(string(1, c)); }
static string nf_json(const string& s) { return nf_str(s); }
static string nf_json(const char* s) { return s ? nf_str(s) : "null"; }
static string nf_json(const vector<bool>& v) {
    string o = "[";
    for (size_t i = 0; i < v.size(); ++i) { if (i) o += ","; o += v[i] ? "true" : "false"; }
    return o + "]";
}
template <typename A, typename B> static string nf_json(const pair<A, B>& p);
template <typename T> static string nf_json(const vector<T>& v) {
    string o = "[";
    for (size_t i = 0; i < v.size(); ++i) { if (i) o += ","; o += nf_json(v[i]); }
    return o + "]";
}
template <typename A, typename B> static string nf_json(const pair<A, B>& p) {
    return "[" + nf_json(p.first) + "," + nf_json(p.second) + "]";
}

static string nf_json(ListNode* head) {
    string o = "[";
    unordered_set<ListNode*> seen;
    int count = 0;
    for (ListNode* cur = head; cur; cur = cur->next) {
        if (count) o += ",";
        if (seen.count(cur)) { o += "\"<cycle>\""; break; }
        if (count >= 500) { o += "\"<too long>\""; break; }
        seen.insert(cur);
        o += to_string(cur->val);
        ++count;
    }
    return o + "]";
}

static string nf_json(DListNode* head) {
    string o = "[";
    unordered_set<DListNode*> seen;
    DListNode* previous = nullptr;
    int count = 0;
    for (DListNode* cur = head; cur; previous = cur, cur = cur->next) {
        if (count) o += ",";
        if (seen.count(cur)) { o += "\"<cycle>\""; break; }
        if (cur->prev != previous) { o += "\"<prev link broken>\""; break; }
        if (count >= 500) { o += "\"<too long>\""; break; }
        seen.insert(cur);
        o += to_string(cur->val);
        ++count;
    }
    return o + "]";
}

static string nf_json(RandomNode* head) {
    vector<RandomNode*> nodes;
    unordered_map<RandomNode*, int> index;
    for (RandomNode* cur = head; cur && !index.count(cur) && nodes.size() <= 500; cur = cur->next) {
        index[cur] = (int)nodes.size();
        nodes.push_back(cur);
    }
    string o = "[";
    for (size_t i = 0; i < nodes.size(); ++i) {
        if (i) o += ",";
        o += "[" + to_string(nodes[i]->val) + ",";
        RandomNode* target = nodes[i]->random;
        if (!target) o += "null";
        else if (index.count(target)) o += to_string(index[target]);
        else o += "\"<outside list>\"";
        o += "]";
    }
    return o + "]";
}

static string nf_json_child(ChildNode* head) {
    string o = "[";
    unordered_set<ChildNode*> seen;
    int count = 0;
    for (ChildNode* cur = head; cur; cur = cur->child) {
        if (count) o += ",";
        if (seen.count(cur)) { o += "\"<cycle>\""; break; }
        if (count >= 500) { o += "\"<too long>\""; break; }
        seen.insert(cur);
        o += to_string(cur->val);
        ++count;
    }
    return o + "]";
}

static string nf_json(ChildNode* head) { return nf_json_child(head); }

static string nf_json(TreeNode* root) {
    vector<string> out;
    queue<TreeNode*> q;
    unordered_set<TreeNode*> seen;
    if (root) q.push(root);
    while (!q.empty() && out.size() < 2000) {
        TreeNode* node = q.front();
        q.pop();
        if (!node) { out.push_back("null"); continue; }
        if (seen.count(node)) { out.push_back("\"<cycle>\""); break; }
        seen.insert(node);
        out.push_back(to_string(node->val));
        q.push(node->left);
        q.push(node->right);
    }
    while (!out.empty() && out.back() == "null") out.pop_back();
    string o = "[";
    for (size_t i = 0; i < out.size(); ++i) { if (i) o += ","; o += out[i]; }
    return o + "]";
}

static string nf_node_value(ListNode* node) { return node ? to_string(node->val) : "-1"; }
static string nf_node_value(TreeNode* node) { return node ? to_string(node->val) : "-1"; }

static ListNode* nf_list(const vector<int>& values, ListNode* tail = nullptr) {
    ListNode* head = tail;
    for (int i = (int)values.size() - 1; i >= 0; --i) head = new ListNode(values[i], head);
    return head;
}

static ListNode* nf_cyclic(const vector<int>& values, int pos) {
    vector<ListNode*> nodes;
    for (int value : values) nodes.push_back(new ListNode(value));
    for (size_t i = 0; i + 1 < nodes.size(); ++i) nodes[i]->next = nodes[i + 1];
    if (!nodes.empty() && pos >= 0 && pos < (int)nodes.size()) nodes.back()->next = nodes[pos];
    return nodes.empty() ? nullptr : nodes[0];
}

static DListNode* nf_dll(const vector<int>& values) {
    DListNode* head = nullptr;
    DListNode* tail = nullptr;
    for (int value : values) {
        DListNode* node = new DListNode(value);
        if (!head) head = tail = node;
        else { tail->next = node; node->prev = tail; tail = node; }
    }
    return head;
}

static RandomNode* nf_random(const vector<pair<int, int>>& pairs) {
    vector<RandomNode*> nodes;
    for (auto& p : pairs) nodes.push_back(new RandomNode(p.first));
    for (size_t i = 0; i < nodes.size(); ++i) {
        if (i + 1 < nodes.size()) nodes[i]->next = nodes[i + 1];
        int target = pairs[i].second;
        if (target >= 0 && target < (int)nodes.size()) nodes[i]->random = nodes[target];
    }
    return nodes.empty() ? nullptr : nodes[0];
}

static ChildNode* nf_child(const vector<vector<int>>& columns) {
    vector<ChildNode*> heads;
    for (auto& column : columns) {
        ChildNode* head = nullptr;
        ChildNode* tail = nullptr;
        for (int value : column) {
            ChildNode* node = new ChildNode(value);
            if (!head) head = tail = node;
            else { tail->child = node; tail = node; }
        }
        if (head) heads.push_back(head);
    }
    for (size_t i = 0; i + 1 < heads.size(); ++i) heads[i]->next = heads[i + 1];
    return heads.empty() ? nullptr : heads[0];
}

static TreeNode* nf_tree(const vector<long long>& values) {
    if (values.empty() || values[0] == NF_NULL) return nullptr;
    TreeNode* root = new TreeNode((int)values[0]);
    queue<TreeNode*> q;
    q.push(root);
    size_t i = 1;
    while (!q.empty() && i < values.size()) {
        TreeNode* node = q.front();
        q.pop();
        if (i < values.size() && values[i] != NF_NULL) { node->left = new TreeNode((int)values[i]); q.push(node->left); }
        ++i;
        if (i < values.size() && values[i] != NF_NULL) { node->right = new TreeNode((int)values[i]); q.push(node->right); }
        ++i;
    }
    return root;
}

static void nf_emit(const string& json) {
    const char* path = getenv("NF_RESULT");
    FILE* out = path ? fopen(path, "w") : stderr;
    if (!out) out = stderr;
    fputs(json.c_str(), out);
    fputc('\n', out);
    fflush(out);
    if (out != stderr) fclose(out);
}
"""

NODE_TYPE_BY_KIND = {
    "linked_list": "ListNode*",
    "cyclic_list": "ListNode*",
    "y_list": "ListNode*",
    "list_node_value": "ListNode*",
    "doubly_linked_list": "DListNode*",
    "random_list": "RandomNode*",
    "child_list": "ChildNode*",
    "tree": "TreeNode*",
    "tree_node_value": "TreeNode*",
}


# ---------------------------------------------------------------------------
# Literals
# ---------------------------------------------------------------------------


def cpp_string(value):
    out = ['"']
    for byte in str(value).encode("utf8"):
        char = chr(byte)
        if char == '"':
            out.append('\\"')
        elif char == "\\":
            out.append("\\\\")
        elif 32 <= byte < 127:
            out.append(char)
        else:
            out.append("\\%03o" % byte)
    out.append('"')
    return "".join(out)


def cpp_char(value):
    text = str(value or "\0")[:1]
    if text == "'":
        return "'\\''"
    if text == "\\":
        return "'\\\\'"
    byte = ord(text)
    if 32 <= byte < 127:
        return f"'{text}'"
    return "'\\%03o'" % (byte & 0xFF)


def cpp_int(value):
    return str(int(value or 0))


def cpp_long(value):
    return f"{int(value or 0)}LL"


def cpp_double(value):
    number = float(value or 0)
    text = repr(number)
    if "inf" in text or "nan" in text:
        return "0.0"
    return text


def join(items):
    return "{" + ", ".join(items) + "}"


def literal(kind, value):
    """C++ expression of the parameter type for a JSON value."""
    if kind == "int":
        return cpp_int(value)
    if kind == "long":
        return cpp_long(value)
    if kind == "double":
        return cpp_double(value)
    if kind == "bool":
        return "true" if value else "false"
    if kind == "string":
        return f"string({cpp_string(value or '')}, {len(str(value or '').encode('utf8'))})"
    if kind == "array":
        return "vector<int>" + join(cpp_int(item) for item in value or [])
    if kind == "long_array":
        return "vector<long long>" + join(cpp_long(item) for item in value or [])
    if kind == "double_array":
        return "vector<double>" + join(cpp_double(item) for item in value or [])
    if kind == "bool_array":
        return "vector<bool>" + join("true" if item else "false" for item in value or [])
    if kind == "string_array":
        return "vector<string>" + join(cpp_string(item) for item in value or [])
    if kind in ("matrix", "graph"):
        return "vector<vector<int>>" + join(join(cpp_int(item) for item in row) for row in value or [])
    if kind == "char_matrix":
        return "vector<vector<char>>" + join(join(cpp_char(item) for item in row) for row in value or [])
    if kind == "string_matrix":
        return "vector<vector<string>>" + join(join(cpp_string(item) for item in row) for row in value or [])
    if kind == "linked_list":
        return f"nf_list({literal('array', value)})"
    if kind == "doubly_linked_list":
        return f"nf_dll({literal('array', value)})"
    if kind == "cyclic_list":
        spec = value or {}
        pos = spec.get("pos", -1)
        return f"nf_cyclic({literal('array', spec.get('values'))}, {cpp_int(-1 if pos is None else pos)})"
    if kind == "random_list":
        pairs = [
            "{" + cpp_int(pair[0]) + ", " + cpp_int(-1 if len(pair) < 2 or pair[1] is None else pair[1]) + "}"
            for pair in value or []
        ]
        return "nf_random(vector<pair<int,int>>" + join(pairs) + ")"
    if kind == "child_list":
        return f"nf_child({literal('matrix', value)})"
    if kind == "tree":
        items = ["NF_NULL" if item is None else cpp_long(item) for item in value or []]
        return "nf_tree(vector<long long>" + join(items) + ")"
    raise ValueError(f"Unsupported C++ parameter kind: {kind}")


def declared_type(kind):
    if kind in NODE_TYPE_BY_KIND:
        return NODE_TYPE_BY_KIND[kind]
    return {
        "int": "int",
        "long": "long long",
        "double": "double",
        "bool": "bool",
        "string": "string",
        "array": "vector<int>",
        "long_array": "vector<long long>",
        "double_array": "vector<double>",
        "bool_array": "vector<bool>",
        "string_array": "vector<string>",
        "matrix": "vector<vector<int>>",
        "graph": "vector<vector<int>>",
        "char_matrix": "vector<vector<char>>",
        "string_matrix": "vector<vector<string>>",
    }[kind]


def serialize_expr(kind, expr):
    if kind in ("list_node_value", "tree_node_value"):
        return f"nf_node_value({expr})"
    if kind == "child_list":
        return f"nf_json_child({expr})"
    if kind == "double":
        return f"nf_json((double)({expr}))"
    if kind == "long":
        return f"nf_json((long long)({expr}))"
    return f"nf_json({expr})"


def snake_to_camel(value):
    parts = value.split("_")
    return parts[0] + "".join(part[:1].upper() + part[1:] for part in parts[1:])


# ---------------------------------------------------------------------------
# Source generation
# ---------------------------------------------------------------------------


def blank_declarations(code):
    """Blank out the user's copies of the node structs, keeping line numbers.

    The harness declares these types itself, before the user's code. Brace
    matching is required because the structs contain nested constructor bodies.
    """
    for name in NODE_DEFINITIONS:
        while True:
            match = re.search(r"\b(?:struct|class)\s+" + name + r"\s*\{", code)
            if not match:
                break
            start = code.find("{", match.end() - 1)
            depth = 0
            end = None
            for index in range(start, len(code)):
                if code[index] == "{":
                    depth += 1
                elif code[index] == "}":
                    depth -= 1
                    if depth == 0:
                        end = index + 1
                        break
            if end is None:
                break
            tail = code[end:]
            stripped = tail.lstrip(" \t")
            if stripped.startswith(";"):
                end += len(tail) - len(stripped) + 1
            removed = code[match.start() : end]
            code = code[: match.start()] + "\n" * removed.count("\n") + code[end:]
    return code


def uses_solution_class(code):
    return re.search(r"\b(?:class|struct)\s+Solution\b", code) is not None


def case_function(index, payload, case_input, solution_class):
    lines = [f"static void nf_case_{index}() {{"]
    design = payload.get("design")
    shared = payload.get("sharedTail")
    if shared:
        lines.append(f"    ListNode* nf_shared = nf_list({literal('array', case_input.get(shared))});")

    def build(kind, name, value):
        if kind == "y_list":
            return f"    ListNode* {name} = nf_list({literal('array', value)}, nf_shared);"
        return f"    {declared_type(kind)} {name} = {literal(kind, value)};"

    if design:
        class_name = design["className"]
        methods = {method["name"]: method for method in design["methods"]}
        lines.append(f"    {class_name}* nf_obj = nullptr;")
        lines.append('    string nf_out = "[";')
        operations = case_input.get("operations") or []
        arguments = case_input.get("arguments") or []
        for op_index, operation in enumerate(operations):
            values = list(arguments[op_index]) if op_index < len(arguments) else []
            sep = "" if op_index == 0 else ","
            if operation == class_name:
                params = design["constructorParameters"]
                call = "new " + class_name + "("
            else:
                method = methods.get(operation)
                if method is None:
                    raise ValueError(f"Unknown operation {operation}")
                params = method["parameters"]
                call = f"nf_obj->{operation}("
            lines.append("    {")
            names = []
            for arg_index, parameter in enumerate(params):
                name = f"nf_a{arg_index}"
                value = values[arg_index] if arg_index < len(values) else None
                lines.append("    " + build(parameter["kind"], name, value))
                names.append(name)
            call += ", ".join(names) + ")"
            lines.append("        nf_enter();")
            if operation == class_name:
                lines.append(f"        nf_obj = {call};")
                lines.append(f'        nf_out += "{sep}null";')
            elif method["returnKind"] == "void":
                lines.append(f"        {call};")
                lines.append(f'        nf_out += "{sep}null";')
            else:
                lines.append(f"        auto nf_r = {call};")
                lines.append(f'        nf_out += "{sep}" + {serialize_expr(method["returnKind"], "nf_r")};')
            lines.append("    }")
        lines.append('    nf_out += "]";')
        lines.append("    nf_emit(nf_out);")
        lines.append("}")
        return "\n".join(lines)

    names = []
    for arg_index, parameter in enumerate(payload["parameters"]):
        name = f"nf_a{arg_index}"
        lines.append(build(parameter["kind"], name, case_input.get(parameter["name"])))
        names.append(name)

    function = snake_to_camel(payload["entrypoint"])
    target = f"nf_solution.{function}" if solution_class else function
    if solution_class:
        lines.append("    Solution nf_solution;")
    call = f"{target}({', '.join(names)})"
    lines.append("    nf_enter();")
    if payload["returnKind"] == "void":
        lines.append(f"    {call};")
        lines.append('    nf_emit("null");')
    else:
        lines.append(f"    auto nf_r = {call};")
        lines.append(f"    nf_emit({serialize_expr(payload['returnKind'], 'nf_r')});")
    lines.append("}")
    return "\n".join(lines)


def generate_source(payload, cases):
    user_code = blank_declarations(payload["code"])
    solution_class = uses_solution_class(user_code)
    head = "\n".join(
        ["#include <bits/stdc++.h>", "using namespace std;", ""]
        + list(NODE_DEFINITIONS.values())
        + [HELPERS]
    )
    user_block = '#line 1 "user.cpp"\n' + user_code + "\n"
    head_lines = head.count("\n") + 1
    user_lines = user_block.count("\n")
    functions = [case_function(index, payload, case, solution_class) for index, case in enumerate(cases)]
    dispatch = "\n".join(f"        case {index}: nf_case_{index}(); break;" for index in range(len(cases)))
    tail = "\n".join(
        [
            f'#line {head_lines + user_lines + 1} "harness.cpp"',
            *functions,
            "",
            "int main(int argc, char** argv) {",
            '    if (const char* redirect = getenv("NF_STDOUT")) freopen(redirect, "w", stdout);',
            "    int which = argc > 1 ? atoi(argv[1]) : 0;",
            "    switch (which) {",
            dispatch,
            "        default: break;",
            "    }",
            "    fflush(stdout);",
            "    return 0;",
            "}",
            "",
        ]
    )
    return head + "\n" + user_block + tail


# ---------------------------------------------------------------------------
# Compile / run / trace
# ---------------------------------------------------------------------------


def failure(error_type, message, started, **extra):
    response = {
        "ok": False,
        "errorType": error_type,
        "message": message,
        "runtimeMs": int((time.perf_counter() - started) * 1000),
    }
    response.update({key: value for key, value in extra.items() if value is not None})
    return response


def clean_compiler_output(text):
    lines = []
    for line in text.splitlines():
        if "harness.cpp" in line or "solution.cpp" in line:
            # Errors inside generated code are almost always a signature mismatch.
            line = line.replace(SOURCE_PATH, "harness")
        lines.append(line.replace("/tmp/work/", ""))
    return "\n".join(lines)[:4000]


def compile_source(started):
    try:
        compiled = subprocess.run(
            ["g++", "-std=c++17", "-O0", "-g", "-I/runner/pch", "-w", "-o", BINARY_PATH, SOURCE_PATH],
            capture_output=True,
            text=True,
            timeout=COMPILE_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        return failure("Time Limit Exceeded", "Compilation timed out.", started)

    if compiled.returncode == 0:
        return None

    output = clean_compiler_output(compiled.stderr)
    match = re.search(r"user\.cpp:(\d+):\d+: (?:fatal )?error: (.*)", output)
    if match:
        return failure(
            "Compile Error",
            f"Line {match.group(1)}: {match.group(2)}",
            started,
            traceback=output,
            line=int(match.group(1)),
        )
    return failure(
        "Compile Error",
        "Your C++ code does not match the expected function signature.",
        started,
        traceback=output,
    )


SIGNAL_MESSAGES = {
    signal.SIGSEGV: "Segmentation fault: invalid memory access (a null pointer, or an index out of range).",
    signal.SIGFPE: "Arithmetic error, such as division by zero.",
    signal.SIGBUS: "Bus error: invalid memory access.",
    signal.SIGILL: "Illegal instruction (often a function that does not return a value).",
}


def run_case(index, timeout_s):
    started = time.perf_counter()
    result_path = os.path.join(WORK_DIR, f"result_{index}.json")
    if os.path.exists(result_path):
        os.remove(result_path)
    env = dict(os.environ, NF_RESULT=result_path)
    try:
        executed = subprocess.run(
            [BINARY_PATH, str(index)], capture_output=True, text=True, timeout=timeout_s, env=env
        )
    except subprocess.TimeoutExpired as error:
        stdout = error.stdout.decode("utf8", "replace") if isinstance(error.stdout, bytes) else (error.stdout or "")
        return failure("Time Limit Exceeded", "Your code ran longer than the time limit.", started, stdout=stdout[:MAX_STDOUT])

    stdout = executed.stdout[:MAX_STDOUT]
    if executed.returncode != 0:
        code = executed.returncode
        stderr = executed.stderr.strip()
        if code < 0:
            sig = -code
            if sig == signal.SIGABRT:
                what = re.search(r"what\(\):\s*(.*)", stderr)
                message = f"Uncaught exception: {what.group(1)}" if what else "Your program aborted."
            else:
                message = SIGNAL_MESSAGES.get(sig, f"Your program was killed by signal {sig}.")
        else:
            message = f"Your program exited with status {code}."
        return failure("Runtime Error", message, started, traceback=stderr[-4000:] or None, stdout=stdout)

    try:
        with open(result_path, encoding="utf8") as handle:
            result = json.loads(handle.read())
    except (OSError, json.JSONDecodeError):
        return failure(
            "Platform Error",
            "The sandbox could not read a result from your program.",
            started,
            traceback=executed.stderr[-2000:] or None,
            stdout=stdout,
        )

    return {
        "ok": True,
        "result": result,
        "stdout": stdout,
        "runtimeMs": int((time.perf_counter() - started) * 1000),
    }


def trace_case(payload, budget_s):
    """Run case 0 under gdb and return (steps, truncated, note)."""
    if os.path.exists(TRACE_PATH):
        os.remove(TRACE_PATH)
    env = dict(
        os.environ,
        NF_TRACE_OUT=TRACE_PATH,
        NF_STEP_LIMIT=str(int(payload.get("stepLimit", 1500))),
        NF_VIS_LIMIT=str(int(payload.get("visualizeLimit", 64))),
        NF_TIME_BUDGET=str(budget_s),
        NF_STDOUT="/dev/null",
        NF_RESULT=os.path.join(WORK_DIR, "trace_result.json"),
    )
    try:
        subprocess.run(
            ["gdb", "-nx", "-batch", "-q", "-x", "/runner/gdb_tracer.py", "--args", BINARY_PATH, "0"],
            capture_output=True,
            text=True,
            timeout=budget_s + 8,
            env=env,
        )
    except subprocess.TimeoutExpired:
        pass
    try:
        with open(TRACE_PATH, encoding="utf8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return [], False, "The C++ tracer could not record this run."
    return data.get("steps", []), bool(data.get("truncated")), data.get("note")


def run(payload):
    started = time.perf_counter()
    os.makedirs(WORK_DIR, exist_ok=True)
    batch = "cases" in payload
    cases = [case.get("input") or {} for case in payload["cases"]] if batch else [payload.get("input") or {}]
    case_timeout = int(payload.get("caseTimeoutMs", 3000)) / 1000

    try:
        source = generate_source(payload, cases)
    except (ValueError, KeyError, TypeError) as error:
        return failure("Platform Error", f"Could not prepare this problem for C++: {error}", started)

    with open(SOURCE_PATH, "w", encoding="utf8") as handle:
        handle.write(source)

    compile_error = compile_source(started)
    if compile_error:
        if not batch:
            compile_error["trace"] = []
        return compile_error

    if batch:
        return {"ok": True, "cases": [run_case(index, case_timeout) for index in range(len(cases))]}

    outcome = run_case(0, case_timeout)
    steps, truncated, note = [], False, None
    if payload.get("trace", True) and outcome.get("errorType") != "Time Limit Exceeded":
        steps, truncated, note = trace_case(payload, budget_s=20)
    elif outcome.get("errorType") == "Time Limit Exceeded" and payload.get("trace", True):
        # A runaway loop still gets a partial replay, bounded by the step budget.
        steps, truncated, note = trace_case(payload, budget_s=8)

    outcome["trace"] = delta_encode(steps)
    outcome["heapMode"] = "delta"
    if outcome["ok"]:
        outcome["stepsCaptured"] = len(steps)
        if truncated:
            outcome["traceTruncated"] = True
        if note:
            outcome["traceNote"] = note
    elif steps and not outcome.get("line"):
        outcome["line"] = steps[-1].get("line")
    return outcome


if __name__ == "__main__":
    try:
        response = run(json.loads(sys.stdin.read()))
    except Exception as error:  # noqa: BLE001 - last-resort guard, must stay JSON
        response = {"ok": False, "errorType": "Platform Error", "message": f"C++ harness failed: {error}"}
    sys.stdout.write(dumps(response))
