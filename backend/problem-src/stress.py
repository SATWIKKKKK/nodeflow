"""Stress cases for Submit: about a hundred generated inputs per problem.

    python problem-src/stress.py all              every problem in data/problems
    python problem-src/stress.py two-sum lru-cache    just these ids

Writes data/stress/<batch>.json: {problem id: [{id, input, expectedOutput}]}.
Submit judges these after the hand-written cases, the way LeetCode judges a
few visible cases and then a long hidden suite.

A generated input is only kept when it is as safe as a hand-written one:

  - it keeps every property that *all* of the problem's hand-written inputs
    share, from a fixed catalogue (lengths and value ranges, sortedness,
    distinct values, BST and heap shape, index and membership relations
    between parameters, DAGs, connected graphs, interval shapes, ...);
  - the reference solution answers it quickly and without raising;
  - the answer looks like the hand-written answers (same type, never null,
    empty or negative when they never are, fits the return type);
  - inputs stay within the sizes the hand-written cases already use, so a
    stress case can never be the one that times a correct solution out.

Problems whose statements promise something the catalogue cannot check
("exactly one peak", "one value repeats and one is missing") are in SKIP and
keep their hand-written cases only. Generation is seeded by problem id, so a
rebuild gives the same cases.
"""

import copy
import hashlib
import json
import math
import os
import random
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
BANK_DIR = os.path.join(BACKEND, "data", "problems")
OUT_DIR = os.path.join(BACKEND, "data", "stress")
TRACER = os.path.join(BACKEND, "src", "execution", "python", "tracer.py")
COMMON = os.path.join(BACKEND, "src", "execution", "common")

TARGET = 100
MAX_ATTEMPTS = 6000
#: A reference slower than this on a case means the case is too big to be fair.
REF_LIMIT_MS = 250
CHUNK = 40
CHUNK_TIMEOUT_S = 20

INT32 = 2**31
INT64 = 2**63

# Promises the invariant catalogue cannot see. These keep their hand-written cases.
SKIP = {
    "missing-number": "n distinct values from 0..n with one missing",
    "majority-element": "a majority element always exists",
    "find-peak-element": "exactly one peak",
    "find-peak-grid": "exactly one peak",
    "sudoku-solver": "a unique solution",
    "single-number": "every other value appears twice",
    "single-number-ii": "every other value appears three times",
    "single-number-iii": "exactly two values appear once",
    "repeating-and-missing": "one value repeats and one is missing",
    "print-shortest-path": "the shortest path is unique",
    "recover-bst": "exactly two values were swapped",
    "build-tree-preorder-inorder": "both arrays traverse the same tree",
    "build-tree-postorder-inorder": "both arrays traverse the same tree",
    "bst-from-preorder": "the array is a BST preorder",
    "floyd-warshall": "a weight matrix with no negative cycles",
    "minimum-platforms": "times are HHMM clock values",
    "accounts-merge": "accounts sharing an email share a name",
    "unique-tree-requirements": "inputs are traversal names",
    "matrix-median": "an odd number of cells",
    "distance-nearest-one": "at least one 1",
    "shortest-distance-binary-maze": "source and destination are open cells",
    "flatten-multilevel-list": "each column is sorted",
    "intersection-y-linked-lists": "a shared tail",
    "copy-random-list": "random indices point into the list",
    "implement-min-heap": "changeKey only gets valid indices",
    "implement-max-heap": "changeKey only gets valid indices",
    "kth-largest-stream": "add is only called once k values exist",
    "bst-iterator": "next is only called while values remain",
    "serialize-deserialize-tree": "deserialize only gets serialized trees",
    "disjoint-set": "every element index is below n",
    "implement-trie-ii": "erase only gets words that are present",
}

SUPPORTED = {
    "int", "long", "double", "bool", "string", "array", "long_array", "double_array", "bool_array",
    "linked_list", "doubly_linked_list", "string_array", "matrix", "char_matrix", "tree", "graph",
    "cyclic_list",
}
SEQ_KINDS = {"array", "long_array", "double_array", "bool_array", "linked_list", "doubly_linked_list"}
INT_KINDS = {"int", "long"}


# ---------------------------------------------------------------- small helpers


def dumps(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def is_num(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def is_sorted(values, strict=False):
    return all(a < b if strict else a <= b for a, b in zip(values, values[1:]))


def size_of(kind, value):
    """The sizes an int parameter might be measured against."""
    if value is None:
        return {}
    if kind in SEQ_KINDS or kind in ("string", "string_array"):
        return {"len": len(value)}
    if kind == "cyclic_list":
        return {"len": len(value.get("values") or [])}
    if kind in ("matrix", "char_matrix"):
        sizes = {"rows": len(value)}
        if value and all(isinstance(row, list) and len(row) == len(value[0]) for row in value):
            sizes["cols"] = len(value[0])
        return sizes
    if kind == "tree":
        return {"nodes": sum(1 for item in value if item is not None)}
    if kind == "graph":
        return {"nodes": len(value)}
    return {}


def members_of(kind, value):
    """The values an int parameter might be required to be (or not be) one of."""
    if value is None:
        return None
    if kind in SEQ_KINDS:
        return set(value)
    if kind == "cyclic_list":
        return set(value.get("values") or [])
    if kind == "tree":
        return {item for item in value if item is not None}
    if kind == "matrix" and all(isinstance(row, list) for row in value):
        return {item for row in value for item in row if is_num(item)}
    return None


# ---------------------------------------------------------------- tree helpers


class Node:
    __slots__ = ("val", "left", "right")

    def __init__(self, val):
        self.val = val
        self.left = None
        self.right = None


def parse_tree(values):
    if not values or values[0] is None:
        return None
    root = Node(values[0])
    queue = [root]
    index = 1
    head = 0
    while head < len(queue) and index < len(values):
        node = queue[head]
        head += 1
        for side in ("left", "right"):
            if index < len(values) and values[index] is not None:
                child = Node(values[index])
                setattr(node, side, child)
                queue.append(child)
            index += 1
    return root


def level_order(root):
    if root is None:
        return []
    out = []
    queue = [root]
    head = 0
    while head < len(queue):
        node = queue[head]
        head += 1
        if node is None:
            out.append(None)
            continue
        out.append(node.val)
        queue.append(node.left)
        queue.append(node.right)
    while out and out[-1] is None:
        out.pop()
    return out


def inorder(root):
    out, stack, node = [], [], root
    while stack or node:
        while node:
            stack.append(node)
            node = node.left
        node = stack.pop()
        out.append(node.val)
        node = node.right
    return out


def is_bst(values):
    order = inorder(parse_tree(values))
    return is_sorted(order, strict=True)


def is_complete(values):
    return None not in values


def random_tree(rng, count, values_for):
    """count nodes in a random shape; values_for(shape_root) assigns values."""
    if count == 0:
        return []
    root = Node(0)
    slots = [(root, "left"), (root, "right")]
    for _ in range(count - 1):
        parent, side = slots.pop(rng.randrange(len(slots)))
        child = Node(0)
        setattr(parent, side, child)
        slots += [(child, "left"), (child, "right")]
    values_for(root)
    return level_order(root)


# ---------------------------------------------------------------- graph helpers


def components(n, edges):
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for u, v in edges:
        if 0 <= u < n and 0 <= v < n:
            parent[find(u)] = find(v)
    return len({find(x) for x in range(n)})


def acyclic(n, edges):
    indegree = [0] * n
    out = [[] for _ in range(n)]
    for u, v in edges:
        if not (0 <= u < n and 0 <= v < n):
            return False
        out[u].append(v)
        indegree[v] += 1
    queue = [x for x in range(n) if indegree[x] == 0]
    seen = 0
    while queue:
        x = queue.pop()
        seen += 1
        for y in out[x]:
            indegree[y] -= 1
            if indegree[y] == 0:
                queue.append(y)
    return seen == n


def adj_edges(adj):
    return [(u, v) for u, row in enumerate(adj) for v in row]


# ---------------------------------------------------------------- profiles
#
# A profile is what every hand-written value of one parameter has in common.
# `check(value)` must hold for a generated value; `make(rng, ctx)` proposes one.


class Numbers:
    """A pool of numbers: their range, and whether they are few enough to be categories."""

    def __init__(self, values):
        values = [value for value in values if is_num(value)]
        self.empty = not values
        self.ints = all(isinstance(value, int) for value in values)
        self.lo = min(values) if values else 0
        self.hi = max(values) if values else 0
        self.pool = sorted(set(values))
        self.categorical = 0 < len(self.pool) <= 6 and len(values) >= 2 * len(self.pool)
        # 0 inside the range but never used ("nonzero divisors", asteroid sizes)
        self.nonzero = self.lo < 0 < self.hi and 0 not in self.pool

    def ok(self, value, lo=None, hi=None):
        if not is_num(value):
            return False
        if self.ints and not isinstance(value, int):
            return False
        if self.categorical and value not in self.pool:
            return False
        if self.nonzero and value == 0:
            return False
        low = self.lo if lo is None else max(self.lo, lo)
        high = self.hi if hi is None else min(self.hi, hi)
        return low <= value <= high

    def sample(self, rng, lo=None, hi=None):
        low = self.lo if lo is None else max(self.lo, lo)
        high = self.hi if hi is None else min(self.hi, hi)
        if low > high:
            return None
        if self.categorical:
            options = [value for value in self.pool if low <= value <= high]
            return rng.choice(options) if options else None
        if not self.ints:
            return round(rng.uniform(low, high), 2)
        roll = rng.random()
        inside = [value for value in self.pool if low <= value <= high]
        if roll < 0.2 and inside:
            value = rng.choice(inside)
        elif roll < 0.3:
            value = rng.choice([low, high, low + 1, high - 1])
        elif roll < 0.55 and high - low > 50:
            # Log-uniform: small magnitudes are as interesting as large ones.
            if low < 0 < high:
                sign = rng.choice([-1, 1])
                reach = high if sign > 0 else -low
                value = sign * (int(math.exp(rng.uniform(0, math.log(reach + 1)))) - 1)
            else:
                value = low + int(math.exp(rng.uniform(0, math.log(high - low + 1)))) - 1
        elif roll < 0.8 and high - low > 30:
            # Clustered near the typical values, so duplicates actually happen.
            centre = rng.choice(inside) if inside else (low + high) // 2
            value = centre + rng.randint(-10, 10)
        else:
            value = rng.randint(low, high)
        value = max(low, min(high, value))
        if self.nonzero and value == 0:
            value = 1 if high >= 1 else -1
        return value


def pick_len(rng, lo, hi, small=8, medium=40, large=150):
    hi = max(lo, hi)
    roll = rng.random()
    if roll < 0.45:
        top = min(hi, max(lo, small))
    elif roll < 0.85:
        top = min(hi, max(lo, medium))
    else:
        top = min(hi, max(lo, large))
    return rng.randint(lo, top)


class SeqProfile:
    """Arrays and lists of numbers (also the values of linked lists)."""

    def __init__(self, values):
        values = [value for value in values if isinstance(value, list)]
        self.lens = [len(value) for value in values]
        self.min_len = min(self.lens)
        self.max_len = max(self.lens)
        self.numbers = Numbers([item for value in values for item in value])
        self.bools = all(isinstance(item, bool) for value in values for item in value) and any(values)
        self.props = set()
        numeric = all(is_num(item) for value in values for item in value)
        for name, test in PROP_TESTS.items():
            if numeric and all(test(value) for value in values):
                self.props.add(name)
        if "strict" in self.props:
            self.props.add("sorted")
            self.props.add("distinct")

    def check(self, value):
        if not isinstance(value, list) or not (self.min_len <= len(value) <= self.max_len):
            return False
        if self.bools:
            return all(isinstance(item, bool) for item in value)
        if not all(self.numbers.ok(item) for item in value):
            return False
        return all(PROP_TESTS[name](value) for name in self.props)

    def make(self, rng, ctx=None):
        ctx = ctx or {}
        lo = ctx.get("min_len", self.min_len)
        hi = min(ctx.get("max_len", self.max_len), self.max_len)
        if lo > hi:
            return None
        length = ctx.get("len")
        if length is None:
            length = pick_len(rng, lo, hi)
        if self.bools:
            return [rng.random() < 0.5 for _ in range(length)]
        if "perm0" in self.props or "perm1" in self.props:
            start = 0 if "perm0" in self.props else 1
            value = list(range(start, start + length))
            rng.shuffle(value)
        elif "index" in self.props:
            value = [rng.randrange(length) for _ in range(length)] if length else []
        else:
            elem_hi = ctx.get("elem_hi")
            if "distinct" in self.props:
                low = self.numbers.lo
                high = self.numbers.hi if elem_hi is None else min(self.numbers.hi, elem_hi)
                if self.numbers.categorical:
                    options = [x for x in self.numbers.pool if x <= high]
                    if len(options) < length:
                        return None
                    value = rng.sample(options, length)
                elif self.numbers.ints:
                    if high - low + 1 < length:
                        return None
                    # Keep the spread modest so values sit near each other.
                    spread = min(high - low, max(length * rng.choice([2, 4, 10, 100]), length))
                    start = rng.randint(low, high - spread) if high - spread > low else low
                    value = rng.sample(range(start, start + spread + 1), length)
                    value = [x for x in value if not (self.numbers.nonzero and x == 0)]
                    if len(value) != length:
                        return None
                else:
                    value = list({round(rng.uniform(low, high), 2) for _ in range(length)})
            else:
                value = []
                for _ in range(length):
                    item = self.numbers.sample(rng, hi=elem_hi)
                    if item is None:
                        return None
                    value.append(item)
        if "sorted" in self.props:
            value.sort()
        elif "desc" in self.props:
            value.sort(reverse=True)
        elif not ({"perm0", "perm1", "minheap", "maxheap"} & self.props):
            # Some already-ordered and all-equal arrays: the shapes that break edge handling.
            roll = rng.random()
            if roll < 0.08:
                value.sort()
            elif roll < 0.13:
                value.sort(reverse=True)
            elif roll < 0.16 and value and "distinct" not in self.props:
                value = [value[0]] * len(value)
        if "minheap" in self.props and "sorted" not in self.props:
            import heapq

            heapq.heapify(value)
        if "maxheap" in self.props and "desc" not in self.props:
            import heapq

            value = [-x for x in value]
            heapq.heapify(value)
            value = [-x for x in value]
        return value

    def mutate(self, rng, value):
        value = list(value)
        roll = rng.random()
        if roll < 0.3 and value:
            item = self.numbers.sample(rng)
            if item is not None:
                value[rng.randrange(len(value))] = item
        elif roll < 0.5 and value:
            value.pop(rng.randrange(len(value)))
        elif roll < 0.7:
            item = self.numbers.sample(rng)
            if item is not None:
                value.insert(rng.randint(0, len(value)), item)
        else:
            rng.shuffle(value)
        if "sorted" in self.props:
            value.sort()
        if "desc" in self.props:
            value.sort(reverse=True)
        return value


PROP_TESTS = {
    "sorted": lambda v: is_sorted(v),
    "strict": lambda v: is_sorted(v, strict=True),
    "desc": lambda v: is_sorted(v[::-1]),
    "distinct": lambda v: len(set(map(dumps, v))) == len(v),
    "perm0": lambda v: sorted(v) == list(range(len(v))),
    "perm1": lambda v: sorted(v) == list(range(1, len(v) + 1)),
    "index": lambda v: all(0 <= x < len(v) for x in v),
    "minheap": lambda v: all(v[(i - 1) // 2] <= v[i] for i in range(1, len(v))),
    "maxheap": lambda v: all(v[(i - 1) // 2] >= v[i] for i in range(1, len(v))),
}


class StringProfile:
    def __init__(self, values):
        values = [value for value in values if isinstance(value, str)]
        self.lens = [len(value) for value in values]
        self.min_len = min(self.lens)
        self.max_len = max(self.lens)
        counts = {}
        for value in values:
            for char in value:
                counts[char] = counts.get(char, 0) + 1
        self.alphabet = sorted(counts) or ["a"]
        self.weights = [counts.get(char, 1) for char in self.alphabet]
        joined = [value for value in values if value]
        # Characters that only ever appear in some positions (a "*" never first, a space never doubled).
        self.never_first = {c for c in self.alphabet if joined and all(not v.startswith(c) for v in joined)}
        self.never_last = {c for c in self.alphabet if joined and all(not v.endswith(c) for v in joined)}
        self.never_double = {c for c in self.alphabet if all(c * 2 not in v for v in values)}
        self.digits = bool(joined) and all(v.isdigit() for v in joined)
        self.no_lead_zero = self.digits and all(not (len(v) > 1 and v[0] == "0") for v in joined)
        if self.no_lead_zero:
            self.never_first.add("0")

    def check(self, value, length=None):
        if not isinstance(value, str) or not (self.min_len <= len(value) <= self.max_len):
            return False
        if length is not None and len(value) != length:
            return False
        if any(char not in self.alphabet for char in value):
            return False
        if value and (value[0] in self.never_first and len(value) > (1 if self.no_lead_zero else 0)):
            if not (self.no_lead_zero and value == "0"):
                return False
        if value and value[-1] in self.never_last:
            return False
        return all(c * 2 not in value for c in self.never_double)

    def make(self, rng, ctx=None):
        ctx = ctx or {}
        lo = max(self.min_len, ctx.get("min_len", self.min_len))
        hi = min(self.max_len, ctx.get("max_len", self.max_len))
        if lo > hi:
            return None
        length = ctx.get("len")
        if length is None:
            length = pick_len(rng, lo, hi, small=6, medium=20, large=60)
        # Small alphabets make repeats, which is where string bugs live.
        alphabet, weights = self.alphabet, self.weights
        if len(alphabet) > 4 and rng.random() < 0.5:
            alphabet = rng.sample(alphabet, rng.randint(2, 4))
            weights = None
        chars = []
        for position in range(length):
            for _ in range(20):
                char = rng.choices(alphabet, weights=weights)[0]
                if position == 0 and char in self.never_first:
                    continue
                if position == length - 1 and char in self.never_last:
                    continue
                if chars and char == chars[-1] and char in self.never_double:
                    continue
                break
            chars.append(char)
        return "".join(chars)

    def mutate(self, rng, value):
        chars = list(value)
        roll = rng.random()
        if roll < 0.4 and chars:
            chars[rng.randrange(len(chars))] = rng.choice(self.alphabet)
        elif roll < 0.6 and chars:
            chars.pop(rng.randrange(len(chars)))
        elif roll < 0.8:
            chars.insert(rng.randint(0, len(chars)), rng.choice(self.alphabet))
        else:
            rng.shuffle(chars)
        return "".join(chars)


class StringArrayProfile:
    def __init__(self, values):
        values = [value for value in values if isinstance(value, list)]
        self.min_len = min(len(value) for value in values)
        self.max_len = max(len(value) for value in values)
        words = [word for value in values for word in value]
        self.words = StringProfile(words) if words else StringProfile([""])
        self.pool = sorted(set(words))
        self.distinct = all(len(set(value)) == len(value) for value in values)
        self.sorted = all(value == sorted(value) for value in values)
        self.same_len = all(len({len(word) for word in value}) <= 1 for value in values)

    def check(self, value, word_len=None):
        if not isinstance(value, list) or not (self.min_len <= len(value) <= self.max_len):
            return False
        if not all(self.words.check(word) for word in value):
            return False
        if word_len is not None and any(len(word) != word_len for word in value):
            return False
        if self.distinct and len(set(value)) != len(value):
            return False
        if self.sorted and value != sorted(value):
            return False
        return not (self.same_len and len({len(word) for word in value}) > 1)

    def make(self, rng, ctx=None):
        ctx = ctx or {}
        count = pick_len(rng, self.min_len, min(self.max_len, 30), small=5, medium=12, large=30)
        word_len = ctx.get("word_len")
        if word_len is None and self.same_len:
            word_len = rng.randint(max(1, self.words.min_len), min(self.words.max_len, 6))
        out = []
        base = None
        for _ in range(count):
            roll = rng.random()
            if roll < 0.25 and self.pool and word_len is None:
                word = rng.choice(self.pool)
            elif roll < 0.55 and out:
                # Near-copies of an earlier word: shared prefixes, one-letter changes.
                word = rng.choice(out)
                if word_len is not None or self.same_len:
                    # One letter changed, length kept: neighbours in a word ladder.
                    if word:
                        at = rng.randrange(len(word))
                        word = word[:at] + rng.choice(self.words.alphabet) + word[at + 1:]
                else:
                    word = self.words.mutate(rng, word)
            else:
                word = self.words.make(rng, {"len": word_len} if word_len is not None else None)
            if word is None:
                return None
            out.append(word)
            base = base or word
        if self.distinct:
            out = list(dict.fromkeys(out))
        if self.sorted:
            out.sort()
        return out

    def mutate(self, rng, value):
        value = list(value)
        if value and rng.random() < 0.5:
            at = rng.randrange(len(value))
            value[at] = self.words.mutate(rng, value[at])
        else:
            rng.shuffle(value)
        return value


class MatrixProfile:
    """Integer matrices: grids, triangles, and lists of fixed-width rows (edges, intervals, queries)."""

    def __init__(self, values, char=False):
        values = [value for value in values if isinstance(value, list)]
        self.char = char
        self.rows_lo = min(len(value) for value in values)
        self.rows_hi = max(len(value) for value in values)
        rows = [row for value in values for row in value]
        widths = {len(row) for row in rows}
        self.rect = all(len({len(row) for row in value}) <= 1 for value in values)
        self.square = self.rect and all(not value or len(value) == len(value[0]) for value in values)
        self.triangle = not self.rect and all(
            all(len(row) == index + 1 for index, row in enumerate(value)) for value in values
        )
        self.width = widths.pop() if len(widths) == 1 else None
        self.tuple = (
            not char
            and self.width is not None
            and self.width <= 4
            and not self.square
            and any(len(value) != self.width for value in values)
        )
        cells = [cell for row in rows for cell in row]
        if char:
            self.alphabet = sorted(set(cells)) or ["."]
            counts = {c: cells.count(c) for c in self.alphabet}
            self.weights = [counts[c] for c in self.alphabet]
        self.numbers = Numbers(cells)
        widths_all = [len(row) for row in rows]
        self.cols_lo = min(widths_all) if widths_all else 0
        self.cols_hi = max(widths_all) if widths_all else 0
        self.props = set()
        self.contains = set()
        if self.tuple:
            self.columns = [Numbers([row[j] for row in rows]) for j in range(self.width)]
            pairs = [(row[0], row[1]) for row in rows] if self.width >= 2 else []
            if self.width >= 2:
                if all(a <= b for a, b in pairs):
                    self.props.add("col_le")
                if all(a < b for a, b in pairs):
                    self.props.add("col_lt")
                if all(a != b for a, b in pairs):
                    self.props.add("col_ne")
            if all(len({dumps(row) for row in value}) == len(value) for value in values):
                self.props.add("rows_distinct")
            if self.width >= 2 and all(
                len({(min(r[0], r[1]), max(r[0], r[1])) for r in value}) == len(value) for value in values
            ):
                self.props.add("pairs_distinct")
            if all(is_sorted([row[0] for row in value]) for value in values):
                self.props.add("by_col0")
            if self.width >= 2 and all(
                all(value[i][1] < value[i + 1][0] for i in range(len(value) - 1)) for value in values
            ):
                self.props.add("disjoint")
            for j in range(self.width):
                if all(len({row[j] for row in value}) == len(value) for value in values):
                    self.props.add(f"col_distinct_{j}")
        elif self.rect and not char:
            grids = [value for value in values if value and value[0]]
            if grids:
                if all(all(is_sorted(row) for row in g) for g in grids):
                    self.props.add("rows_sorted")
                if all(all(is_sorted([row[j] for row in g]) for j in range(len(g[0]))) for g in grids):
                    self.props.add("cols_sorted")
                if all(is_sorted([cell for row in g for cell in row]) for g in grids):
                    self.props.add("flat_sorted")
                if self.square and all(all(g[i][j] == g[j][i] for i in range(len(g)) for j in range(len(g))) for g in grids):
                    self.props.add("symmetric")
                diagonal = {g[i][i] for g in grids if len(g) == len(g[0]) for i in range(len(g))}
                if self.square and len(diagonal) == 1:
                    self.props.add("diagonal")
                    self.diagonal = diagonal.pop()
        if (char or self.numbers.categorical) and not self.tuple:
            options = self.alphabet if char else self.numbers.pool
            for option in options:
                if all(any(option in row for row in value) for value in values):
                    self.contains.add(option)

    def cell_ok(self, cell):
        if self.char:
            return cell in self.alphabet
        return self.numbers.ok(cell)

    def check(self, value, ctx=None):
        ctx = ctx or {}
        if not isinstance(value, list) or not (self.rows_lo <= len(value) <= self.rows_hi):
            return False
        if not all(isinstance(row, list) for row in value):
            return False
        if self.tuple:
            if any(len(row) != self.width for row in value):
                return False
            for row in value:
                for j, cell in enumerate(row):
                    if not self.columns[j].ok(cell, hi=ctx.get("col_hi", {}).get(j)):
                        return False
            pairs = [(row[0], row[1]) for row in value] if self.width >= 2 else []
            if "col_le" in self.props and any(a > b for a, b in pairs):
                return False
            if "col_lt" in self.props and any(a >= b for a, b in pairs):
                return False
            if "col_ne" in self.props and any(a == b for a, b in pairs):
                return False
            if "rows_distinct" in self.props and len({dumps(r) for r in value}) != len(value):
                return False
            if "pairs_distinct" in self.props and len({(min(a, b), max(a, b)) for a, b in pairs}) != len(value):
                return False
            if "by_col0" in self.props and not is_sorted([row[0] for row in value]):
                return False
            if "disjoint" in self.props and any(value[i][1] >= value[i + 1][0] for i in range(len(value) - 1)):
                return False
            for j in range(self.width):
                if f"col_distinct_{j}" in self.props and len({row[j] for row in value}) != len(value):
                    return False
            return True
        if self.rect and len({len(row) for row in value}) > 1:
            return False
        if self.triangle and any(len(row) != i + 1 for i, row in enumerate(value)):
            return False
        if self.square and value and len(value) != len(value[0]):
            return False
        if any(not (self.cols_lo <= len(row) <= self.cols_hi) for row in value):
            return False
        if not all(self.cell_ok(cell) for row in value for cell in row):
            return False
        grid = value
        if grid and grid[0]:
            if "rows_sorted" in self.props and not all(is_sorted(row) for row in grid):
                return False
            if "cols_sorted" in self.props and not all(is_sorted([row[j] for row in grid]) for j in range(len(grid[0]))):
                return False
            if "flat_sorted" in self.props and not is_sorted([c for row in grid for c in row]):
                return False
            if "symmetric" in self.props and not all(grid[i][j] == grid[j][i] for i in range(len(grid)) for j in range(len(grid))):
                return False
            if "diagonal" in self.props and not all(grid[i][i] == self.diagonal for i in range(len(grid))):
                return False
        return all(any(option in row for row in value) for option in self.contains)

    def cell(self, rng):
        if self.char:
            return rng.choices(self.alphabet, weights=self.weights)[0]
        return self.numbers.sample(rng)

    def make(self, rng, ctx=None):
        ctx = ctx or {}
        if self.tuple:
            return self.make_tuples(rng, ctx)
        rows = pick_len(rng, self.rows_lo, min(self.rows_hi, 12), small=4, medium=8, large=12)
        if self.triangle:
            grid = [[self.cell(rng) for _ in range(index + 1)] for index in range(rows)]
        else:
            cols = rows if self.square else pick_len(rng, max(self.cols_lo, 1 if rows else 0), min(self.cols_hi, 12), small=4, medium=8, large=12)
            grid = [[self.cell(rng) for _ in range(cols)] for _ in range(rows)]
            if self.rect and not self.square and not rows:
                grid = []
        if any(cell is None for row in grid for cell in row):
            return None
        if grid and grid[0] and not self.char:
            if "flat_sorted" in self.props:
                flat = sorted(c for row in grid for c in row)
                width = len(grid[0])
                grid = [flat[i * width:(i + 1) * width] for i in range(len(grid))]
            else:
                if "rows_sorted" in self.props:
                    grid = [sorted(row) for row in grid]
                if "cols_sorted" in self.props:
                    columns = [sorted(row[j] for row in grid) for j in range(len(grid[0]))]
                    grid = [[columns[j][i] for j in range(len(grid[0]))] for i in range(len(grid))]
            if "symmetric" in self.props:
                for i in range(len(grid)):
                    for j in range(i):
                        grid[i][j] = grid[j][i]
            if "diagonal" in self.props:
                for i in range(len(grid)):
                    grid[i][i] = self.diagonal
        for option in self.contains:
            if grid and grid[0] and not any(option in row for row in grid):
                grid[rng.randrange(len(grid))][rng.randrange(len(grid[0]))] = option
        return grid

    def make_tuples(self, rng, ctx):
        col_hi = ctx.get("col_hi", {})
        count = pick_len(rng, self.rows_lo, min(self.rows_hi, 40), small=5, medium=15, large=40)
        nodes = ctx.get("nodes")
        out = []
        seen = set()
        if "disjoint" in self.props and self.width >= 2:
            low, high = self.columns[0].lo, min(self.columns[1].hi, col_hi.get(1, self.columns[1].hi))
            if high - low + 1 < 2 * count:
                count = max(self.rows_lo, (high - low + 1) // 2)
            points = sorted(rng.sample(range(low, high + 1), 2 * count)) if high - low + 1 >= 2 * count else []
            if len(points) != 2 * count:
                return None
            for i in range(count):
                a, b = points[2 * i], points[2 * i + 1]
                if "col_le" in self.props and "col_lt" not in self.props and rng.random() < 0.15:
                    b = a
                row = [a, b] + [self.columns[j].sample(rng, hi=col_hi.get(j)) for j in range(2, self.width)]
                out.append(row)
            return out
        # Edge lists over n nodes: a spanning tree first when the graph must be connected.
        if nodes and "connected" in ctx.get("graph", set()) and self.width >= 2:
            order = list(range(nodes))
            rng.shuffle(order)
            for index in range(1, nodes):
                u, v = order[rng.randrange(index)], order[index]
                row = [u, v] + [self.columns[j].sample(rng, hi=col_hi.get(j)) for j in range(2, self.width)]
                out.append(row)
            count = max(count, len(out))
        attempts = 0
        while len(out) < count and attempts < count * 20:
            attempts += 1
            row = []
            for j in range(self.width):
                cell = self.columns[j].sample(rng, hi=col_hi.get(j))
                if cell is None:
                    return None
                row.append(cell)
            if self.width >= 2:
                if "col_le" in self.props and row[0] > row[1]:
                    row[0], row[1] = row[1], row[0]
                if "col_ne" in self.props and row[0] == row[1]:
                    continue
            key = dumps(row[:2]) if "pairs_distinct" in self.props else dumps(row)
            if self.width >= 2 and "pairs_distinct" in self.props:
                key = dumps(sorted(row[:2]))
            if key in seen:
                continue
            seen.add(key)
            out.append(row)
        if nodes and "acyclic" in ctx.get("graph", set()) and self.width >= 2:
            rank = list(range(nodes))
            rng.shuffle(rank)
            for row in out:
                if 0 <= row[0] < nodes and 0 <= row[1] < nodes and rank[row[0]] > rank[row[1]]:
                    row[0], row[1] = row[1], row[0]
        if "by_col0" in self.props:
            out.sort(key=lambda row: row[0])
        return out

    def mutate(self, rng, value):
        value = copy.deepcopy(value)
        if not value:
            return value
        if self.tuple:
            roll = rng.random()
            if roll < 0.4:
                value.pop(rng.randrange(len(value)))
            elif roll < 0.7:
                rng.shuffle(value)
            else:
                row = value[rng.randrange(len(value))]
                j = rng.randrange(self.width)
                row[j] = self.columns[j].sample(rng)
            return value
        row = value[rng.randrange(len(value))]
        if row:
            row[rng.randrange(len(row))] = self.cell(rng)
        return value


class TreeProfile:
    def __init__(self, values):
        values = [value for value in values if isinstance(value, list)]
        counts = [sum(1 for item in value if item is not None) for value in values]
        self.min_n = min(counts)
        self.max_n = max(counts)
        self.numbers = Numbers([item for value in values for item in value if item is not None])
        nonempty = [value for value in values if value]
        self.distinct = all(len({x for x in v if x is not None}) == sum(1 for x in v if x is not None) for v in nonempty)
        self.bst = bool(nonempty) and all(is_bst(v) for v in nonempty)
        self.complete = bool(nonempty) and all(is_complete(v) for v in nonempty)

    def check(self, value):
        if not isinstance(value, list):
            return False
        nodes = [x for x in value if x is not None]
        if not (self.min_n <= len(nodes) <= self.max_n):
            return False
        if value and value[0] is None:
            return False
        if level_order(parse_tree(value)) != value:
            return False
        if not all(self.numbers.ok(x) for x in nodes):
            return False
        if self.distinct and len(set(nodes)) != len(nodes):
            return False
        if self.bst and value and not is_bst(value):
            return False
        return not (self.complete and not is_complete(value))

    def make(self, rng, ctx=None):
        count = pick_len(rng, self.min_n, min(self.max_n, 63), small=7, medium=20, large=63)
        if self.complete:
            values = [self.numbers.sample(rng) for _ in range(count)]
            if self.distinct:
                values = self.distinct_values(rng, count)
            return values

        def assign(root):
            order = []
            stack, node = [], root
            while stack or node:
                while node:
                    stack.append(node)
                    node = node.left
                node = stack.pop()
                order.append(node)
                node = node.right
            # A BST now and then even when not required: validators need some trees that pass.
            as_bst = self.bst or rng.random() < 0.3
            if as_bst or self.distinct:
                values = self.distinct_values(rng, len(order))
                if values is None:
                    raise ValueError("range too small")
                if as_bst:
                    values.sort()
            else:
                values = [self.numbers.sample(rng) for _ in order]
            for node, value in zip(order, values):
                node.val = value

        try:
            return random_tree(rng, count, assign)
        except ValueError:
            return None

    def distinct_values(self, rng, count):
        low, high = self.numbers.lo, self.numbers.hi
        if high - low + 1 < count:
            return None
        spread = min(high - low, max(count * 4, 10))
        start = rng.randint(low, high - spread) if high - spread > low else low
        return rng.sample(range(start, start + spread + 1), count)

    def mutate(self, rng, value):
        return self.make(rng)


class GraphProfile:
    """Adjacency lists."""

    def __init__(self, values):
        values = [value for value in values if isinstance(value, list)]
        self.min_n = min(len(v) for v in values)
        self.max_n = max(len(v) for v in values)
        degrees = [len(row) for v in values for row in v]
        self.max_degree = max(degrees) if degrees else 0
        tests = {
            "undirected": lambda adj: all(u in adj[v] for u, row in enumerate(adj) for v in row if 0 <= v < len(adj)),
            "no_self": lambda adj: all(u not in row for u, row in enumerate(adj)),
            "no_dup": lambda adj: all(len(set(row)) == len(row) for row in adj),
            "dag": lambda adj: acyclic(len(adj), adj_edges(adj)),
            "connected": lambda adj: components(len(adj), adj_edges(adj)) == 1,
            "sorted_rows": lambda adj: all(is_sorted(row) for row in adj),
        }
        self.props = {name for name, test in tests.items() if all(test(v) for v in values)}
        self.tests = tests

    def check(self, value):
        if not isinstance(value, list) or not (self.min_n <= len(value) <= self.max_n):
            return False
        n = len(value)
        if not all(isinstance(row, list) and all(isinstance(v, int) and 0 <= v < n for v in row) for row in value):
            return False
        return all(self.tests[name](value) for name in self.props)

    def make(self, rng, ctx=None):
        n = pick_len(rng, max(1, self.min_n), min(self.max_n, 30), small=6, medium=12, large=30)
        undirected = "undirected" in self.props
        possible = n * (n - 1) // (2 if undirected else 1)
        m = rng.randint(0, min(possible, max(n, int(n * rng.choice([0.5, 1, 1.5, 2.5])))))
        edges = set()
        if "connected" in self.props:
            order = list(range(n))
            rng.shuffle(order)
            for index in range(1, n):
                edges.add((order[rng.randrange(index)], order[index]))
        rank = list(range(n))
        rng.shuffle(rank)
        attempts = 0
        while len(edges) < m and attempts < m * 20 + 20:
            attempts += 1
            u, v = rng.randrange(n), rng.randrange(n)
            if u == v and ("no_self" in self.props or undirected):
                continue
            if undirected and (v, u) in edges:
                continue
            edges.add((u, v))
        adj = [[] for _ in range(n)]
        for u, v in edges:
            if "dag" in self.props and rank[u] > rank[v]:
                u, v = v, u
            if v not in adj[u] or "no_dup" not in self.props:
                adj[u].append(v)
            if undirected and u != v and u not in adj[v]:
                adj[v].append(u)
        for row in adj:
            if "sorted_rows" in self.props:
                row.sort()
            else:
                rng.shuffle(row)
        return adj

    def mutate(self, rng, value):
        return self.make(rng)


class CyclicProfile:
    def __init__(self, values):
        values = [value for value in values if isinstance(value, dict)]
        self.values = SeqProfile([value.get("values") or [] for value in values])
        self.always_cycle = all(value.get("pos", -1) >= 0 for value in values)
        self.never_cycle = all(value.get("pos", -1) < 0 for value in values)

    def check(self, value):
        if not isinstance(value, dict) or not self.values.check(value.get("values")):
            return False
        pos = value.get("pos")
        if not isinstance(pos, int) or not (-1 <= pos < len(value["values"])):
            return False
        if self.always_cycle and pos < 0:
            return False
        return not (self.never_cycle and pos >= 0)

    def make(self, rng, ctx=None):
        values = self.values.make(rng)
        if values is None:
            return None
        if self.never_cycle or not values or (not self.always_cycle and rng.random() < 0.4):
            pos = -1
        else:
            pos = rng.randrange(len(values))
        return {"values": values, "pos": pos}

    def mutate(self, rng, value):
        return self.make(rng)


class ScalarProfile:
    def __init__(self, kind, values):
        self.kind = kind
        self.numbers = Numbers(values)

    def check(self, value, lo=None, hi=None):
        if self.kind == "bool":
            return isinstance(value, bool)
        if self.kind in INT_KINDS and not (isinstance(value, int) and not isinstance(value, bool)):
            return False
        return self.numbers.ok(value, lo, hi)

    def make(self, rng, ctx=None):
        ctx = ctx or {}
        if self.kind == "bool":
            return rng.random() < 0.5
        return self.numbers.sample(rng, ctx.get("lo"), ctx.get("hi"))

    def mutate(self, rng, value):
        if self.kind == "bool":
            return not value
        if rng.random() < 0.5 and isinstance(value, int):
            return value + rng.choice([-1, 1])
        return self.make(rng)


def profile_for(kind, values):
    if kind in INT_KINDS or kind in ("double", "bool"):
        return ScalarProfile(kind, values)
    if kind in SEQ_KINDS:
        return SeqProfile(values)
    if kind == "string":
        return StringProfile(values)
    if kind == "string_array":
        return StringArrayProfile(values)
    if kind == "matrix":
        return MatrixProfile(values)
    if kind == "char_matrix":
        return MatrixProfile(values, char=True)
    if kind == "tree":
        return TreeProfile(values)
    if kind == "graph":
        return GraphProfile(values)
    if kind == "cyclic_list":
        return CyclicProfile(values)
    raise KeyError(kind)


# ---------------------------------------------------------------- relations between parameters


def detect_relations(params, inputs):
    """Every catalogued relation between two parameters that all hand-written inputs keep."""
    relations = []
    kinds = {p["name"]: p["kind"] for p in params}
    names = [p["name"] for p in params]

    def always(test):
        try:
            return all(test(case) for case in inputs)
        except Exception:  # noqa: BLE001 - a relation that cannot be evaluated does not hold
            return False

    for p in names:
        if kinds[p] not in INT_KINDS:
            continue
        for q in names:
            if q == p:
                continue
            # p measured against q's sizes: k <= len(nums), index < rows, ...
            for measure in ("len", "rows", "cols", "nodes"):
                if all(measure in size_of(kinds[q], case.get(q)) for case in inputs):
                    for slack in (-1, 0):
                        if always(lambda c, m=measure, s=slack: c[p] <= size_of(kinds[q], c[q])[m] + s):
                            relations.append(("le_size", p, q, measure, slack))
                            break
            # p one of q's values, or never one of them
            if all(members_of(kinds[q], case.get(q)) is not None for case in inputs):
                if always(lambda c: c[p] in members_of(kinds[q], c[q])):
                    relations.append(("member", p, q))
                elif always(lambda c: c[p] not in members_of(kinds[q], c[q])) and kinds[q] != "matrix":
                    relations.append(("not_member", p, q))
                elif any(case[p] in members_of(kinds[q], case[q]) for case in inputs):
                    # Not a rule, only a habit: searches that sometimes find what they look for.
                    relations.append(("sometimes_member", p, q))
            if kinds[q] in INT_KINDS:
                if always(lambda c: c[p] < c[q]):
                    relations.append(("lt", p, q))
                elif always(lambda c: c[p] <= c[q]):
                    relations.append(("le", p, q))
                elif always(lambda c: c[p] != c[q]) and names.index(p) < names.index(q):
                    relations.append(("ne", p, q))
            # q's elements bounded by p: cuts inside a stick, edge ends below n
            if kinds[q] in SEQ_KINDS:
                for slack in (-1, 0):
                    if always(lambda c, s=slack: all(x <= c[p] + s for x in c[q])):
                        relations.append(("elems_le", q, p, slack))
                        break
            if kinds[q] == "matrix":
                width = {len(row) for case in inputs for row in case[q]}
                if len(width) == 1:
                    for j in range(width.pop()):
                        for slack in (-1, 0):
                            if always(lambda c, j=j, s=slack: all(row[j] <= c[p] + s for row in c[q])):
                                relations.append(("col_le", q, j, p, slack))
                                break
                    # edge lists over p nodes: acyclic / connected
                    if always(lambda c: all(0 <= row[0] < c[p] and 0 <= row[1] < c[p] for row in c[q] if len(row) >= 2)):
                        if always(lambda c: acyclic(c[p], [(r[0], r[1]) for r in c[q]])):
                            relations.append(("graph", q, p, "acyclic"))
                        if always(lambda c: components(c[p], [(r[0], r[1]) for r in c[q]]) == 1):
                            relations.append(("graph", q, p, "connected"))
    sized = [n for n in names if kinds[n] in SEQ_KINDS or kinds[n] in ("string", "string_array")]
    for a in sized:
        for b in sized:
            if a >= b:
                continue
            if always(lambda c: len(c[a]) == len(c[b])):
                relations.append(("same_len", a, b))
                if kinds[a] in SEQ_KINDS and kinds[b] in SEQ_KINDS:
                    # Either way round: start[i] < end[i] whatever the names sort as.
                    for low, high in ((a, b), (b, a)):
                        if always(lambda c, low=low, high=high: all(x < y for x, y in zip(c[low], c[high]))):
                            relations.append(("pairwise_lt", low, high))
                        elif always(lambda c, low=low, high=high: all(x <= y for x, y in zip(c[low], c[high]))):
                            relations.append(("pairwise_le", low, high))
            elif always(lambda c: len(c[a]) <= len(c[b])):
                relations.append(("len_le", a, b))
            elif always(lambda c: len(c[b]) <= len(c[a])):
                relations.append(("len_le", b, a))
    for a in names:
        for b in names:
            if kinds[a] == "string_array" and kinds[b] == "string":
                if always(lambda c: all(len(w) == len(c[b]) for w in c[a])):
                    relations.append(("word_len", a, b))
    if len(sized) > 1:
        least = min(sum(len(case[n]) for n in sized) for case in inputs)
        if least > 0:
            relations.append(("total_len", tuple(sized), least))
    return relations


def relation_holds(relation, case, kinds):
    tag = relation[0]
    try:
        if tag == "le_size":
            _, p, q, measure, slack = relation
            return case[p] <= size_of(kinds[q], case[q])[measure] + slack
        if tag == "member":
            return case[relation[1]] in members_of(kinds[relation[2]], case[relation[2]])
        if tag == "not_member":
            return case[relation[1]] not in members_of(kinds[relation[2]], case[relation[2]])
        if tag == "lt":
            return case[relation[1]] < case[relation[2]]
        if tag == "le":
            return case[relation[1]] <= case[relation[2]]
        if tag == "ne":
            return case[relation[1]] != case[relation[2]]
        if tag == "elems_le":
            _, q, p, slack = relation
            return all(x <= case[p] + slack for x in case[q])
        if tag == "col_le":
            _, q, j, p, slack = relation
            return all(row[j] <= case[p] + slack for row in case[q])
        if tag == "graph":
            _, q, p, what = relation
            edges = [(r[0], r[1]) for r in case[q]]
            if not all(0 <= u < case[p] and 0 <= v < case[p] for u, v in edges):
                return False
            return acyclic(case[p], edges) if what == "acyclic" else components(case[p], edges) == 1
        if tag == "same_len":
            return len(case[relation[1]]) == len(case[relation[2]])
        if tag == "len_le":
            return len(case[relation[1]]) <= len(case[relation[2]])
        if tag == "pairwise_lt":
            return all(x < y for x, y in zip(case[relation[1]], case[relation[2]]))
        if tag == "pairwise_le":
            return all(x <= y for x, y in zip(case[relation[1]], case[relation[2]]))
        if tag == "word_len":
            return all(len(w) == len(case[relation[2]]) for w in case[relation[1]])
        if tag == "total_len":
            return sum(len(case[n]) for n in relation[1]) >= relation[2]
    except (KeyError, TypeError, IndexError):
        return False
    return True


# ---------------------------------------------------------------- one function problem


class FunctionGenerator:
    def __init__(self, problem, inputs):
        self.params = problem["signature"]["parameters"]
        self.kinds = {p["name"]: p["kind"] for p in self.params}
        self.inputs = inputs
        self.profiles = {p["name"]: profile_for(p["kind"], [case.get(p["name"]) for case in inputs]) for p in self.params}
        self.relations = detect_relations(self.params, inputs)
        # Ints that bound something else (n for edge lists, a stick's length) come first;
        # ints measured against something (k <= len, target in nums) come last.
        bounding = {r[3] for r in self.relations if r[0] == "col_le"} | {r[2] for r in self.relations if r[0] in ("elems_le", "graph")}
        names = [p["name"] for p in self.params]
        self.order = (
            [n for n in names if n in bounding]
            + [n for n in names if self.kinds[n] not in INT_KINDS and n not in bounding]
            + [n for n in names if self.kinds[n] in INT_KINDS and n not in bounding]
        )

    def check(self, case):
        for name, profile in self.profiles.items():
            if name not in case or not profile.check(case[name]):
                return False
        return all(relation_holds(r, case, self.kinds) for r in self.relations)

    def generate(self, rng):
        case = {}
        for name in self.order:
            kind = self.kinds[name]
            ctx = {}
            if kind in INT_KINDS:
                for r in self.relations:
                    if r[0] == "le_size" and r[1] == name and r[2] in case:
                        bound = size_of(self.kinds[r[2]], case[r[2]]).get(r[3])
                        if bound is not None:
                            ctx["hi"] = min(ctx.get("hi", bound + r[4]), bound + r[4])
                    if r[0] in ("lt", "le") and r[1] == name and r[2] in case:
                        bound = case[r[2]] - (1 if r[0] == "lt" else 0)
                        ctx["hi"] = min(ctx.get("hi", bound), bound)
                    if r[0] in ("lt", "le") and r[2] == name and r[1] in case:
                        bound = case[r[1]] + (1 if r[0] == "lt" else 0)
                        ctx["lo"] = max(ctx.get("lo", bound), bound)
                members = [r for r in self.relations if r[0] == "member" and r[1] == name and r[2] in case]
                habits = [r for r in self.relations if r[0] == "sometimes_member" and r[1] == name and r[2] in case]
                optional = False
                if habits and not members and rng.random() < 0.5:
                    members, optional = habits, True
                if members and rng.random() < 0.97:
                    pool = sorted(members_of(self.kinds[members[0][2]], case[members[0][2]]), key=dumps)
                    pool = [x for x in pool if self.profiles[name].check(x, ctx.get("lo"), ctx.get("hi"))]
                    if pool:
                        case[name] = rng.choice(pool)
                        continue
                    if not optional:
                        return None
                value = self.profiles[name].make(rng, ctx)
            else:
                for r in self.relations:
                    if r[0] == "elems_le" and r[1] == name and r[2] in case:
                        ctx["elem_hi"] = case[r[2]] + r[3]
                    if r[0] == "col_le" and r[1] == name and r[3] in case:
                        ctx.setdefault("col_hi", {})[r[2]] = case[r[3]] + r[4]
                    if r[0] == "graph" and r[1] == name and r[2] in case:
                        ctx["nodes"] = case[r[2]]
                        ctx.setdefault("graph", set()).add(r[3])
                    if r[0] == "same_len" and r[2] == name and r[1] in case:
                        ctx["len"] = len(case[r[1]])
                    if r[0] == "len_le" and r[2] == name and r[1] in case:
                        ctx["min_len"] = len(case[r[1]])
                    if r[0] == "len_le" and r[1] == name and r[2] in case:
                        ctx["max_len"] = len(case[r[2]])
                    if r[0] == "word_len" and r[1] == name and r[2] in case:
                        ctx["word_len"] = len(case[r[2]])
                value = self.profiles[name].make(rng, ctx)
                # Pairwise a[i] < b[i]: draw b, then make a fit under it.
                for r in self.relations:
                    if r[0] not in ("pairwise_lt", "pairwise_le") or value is None:
                        continue
                    gap = 1 if r[0] == "pairwise_lt" else 0
                    if r[2] == name and r[1] in case:
                        value = [max(y, x + gap + rng.randint(0, 5)) for x, y in zip(case[r[1]], value)]
                    elif r[1] == name and r[2] in case:
                        value = [min(x, y - gap - rng.randint(0, 5)) for x, y in zip(value, case[r[2]])]
            if value is None:
                return None
            case[name] = value
        return case

    def mutate(self, rng):
        case = copy.deepcopy(rng.choice(self.inputs))
        name = rng.choice(list(self.profiles))
        mutate = getattr(self.profiles[name], "mutate", None)
        if mutate is None or name not in case:
            return None
        case[name] = mutate(rng, case[name])
        return case


# ---------------------------------------------------------------- design problems


class DesignGenerator:
    """Operation scripts: the constructor, then calls drawn like the hand-written ones."""

    def __init__(self, problem, inputs):
        design = problem["signature"]["design"]
        self.class_name = design["className"]
        self.methods = {m["name"]: m for m in design["methods"]}
        self.ctor = design["constructorParameters"]
        self.inputs = inputs
        lengths = [len(case["operations"]) for case in inputs]
        self.min_ops, self.max_ops = min(lengths), max(lengths)
        self.counts = {}
        args = {}
        ctor_args = []
        for case in inputs:
            for op, values in zip(case["operations"], case["arguments"]):
                if op == self.class_name:
                    ctor_args.append(values)
                    continue
                self.counts[op] = self.counts.get(op, 0) + 1
                for index, value in enumerate(values):
                    args.setdefault((op, index), []).append(value)
        self.ctor_profiles = [
            profile_for(param["kind"], [values[index] for values in ctor_args]) for index, param in enumerate(self.ctor)
        ]
        self.arg_profiles = {}
        for (op, index), values in args.items():
            kind = self.methods[op]["parameters"][index]["kind"]
            if kind not in SUPPORTED:
                raise KeyError(kind)
            self.arg_profiles[(op, index)] = (kind, profile_for(kind, values))

    def check(self, case):
        ops, arguments = case.get("operations"), case.get("arguments")
        if not ops or ops[0] != self.class_name or self.class_name in ops[1:] or len(ops) != len(arguments):
            return False
        if not (self.min_ops <= len(ops) <= self.max_ops):
            return False
        for profile, value in zip(self.ctor_profiles, arguments[0]):
            if not profile.check(value):
                return False
        for op, values in zip(ops[1:], arguments[1:]):
            if op not in self.counts:
                return False
            for index, value in enumerate(values):
                kind, profile = self.arg_profiles[(op, index)]
                if not profile.check(value):
                    return False
        return True

    def generate(self, rng):
        count = pick_len(rng, self.min_ops, min(self.max_ops, 40), small=8, medium=20, large=40)
        ctor = [profile.make(rng) for profile in self.ctor_profiles]
        if any(value is None for value in ctor):
            return None
        ops, arguments = [self.class_name], [ctor]
        used = {}
        names = list(self.counts)
        weights = [self.counts[name] for name in names]
        for _ in range(count - 1):
            op = rng.choices(names, weights=weights)[0]
            values = []
            for index, param in enumerate(self.methods[op]["parameters"]):
                kind, profile = self.arg_profiles[(op, index)]
                # Keyed by parameter name: put(key, value) then get(key) share keys, not values.
                slot = (param["name"], kind)
                earlier = used.get(slot)
                # Reuse keys and words already seen, so gets hit and searches find things.
                if earlier and rng.random() < 0.5:
                    value = rng.choice(earlier)
                    if kind == "string" and value and rng.random() < 0.3:
                        value = value[: rng.randint(1, len(value))]
                else:
                    value = profile.make(rng)
                if value is None:
                    return None
                values.append(value)
                used.setdefault(slot, []).append(value)
            ops.append(op)
            arguments.append(values)
        return {"operations": ops, "arguments": arguments}

    def mutate(self, rng):
        return self.generate(rng)


# ---------------------------------------------------------------- answers


class OutputProfile:
    """What the hand-written answers have in common."""

    def __init__(self, return_kind, outputs, design=None, inputs=None):
        self.return_kind = return_kind
        self.design = design
        if design:
            per_method = {}
            for case, output in zip(inputs, outputs):
                for op, value in zip(case["operations"], output or []):
                    per_method.setdefault(op, []).append(value)
            kinds = {m["name"]: m["returnKind"] for m in design["methods"]}
            self.methods = {op: OutputProfile(kinds.get(op, "void"), values) for op, values in per_method.items()}
            return
        self.classes = {self.cls(value) for value in outputs}
        self.never_empty = all(not (isinstance(v, (list, str)) and len(v) == 0) for v in outputs)
        numbers = [v for v in outputs if is_num(v)]
        self.never_negative = bool(numbers) and all(v >= 0 for v in numbers)
        self.magnitude = max((abs(v) for v in numbers), default=0)

    @staticmethod
    def cls(value):
        if value is None:
            return "null"
        if isinstance(value, bool):
            return "bool"
        if is_num(value):
            return "number"
        if isinstance(value, str):
            return "string"
        if isinstance(value, list):
            return "list"
        return "object"

    def ok(self, value, case=None):
        if self.design:
            if not isinstance(value, list) or len(value) != len(case["operations"]):
                return False
            for op, item in zip(case["operations"], value):
                profile = self.methods.get(op)
                if profile and not profile.ok(item):
                    return False
            return True
        if self.cls(value) not in self.classes:
            return False
        if self.never_empty and isinstance(value, (list, str)) and len(value) == 0:
            return False
        if is_num(value):
            if self.never_negative and value < 0:
                return False
            if self.return_kind == "int" and not (-INT32 <= value < INT32):
                return False
            if self.return_kind == "long" and not (-INT64 <= value < INT64):
                return False
            if isinstance(value, float) and (not math.isfinite(value) or abs(value) > max(10 * self.magnitude, 1e4)):
                return False
        if isinstance(value, list):
            flat = [x for x in value if is_num(x)]
            if self.return_kind in ("array", "matrix") and any(not (-INT32 <= x < INT32) for x in flat):
                return False
        return True


def run_reference(problem, inputs):
    """The reference's answer and runtime for each input, or None where it failed or ran long."""
    signature = problem["signature"]
    results = []
    for start in range(0, len(inputs), CHUNK):
        results.extend(run_chunk(problem, signature, inputs[start:start + CHUNK]))
    return results


def run_chunk(problem, signature, inputs):
    payload = {
        "code": problem["referenceCode"],
        "entrypoint": signature.get("functionName", ""),
        "parameters": signature.get("parameters", []),
        "returnKind": signature.get("returnKind", "int"),
        "sharedTail": signature.get("sharedTail"),
        "design": signature.get("design"),
        "cases": [{"input": case} for case in inputs],
        "caseTimeoutMs": 2000,
    }
    env = dict(os.environ, PYTHONPATH=COMMON + os.pathsep + os.environ.get("PYTHONPATH", ""), PYTHONIOENCODING="utf8")
    try:
        done = subprocess.run(
            [sys.executable, TRACER],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            encoding="utf8",
            timeout=CHUNK_TIMEOUT_S,
            env=env,
        )
        response = json.loads(done.stdout)
    except subprocess.TimeoutExpired:
        # Something in here never finishes: split until it is found and dropped.
        if len(inputs) == 1:
            return [None]
        half = len(inputs) // 2
        return run_chunk(problem, signature, inputs[:half]) + run_chunk(problem, signature, inputs[half:])
    except (json.JSONDecodeError, OSError):
        return [None] * len(inputs)
    if not response.get("ok"):
        return [None] * len(inputs)
    out = []
    for result in response["cases"]:
        if result.get("ok") and result.get("runtimeMs", 0) <= REF_LIMIT_MS:
            out.append(result)
        else:
            out.append(None)
    return out


# ---------------------------------------------------------------- per problem


def seed_for(problem_id):
    return int(hashlib.sha256(problem_id.encode()).hexdigest()[:12], 16)


def stress_problem(problem):
    """Returns (cases, note)."""
    if problem["id"] in SKIP:
        return [], f"skipped: {SKIP[problem['id']]}"
    signature = problem["signature"]
    hand = problem["testCases"]
    inputs = [case["input"] for case in hand]
    outputs = [case["expectedOutput"] for case in hand]
    try:
        if signature.get("design"):
            generator = DesignGenerator(problem, inputs)
            output_profile = OutputProfile("design", outputs, design=signature["design"], inputs=inputs)
        else:
            kinds = {p["kind"] for p in signature["parameters"]}
            unsupported = kinds - SUPPORTED
            if unsupported or signature.get("sharedTail"):
                return [], f"skipped: unsupported kinds {sorted(unsupported) or ['y_list']}"
            generator = FunctionGenerator(problem, inputs)
            output_profile = OutputProfile(signature["returnKind"], outputs)
    except (KeyError, ValueError) as error:
        return [], f"skipped: {error}"

    # Each hand-written input must pass its own checks, or the profile is wrong.
    for case in inputs:
        if not generator.check(case):
            return [], "skipped: profile rejects a hand-written input"

    rng = random.Random(seed_for(problem["id"]))
    seen = {dumps(case) for case in inputs}
    kept = []
    tally = {}
    attempts = 0
    while len(kept) < TARGET and attempts < MAX_ATTEMPTS:
        batch = []
        while len(batch) < CHUNK and attempts < MAX_ATTEMPTS:
            attempts += 1
            try:
                case = generator.mutate(rng) if rng.random() < 0.25 else generator.generate(rng)
            except (ValueError, IndexError, KeyError, TypeError):
                case = None
            if case is None or not generator.check(case):
                continue
            key = dumps(case)
            if key in seen:
                continue
            seen.add(key)
            batch.append(case)
        if not batch:
            continue
        for case, result in zip(batch, run_reference(problem, batch)):
            if result is None or not output_profile.ok(result["result"], case):
                continue
            answer = result["result"]
            # No one answer may crowd out the rest (all-false, all-zero, all-empty),
            # until generation is nearly out of attempts.
            label = dumps(answer)
            share = 0.6 if isinstance(answer, bool) else 0.35
            if tally.get(label, 0) >= TARGET * share and attempts < MAX_ATTEMPTS * 0.85:
                continue
            tally[label] = tally.get(label, 0) + 1
            kept.append({"input": case, "expectedOutput": answer})
            if len(kept) >= TARGET:
                break
    # Small first: the failing case a learner sees is then the simplest one.
    kept.sort(key=lambda case: len(dumps(case["input"])))
    cases = [{"id": f"stress-{index + 1}", **case} for index, case in enumerate(kept)]
    return cases, f"{len(cases)} cases"


def main():
    wanted = sys.argv[1:] or ["all"]
    os.makedirs(OUT_DIR, exist_ok=True)
    summary = {"generated": 0, "problems": 0, "skipped": 0}
    for name in sorted(os.listdir(BANK_DIR)):
        if not name.endswith(".json"):
            continue
        with open(os.path.join(BANK_DIR, name), encoding="utf8") as handle:
            problems = json.load(handle)
        selected = [p for p in problems if wanted == ["all"] or p["id"] in wanted]
        if not selected:
            continue
        out_path = os.path.join(OUT_DIR, name)
        existing = {}
        if wanted != ["all"] and os.path.exists(out_path):
            with open(out_path, encoding="utf8") as handle:
                existing = json.load(handle)
        for problem in selected:
            cases, note = stress_problem(problem)
            print(f"{name[:-5]:28} {problem['id']:36} {note}", flush=True)
            if cases:
                existing[problem["id"]] = cases
                summary["generated"] += len(cases)
                summary["problems"] += 1
            else:
                existing.pop(problem["id"], None)
                summary["skipped"] += 1
        with open(out_path, "w", encoding="utf8") as handle:
            json.dump(existing, handle, separators=(",", ":"))
            handle.write("\n")
    write_index()
    print(
        f"total: {summary['generated']} cases for {summary['problems']} problems; {summary['skipped']} kept hand-written cases only"
    )


def write_index():
    """id -> batch file and count, so the server knows the sizes without reading every case."""
    index = {}
    for name in sorted(os.listdir(OUT_DIR)):
        if not name.endswith(".json") or name == "index.json":
            continue
        with open(os.path.join(OUT_DIR, name), encoding="utf8") as handle:
            for problem_id, cases in json.load(handle).items():
                index[problem_id] = {"file": name, "count": len(cases)}
    with open(os.path.join(OUT_DIR, "index.json"), "w", encoding="utf8") as handle:
        json.dump(index, handle, indent=1, sort_keys=True)
        handle.write("\n")


if __name__ == "__main__":
    main()
