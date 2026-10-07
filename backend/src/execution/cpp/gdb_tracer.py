"""Records a line-by-line trace of the user's C++ or C code. Runs inside gdb (-x).

The harness calls nf_enter() right before each call into user code. We stop
there, step into the user's function, and then `step` line by line. Library
code is skipped by name (`skip -rfu ^std::`); harness helpers are stepped out of, so
every recorded stop is a user line. Each stop is serialised in the same shape as the Python
tracer: {line, event, variables, heap, stack?}.

C (NF_LANG=c) differs in one way that matters: an array is only a pointer.
The C harness notes the size of every block malloc hands out (c/runner.py),
so a pointer to the start of one is drawn as that many cells; `char*` is
drawn as the string it points to; a pointer into the middle of a block, or to
a single value, shows the value it points at.
"""

import glob
import json
import struct
import os
import re
import signal
import sys
import threading
import time

import gdb  # noqa: E402 - provided by gdb

# gcc's own image keeps the libstdc++ printers under /usr/local; Debian/Ubuntu under /usr/share.
for printers_path in glob.glob("/usr/local/share/gcc-*/python") + glob.glob("/usr/share/gcc*/python"):
    sys.path.insert(0, printers_path)
try:
    from libstdcxx.v6.printers import register_libstdcxx_printers

    register_libstdcxx_printers(None)
except Exception:  # noqa: BLE001 - containers fall back to raw fields
    pass

OUT_PATH = os.environ.get("NF_TRACE_OUT", "/tmp/work/trace.json")
STEP_LIMIT = int(os.environ.get("NF_STEP_LIMIT", "1500"))
VIS_LIMIT = int(os.environ.get("NF_VIS_LIMIT", "64"))
TIME_BUDGET = float(os.environ.get("NF_TIME_BUDGET", "20"))
USER_FILE = os.environ.get("NF_USER_FILE", "user.cpp")
IS_C = os.environ.get("NF_LANG") == "c"

try:
    with open(os.environ.get("NF_USER_SOURCE", ""), encoding="utf8") as _handle:
        USER_LINES = _handle.read().split("\n")
except OSError:
    USER_LINES = []


def is_closing_brace(line):
    """A stop on a bare `}` runs nothing the learner wrote.

    What it does show is the frame on its way out. A local returned by value
    has already been moved into the caller by then, so a vector that held the
    answer one line earlier is drawn empty — the replay's last frame says the
    result was lost at the very moment it was returned. Skipping the stop
    keeps the last thing shown the last thing that was true.
    """
    if not 1 <= line <= len(USER_LINES):
        return False
    return USER_LINES[line - 1].strip() in ("}", "};")
# --- freed memory ---------------------------------------------------------
#
# After `delete head`, the pointer still holds the old address and gdb reads
# whatever the allocator left there: a garbage value and a `next` into
# nowhere, drawn as if it were a real node. So the address a line frees is
# noted before the line runs, and a pointer to it is shown as deleted rather
# than followed. A later `new` may hand that memory out again, and there is
# no telling which block it reused, so any allocation clears the list: a live
# node is never hidden, at the cost of a dangling pointer kept past a later
# `new` being followed again (rare in practice).
FREES = re.compile(r"\bdelete\s*(?:\[\s*\])?\s*([^;]+?)\s*;|\bfree\s*\(\s*([^;]+?)\s*\)\s*;")
ALLOCATES = re.compile(r"\bnew\b|\b(?:malloc|calloc|realloc)\s*\(")
freed_addresses = set()
DELETED = "<deleted>"


def note_frees(frame, line):
    """Before `line` runs: remember what it frees, or forget everything if it allocates."""
    if not 1 <= line <= len(USER_LINES):
        return
    text = USER_LINES[line - 1].split("//")[0]
    if ALLOCATES.search(text):
        freed_addresses.clear()
    for match in FREES.finditer(text):
        expression = (match.group(1) or match.group(2) or "").strip()
        if not expression:
            continue
        try:
            value = frame.read_var(expression) if re.fullmatch(r"[A-Za-z_]\w*", expression) else gdb.parse_and_eval(expression)
            address = int(value)
        except (gdb.error, RuntimeError, ValueError, OverflowError):
            continue
        if address:
            freed_addresses.add(address)


MAX_OBJECTS = 160
MAX_STRING = 240
CHAR_NAMES = {"char", "signed char", "unsigned char"}


def c_scalar(t):
    return t.code in (gdb.TYPE_CODE_INT, gdb.TYPE_CODE_FLT, gdb.TYPE_CODE_BOOL, gdb.TYPE_CODE_CHAR, gdb.TYPE_CODE_ENUM)


class Allocations:
    """C only: the harness's table of live malloc'd blocks, read once per step."""

    def __init__(self):
        self.available = IS_C
        self.sizes = {}

    def refresh(self):
        self.sizes = {}
        if not self.available:
            return
        try:
            count = int(gdb.parse_and_eval("nf_alloc_count"))
            if count <= 0:
                return
            count = min(count, 16384)
            inferior = gdb.selected_inferior()
            pointers = int(gdb.parse_and_eval("(unsigned long)&nf_alloc_ptr[0]"))
            lengths = int(gdb.parse_and_eval("(unsigned long)&nf_alloc_len[0]"))
            raw_pointers = bytes(inferior.read_memory(pointers, 8 * count))
            raw_lengths = bytes(inferior.read_memory(lengths, 8 * count))
            for address, length in zip(struct.unpack(f"<{count}Q", raw_pointers), struct.unpack(f"<{count}Q", raw_lengths)):
                self.sizes[address] = length
        except (gdb.error, gdb.MemoryError, RuntimeError, ValueError, struct.error):
            self.sizes = {}


allocations = Allocations()


def run(command):
    return gdb.execute(command, to_string=True)


watchdog = {"fired": False}


def guarded(command, seconds=1.5):
    """Run a stepping command, interrupting the program if it never comes back.

    `step` on a line that loops onto itself (`while (true) { i++; }`) would
    otherwise block forever; SIGINT makes gdb stop wherever the program is.
    """
    pid = gdb.selected_inferior().pid

    def interrupt():
        watchdog["fired"] = True
        try:
            os.kill(pid, signal.SIGINT)
        except OSError:
            pass

    timer = threading.Timer(seconds, interrupt)
    timer.start()
    try:
        return run(command)
    finally:
        timer.cancel()


for setting in (
    "set pagination off",
    "set confirm off",
    "set print pretty off",
    "set disable-randomization off",
    "set startup-with-shell off",
    "set step-mode off",
    "set width 0",
    # Library code is skipped by function name. A file glob (`skip -gfi /usr/*`)
    # makes gdb 17 step over user functions too, so it is not used.
    "skip -rfu ^std::",
    "skip -rfu ^__gnu_cxx::",
    # Harness helpers (nf_*) are not skipped: gdb 17 treats `step` inside a skipped
    # frame like `finish`, which would jump out of nf_case_* before the user call.
    # main() steps out of helpers itself.
):
    try:
        run(setting)
    except gdb.error:
        pass

stop_state = {"signal": None}


def on_stop(event):
    if isinstance(event, gdb.SignalEvent):
        stop_state["signal"] = event.stop_signal


gdb.events.stop.connect(on_stop)


def in_user_code(frame):
    try:
        sal = frame.find_sal()
    except gdb.error:
        return False
    return sal.symtab is not None and os.path.basename(sal.symtab.filename) == USER_FILE


def alive():
    inferior = gdb.selected_inferior()
    return inferior is not None and inferior.pid != 0 and len(inferior.threads()) > 0


class Serializer:
    def __init__(self):
        self.ids = {}
        self.next_id = 1
        self.heap = {}
        self.active = set()

    def reset(self):
        self.heap = {}
        self.active = set()

    def ref(self, key):
        if key not in self.ids:
            self.ids[key] = f"obj_{self.next_id}"
            self.next_id += 1
        return self.ids[key]

    # -- entry point --------------------------------------------------------

    def value(self, v):
        try:
            return self._value(v)
        except (gdb.error, gdb.MemoryError, RuntimeError, ValueError, OverflowError):
            return "<unreadable>"

    def _value(self, v):
        if not isinstance(v, gdb.Value):
            if isinstance(v, (int, float, bool, str)) or v is None:
                return v
            return str(v)[:MAX_STRING]

        t = v.type.strip_typedefs()
        code = t.code

        if code in (gdb.TYPE_CODE_REF, gdb.TYPE_CODE_RVALUE_REF):
            return self._value(v.referenced_value())
        if code == gdb.TYPE_CODE_BOOL:
            return bool(v)
        if code == gdb.TYPE_CODE_CHAR or (code == gdb.TYPE_CODE_INT and t.sizeof == 1 and (t.name or "") in CHAR_NAMES):
            byte = int(v) & 0xFF
            return chr(byte) if 32 <= byte < 127 else f"\\x{byte:02x}"
        if code in (gdb.TYPE_CODE_INT, gdb.TYPE_CODE_ENUM):
            return int(v)
        if code == gdb.TYPE_CODE_FLT:
            number = float(v)
            if number != number:
                return "nan"
            if number in (float("inf"), float("-inf")):
                return "inf" if number > 0 else "-inf"
            return number
        if code == gdb.TYPE_CODE_PTR:
            address = int(v)
            if address == 0:
                return None
            if address in freed_addresses:
                return DELETED
            target = t.target().strip_typedefs()
            if target.code in (gdb.TYPE_CODE_STRUCT, gdb.TYPE_CODE_UNION):
                return self.struct(v.dereference(), address)
            if IS_C:
                return self.c_pointer(v, address, target)
            return f"0x{address:x}"
        if code == gdb.TYPE_CODE_ARRAY:
            low, high = t.range()
            count = high - low + 1
            key = (int(v.address) if v.address is not None else id(v), "array")
            return self.container(key, "list", [v[low + i] for i in range(min(count, VIS_LIMIT))], max(0, count - VIS_LIMIT))
        if code in (gdb.TYPE_CODE_STRUCT, gdb.TYPE_CODE_UNION):
            name = t.tag or t.name or ""
            if name.startswith("std::__cxx11::basic_string<char") or name.startswith("std::basic_string<char"):
                return self.string(v)
            if name.startswith("std::vector<") and not name.startswith("std::vector<bool"):
                return self.vector(v)
            if name.startswith("std::pair<"):
                key = (int(v.address) if v.address is not None else id(v), name)
                return self.container(key, "tuple", [v["first"], v["second"]], 0)
            if name.startswith("std::"):
                return self.std_container(v, name)
            address = int(v.address) if v.address is not None else id(v)
            return self.struct(v, address)
        return str(v)[:MAX_STRING]

    # -- C pointers -----------------------------------------------------------

    def c_pointer(self, v, address, target):
        size = allocations.sizes.get(address)
        if target.code == gdb.TYPE_CODE_CHAR or (target.code == gdb.TYPE_CODE_INT and target.sizeof == 1):
            return self.c_string(address, size)
        if target.sizeof <= 0 or not (c_scalar(target) or target.code == gdb.TYPE_CODE_PTR):
            return f"0x{address:x}"
        if size is None:
            # Not the start of a block: a pointer to one value, or into an array.
            return self._value(v.dereference())
        count = size // target.sizeof
        key = (address, "array")
        items = [(v + index).dereference() for index in range(min(count, VIS_LIMIT))]
        return self.container(key, "list", items, max(0, count - VIS_LIMIT))

    def c_string(self, address, size):
        limit = MAX_STRING if size is None else min(MAX_STRING, size)
        try:
            raw = bytes(gdb.selected_inferior().read_memory(address, max(1, limit)))
        except (gdb.error, gdb.MemoryError):
            return f"0x{address:x}"
        end = raw.find(b"\x00")
        text = (raw if end < 0 else raw[:end]).decode("utf8", "replace")
        return text + ("…" if end < 0 and size is None else "")

    # -- shapes ---------------------------------------------------------------

    def string(self, v):
        length = int(v["_M_string_length"])
        pointer = v["_M_dataplus"]["_M_p"]
        text = pointer.string(length=min(length, MAX_STRING), errors="replace")
        return text + ("…" if length > MAX_STRING else "")

    def vector(self, v):
        impl = v["_M_impl"]
        start = impl["_M_start"]
        finish = impl["_M_finish"]
        count = int(finish - start) if int(start) else 0
        key = (int(v.address) if v.address is not None else id(v), "vector")
        items = [(start + index).dereference() for index in range(min(count, VIS_LIMIT))]
        return self.container(key, "list", items, max(0, count - VIS_LIMIT))

    def std_container(self, v, name):
        key = (int(v.address) if v.address is not None else id(v), name.split("<")[0])
        visualizer = gdb.default_visualizer(v)
        if visualizer is None or not hasattr(visualizer, "children"):
            return self.struct(v, key[0])

        hint = visualizer.display_hint() if hasattr(visualizer, "display_hint") else None
        base = name.split("<")[0]
        if base in ("std::map", "std::unordered_map", "std::multimap", "std::unordered_multimap"):
            kind = "dict"
        elif base in ("std::set", "std::unordered_set", "std::multiset", "std::unordered_multiset"):
            kind = "set"
        elif base == "std::stack":
            kind = "stack"
        elif base == "std::queue":
            kind = "queue"
        elif base == "std::priority_queue":
            kind = "heap"
        elif base == "std::deque":
            kind = "deque"
        elif hint == "map":
            kind = "dict"
        else:
            kind = "list"

        children = []
        limit = VIS_LIMIT * (2 if kind == "dict" else 1)
        extra = 0
        try:
            for index, (_, child) in enumerate(visualizer.children()):
                if index >= limit:
                    extra += 1
                    if extra > 1000:
                        break
                    continue
                children.append(child)
        except (gdb.error, gdb.MemoryError, RuntimeError, TypeError):
            pass

        if kind == "dict":
            return self.mapping(key, children, extra // 2)
        return self.container(key, kind, children, extra)

    def container(self, key, kind, items, truncated):
        ref = self.ref(key)
        if ref in self.heap or ref in self.active or len(self.heap) >= MAX_OBJECTS:
            return ref
        self.active.add(ref)
        self.heap[ref] = {
            "type": kind,
            "items": [self.value(item) for item in items],
            "truncated": truncated,
        }
        self.active.discard(ref)
        return ref

    def mapping(self, key, flat, truncated):
        ref = self.ref(key)
        if ref in self.heap or ref in self.active or len(self.heap) >= MAX_OBJECTS:
            return ref
        self.active.add(ref)
        fields = {}
        for index in range(0, len(flat) - 1, 2):
            map_key = self.value(flat[index])
            fields[str(map_key)] = self.value(flat[index + 1])
        self.heap[ref] = {"type": "dict", "fields": fields, "truncated": truncated}
        self.active.discard(ref)
        return ref

    def struct(self, v, address):
        t = v.type.strip_typedefs()
        # `typedef struct { ... } MinStack;` has no tag: the typedef names it.
        name = t.tag or t.name or v.type.name or "struct"
        ref = self.ref((address, name))
        if ref in self.heap or ref in self.active or len(self.heap) >= MAX_OBJECTS:
            return ref
        self.active.add(ref)
        fields = {}
        self.collect_fields(v, t, fields)
        self.heap[ref] = {"type": name.split("::")[-1], "fields": fields}
        self.active.discard(ref)
        return ref

    def collect_fields(self, v, t, fields):
        for field in t.fields():
            if field.is_base_class:
                try:
                    self.collect_fields(v[field], field.type.strip_typedefs(), fields)
                except gdb.error:
                    pass
                continue
            if not field.name or field.artificial or not hasattr(field, "bitpos"):
                continue
            if field.name.startswith("_vptr"):
                continue
            try:
                fields[field.name] = self.value(v[field.name])
            except gdb.error:
                fields[field.name] = "<unreadable>"


serializer = Serializer()
max_line_seen = {}


def frame_key(frame):
    try:
        return (frame.name(), int(frame.read_register("rbp")))
    except (gdb.error, ValueError):
        return (frame.name(), 0)


def frame_variables(frame, line):
    try:
        block = frame.block()
    except RuntimeError:
        return {}
    key = frame_key(frame)
    visited_beyond = max_line_seen.get(key, 0) > line
    seen = set()
    collected = []
    while block is not None:
        for symbol in block:
            if not (symbol.is_argument or symbol.is_variable):
                continue
            name = symbol.name
            if name in seen or name.startswith("__") or name.startswith("nf_"):
                continue
            if not symbol.is_argument:
                # Not declared yet on this path through the function.
                if symbol.line > line or (symbol.line == line and not visited_beyond):
                    continue
            seen.add(name)
            collected.append(symbol)
        if block.function is not None:
            break
        block = block.superblock

    collected.sort(key=lambda symbol: (0 if symbol.is_argument else 1, symbol.line))
    variables = {}
    for symbol in collected:
        try:
            variables[symbol.name] = serializer.value(symbol.value(frame))
        except (gdb.error, RuntimeError):
            continue
    return variables


def capture(frame, event):
    serializer.reset()
    allocations.refresh()
    frames = []
    current = frame
    while current is not None and in_user_code(current):
        frames.append(current)
        current = current.older()
    frames.reverse()

    line = frame.find_sal().line
    top = frame_variables(frame, line)
    step = {"line": line, "event": event, "variables": top, "heap": None}
    if len(frames) > 1:
        stack = []
        for entry in frames:
            entry_line = entry.find_sal().line
            variables = top if entry == frame else frame_variables(entry, entry_line)
            stack.append({"function": (entry.name() or "?").split("(")[0], "line": entry_line, "variables": variables})
        step["stack"] = stack
    step["heap"] = serializer.heap

    key = frame_key(frame)
    max_line_seen[key] = max(max_line_seen.get(key, 0), line)
    return step


def is_case_frame(frame):
    return (frame.name() or "").startswith("nf_case_")


def older_frames(frame):
    current = frame.older()
    while current is not None:
        yield current
        current = current.older()


def older_user_frame(frame):
    current = frame.older()
    while current is not None:
        if in_user_code(current):
            return True
        current = current.older()
    return False


last_key = {"value": None}


def main():
    started = time.time()
    steps = []
    truncated = False
    note = None

    try:
        run("break nf_enter")
        run("run")
    except gdb.error as error:
        note = f"gdb could not start the program: {error}"

    guard = 0
    while note is None and alive():
        guard += 1
        if guard > STEP_LIMIT * 20:
            truncated = True
            break
        if time.time() - started > TIME_BUDGET:
            truncated = True
            break
        try:
            frame = gdb.selected_frame()
        except gdb.error:
            break

        if watchdog["fired"]:
            if in_user_code(frame) and len(steps) < STEP_LIMIT:
                steps.append(capture(frame, "line"))
            truncated = True
            note = "Tracing stopped: one line kept running without finishing, which usually means an infinite loop."
            break

        if stop_state["signal"]:
            if in_user_code(frame):
                steps.append(capture(frame, "exception"))
            break

        if frame.name() == "nf_enter":
            try:
                guarded("finish")
                guarded("step")
            except gdb.error:
                break
            continue

        if in_user_code(frame):
            if len(steps) >= STEP_LIMIT:
                truncated = True
                break
            sal = frame.find_sal()
            current_line = sal.line
            # Coming back from a helper (malloc, a library call) lands mid-line,
            # on a line just recorded: that is the same line, not a new step.
            repeat = (
                steps
                and steps[-1]["line"] == current_line
                and last_key["value"] == frame_key(frame)
                and sal.pc != frame.pc()
            )
            if not is_closing_brace(current_line) and not repeat:
                steps.append(capture(frame, "line"))
                last_key["value"] = frame_key(frame)
            note_frees(frame, current_line)
            try:
                guarded("step")
            except gdb.error:
                break
            continue

        try:
            if older_user_frame(frame):
                guarded("finish")
            elif is_case_frame(frame):
                # Inside the harness case: step until the call reaches user code.
                # (Newer gdb/gcc leave `finish` mid-line, so one step is not enough.)
                guarded("step")
            elif any(is_case_frame(older) for older in older_frames(frame)):
                # A library or harness helper the case called (input builders, output).
                guarded("finish")
            else:
                # Harness code between calls (design problems make several).
                guarded("continue", seconds=4)
        except gdb.error:
            break

    try:
        if alive():
            run("kill")
    except gdb.error:
        pass

    with open(OUT_PATH, "w", encoding="utf8") as handle:
        json.dump({"steps": steps, "truncated": truncated, "note": note}, handle)


main()
