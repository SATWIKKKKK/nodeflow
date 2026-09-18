"""Java sandbox harness driver.

Same JSON payload and response shape as the Python tracer (python/tracer.py).
The user's code is compiled as Solution.java against the precompiled NfHarness
(which also defines ListNode, TreeNode, ...). Every case runs in one JVM, each
with its own time budget; traces come from NfTracer (JDI).

Line numbers are preserved exactly: the node classes the starter declares are
blanked out line-for-line, and the default imports are added to line 1.
"""

import json
import os
import re
import subprocess
import sys
import time

sys.path.insert(0, "/runner")
from nf_trace import delta_encode, dumps  # noqa: E402

# Each run gets its own directory when several share one machine (Vercel Sandbox).
WORK_DIR = os.environ.get("NF_WORK_DIR", "/tmp/work")
SOURCE_PATH = os.path.join(WORK_DIR, "Solution.java")
CLASSES_DIR = os.path.join(WORK_DIR, "classes")
SPEC_PATH = os.path.join(WORK_DIR, "spec.json")
RESULTS_PATH = os.path.join(WORK_DIR, "results.jsonl")
TRACE_PATH = os.path.join(WORK_DIR, "trace.json")
HARNESS_CLASSES = "/runner/java/classes"
COMPILE_TIMEOUT = 40
JVM_FLAGS = ["-Xmx256m", "-XX:+UseSerialGC", "-XX:TieredStopAtLevel=1", "-Xshare:auto"]
NODE_CLASSES = ["ListNode", "DListNode", "RandomNode", "ChildNode", "TreeNode"]
DEFAULT_IMPORTS = "import java.util.*; import java.util.function.*; import java.util.stream.*; "


def failure(error_type, message, started, **extra):
    response = {
        "ok": False,
        "errorType": error_type,
        "message": message,
        "runtimeMs": int((time.perf_counter() - started) * 1000),
    }
    response.update({key: value for key, value in extra.items() if value is not None})
    return response


def blank_block(code, pattern):
    while True:
        match = re.search(pattern, code)
        if not match:
            return code
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
            return code
        removed = code[match.start() : end]
        code = code[: match.start()] + "\n" * removed.count("\n") + code[end:]


def prepare_source(code):
    for name in NODE_CLASSES:
        code = blank_block(code, r"(?m)^[ \t]*(?:(?:public|static|final)\s+)*class\s+" + name + r"\b[^{]*\{")
    # Everything lives in Solution.java, so no other top-level type may be public.
    code = re.sub(
        r"(?m)^(\s*)public\s+((?:final\s+|abstract\s+)?(?:class|interface|enum|record)\s+(?!Solution\b))",
        r"\1\2",
        code,
    )
    return DEFAULT_IMPORTS + code


def compile_source(code, started):
    os.makedirs(CLASSES_DIR, exist_ok=True)
    with open(SOURCE_PATH, "w", encoding="utf8") as handle:
        handle.write(prepare_source(code))
    try:
        compiled = subprocess.run(
            [
                "javac",
                "-J-XX:TieredStopAtLevel=1",
                "-J-Xshare:auto",
                "-g",
                "-nowarn",
                "-encoding",
                "UTF-8",
                "-cp",
                HARNESS_CLASSES,
                "-d",
                CLASSES_DIR,
                SOURCE_PATH,
            ],
            capture_output=True,
            text=True,
            timeout=COMPILE_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        return failure("Time Limit Exceeded", "Compilation timed out.", started)

    if compiled.returncode == 0:
        return None
    output = (compiled.stderr or compiled.stdout).replace(WORK_DIR + "/", "")
    match = re.search(r"Solution\.java:(\d+): error: (.*)", output)
    if match:
        return failure(
            "Compile Error",
            f"Line {match.group(1)}: {match.group(2)}",
            started,
            traceback=output[:4000],
            line=int(match.group(1)),
        )
    return failure("Compile Error", "Your Java code did not compile.", started, traceback=output[:4000])


def write_spec(payload, cases):
    spec = {
        "entrypoint": payload["entrypoint"],
        "parameters": payload["parameters"],
        "returnKind": payload["returnKind"],
        "design": payload.get("design"),
        "sharedTail": payload.get("sharedTail"),
        "caseTimeoutMs": int(payload.get("caseTimeoutMs", 4000)),
        "cases": cases,
    }
    with open(SPEC_PATH, "w", encoding="utf8") as handle:
        json.dump(spec, handle)


def run_cases(count, case_timeout_ms, started):
    if os.path.exists(RESULTS_PATH):
        os.remove(RESULTS_PATH)
    budget = 10 + count * (case_timeout_ms / 1000 + 1)
    try:
        subprocess.run(
            ["java", *JVM_FLAGS, "-cp", f"{HARNESS_CLASSES}:{CLASSES_DIR}", "NfHarness", "run", SPEC_PATH, RESULTS_PATH],
            capture_output=True,
            text=True,
            timeout=budget,
        )
    except subprocess.TimeoutExpired:
        pass

    results = []
    try:
        with open(RESULTS_PATH, encoding="utf8") as handle:
            for line in handle:
                line = line.strip()
                if line:
                    results.append(json.loads(line))
    except (OSError, json.JSONDecodeError):
        pass

    for result in results:
        result.pop("timedOut", None)
    # A case that timed out stops the run; later cases are reported as not reached.
    while len(results) < count:
        results.append(failure("Time Limit Exceeded", "Your code ran longer than the time limit.", started))
    return results


def trace_case(payload, budget_ms):
    if os.path.exists(TRACE_PATH):
        os.remove(TRACE_PATH)
    try:
        subprocess.run(
            [
                "java",
                *JVM_FLAGS,
                "-cp",
                HARNESS_CLASSES,
                "NfTracer",
                f"{HARNESS_CLASSES}:{CLASSES_DIR}",
                SPEC_PATH,
                TRACE_PATH,
                str(int(payload.get("stepLimit", 1500))),
                str(int(payload.get("visualizeLimit", 64))),
                str(budget_ms),
            ],
            capture_output=True,
            text=True,
            timeout=budget_ms / 1000 + 10,
        )
    except subprocess.TimeoutExpired:
        pass
    try:
        with open(TRACE_PATH, encoding="utf8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return [], False, "The Java tracer could not record this run."
    return data.get("steps", []), bool(data.get("truncated")), data.get("note")


def run(payload):
    started = time.perf_counter()
    os.makedirs(WORK_DIR, exist_ok=True)
    batch = "cases" in payload
    cases = [case.get("input") or {} for case in payload["cases"]] if batch else [payload.get("input") or {}]
    case_timeout_ms = int(payload.get("caseTimeoutMs", 4000))

    compile_error = compile_source(payload["code"], started)
    if compile_error:
        if not batch:
            compile_error["trace"] = []
        return compile_error

    write_spec(payload, cases)
    results = run_cases(len(cases), case_timeout_ms, started)
    if batch:
        return {"ok": True, "cases": results}

    outcome = results[0]
    steps, truncated, note = [], False, None
    if payload.get("trace", True):
        timed_out = outcome.get("errorType") == "Time Limit Exceeded"
        steps, truncated, note = trace_case(payload, budget_ms=8000 if timed_out else 20000)

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
        response = {"ok": False, "errorType": "Platform Error", "message": f"Java harness failed: {error}"}
    sys.stdout.write(dumps(response))
