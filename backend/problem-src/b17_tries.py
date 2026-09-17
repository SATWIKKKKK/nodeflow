import random

from dsl import design, method, ops, problem

rng = random.Random(101)
WORDS = ["".join(rng.choice("abc") for _ in range(rng.randint(1, 6))) for _ in range(120)]
NUMS = [rng.randint(0, 2**31 - 1) for _ in range(500)]

problem(
    id="implement-trie",
    source="Trie Implementation and Operations",
    title="Implement a Trie",
    topic="Trie",
    difficulty="Medium",
    structure="trie",
    description="""Build Trie with insert(word), search(word), which says whether word was inserted, and
    startsWith(prefix), which says whether any inserted word begins with prefix. Each node holds up to 26 children
    and an end-of-word flag.""",
    constraints=["1 <= word.length, prefix.length <= 2000", "Lowercase English letters.", "At most 3 * 10^4 calls."],
    design=design(
        "Trie",
        methods=[
            method("insert", [("word", "string")]),
            method("search", [("word", "string")], ret="bool"),
            method("startsWith", [("prefix", "string")], ret="bool"),
        ],
    ),
    ref="""
class Trie:
    def __init__(self):
        self.root = {}

    def insert(self, word):
        node = self.root
        for char in word:
            node = node.setdefault(char, {})
        node["$"] = True

    def _walk(self, text):
        node = self.root
        for char in text:
            if char not in node:
                return None
            node = node[char]
        return node

    def search(self, word):
        node = self._walk(word)
        return node is not None and "$" in node

    def startsWith(self, prefix):
        return self._walk(prefix) is not None
""",
    examples=[
        (ops(("Trie",), ("insert", "apple"), ("search", "apple"), ("search", "app"), ("startsWith", "app"), ("insert", "app"), ("search", "app")), [None, None, True, False, True, None, True]),
        (ops(("Trie",), ("search", "a"), ("startsWith", "a")), [None, False, False]),
    ],
    tests=[
        ops(("Trie",), ("insert", "a"), ("search", "a"), ("search", "aa"), ("startsWith", "aa")),
        ops(("Trie",), *[("insert", w) for w in WORDS[:60]], *[("search", w) for w in WORDS[60:]], *[("startsWith", w) for w in WORDS[60:90]]),
        ops(("Trie",), ("insert", "noesis"), ("startsWith", "noesis"), ("startsWith", "noesiss"), ("search", "noe")),
    ],
)

problem(
    id="implement-trie-ii",
    source="Trie Implementation and Advanced Operations",
    title="Trie with Counts",
    topic="Trie",
    difficulty="Hard",
    structure="trie",
    description="""Build Trie where the same word can be inserted several times. insert(word) adds one copy,
    countWordsEqualTo(word) returns how many copies exist, countWordsStartingWith(prefix) returns how many copies begin
    with prefix, and erase(word) removes one copy (it is only called when a copy exists). Store a pass-through count
    and an end count on every node.""",
    constraints=["1 <= word.length <= 1000", "At most 3 * 10^4 calls."],
    design=design(
        "Trie",
        methods=[
            method("insert", [("word", "string")]),
            method("countWordsEqualTo", [("word", "string")], ret="int"),
            method("countWordsStartingWith", [("prefix", "string")], ret="int"),
            method("erase", [("word", "string")]),
        ],
    ),
    ref="""
class Node:
    def __init__(self):
        self.children = {}
        self.passing = 0
        self.ending = 0


class Trie:
    def __init__(self):
        self.root = Node()

    def insert(self, word):
        node = self.root
        for char in word:
            node = node.children.setdefault(char, Node())
            node.passing += 1
        node.ending += 1

    def _walk(self, text):
        node = self.root
        for char in text:
            node = node.children.get(char)
            if node is None:
                return None
        return node

    def countWordsEqualTo(self, word):
        node = self._walk(word)
        return node.ending if node else 0

    def countWordsStartingWith(self, prefix):
        node = self._walk(prefix)
        return node.passing if node else 0

    def erase(self, word):
        node = self.root
        for char in word:
            node = node.children[char]
            node.passing -= 1
        node.ending -= 1
""",
    examples=[
        (
            ops(("Trie",), ("insert", "apple"), ("insert", "apple"), ("countWordsEqualTo", "apple"), ("countWordsStartingWith", "app"), ("erase", "apple"), ("countWordsEqualTo", "apple"), ("countWordsStartingWith", "app"), ("erase", "apple"), ("countWordsStartingWith", "app")),
            [None, None, None, 2, 2, None, 1, 1, None, 0],
        ),
        (ops(("Trie",), ("insert", "ab"), ("countWordsEqualTo", "a"), ("countWordsStartingWith", "a")), [None, None, 0, 1]),
    ],
    tests=[
        ops(("Trie",), ("countWordsStartingWith", "z")),
        ops(("Trie",), *[("insert", w) for w in WORDS], *[("countWordsEqualTo", w) for w in WORDS[:40]], *[("countWordsStartingWith", w[:2]) for w in WORDS[:40]]),
        ops(("Trie",), *[("insert", w) for w in WORDS[:30]], *[("erase", w) for w in WORDS[:15]], *[("countWordsStartingWith", p) for p in ("a", "b", "c", "ab", "ca")]),
    ],
)

problem(
    id="longest-word-all-prefixes",
    source="Longest Word with All Prefixes",
    title="Longest Word with All Prefixes",
    topic="Trie",
    difficulty="Medium",
    structure="trie",
    description="""Return the longest word in words whose every prefix is also in words. If several have the same length,
    return the alphabetically smallest. Return "" if no word qualifies. Insert everything into a trie and check that
    each prefix node ends a word.""",
    constraints=["1 <= words.length <= 10^5", "1 <= words[i].length <= 10^5"],
    fn="complete_string",
    params=[("words", "string_array")],
    ret="string",
    ref="""
def complete_string(words):
    root = {}
    for word in words:
        node = root
        for char in word:
            node = node.setdefault(char, {})
        node["$"] = True

    def complete(word):
        node = root
        for char in word:
            node = node[char]
            if "$" not in node:
                return False
        return True

    best = ""
    for word in words:
        longer = len(word) > len(best) or (len(word) == len(best) and word < best)
        if longer and complete(word):
            best = word
    return best
""",
    examples=[({"words": ["n", "ni", "nin", "ninj", "ninja", "ninga"]}, "ninja"), ({"words": ["ab", "bc"]}, "")],
    tests=[{"words": ["a"]}, {"words": ["b", "a", "ba", "ab"]}, {"words": WORDS}],
)

problem(
    id="distinct-substrings",
    source="Number of distinct substrings in a string",
    title="Count Distinct Substrings",
    topic="Trie",
    difficulty="Hard",
    structure="trie",
    description="""Return how many different non-empty substrings s has. Insert every suffix into a trie; each new node
    created is a new distinct substring.""",
    constraints=["1 <= s.length <= 1000"],
    fn="count_distinct_substrings",
    params=[("s", "string")],
    ret="int",
    ref="""
def count_distinct_substrings(s):
    root = {}
    count = 0
    for start in range(len(s)):
        node = root
        for char in s[start:]:
            if char not in node:
                node[char] = {}
                count += 1
            node = node[char]
    return count
""",
    examples=[({"s": "abab"}, 7), ({"s": "aaa"}, 3)],
    tests=[{"s": "z"}, {"s": "abcdefghij"}, {"s": "".join(rng.choice("ab") for _ in range(300))}],
)

problem(
    id="max-xor-two-numbers",
    source="Maximum XOR of two numbers in an array",
    title="Maximum XOR of Two Numbers",
    topic="Trie",
    difficulty="Medium",
    structure="trie",
    description="""Return the largest nums[i] XOR nums[j] over all pairs (i may equal j). Insert every number's 31 bits into a
    binary trie, then for each number walk the trie preferring the opposite bit.""",
    constraints=["1 <= nums.length <= 2 * 10^5", "0 <= nums[i] <= 2^31 - 1"],
    fn="find_maximum_xor",
    params=[("nums", "array")],
    ret="int",
    ref="""
def find_maximum_xor(nums):
    root = {}
    for value in nums:
        node = root
        for bit in range(30, -1, -1):
            node = node.setdefault((value >> bit) & 1, {})
    best = 0
    for value in nums:
        node = root
        current = 0
        for bit in range(30, -1, -1):
            want = 1 - ((value >> bit) & 1)
            if want in node:
                current |= 1 << bit
                node = node[want]
            else:
                node = node[1 - want]
        best = max(best, current)
    return best
""",
    examples=[({"nums": [3, 10, 5, 25, 2, 8]}, 28), ({"nums": [14, 70, 53, 83, 49, 91, 36, 80, 92, 51, 66, 70]}, 127)],
    tests=[{"nums": [0]}, {"nums": [7, 7, 7]}, {"nums": NUMS}],
)

problem(
    id="max-xor-with-limit",
    source="Maximum Xor with an element from an array",
    title="Maximum XOR with a Limit",
    topic="Trie",
    difficulty="Hard",
    structure="trie",
    description="""For each query [x, m], return the largest x XOR nums[j] over elements nums[j] <= m, or -1 if no element
    is that small. Answer queries offline: sort them by m and insert numbers into a binary trie as the limit grows.""",
    constraints=["1 <= nums.length, queries.length <= 10^5", "0 <= nums[j], x, m <= 10^9"],
    fn="maximize_xor",
    params=[("nums", "array"), ("queries", "matrix")],
    ret="array",
    ref="""
def maximize_xor(nums, queries):
    nums = sorted(nums)
    order = sorted(range(len(queries)), key=lambda index: queries[index][1])
    root = {}
    answers = [-1] * len(queries)
    pointer = 0
    for index in order:
        x, limit = queries[index]
        while pointer < len(nums) and nums[pointer] <= limit:
            node = root
            for bit in range(29, -1, -1):
                node = node.setdefault((nums[pointer] >> bit) & 1, {})
            pointer += 1
        if pointer == 0:
            continue
        node = root
        best = 0
        for bit in range(29, -1, -1):
            want = 1 - ((x >> bit) & 1)
            if want in node:
                best |= 1 << bit
                node = node[want]
            else:
                node = node[1 - want]
        answers[index] = best
    return answers
""",
    examples=[
        ({"nums": [0, 1, 2, 3, 4], "queries": [[3, 1], [1, 3], [5, 6]]}, [3, 3, 7]),
        ({"nums": [5, 2, 4, 6, 6, 3], "queries": [[12, 4], [8, 1], [6, 3]]}, [15, -1, 5]),
    ],
    tests=[
        {"nums": [1000000000], "queries": [[0, 0], [0, 1000000000]]},
        {"nums": [rng.randint(0, 10**9) for _ in range(300)], "queries": [[rng.randint(0, 10**9), rng.randint(0, 10**9)] for _ in range(200)]},
        {"nums": list(range(64)), "queries": [[i, i // 2] for i in range(64)]},
    ],
)
