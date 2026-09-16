"""Helpers shared by every sandbox harness (Python, C++, Java).

Traces leave the sandbox delta-encoded: each step carries only the heap objects
that changed since the previous step plus the ids that disappeared. A loop over
a 64-cell array would otherwise resend the whole array on every line.
"""

import json
import math


def jsonable(value):
    """Make a value safe for json.dumps (no NaN/inf, no tuples/sets)."""
    if isinstance(value, float):
        if math.isnan(value):
            return "nan"
        if math.isinf(value):
            return "inf" if value > 0 else "-inf"
        return value
    if isinstance(value, (list, tuple)):
        return [jsonable(item) for item in value]
    if isinstance(value, (set, frozenset)):
        items = [jsonable(item) for item in value]
        try:
            return sorted(items)
        except TypeError:
            return items
    if isinstance(value, dict):
        return {str(key): jsonable(entry) for key, entry in value.items()}
    return value


def delta_encode(steps):
    """Rewrite full-heap steps in place as heap deltas. Returns the same list."""
    previous = {}
    for step in steps:
        heap = step.get("heap") or {}
        current = {}
        changed = {}
        for ref, obj in heap.items():
            encoded = json.dumps(obj, sort_keys=True)
            current[ref] = encoded
            if previous.get(ref) != encoded:
                changed[ref] = obj
        removed = [ref for ref in previous if ref not in current]
        step["heap"] = changed
        if removed:
            step["removed"] = removed
        previous = current
    return steps


def dumps(payload):
    return json.dumps(payload, separators=(",", ":"))
