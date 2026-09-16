"""Builds problem batches into data/problems/*.json.

    python problem-src/build.py b01_math          one batch
    python problem-src/build.py all               every batch module (bNN_*.py)

For each problem: runs the reference solution locally (same harness as the
sandbox) on every example and test input, checks the hand-written example
outputs, and fills in the hidden cases' expected outputs. Then run
`npm run verify:problems -- --file data/problems/<batch>.json` to re-check
everything inside the real sandbox.
"""

import importlib
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(BACKEND, "src", "execution", "python"))
sys.path.insert(0, os.path.join(BACKEND, "src", "execution", "common"))

import dsl  # noqa: E402
import tracer  # noqa: E402

OUT_DIR = os.path.join(BACKEND, "data", "problems")
REVIEWED_AT = "2026-09-16"
STRUCTURES = {"array", "string", "matrix", "linked_list", "stack", "queue", "hashmap", "tree", "heap", "graph", "trie", "number"}


def canon(value, mode):
    if mode == "unordered" and isinstance(value, list):
        return sorted(value, key=lambda item: json.dumps(item, sort_keys=True))
    if mode == "unordered_deep" and isinstance(value, list):
        return sorted((canon(item, mode) for item in value), key=lambda item: json.dumps(item, sort_keys=True))
    return value


def matches(actual, expected, mode):
    if mode == "float":
        if isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
            return math.isclose(actual, expected, rel_tol=1e-5, abs_tol=1e-5)
        if isinstance(actual, list) and isinstance(expected, list):
            return len(actual) == len(expected) and all(matches(a, e, mode) for a, e in zip(actual, expected))
        return actual == expected
    return json.dumps(canon(actual, mode), sort_keys=True) == json.dumps(canon(expected, mode), sort_keys=True)


def payload_for(p, inputs):
    return {
        "code": p["ref"],
        "entrypoint": p["fn"],
        "parameters": p["params"],
        "returnKind": p["ret"],
        "sharedTail": p["shared_tail"],
        "design": p["design"],
        "cases": [{"input": case} for case in inputs],
        "caseTimeoutMs": 0,
    }


def build_problem(p):
    errors = []
    if p["structure"] not in STRUCTURES:
        errors.append(f"unknown structure {p['structure']}")
    if len(p["examples"]) < 2:
        errors.append("needs at least two examples")
    if len(p["tests"]) < 3:
        errors.append("needs at least three hidden tests")
    if not p["design"]:
        for example in p["examples"]:
            missing = [param["name"] for param in p["params"] if param["name"] not in example[0]]
            if missing:
                errors.append(f"example missing inputs {missing}")

    inputs = [example[0] for example in p["examples"]] + list(p["tests"])
    response = tracer.run(payload_for(p, inputs))
    if not response.get("ok"):
        return None, errors + [f"reference failed to run: {response.get('message')}"]

    results = response["cases"]
    for index, result in enumerate(results):
        if not result.get("ok"):
            errors.append(f"case {index} raised {result.get('errorType')}: {result.get('message')}")
    if errors:
        return None, errors

    examples = []
    test_cases = []
    for index, example in enumerate(p["examples"]):
        actual = results[index]["result"]
        if not matches(actual, example[1], p["compare"]):
            errors.append(f"example {index + 1}: written {json.dumps(example[1])} but reference gives {json.dumps(actual)}")
        entry = {"input": example[0], "output": example[1]}
        if len(example) > 2 and example[2]:
            entry["explanation"] = example[2]
        examples.append(entry)
        test_cases.append({"id": f"sample-{index + 1}", "input": example[0], "expectedOutput": example[1], "visible": True})

    offset = len(p["examples"])
    for index, case in enumerate(p["tests"]):
        test_cases.append(
            {
                "id": f"hidden-{index + 1}",
                "input": case,
                "expectedOutput": results[offset + index]["result"],
                "visible": False,
            }
        )

    signature = {"functionName": p["fn"], "parameters": p["params"], "returnKind": p["ret"]}
    if p["compare"] != "exact":
        signature["compare"] = p["compare"]
    if p["shared_tail"]:
        signature["sharedTail"] = p["shared_tail"]
    if p["design"]:
        signature["design"] = p["design"]

    record = {
        "id": p["id"],
        "sourceTitle": p["source"],
        "topic": p["topic"],
        "difficulty": p["difficulty"],
        "structureType": p["structure"],
        "reviewStatus": "verified",
        "reviewedAt": REVIEWED_AT,
        "title": p["title"],
        "description": p["description"],
        "constraints": p["constraints"],
        "examples": examples,
        "signature": signature,
        "starterCode": dsl.python_starter(p),
        "referenceCode": p["ref"],
        "defaultInput": p["default_input"] or p["examples"][0][0],
        "testCases": test_cases,
    }
    if p["notes"]:
        record["reviewNotes"] = p["notes"]
    return record, errors


def build_batch(name):
    dsl.PROBLEMS.clear()
    importlib.import_module(name)
    records = []
    failures = []
    ids = set()
    for p in dsl.PROBLEMS:
        if p["id"] in ids:
            failures.append(f"{p['id']}: duplicate id")
            continue
        ids.add(p["id"])
        record, errors = build_problem(p)
        if errors:
            failures.extend(f"{p['id']}: {error}" for error in errors)
        elif record:
            records.append(record)
    os.makedirs(OUT_DIR, exist_ok=True)
    if not failures:
        with open(os.path.join(OUT_DIR, f"{name}.json"), "w", encoding="utf8") as handle:
            json.dump(records, handle, indent=1)
            handle.write("\n")
    return records, failures


def main():
    names = sys.argv[1:]
    if names == ["all"]:
        names = sorted(file[:-3] for file in os.listdir(HERE) if file.startswith("b") and file.endswith(".py"))
    total = 0
    bad = False
    for name in names:
        records, failures = build_batch(name)
        total += len(records)
        status = "ok" if not failures else "FAILED"
        print(f"{name}: {len(records)} problems {status}")
        for failure in failures:
            print("   ", failure)
        bad = bad or bool(failures)
    print(f"total: {total}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
