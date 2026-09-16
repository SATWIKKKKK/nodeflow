from dsl import problem

# ---------------------------------------------------------------- hashing

problem(
    id="second-most-frequent",
    source="Second Highest Occurring Element",
    title="Second Most Frequent Element",
    topic="Hashing",
    difficulty="Easy",
    structure="hashmap",
    description="""Count how often each value appears in nums. Find the second-highest distinct frequency and
    return the smallest value that occurs exactly that many times. If every value shares one frequency, return -1.""",
    constraints=["1 <= nums.length <= 10^4", "-10^4 <= nums[i] <= 10^4"],
    fn="second_most_frequent",
    params=[("nums", "array")],
    ret="int",
    ref="""
def second_most_frequent(nums):
    counts = {}
    for value in nums:
        counts[value] = counts.get(value, 0) + 1
    levels = sorted(set(counts.values()), reverse=True)
    if len(levels) < 2:
        return -1
    target = levels[1]
    return min(value for value, count in counts.items() if count == target)
""",
    examples=[
        ({"nums": [1, 2, 2, 3, 3, 3]}, 2, "3 appears three times, 2 appears twice."),
        ({"nums": [4, 4, 4]}, -1),
        ({"nums": [1, 1, 2, 2, 3]}, 3, "1 and 2 tie on two; the next frequency is one, held by 3."),
    ],
    tests=[{"nums": [7]}, {"nums": [5, 6, 6, 7, 7, 8, 8, 8]}, {"nums": [-1, -1, -2, -3, -3, -3, 9, 9]}, {"nums": [2, 1, 2, 1, 3, 3, 3, 4, 4]}],
)

problem(
    id="sum-highest-lowest-frequency",
    source="Sum of Highest and Lowest Frequency",
    title="Highest Plus Lowest Frequency",
    topic="Hashing",
    difficulty="Easy",
    structure="hashmap",
    description="""Count how many times each distinct value appears in nums, then return the largest count plus the
    smallest count.""",
    constraints=["1 <= nums.length <= 10^4", "-10^4 <= nums[i] <= 10^4"],
    fn="sum_high_low_frequency",
    params=[("nums", "array")],
    ret="int",
    ref="""
def sum_high_low_frequency(nums):
    counts = {}
    for value in nums:
        counts[value] = counts.get(value, 0) + 1
    return max(counts.values()) + min(counts.values())
""",
    examples=[({"nums": [1, 2, 2, 3, 3, 3]}, 4, "Highest is 3 (for 3), lowest is 1 (for 1)."), ({"nums": [5, 5, 5, 5]}, 8)],
    tests=[{"nums": [9]}, {"nums": [1, 2, 3, 4]}, {"nums": [2, 2, 3, 3, 3, 3, 4, 4, 4]}, {"nums": [-5, -5, 0, 0, 0, 7]}],
)

# ---------------------------------------------------------------- strings

problem(
    id="reverse-string-blocks",
    source="Reverse a String II",
    title="Reverse in Blocks",
    topic="String",
    difficulty="Easy",
    structure="string",
    description="""Walk through s in blocks of 2k characters. In each block, reverse the first k characters and leave
    the rest. If fewer than k characters remain, reverse all of them; if between k and 2k remain, reverse the first k.""",
    constraints=["1 <= s.length <= 10^4", "1 <= k <= 10^4", "s contains lowercase English letters."],
    fn="reverse_blocks",
    params=[("s", "string"), ("k", "int")],
    ret="string",
    ref="""
def reverse_blocks(s, k):
    chars = list(s)
    for start in range(0, len(chars), 2 * k):
        left, right = start, min(start + k, len(chars)) - 1
        while left < right:
            chars[left], chars[right] = chars[right], chars[left]
            left += 1
            right -= 1
    return "".join(chars)
""",
    examples=[({"s": "abcdefg", "k": 2}, "bacdfeg"), ({"s": "abcd", "k": 4}, "dcba")],
    tests=[{"s": "a", "k": 1}, {"s": "abcdefgh", "k": 3}, {"s": "abc", "k": 5}, {"s": "abcdefghij", "k": 1}],
)

problem(
    id="valid-palindrome",
    source="Palindrome Check",
    title="Valid Palindrome",
    topic="String",
    difficulty="Easy",
    structure="string",
    description="""Return whether s is a palindrome once you ignore every character that is not a letter or digit
    and treat upper and lower case as equal.""",
    constraints=["1 <= s.length <= 2 * 10^5", "s contains printable ASCII characters."],
    fn="is_palindrome",
    params=[("s", "string")],
    ret="bool",
    ref="""
def is_palindrome(s):
    left, right = 0, len(s) - 1
    while left < right:
        if not s[left].isalnum():
            left += 1
        elif not s[right].isalnum():
            right -= 1
        elif s[left].lower() != s[right].lower():
            return False
        else:
            left += 1
            right -= 1
    return True
""",
    examples=[({"s": "A man, a plan, a canal: Panama"}, True), ({"s": "race a car"}, False)],
    tests=[{"s": " "}, {"s": "0P"}, {"s": "No lemon, no melon"}, {"s": "ab_a"}, {"s": "a."}],
)

problem(
    id="largest-odd-number-string",
    source="Largest Odd Number in a String",
    title="Largest Odd Number in a String",
    topic="String",
    difficulty="Easy",
    structure="string",
    description="""num is a string of digits. Return the largest odd number that is a non-empty prefix of num, written
    without leading zeros, or an empty string if no prefix is odd. (The largest odd prefix always ends at the last odd digit.)""",
    constraints=["1 <= num.length <= 10^5", "num contains only digits and may start with zeros."],
    fn="largest_odd_number",
    params=[("num", "string")],
    ret="string",
    ref="""
def largest_odd_number(num):
    end = len(num) - 1
    while end >= 0 and int(num[end]) % 2 == 0:
        end -= 1
    if end < 0:
        return ""
    start = 0
    while start < end and num[start] == "0":
        start += 1
    return num[start:end + 1]
""",
    examples=[({"num": "52"}, "5"), ({"num": "4206"}, ""), ({"num": "0032"}, "3", "The prefix 003 is odd; without leading zeros it is 3.")],
    tests=[{"num": "35427"}, {"num": "0"}, {"num": "7"}, {"num": "00000001"}, {"num": "2468013"}],
)

problem(
    id="longest-common-prefix",
    source="Longest Common Prefix",
    title="Longest Common Prefix",
    topic="String",
    difficulty="Easy",
    structure="string",
    description="""Return the longest string that every word in strs starts with. Return an empty string if they
    share no prefix.""",
    constraints=["1 <= strs.length <= 200", "0 <= strs[i].length <= 200", "Words contain lowercase letters."],
    fn="longest_common_prefix",
    params=[("strs", "string_array")],
    ret="string",
    ref="""
def longest_common_prefix(strs):
    prefix = strs[0]
    for word in strs[1:]:
        while not word.startswith(prefix):
            prefix = prefix[:-1]
    return prefix
""",
    examples=[({"strs": ["flower", "flow", "flight"]}, "fl"), ({"strs": ["dog", "racecar", "car"]}, "")],
    tests=[{"strs": ["alone"]}, {"strs": ["", "abc"]}, {"strs": ["interview", "internet", "interval", "intern"]}, {"strs": ["aaa", "aa", "aaaa"]}],
)

problem(
    id="isomorphic-strings",
    source="Isomorphic String",
    title="Isomorphic Strings",
    topic="String",
    difficulty="Easy",
    structure="hashmap",
    description="""Two strings are isomorphic when the characters of s can be replaced, one for one, to produce t:
    each character maps to exactly one character and no two characters map to the same one. Return whether s and t are isomorphic.""",
    constraints=["1 <= s.length == t.length <= 5 * 10^4", "s and t contain printable ASCII characters."],
    fn="is_isomorphic",
    params=[("s", "string"), ("t", "string")],
    ret="bool",
    ref="""
def is_isomorphic(s, t):
    forward = {}
    backward = {}
    for a, b in zip(s, t):
        if forward.get(a, b) != b or backward.get(b, a) != a:
            return False
        forward[a] = b
        backward[b] = a
    return True
""",
    examples=[({"s": "egg", "t": "add"}, True), ({"s": "foo", "t": "bar"}, False), ({"s": "paper", "t": "title"}, True)],
    tests=[{"s": "a", "t": "b"}, {"s": "badc", "t": "baba"}, {"s": "abab", "t": "cdcd"}, {"s": "ab", "t": "aa"}],
)

problem(
    id="rotate-string",
    source="Rotate String",
    title="Rotate String",
    topic="String",
    difficulty="Easy",
    structure="string",
    description="""A shift moves the first character of a string to its end. Return whether some number of shifts
    turns s into goal.""",
    constraints=["1 <= s.length, goal.length <= 100", "Lowercase English letters."],
    fn="rotate_string",
    params=[("s", "string"), ("goal", "string")],
    ret="bool",
    ref="""
def rotate_string(s, goal):
    return len(s) == len(goal) and goal in s + s
""",
    examples=[({"s": "abcde", "goal": "cdeab"}, True), ({"s": "abcde", "goal": "abced"}, False)],
    tests=[{"s": "a", "goal": "a"}, {"s": "aa", "goal": "a"}, {"s": "abcabc", "goal": "cabcab"}, {"s": "xyz", "goal": "zyx"}],
)

problem(
    id="valid-anagram",
    source="Valid Anagram",
    title="Valid Anagram",
    topic="String",
    difficulty="Easy",
    structure="hashmap",
    description="""Return whether t uses exactly the same letters as s, each the same number of times.""",
    constraints=["1 <= s.length, t.length <= 5 * 10^4", "Lowercase English letters."],
    fn="is_anagram",
    params=[("s", "string"), ("t", "string")],
    ret="bool",
    ref="""
def is_anagram(s, t):
    if len(s) != len(t):
        return False
    counts = {}
    for char in s:
        counts[char] = counts.get(char, 0) + 1
    for char in t:
        if counts.get(char, 0) == 0:
            return False
        counts[char] -= 1
    return True
""",
    examples=[({"s": "anagram", "t": "nagaram"}, True), ({"s": "rat", "t": "car"}, False)],
    tests=[{"s": "a", "t": "a"}, {"s": "ab", "t": "a"}, {"s": "aacc", "t": "ccac"}, {"s": "listen", "t": "silent"}],
)

problem(
    id="sort-characters-by-frequency",
    source="Sort Characters by Frequency",
    title="Sort Characters by Frequency",
    topic="String",
    difficulty="Medium",
    structure="hashmap",
    description="""Rearrange s so that characters appearing more often come first, with all copies of a character kept
    together. Characters with equal counts are ordered by character code (so 'A' comes before 'a').""",
    constraints=["1 <= s.length <= 5 * 10^5", "s contains letters and digits."],
    fn="frequency_sort",
    params=[("s", "string")],
    ret="string",
    ref="""
def frequency_sort(s):
    counts = {}
    for char in s:
        counts[char] = counts.get(char, 0) + 1
    order = sorted(counts, key=lambda char: (-counts[char], char))
    return "".join(char * counts[char] for char in order)
""",
    examples=[({"s": "tree"}, "eert", "e appears twice; r and t once each, and r comes first."), ({"s": "Aabb"}, "bbAa")],
    tests=[{"s": "z"}, {"s": "cccaaa"}, {"s": "2a554442f544asfasss"}, {"s": "abcABC112"}],
)

problem(
    id="reverse-words",
    source="Reverse every word in a string",
    title="Reverse the Words",
    topic="String",
    difficulty="Medium",
    structure="string",
    description="""Return the words of s in reverse order, joined by single spaces. A word is a run of non-space
    characters; leading, trailing and repeated spaces all disappear.""",
    constraints=["1 <= s.length <= 10^4", "s contains at least one word."],
    fn="reverse_words",
    params=[("s", "string")],
    ret="string",
    ref="""
def reverse_words(s):
    words = []
    index = len(s) - 1
    while index >= 0:
        while index >= 0 and s[index] == " ":
            index -= 1
        end = index
        while index >= 0 and s[index] != " ":
            index -= 1
        if end >= 0 and end > index:
            words.append(s[index + 1:end + 1])
    return " ".join(words)
""",
    examples=[({"s": "  the sky   is blue "}, "blue is sky the"), ({"s": "hello"}, "hello")],
    tests=[{"s": "a good   example"}, {"s": "   x   "}, {"s": "one two three four"}, {"s": "Noesis traces code"}],
)

problem(
    id="min-bracket-reversals",
    source="Minimum number of bracket reversals to make an expression balanced",
    title="Fewest Bracket Flips",
    topic="String",
    difficulty="Medium",
    structure="stack",
    description="""s contains only '{' and '}'. Flipping a bracket turns '{' into '}' or the reverse. Return the
    fewest flips that make s balanced, or -1 if that is impossible.""",
    constraints=["1 <= s.length <= 10^5"],
    fn="min_reversals",
    params=[("s", "string")],
    ret="int",
    ref="""
def min_reversals(s):
    if len(s) % 2 == 1:
        return -1
    open_count = 0
    close_count = 0
    for char in s:
        if char == "{":
            open_count += 1
        elif open_count > 0:
            open_count -= 1
        else:
            close_count += 1
    return (open_count + 1) // 2 + (close_count + 1) // 2
""",
    examples=[({"s": "}}{{"}, 2, "Flip the first and the last bracket."), ({"s": "{{{"}, -1), ({"s": "{{}}"}, 0)],
    tests=[{"s": "}{{}}{{{"}, {"s": "}}}}"}, {"s": "{}{}{}"}, {"s": "}{"}, {"s": "{{{{}}"}],
)

problem(
    id="count-and-say",
    source="Count and say",
    title="Count and Say",
    topic="String",
    difficulty="Medium",
    structure="string",
    description="""The count-and-say sequence starts with "1". Each next term reads the previous one aloud in groups:
    "21" is "one 2, one 1", written "1211". Return the nth term.""",
    constraints=["1 <= n <= 30"],
    fn="count_and_say",
    params=[("n", "int")],
    ret="string",
    ref="""
def count_and_say(n):
    term = "1"
    for _ in range(n - 1):
        parts = []
        index = 0
        while index < len(term):
            run = index
            while run < len(term) and term[run] == term[index]:
                run += 1
            parts.append(str(run - index) + term[index])
            index = run
        term = "".join(parts)
    return term
""",
    examples=[({"n": 1}, "1"), ({"n": 4}, "1211", "1 → 11 → 21 → 1211")],
    tests=[{"n": 2}, {"n": 5}, {"n": 10}, {"n": 15}],
)

problem(
    id="rabin-karp-search",
    source="Rabin Karp Algorithm",
    title="Pattern Search with Rolling Hash",
    topic="String",
    difficulty="Hard",
    structure="string",
    description="""Return every index where pattern starts inside text, in increasing order. Compare rolling hashes
    of each window first and only check characters when the hashes agree.""",
    constraints=["1 <= pattern.length <= text.length <= 10^5", "Lowercase English letters."],
    fn="find_occurrences",
    params=[("text", "string"), ("pattern", "string")],
    ret="array",
    ref="""
def find_occurrences(text, pattern):
    base, mod = 31, 1000000007
    m, n = len(pattern), len(text)
    if m > n:
        return []
    power = 1
    for _ in range(m - 1):
        power = power * base % mod
    target = 0
    window = 0
    for i in range(m):
        target = (target * base + ord(pattern[i])) % mod
        window = (window * base + ord(text[i])) % mod
    found = []
    for start in range(n - m + 1):
        if window == target and text[start:start + m] == pattern:
            found.append(start)
        if start + m < n:
            window = (window - ord(text[start]) * power) % mod
            window = (window * base + ord(text[start + m])) % mod
    return found
""",
    examples=[({"text": "abababab", "pattern": "aba"}, [0, 2, 4]), ({"text": "hello", "pattern": "xyz"}, [])],
    tests=[{"text": "aaaaa", "pattern": "aa"}, {"text": "a", "pattern": "a"}, {"text": "geeksforgeeks", "pattern": "geek"}, {"text": "abc", "pattern": "abcd"}],
)

problem(
    id="z-function",
    source="Z function",
    title="Z-Array",
    topic="String",
    difficulty="Hard",
    structure="string",
    description="""The Z-array of s stores, for each position i > 0, the length of the longest substring starting at i
    that is also a prefix of s. By convention z[0] is 0. Build it in linear time.""",
    constraints=["1 <= s.length <= 10^5", "Lowercase English letters."],
    fn="z_array",
    params=[("s", "string")],
    ret="array",
    ref="""
def z_array(s):
    n = len(s)
    z = [0] * n
    left = right = 0
    for i in range(1, n):
        if i < right:
            z[i] = min(right - i, z[i - left])
        while i + z[i] < n and s[z[i]] == s[i + z[i]]:
            z[i] += 1
        if i + z[i] > right:
            left, right = i, i + z[i]
    return z
""",
    examples=[({"s": "aabxaab"}, [0, 1, 0, 0, 3, 1, 0]), ({"s": "aaaa"}, [0, 3, 2, 1])],
    tests=[{"s": "a"}, {"s": "abcabcab"}, {"s": "abacaba"}, {"s": "zzzzzzzzzz"}],
)

problem(
    id="lps-array",
    source="KMP Algorithm or LPS array",
    title="Prefix Function (LPS Array)",
    topic="String",
    difficulty="Hard",
    structure="string",
    description="""For each position i in pattern, lps[i] is the length of the longest proper prefix of pattern[0..i]
    that is also a suffix of it. This table is what lets KMP search without backing up. Return lps.""",
    constraints=["1 <= pattern.length <= 10^5", "Lowercase English letters."],
    fn="lps_array",
    params=[("pattern", "string")],
    ret="array",
    ref="""
def lps_array(pattern):
    lps = [0] * len(pattern)
    length = 0
    i = 1
    while i < len(pattern):
        if pattern[i] == pattern[length]:
            length += 1
            lps[i] = length
            i += 1
        elif length > 0:
            length = lps[length - 1]
        else:
            lps[i] = 0
            i += 1
    return lps
""",
    examples=[({"pattern": "aabaaab"}, [0, 1, 0, 1, 2, 2, 3]), ({"pattern": "abcd"}, [0, 0, 0, 0])],
    tests=[{"pattern": "a"}, {"pattern": "aaaa"}, {"pattern": "abacabab"}, {"pattern": "ababaca"}],
)

problem(
    id="shortest-palindrome",
    source="Shortest Palindrome",
    title="Shortest Palindrome",
    topic="String",
    difficulty="Hard",
    structure="string",
    description="""You may only add characters to the front of s. Return the shortest palindrome you can make that way.
    It is s preceded by the reverse of whatever follows s's longest palindromic prefix.""",
    constraints=["0 <= s.length <= 5 * 10^4", "Lowercase English letters."],
    fn="shortest_palindrome",
    params=[("s", "string")],
    ret="string",
    ref="""
def shortest_palindrome(s):
    combined = s + "#" + s[::-1]
    lps = [0] * len(combined)
    for i in range(1, len(combined)):
        length = lps[i - 1]
        while length > 0 and combined[i] != combined[length]:
            length = lps[length - 1]
        if combined[i] == combined[length]:
            length += 1
        lps[i] = length
    keep = lps[-1]
    return s[keep:][::-1] + s
""",
    examples=[({"s": "aacecaaa"}, "aaacecaaa"), ({"s": "abcd"}, "dcbabcd")],
    tests=[{"s": ""}, {"s": "a"}, {"s": "racecar"}, {"s": "abb"}, {"s": "aabba"}],
)

problem(
    id="longest-happy-prefix",
    source="Longest happy prefix",
    title="Longest Happy Prefix",
    topic="String",
    difficulty="Hard",
    structure="string",
    description="""A happy prefix is a non-empty prefix of s that is also a suffix of s, but not all of s.
    Return the longest one, or an empty string if there is none.""",
    constraints=["1 <= s.length <= 10^5", "Lowercase English letters."],
    fn="longest_prefix",
    params=[("s", "string")],
    ret="string",
    ref="""
def longest_prefix(s):
    lps = [0] * len(s)
    length = 0
    for i in range(1, len(s)):
        while length > 0 and s[i] != s[length]:
            length = lps[length - 1]
        if s[i] == s[length]:
            length += 1
        lps[i] = length
    return s[:lps[-1]]
""",
    examples=[({"s": "level"}, "l"), ({"s": "ababab"}, "abab")],
    tests=[{"s": "a"}, {"s": "leetcodeleet"}, {"s": "aaaa"}, {"s": "abc"}],
)
