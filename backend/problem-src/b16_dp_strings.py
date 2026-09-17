import random

from dsl import problem

rng = random.Random(91)
NUMS = [rng.randint(-500, 500) for _ in range(400)]
TEXT_A = "".join(rng.choice("abcde") for _ in range(300))
TEXT_B = "".join(rng.choice("abcde") for _ in range(250))

# ---------------------------------------------------------------- LIS family

problem(
    id="longest-increasing-subsequence",
    source="Longest Increasing Subsequence",
    title="Longest Increasing Subsequence",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description="""Return the length of the longest strictly increasing subsequence of nums. For O(n log n), keep tails[k]
    = the smallest tail of an increasing subsequence of length k + 1 and binary search into it.""",
    constraints=["1 <= nums.length <= 2500", "-10^4 <= nums[i] <= 10^4"],
    fn="length_of_lis",
    params=[("nums", "array")],
    ret="int",
    ref="""
from bisect import bisect_left


def length_of_lis(nums):
    tails = []
    for value in nums:
        index = bisect_left(tails, value)
        if index == len(tails):
            tails.append(value)
        else:
            tails[index] = value
    return len(tails)
""",
    examples=[({"nums": [10, 9, 2, 5, 3, 7, 101, 18]}, 4), ({"nums": [7, 7, 7, 7]}, 1)],
    tests=[{"nums": [1]}, {"nums": list(range(100))}, {"nums": NUMS}],
)

problem(
    id="print-lis",
    source="Print Longest Increasing Subsequence",
    title="Print the Longest Increasing Subsequence",
    topic="Dynamic Programming",
    difficulty="Hard",
    structure="array",
    description="""Return one longest strictly increasing subsequence, chosen exactly like this: len[i] is the longest
    one ending at i and parent[i] is the smallest j < i with nums[j] < nums[i] that achieves it. The answer ends at
    the smallest index with the largest len; follow parents back from there.""",
    constraints=["1 <= nums.length <= 1000"],
    fn="longest_increasing_subsequence",
    params=[("nums", "array")],
    ret="array",
    ref="""
def longest_increasing_subsequence(nums):
    n = len(nums)
    length = [1] * n
    parent = list(range(n))
    for i in range(n):
        for j in range(i):
            if nums[j] < nums[i] and length[j] + 1 > length[i]:
                length[i] = length[j] + 1
                parent[i] = j
    end = max(range(n), key=lambda index: (length[index], -index))
    sequence = [nums[end]]
    while parent[end] != end:
        end = parent[end]
        sequence.append(nums[end])
    return sequence[::-1]
""",
    examples=[({"nums": [10, 9, 2, 5, 3, 7, 101, 18]}, [2, 5, 7, 101]), ({"nums": [5, 4, 11, 1, 16, 8]}, [5, 11, 16])],
    tests=[{"nums": [3]}, {"nums": [3, 3, 3]}, {"nums": NUMS}],
)

problem(
    id="largest-divisible-subset",
    source="Largest Divisible Subset",
    title="Largest Divisible Subset",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description="""nums holds distinct positive integers. Return the largest subset where, for every pair, one divides
    the other, in ascending order. Sort nums, then build it like printing an LIS: len[i] uses the smallest j < i with
    nums[i] % nums[j] == 0 that gives the longest chain, and the answer ends at the smallest index with the largest
    len.""",
    constraints=["1 <= nums.length <= 1000", "1 <= nums[i] <= 2 * 10^9", "Values are distinct."],
    fn="largest_divisible_subset",
    params=[("nums", "array")],
    ret="array",
    ref="""
def largest_divisible_subset(nums):
    nums = sorted(nums)
    n = len(nums)
    length = [1] * n
    parent = list(range(n))
    for i in range(n):
        for j in range(i):
            if nums[i] % nums[j] == 0 and length[j] + 1 > length[i]:
                length[i] = length[j] + 1
                parent[i] = j
    end = max(range(n), key=lambda index: (length[index], -index))
    subset = [nums[end]]
    while parent[end] != end:
        end = parent[end]
        subset.append(nums[end])
    return subset[::-1]
""",
    examples=[({"nums": [1, 2, 3]}, [1, 2]), ({"nums": [1, 2, 4, 8]}, [1, 2, 4, 8])],
    tests=[{"nums": [7]}, {"nums": [3, 4, 16, 8]}, {"nums": rng.sample(range(1, 2000), 300)}],
)

problem(
    id="longest-string-chain",
    source="Longest String Chain",
    title="Longest String Chain",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description="""A word is a predecessor of another if inserting exactly one letter anywhere turns it into the other. A
    chain is a sequence where each word is a predecessor of the next. Return the length of the longest chain you can
    build from words. Process words by length and try deleting each letter.""",
    constraints=["1 <= words.length <= 1000", "1 <= words[i].length <= 16"],
    fn="longest_str_chain",
    params=[("words", "string_array")],
    ret="int",
    ref="""
def longest_str_chain(words):
    best = {}
    for word in sorted(set(words), key=len):
        best[word] = 1 + max((best.get(word[:i] + word[i + 1:], 0) for i in range(len(word))), default=0)
    return max(best.values())
""",
    examples=[({"words": ["a", "b", "ba", "bca", "bda", "bdca"]}, 4), ({"words": ["abcd", "dbqca"]}, 1)],
    tests=[{"words": ["x"]}, {"words": ["xbc", "pcxbcf", "xb", "cxbc", "pcxbc"]}, {"words": ["".join(rng.choice("ab") for _ in range(rng.randint(1, 8))) for _ in range(300)]}],
)

problem(
    id="longest-bitonic-subsequence",
    source="Longest Bitonic Subsequence",
    title="Longest Bitonic Subsequence",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description="""A bitonic subsequence strictly increases and then strictly decreases; either part may be empty. Return
    the length of the longest one. Combine the LIS ending at i with the longest decreasing run starting at i.""",
    constraints=["1 <= nums.length <= 1000"],
    fn="longest_bitonic",
    params=[("nums", "array")],
    ret="int",
    ref="""
def longest_bitonic(nums):
    n = len(nums)
    up = [1] * n
    down = [1] * n
    for i in range(n):
        for j in range(i):
            if nums[j] < nums[i]:
                up[i] = max(up[i], up[j] + 1)
    for i in range(n - 1, -1, -1):
        for j in range(n - 1, i, -1):
            if nums[j] < nums[i]:
                down[i] = max(down[i], down[j] + 1)
    return max(up[i] + down[i] - 1 for i in range(n))
""",
    examples=[({"nums": [1, 11, 2, 10, 4, 5, 2, 1]}, 6), ({"nums": [12, 11, 40, 5, 3, 1]}, 5)],
    tests=[{"nums": [4]}, {"nums": [2, 2, 2]}, {"nums": NUMS}],
)

problem(
    id="number-of-lis",
    source="Number of Longest Increasing Subsequences",
    title="Number of Longest Increasing Subsequences",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description="""Return how many strictly increasing subsequences (chosen by position) have the maximum possible
    length. Track, for each index, both the best length ending there and how many ways reach it.""",
    constraints=["1 <= nums.length <= 2000", "The answer fits in a 32-bit signed integer."],
    fn="find_number_of_lis",
    params=[("nums", "array")],
    ret="int",
    ref="""
def find_number_of_lis(nums):
    n = len(nums)
    length = [1] * n
    count = [1] * n
    for i in range(n):
        for j in range(i):
            if nums[j] < nums[i]:
                if length[j] + 1 > length[i]:
                    length[i] = length[j] + 1
                    count[i] = count[j]
                elif length[j] + 1 == length[i]:
                    count[i] += count[j]
    best = max(length)
    return sum(c for l, c in zip(length, count) if l == best)
""",
    examples=[({"nums": [1, 3, 5, 4, 7]}, 2), ({"nums": [2, 2, 2, 2, 2]}, 5)],
    tests=[{"nums": [1]}, {"nums": [1, 2, 4, 3, 5, 4, 7, 2]}, {"nums": [rng.randint(0, 30) for _ in range(300)]}],
)

# ---------------------------------------------------------------- DP on strings

problem(
    id="longest-common-subsequence",
    source="Longest common subsequence",
    title="Longest Common Subsequence",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="string",
    description="""Return the length of the longest sequence of characters that appears, in order but not necessarily
    contiguously, in both a and b.""",
    constraints=["1 <= a.length, b.length <= 1000"],
    fn="longest_common_subsequence",
    params=[("a", "string"), ("b", "string")],
    ret="int",
    ref="""
def longest_common_subsequence(a, b):
    prev = [0] * (len(b) + 1)
    for char in a:
        current = [0]
        for j, other in enumerate(b):
            current.append(prev[j] + 1 if char == other else max(prev[j + 1], current[j]))
        prev = current
    return prev[-1]
""",
    examples=[({"a": "abcde", "b": "ace"}, 3), ({"a": "abc", "b": "def"}, 0)],
    tests=[{"a": "a", "b": "a"}, {"a": "bsbininm", "b": "jmjkbkjkv"}, {"a": TEXT_A, "b": TEXT_B}],
)

problem(
    id="longest-common-substring",
    source="Longest common substring",
    title="Longest Common Substring",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="string",
    description="""Return the length of the longest contiguous string that appears in both a and b. A match at (i, j)
    extends the match ending at (i − 1, j − 1); a mismatch resets it to 0.""",
    constraints=["1 <= a.length, b.length <= 1000"],
    fn="longest_common_substring",
    params=[("a", "string"), ("b", "string")],
    ret="int",
    ref="""
def longest_common_substring(a, b):
    prev = [0] * (len(b) + 1)
    best = 0
    for char in a:
        current = [0] * (len(b) + 1)
        for j, other in enumerate(b):
            if char == other:
                current[j + 1] = prev[j] + 1
                best = max(best, current[j + 1])
        prev = current
    return best
""",
    examples=[({"a": "abcjklp", "b": "acjkp"}, 3), ({"a": "wasdijkl", "b": "wsdjkl"}, 3)],
    tests=[{"a": "a", "b": "b"}, {"a": "zzzz", "b": "zz"}, {"a": TEXT_A, "b": TEXT_B}],
)

problem(
    id="longest-palindromic-subsequence",
    source="Longest palindromic subsequence",
    title="Longest Palindromic Subsequence",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="string",
    description="""Return the length of the longest subsequence of s that reads the same forwards and backwards. It equals
    the LCS of s and its reverse.""",
    constraints=["1 <= s.length <= 1000"],
    fn="longest_palindrome_subseq",
    params=[("s", "string")],
    ret="int",
    ref="""
def longest_palindrome_subseq(s):
    b = s[::-1]
    prev = [0] * (len(s) + 1)
    for char in s:
        current = [0]
        for j, other in enumerate(b):
            current.append(prev[j] + 1 if char == other else max(prev[j + 1], current[j]))
        prev = current
    return prev[-1]
""",
    examples=[({"s": "bbbab"}, 4), ({"s": "cbbd"}, 2)],
    tests=[{"s": "x"}, {"s": "noesisisnoe"}, {"s": TEXT_A}],
)

problem(
    id="min-insertions-palindrome",
    source="Minimum insertions to make string palindrome",
    title="Minimum Insertions for a Palindrome",
    topic="Dynamic Programming",
    difficulty="Hard",
    structure="string",
    description="""Return the fewest characters to insert anywhere in s to make it a palindrome. That is the length of s
    minus its longest palindromic subsequence.""",
    constraints=["1 <= s.length <= 500"],
    fn="min_insertions",
    params=[("s", "string")],
    ret="int",
    ref="""
def min_insertions(s):
    b = s[::-1]
    prev = [0] * (len(s) + 1)
    for char in s:
        current = [0]
        for j, other in enumerate(b):
            current.append(prev[j] + 1 if char == other else max(prev[j + 1], current[j]))
        prev = current
    return len(s) - prev[-1]
""",
    examples=[({"s": "zzazz"}, 0), ({"s": "mbadm"}, 2), ({"s": "leetcode"}, 5)],
    tests=[{"s": "a"}, {"s": "ab"}, {"s": TEXT_A[:200]}],
)

problem(
    id="min-insert-delete-convert",
    source="Minimum insertions or deletions to convert string A to B",
    title="Insertions and Deletions to Convert a String",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="string",
    description="""Turn a into b using only single-character deletions and insertions. Return the fewest operations:
    delete what is not in the LCS from a and insert what is missing from b.""",
    constraints=["1 <= a.length, b.length <= 1000"],
    fn="min_operations",
    params=[("a", "string"), ("b", "string")],
    ret="int",
    ref="""
def min_operations(a, b):
    prev = [0] * (len(b) + 1)
    for char in a:
        current = [0]
        for j, other in enumerate(b):
            current.append(prev[j] + 1 if char == other else max(prev[j + 1], current[j]))
        prev = current
    return len(a) + len(b) - 2 * prev[-1]
""",
    examples=[({"a": "heap", "b": "pea"}, 3), ({"a": "sea", "b": "eat"}, 2)],
    tests=[{"a": "same", "b": "same"}, {"a": "a", "b": "bbbb"}, {"a": TEXT_A, "b": TEXT_B}],
)

problem(
    id="shortest-common-supersequence",
    source="Shortest common supersequence",
    title="Shortest Common Supersequence",
    topic="Dynamic Programming",
    difficulty="Hard",
    structure="string",
    description="""Return a shortest string that has both a and b as subsequences. Build it from the LCS table,
    backtracking from the end: on equal characters take the character once and move diagonally; otherwise, if
    dp[i − 1][j] >= dp[i][j − 1], take a[i − 1] and move up, else take b[j − 1] and move left. Then prepend whatever
    remains of either string.""",
    constraints=["1 <= a.length, b.length <= 1000"],
    fn="shortest_common_supersequence",
    params=[("a", "string"), ("b", "string")],
    ret="string",
    ref="""
def shortest_common_supersequence(a, b):
    n, m = len(a), len(b)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    out = []
    i, j = n, m
    while i > 0 and j > 0:
        if a[i - 1] == b[j - 1]:
            out.append(a[i - 1])
            i -= 1
            j -= 1
        elif dp[i - 1][j] >= dp[i][j - 1]:
            out.append(a[i - 1])
            i -= 1
        else:
            out.append(b[j - 1])
            j -= 1
    while i > 0:
        out.append(a[i - 1])
        i -= 1
    while j > 0:
        out.append(b[j - 1])
        j -= 1
    return "".join(reversed(out))
""",
    examples=[({"a": "abac", "b": "cab"}, "cabac"), ({"a": "brute", "b": "groot"}, "gbrooute")],
    tests=[{"a": "a", "b": "a"}, {"a": "xyz", "b": "abc"}, {"a": TEXT_A[:120], "b": TEXT_B[:100]}],
)

problem(
    id="distinct-subsequences",
    source="Distinct subsequences",
    title="Distinct Subsequences",
    topic="Dynamic Programming",
    difficulty="Hard",
    structure="string",
    description="""Return how many distinct ways (by position) t appears as a subsequence of s, modulo 1,000,000,007.""",
    constraints=["1 <= s.length, t.length <= 1000"],
    fn="num_distinct",
    params=[("s", "string"), ("t", "string")],
    ret="int",
    ref="""
def num_distinct(s, t):
    mod = 1000000007
    ways = [1] + [0] * len(t)
    for char in s:
        for j in range(len(t), 0, -1):
            if t[j - 1] == char:
                ways[j] = (ways[j] + ways[j - 1]) % mod
    return ways[-1]
""",
    examples=[({"s": "rabbbit", "t": "rabbit"}, 3), ({"s": "babgbag", "t": "bag"}, 5)],
    tests=[{"s": "a", "t": "b"}, {"s": "a" * 200, "t": "a" * 20}, {"s": TEXT_A, "t": "abcde"}],
)

problem(
    id="edit-distance",
    source="Edit distance",
    title="Edit Distance",
    topic="Dynamic Programming",
    difficulty="Hard",
    structure="string",
    description="""Return the fewest single-character insertions, deletions or replacements needed to turn a into b.""",
    constraints=["0 <= a.length, b.length <= 500"],
    fn="min_distance",
    params=[("a", "string"), ("b", "string")],
    ret="int",
    ref="""
def min_distance(a, b):
    prev = list(range(len(b) + 1))
    for i, char in enumerate(a, 1):
        current = [i]
        for j, other in enumerate(b, 1):
            if char == other:
                current.append(prev[j - 1])
            else:
                current.append(1 + min(prev[j - 1], prev[j], current[j - 1]))
        prev = current
    return prev[-1]
""",
    examples=[({"a": "horse", "b": "ros"}, 3), ({"a": "intention", "b": "execution"}, 5)],
    tests=[{"a": "", "b": "abc"}, {"a": "abc", "b": ""}, {"a": TEXT_A, "b": TEXT_B}],
)

problem(
    id="wildcard-matching",
    source="Wildcard matching",
    title="Wildcard Matching",
    topic="Dynamic Programming",
    difficulty="Hard",
    structure="string",
    description="""In pattern p, "?" matches any single character and "*" matches any sequence (including empty). Return
    whether p matches all of s.""",
    constraints=["0 <= s.length, p.length <= 2000"],
    fn="is_match",
    params=[("s", "string"), ("p", "string")],
    ret="bool",
    ref="""
def is_match(s, p):
    prev = [True] + [False] * len(s)
    for char in p:
        current = [prev[0] and char == "*"] + [False] * len(s)
        for j in range(1, len(s) + 1):
            if char == "*":
                current[j] = prev[j] or current[j - 1]
            elif char == "?" or char == s[j - 1]:
                current[j] = prev[j - 1]
        prev = current
    return prev[-1]
""",
    examples=[({"s": "aa", "p": "a"}, False), ({"s": "aa", "p": "*"}, True), ({"s": "cb", "p": "?a"}, False)],
    tests=[{"s": "", "p": "***"}, {"s": "adceb", "p": "*a*b"}, {"s": "acdcb", "p": "a*c?b"}, {"s": "a" * 300 + "b", "p": "*a*a*a*a*b"}],
)

# ---------------------------------------------------------------- partition DP

problem(
    id="matrix-chain-multiplication",
    source="Matrix chain multiplication",
    title="Matrix Chain Multiplication",
    topic="Dynamic Programming",
    difficulty="Hard",
    structure="array",
    description="""Matrix i has dimensions dims[i − 1] × dims[i]. Return the fewest scalar multiplications needed to
    multiply the whole chain, choosing where to put the brackets. Try every split point of every interval.""",
    constraints=["2 <= dims.length <= 100", "1 <= dims[i] <= 500"],
    fn="matrix_multiplication",
    params=[("dims", "array")],
    ret="int",
    ref="""
def matrix_multiplication(dims):
    n = len(dims)
    cost = [[0] * n for _ in range(n)]
    for length in range(2, n):
        for i in range(1, n - length + 1):
            j = i + length - 1
            cost[i][j] = min(cost[i][k] + cost[k + 1][j] + dims[i - 1] * dims[k] * dims[j] for k in range(i, j))
    return cost[1][n - 1]
""",
    examples=[({"dims": [10, 20, 30, 40, 50]}, 38000), ({"dims": [4, 2, 3]}, 24)],
    tests=[{"dims": [5, 5]}, {"dims": [40, 20, 30, 10, 30]}, {"dims": [rng.randint(1, 500) for _ in range(60)]}],
)

problem(
    id="min-cost-cut-stick",
    source="Minimum cost to cut the stick",
    title="Minimum Cost to Cut a Stick",
    topic="Dynamic Programming",
    difficulty="Hard",
    structure="array",
    description="""A stick of length n has marked positions cuts. Cutting a piece costs its current length. You may cut in
    any order. Return the smallest total cost. Sort the cuts, add both ends, and solve over intervals of cut
    points.""",
    constraints=["2 <= n <= 10^6", "1 <= cuts.length <= min(n - 1, 100)", "Cuts are distinct and strictly inside the stick."],
    fn="min_cost_cuts",
    params=[("n", "int"), ("cuts", "array")],
    ret="int",
    ref="""
def min_cost_cuts(n, cuts):
    points = [0] + sorted(cuts) + [n]
    m = len(points)
    cost = [[0] * m for _ in range(m)]
    for gap in range(2, m):
        for i in range(m - gap):
            j = i + gap
            cost[i][j] = points[j] - points[i] + min(cost[i][k] + cost[k][j] for k in range(i + 1, j))
    return cost[0][m - 1]
""",
    examples=[({"n": 7, "cuts": [1, 3, 4, 5]}, 16), ({"n": 9, "cuts": [5, 6, 1, 4, 2]}, 22)],
    tests=[{"n": 2, "cuts": [1]}, {"n": 100, "cuts": list(range(1, 100, 3))}, {"n": 1000000, "cuts": rng.sample(range(1, 1000000), 80)}],
)

problem(
    id="burst-balloons",
    source="Burst balloons",
    title="Burst Balloons",
    topic="Dynamic Programming",
    difficulty="Hard",
    structure="array",
    description="""Bursting balloon i earns nums[left] × nums[i] × nums[right], where left and right are its current
    neighbours (a missing neighbour counts as 1). Return the most coins from bursting every balloon. Think about which
    balloon in an interval is burst last.""",
    constraints=["1 <= nums.length <= 300", "0 <= nums[i] <= 100"],
    fn="max_coins",
    params=[("nums", "array")],
    ret="int",
    ref="""
def max_coins(nums):
    values = [1] + nums + [1]
    n = len(values)
    best = [[0] * n for _ in range(n)]
    for gap in range(2, n):
        for left in range(n - gap):
            right = left + gap
            best[left][right] = max(
                best[left][k] + best[k][right] + values[left] * values[k] * values[right] for k in range(left + 1, right)
            )
    return best[0][n - 1]
""",
    examples=[({"nums": [3, 1, 5, 8]}, 167), ({"nums": [1, 5]}, 10)],
    tests=[{"nums": [7]}, {"nums": [0, 0, 0]}, {"nums": [rng.randint(0, 100) for _ in range(60)]}],
)

problem(
    id="palindrome-partitioning-ii",
    source="Palindrome partitioning II",
    title="Palindrome Partitioning II",
    topic="Dynamic Programming",
    difficulty="Hard",
    structure="string",
    description="""Split s into pieces that are each palindromes. Return the fewest cuts needed. Precompute which
    substrings are palindromes, then find the best cut count for every prefix.""",
    constraints=["1 <= s.length <= 2000"],
    fn="min_cut",
    params=[("s", "string")],
    ret="int",
    ref="""
def min_cut(s):
    n = len(s)
    is_pal = [[False] * n for _ in range(n)]
    for end in range(n):
        for start in range(end + 1):
            if s[start] == s[end] and (end - start < 2 or is_pal[start + 1][end - 1]):
                is_pal[start][end] = True
    cuts = [0] * n
    for end in range(n):
        if is_pal[0][end]:
            continue
        cuts[end] = min(cuts[start - 1] + 1 for start in range(1, end + 1) if is_pal[start][end])
    return cuts[-1]
""",
    examples=[({"s": "aab"}, 1), ({"s": "a"}, 0), ({"s": "ab"}, 1)],
    tests=[{"s": "racecar"}, {"s": "abcdef"}, {"s": TEXT_A}],
)
