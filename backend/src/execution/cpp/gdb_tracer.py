"""Records a line-by-line trace of the user's C++ code. Runs inside gdb (-x).

The harness calls nf_enter() right before each call into user code. We stop
there, step into the user's function, and then `step` line by line. Library
code is skipped by name (`skip -rfu ^std::`); harness helpers are stepped out of, so
every recorded stop is a user line. Each stop is serialised in the same shape as the Python
tracer: {line, event, variables, heap, stack?}.
"""

import glob
import json
import os
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
USER_FILE = "user.cpp"
MAX_OBJECTS = 160
MAX_STRING = 240
CHAR_NAMES = {"char", "signed char", "unsigned char"}


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
            target = t.target().strip_typedefs()
            if target.code in (gdb.TYPE_CODE_STRUCT, gdb.TYPE_CODE_UNION):
                return self.struct(v.dereference(), address)
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
        name = t.tag or t.name or "struct"
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
            steps.append(capture(frame, "line"))
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
