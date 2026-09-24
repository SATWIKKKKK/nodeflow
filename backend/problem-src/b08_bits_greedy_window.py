from dsl import problem

# ---------------------------------------------------------------- bit manipulation

problem(
    id="min-bit-flips",
    source="Bit Manipulation Minimum Bit Flips to Convert Number",
    title="Minimum Bit Flips",
    topic="Bit Manipulation",
    difficulty="Easy",
    structure="number",
    description="""Return how many bits must be flipped to turn start into goal. That is the number of 1 bits in
    start XOR goal; clear the lowest set bit with x & (x - 1) until nothing is left.""",
    constraints=["0 <= start, goal <= 10^9"],
    fn="min_bit_flips",
    params=[("start", "int"), ("goal", "int")],
    ret="int",
    ref="""
def min_bit_flips(start, goal):
    diff = start ^ goal
    flips = 0
    while diff:
        diff &= diff - 1
        flips += 1
    return flips
""",
    examples=[({"start": 10, "goal": 7}, 3, "1010 → 0111 differs in three bits."), ({"start": 3, "goal": 4}, 3)],
    tests=[{"start": 0, "goal": 0}, {"start": 1000000000, "goal": 0}, {"start": 29, "goal": 15}, {"start": 8, "goal": 9}],
)

problem(
    id="single-number",
    source="Single Number - I",
    title="Single Number",
    topic="Bit Manipulation",
    difficulty="Easy",
    structure="array",
    description="""Every value in nums appears twice except one. Return the one that appears once, using XOR so that
    the pairs cancel out.""",
    constraints=["1 <= nums.length <= 3 * 10^4", "-3 * 10^4 <= nums[i] <= 3 * 10^4"],
    fn="single_number",
    params=[("nums", "array")],
    ret="int",
    ref="""
def single_number(nums):
    result = 0
    for value in nums:
        result ^= value
    return result
""",
    examples=[({"nums": [2, 2, 1]}, 1), ({"nums": [4, 1, 2, 1, 2]}, 4)],
    tests=[{"nums": [7]}, {"nums": [-1, -1, -2]}, {"nums": [i for i in range(1, 500) for _ in range(2)] + [30000]}],
)

problem(
    id="single-number-ii",
    source="Single Number - II",
    title="Single Number II",
    topic="Bit Manipulation",
    difficulty="Medium",
    structure="array",
    description="""Every value appears three times except one, which appears once. Return it in linear time and constant
    space. Track which bits have been seen once and twice.""",
    constraints=["1 <= nums.length <= 3 * 10^4", "-2^31 <= nums[i] <= 2^31 - 1"],
    fn="single_number_ii",
    params=[("nums", "array")],
    ret="int",
    ref="""
def single_number_ii(nums):
    ones = twos = 0
    for value in nums:
        ones = (ones ^ value) & ~twos
        twos = (twos ^ value) & ~ones
    return ones
""",
    examples=[({"nums": [2, 2, 3, 2]}, 3), ({"nums": [0, 1, 0, 1, 0, 1, 99]}, 99)],
    tests=[{"nums": [-2, -2, 1, 1, -3, 1, -3, -3, -4, -2]}, {"nums": [5]}, {"nums": [2147483647, -2147483648, -2147483648, -2147483648]}],
)

problem(
    id="single-number-iii",
    source="Single Number - III",
    title="Single Number III",
    topic="Bit Manipulation",
    difficulty="Medium",
    structure="array",
    description="""Exactly two values appear once and every other value appears twice. Return the two values in
    ascending order. XOR everything, then split the values by the lowest bit where the two singles differ.""",
    constraints=["2 <= nums.length <= 3 * 10^4", "-2^31 <= nums[i] <= 2^31 - 1"],
    fn="single_number_iii",
    params=[("nums", "array")],
    ret="array",
    ref="""
def single_number_iii(nums):
    both = 0
    for value in nums:
        both ^= value
    lowest = both & -both
    first = 0
    for value in nums:
        if value & lowest:
            first ^= value
    second = both ^ first
    return sorted([first, second])
""",
    examples=[({"nums": [1, 2, 1, 3, 2, 5]}, [3, 5]), ({"nums": [-1, 0]}, [-1, 0])],
    tests=[{"nums": [0, 1]}, {"nums": [4, 4, -7, 9, 9, 12]}, {"nums": [2147483647, -2147483648, 5, 5]}],
)

problem(
    id="divide-two-integers",
    source="Divide two numbers without multiplication and division",
    title="Divide Without Dividing",
    topic="Bit Manipulation",
    difficulty="Medium",
    structure="number",
    description="""Return dividend / divisor truncated toward zero, without using multiplication, division or modulo.
    Subtract shifted copies of the divisor, largest first. If the result overflows a 32-bit signed integer, return
    2147483647.""",
    constraints=["-2^31 <= dividend, divisor <= 2^31 - 1", "divisor != 0"],
    fn="divide",
    params=[("dividend", "int"), ("divisor", "int")],
    ret="int",
    ref="""
def divide(dividend, divisor):
    if dividend == -2147483648 and divisor == -1:
        return 2147483647
    negative = (dividend < 0) != (divisor < 0)
    a, b = abs(dividend), abs(divisor)
    quotient = 0
    while a >= b:
        shift = 0
        while a >= (b << (shift + 1)):
            shift += 1
        a -= b << shift
        quotient += 1 << shift
    return -quotient if negative else quotient
""",
    examples=[({"dividend": 10, "divisor": 3}, 3), ({"dividend": 7, "divisor": -3}, -2), ({"dividend": -2147483648, "divisor": -1}, 2147483647)],
    tests=[{"dividend": 0, "divisor": 5}, {"dividend": -2147483648, "divisor": 1}, {"dividend": 2147483647, "divisor": 2}, {"dividend": 1, "divisor": -1}],
)

problem(
    id="power-set-bitmask",
    source="Power Set Bit Manipulation",
    title="All Subsequences with Bitmasks",
    topic="Bit Manipulation",
    difficulty="Medium",
    structure="string",
    description="""Every integer mask from 1 to 2^n - 1 picks a non-empty subsequence of s (bit i keeps s[i]). Return all
    of them sorted alphabetically. Subsequences built from different positions are listed separately even if equal.""",
    constraints=["1 <= s.length <= 12", "Lowercase English letters."],
    fn="all_subsequences",
    params=[("s", "string")],
    ret="string_array",
    ref="""
def all_subsequences(s):
    n = len(s)
    result = []
    for mask in range(1, 1 << n):
        picked = "".join(s[i] for i in range(n) if mask & (1 << i))
        result.append(picked)
    return sorted(result)
""",
    examples=[({"s": "abc"}, ["a", "ab", "abc", "ac", "b", "bc", "c"]), ({"s": "z"}, ["z"])],
    tests=[{"s": "aa"}, {"s": "dcba"}, {"s": "noesisgraph"}],
)

problem(
    id="xor-range",
    source="XOR of numbers in a given range",
    title="XOR of a Range",
    topic="Bit Manipulation",
    difficulty="Medium",
    structure="number",
    description="""Return L xor (L + 1) xor ... xor R. The XOR of 1..n follows a cycle of four, so XOR(1..R) xor
    XOR(1..L - 1) answers it in constant time.""",
    constraints=["1 <= L <= R <= 10^9"],
    fn="xor_range",
    params=[("L", "int"), ("R", "int")],
    ret="int",
    ref="""
def xor_range(L, R):
    def prefix(n):
        return [n, 1, n + 1, 0][n % 4]

    return prefix(R) ^ prefix(L - 1)
""",
    examples=[({"L": 3, "R": 5}, 2, "3 ^ 4 ^ 5 = 2"), ({"L": 1, "R": 1}, 1)],
    tests=[{"L": 1, "R": 1000000000}, {"L": 7, "R": 7}, {"L": 4, "R": 8}, {"L": 123456, "R": 654321}],
)

# ---------------------------------------------------------------- greedy

problem(
    id="assign-cookies",
    source="Assign Cookies",
    title="Assign Cookies",
    topic="Greedy",
    difficulty="Easy",
    structure="array",
    description="""Child i is happy with a cookie of size at least greed[i], and each child gets at most one cookie.
    Return the most children you can make happy. Sort both lists and match greedily.""",
    constraints=["1 <= greed.length <= 3 * 10^4", "0 <= cookies.length <= 3 * 10^4"],
    fn="find_content_children",
    params=[("greed", "array"), ("cookies", "array")],
    ret="int",
    ref="""
def find_content_children(greed, cookies):
    greed.sort()
    cookies.sort()
    child = 0
    for size in cookies:
        if child < len(greed) and size >= greed[child]:
            child += 1
    return child
""",
    examples=[({"greed": [1, 2, 3], "cookies": [1, 1]}, 1), ({"greed": [1, 2], "cookies": [1, 2, 3]}, 2)],
    tests=[{"greed": [5], "cookies": []}, {"greed": [10, 9, 8, 7], "cookies": [5, 6, 7, 8]}, {"greed": [1, 1, 1], "cookies": [1, 1, 1, 1]}],
)

problem(
    id="lemonade-change",
    source="Lemonade Change",
    title="Lemonade Change",
    topic="Greedy",
    difficulty="Easy",
    structure="array",
    description="""Lemonade costs 5. Customers pay in order with a 5, 10 or 20 bill and you start with no change.
    Return whether you can give every customer correct change. Prefer giving a 10 over two 5s.""",
    constraints=["1 <= bills.length <= 10^5", "bills[i] is 5, 10 or 20."],
    fn="lemonade_change",
    params=[("bills", "array")],
    ret="bool",
    ref="""
def lemonade_change(bills):
    fives = tens = 0
    for bill in bills:
        if bill == 5:
            fives += 1
        elif bill == 10:
            if fives == 0:
                return False
            fives -= 1
            tens += 1
        else:
            if tens > 0 and fives > 0:
                tens -= 1
                fives -= 1
            elif fives >= 3:
                fives -= 3
            else:
                return False
    return True
""",
    examples=[({"bills": [5, 5, 5, 10, 20]}, True), ({"bills": [5, 5, 10, 10, 20]}, False)],
    tests=[{"bills": [10]}, {"bills": [5, 5, 5, 5, 20, 20]}, {"bills": [5, 5, 10, 20, 5, 5, 5, 5, 5, 5, 5, 5, 5, 10, 5, 5, 20, 5, 20, 5]}],
)

problem(
    id="jump-game",
    source="Jump Game - I",
    title="Jump Game",
    topic="Greedy",
    difficulty="Medium",
    structure="array",
    description="""From index i you may jump up to nums[i] steps forward. Starting at index 0, return whether you can reach
    the last index. Track the farthest index reachable so far.""",
    constraints=["1 <= nums.length <= 10^4", "0 <= nums[i] <= 10^5"],
    fn="can_jump",
    params=[("nums", "array")],
    ret="bool",
    ref="""
def can_jump(nums):
    farthest = 0
    for index, step in enumerate(nums):
        if index > farthest:
            return False
        farthest = max(farthest, index + step)
    return True
""",
    examples=[({"nums": [2, 3, 1, 1, 4]}, True), ({"nums": [3, 2, 1, 0, 4]}, False)],
    tests=[{"nums": [0]}, {"nums": [0, 1]}, {"nums": [1] * 5000}, {"nums": [2, 0, 0]}],
)

problem(
    id="shortest-job-first",
    source="Shortest Job First",
    title="Shortest Job First",
    topic="Greedy",
    difficulty="Easy",
    structure="array",
    description="""All processes arrive at time 0 and run without interruption, shortest burst first. Return the average
    waiting time, rounded down to an integer.""",
    constraints=["1 <= bursts.length <= 10^5", "1 <= bursts[i] <= 10^5"],
    fn="average_waiting_time",
    params=[("bursts", "array")],
    ret="int",
    ref="""
def average_waiting_time(bursts):
    bursts.sort()
    clock = 0
    waiting = 0
    for burst in bursts:
        waiting += clock
        clock += burst
    return waiting // len(bursts)
""",
    examples=[({"bursts": [4, 3, 7, 1, 2]}, 4, "Waits are 0, 1, 3, 6 and 10."), ({"bursts": [1, 2, 3]}, 1)],
    tests=[{"bursts": [5]}, {"bursts": [100000] * 10}, {"bursts": list(range(1000, 0, -1))}],
)

problem(
    id="job-sequencing",
    source="Job sequencing Problem",
    title="Job Sequencing",
    topic="Greedy",
    difficulty="Medium",
    structure="array",
    description="""Each job is [id, deadline, profit] and takes one unit of time; it earns its profit only if finished by
    its deadline, and only one job runs at a time. Return [jobs done, total profit] for the most profitable schedule.
    Take jobs by profit and put each in the latest free slot before its deadline.""",
    constraints=["1 <= jobs.length <= 10^4", "1 <= deadline <= jobs.length", "1 <= profit <= 500"],
    fn="job_sequencing",
    params=[("jobs", "matrix")],
    ret="array",
    ref="""
def job_sequencing(jobs):
    jobs.sort(key=lambda job: -job[2])
    latest = max(job[1] for job in jobs)
    slots = [False] * (latest + 1)
    count = profit = 0
    for _, deadline, gain in jobs:
        for slot in range(deadline, 0, -1):
            if not slots[slot]:
                slots[slot] = True
                count += 1
                profit += gain
                break
    return [count, profit]
""",
    examples=[
        ({"jobs": [[1, 4, 20], [2, 1, 10], [3, 1, 40], [4, 1, 30]]}, [2, 60]),
        ({"jobs": [[1, 2, 100], [2, 1, 19], [3, 2, 27], [4, 1, 25], [5, 1, 15]]}, [2, 127]),
    ],
    tests=[{"jobs": [[1, 1, 5]]}, {"jobs": [[1, 3, 10], [2, 3, 20], [3, 3, 30], [4, 3, 40]]}, {"jobs": [[i, (i % 50) + 1, (i * 37) % 500 + 1] for i in range(1, 400)]}],
)

problem(
    id="n-meetings",
    source="N meetings in one room",
    title="Meetings in One Room",
    topic="Greedy",
    difficulty="Easy",
    structure="array",
    description="""Meeting i runs from start[i] to end[i]. A meeting can follow another only if it starts strictly after
    the other ends. Return the most meetings one room can host. Pick by earliest end time.""",
    constraints=["1 <= n <= 10^5", "0 <= start[i] < end[i] <= 10^6"],
    fn="max_meetings",
    params=[("start", "array"), ("end", "array")],
    ret="int",
    ref="""
def max_meetings(start, end):
    meetings = sorted(zip(end, start))
    count = 0
    last_end = -1
    for finish, begin in meetings:
        if begin > last_end:
            count += 1
            last_end = finish
    return count
""",
    examples=[({"start": [1, 3, 0, 5, 8, 5], "end": [2, 4, 6, 7, 9, 9]}, 4), ({"start": [10, 12, 20], "end": [20, 25, 30]}, 1)],
    tests=[{"start": [1], "end": [2]}, {"start": [1, 2, 3], "end": [10, 3, 4]}, {"start": list(range(0, 2000, 2)), "end": list(range(1, 2001, 2))}],
)

problem(
    id="non-overlapping-intervals",
    source="Non-overlapping Intervals",
    title="Remove Overlapping Intervals",
    topic="Greedy",
    difficulty="Medium",
    structure="array",
    description="""Return the fewest intervals to remove so the rest do not overlap. Intervals that only touch at an
    endpoint do not overlap.""",
    constraints=["1 <= intervals.length <= 10^5", "-5 * 10^4 <= start < end <= 5 * 10^4"],
    fn="erase_overlap_intervals",
    params=[("intervals", "matrix")],
    ret="int",
    ref="""
def erase_overlap_intervals(intervals):
    intervals.sort(key=lambda interval: interval[1])
    kept_end = None
    removed = 0
    for begin, finish in intervals:
        if kept_end is None or begin >= kept_end:
            kept_end = finish
        else:
            removed += 1
    return removed
""",
    examples=[({"intervals": [[1, 2], [2, 3], [3, 4], [1, 3]]}, 1), ({"intervals": [[1, 2], [1, 2], [1, 2]]}, 2)],
    tests=[{"intervals": [[1, 2]]}, {"intervals": [[1, 100], [11, 22], [1, 11], [2, 12]]}, {"intervals": [[i, i + 3] for i in range(500)]}],
)

problem(
    id="insert-interval",
    source="Insert Interval",
    title="Insert an Interval",
    topic="Greedy",
    difficulty="Medium",
    structure="array",
    description="""intervals is sorted by start and has no overlaps. Insert new_interval, merge anything it overlaps
    (touching counts as overlapping), and return the result.""",
    constraints=["0 <= intervals.length <= 10^4", "0 <= start <= end <= 10^5"],
    fn="insert_interval",
    params=[("intervals", "matrix"), ("new_interval", "array")],
    ret="matrix",
    ref="""
def insert_interval(intervals, new_interval):
    result = []
    begin, finish = new_interval
    index = 0
    while index < len(intervals) and intervals[index][1] < begin:
        result.append(intervals[index])
        index += 1
    while index < len(intervals) and intervals[index][0] <= finish:
        begin = min(begin, intervals[index][0])
        finish = max(finish, intervals[index][1])
        index += 1
    result.append([begin, finish])
    result.extend(intervals[index:])
    return result
""",
    examples=[
        ({"intervals": [[1, 3], [6, 9]], "new_interval": [2, 5]}, [[1, 5], [6, 9]]),
        ({"intervals": [[1, 2], [3, 5], [6, 7], [8, 10], [12, 16]], "new_interval": [4, 8]}, [[1, 2], [3, 10], [12, 16]]),
    ],
    tests=[{"intervals": [], "new_interval": [5, 7]}, {"intervals": [[1, 5]], "new_interval": [6, 8]}, {"intervals": [[3, 5]], "new_interval": [0, 1]}, {"intervals": [[1, 5]], "new_interval": [5, 7]}],
)

problem(
    id="minimum-platforms",
    source="Minimum number of platforms required for a railway",
    title="Minimum Platforms",
    topic="Greedy",
    difficulty="Medium",
    structure="array",
    description="""Train i arrives at arrival[i] and leaves at departure[i] (times written as HHMM). A train needs a
    platform for its whole stay, and a train arriving at the moment another departs still needs its own platform.
    Return the fewest platforms that avoid any waiting.""",
    constraints=["1 <= n <= 5 * 10^4", "0000 <= times <= 2359", "arrival[i] <= departure[i]"],
    fn="min_platforms",
    params=[("arrival", "array"), ("departure", "array")],
    ret="int",
    ref="""
def min_platforms(arrival, departure):
    arrival = sorted(arrival)
    departure = sorted(departure)
    i = j = 0
    platforms = best = 0
    while i < len(arrival):
        if arrival[i] <= departure[j]:
            platforms += 1
            best = max(best, platforms)
            i += 1
        else:
            platforms -= 1
            j += 1
    return best
""",
    examples=[
        ({"arrival": [900, 940, 950, 1100, 1500, 1800], "departure": [910, 1200, 1120, 1130, 1900, 2000]}, 3),
        ({"arrival": [900, 1100, 1235], "departure": [1000, 1200, 1240]}, 1),
    ],
    tests=[{"arrival": [1000], "departure": [1000]}, {"arrival": [900, 1000], "departure": [1000, 1100]}, {"arrival": [i % 2300 for i in range(0, 3000, 7)], "departure": [min(2359, i % 2300 + 45) for i in range(0, 3000, 7)]}],
)

problem(
    id="valid-parenthesis-wildcard",
    source="Valid Paranthesis Checker",
    title="Parentheses with Wildcards",
    topic="Greedy",
    difficulty="Medium",
    structure="string",
    description="""s contains '(', ')' and '*'. Each '*' may act as '(', ')' or nothing. Return whether s can be read as
    balanced. Track the smallest and largest possible number of open brackets as you scan.""",
    constraints=["1 <= s.length <= 100"],
    fn="check_valid_string",
    params=[("s", "string")],
    ret="bool",
    ref="""
def check_valid_string(s):
    low = high = 0
    for char in s:
        if char == "(":
            low += 1
            high += 1
        elif char == ")":
            low -= 1
            high -= 1
        else:
            low -= 1
            high += 1
        if high < 0:
            return False
        low = max(low, 0)
    return low == 0
""",
    examples=[({"s": "()"}, True), ({"s": "(*))"}, True), ({"s": ")("}, False)],
    tests=[{"s": "*"}, {"s": "((((()(()()()*()(((((*)()*(**(())))))(())()())(((())())())))))))(((((())*)))()))(()((*()*(*)))(*)()"}, {"s": "(((*)"}, {"s": "(*()"}],
)

problem(
    id="candy",
    source="Candy",
    title="Candy",
    topic="Greedy",
    difficulty="Hard",
    structure="array",
    description="""Children stand in a line with ratings. Every child gets at least one candy, and a child with a higher
    rating than a neighbour gets more candy than that neighbour. Return the fewest candies needed. Sweep left to right,
    then right to left.""",
    constraints=["1 <= ratings.length <= 2 * 10^4", "0 <= ratings[i] <= 2 * 10^4"],
    fn="candy",
    params=[("ratings", "array")],
    ret="int",
    ref="""
def candy(ratings):
    n = len(ratings)
    candies = [1] * n
    for i in range(1, n):
        if ratings[i] > ratings[i - 1]:
            candies[i] = candies[i - 1] + 1
    for i in range(n - 2, -1, -1):
        if ratings[i] > ratings[i + 1]:
            candies[i] = max(candies[i], candies[i + 1] + 1)
    return sum(candies)
""",
    examples=[({"ratings": [1, 0, 2]}, 5), ({"ratings": [1, 2, 2]}, 4)],
    tests=[{"ratings": [7]}, {"ratings": [1, 3, 4, 5, 2]}, {"ratings": list(range(100)) + list(range(100, 0, -1))}, {"ratings": [1, 2, 87, 87, 87, 2, 1]}],
)

# ---------------------------------------------------------------- sliding window

problem(
    id="max-points-from-cards",
    source="Maximum Points You Can Obtain from Cards",
    title="Points from Cards",
    topic="Sliding Window",
    difficulty="Medium",
    structure="array",
    description="""Take exactly k cards, each from the left or right end of the row. Return the highest possible total.
    Equivalently, find the window of n - k cards with the smallest sum that you leave behind.""",
    constraints=["1 <= cards.length <= 10^5", "1 <= k <= cards.length", "1 <= cards[i] <= 10^4"],
    fn="max_score",
    params=[("cards", "array"), ("k", "int")],
    ret="int",
    ref="""
def max_score(cards, k):
    total = sum(cards[:k])
    best = total
    for taken_right in range(1, k + 1):
        total += cards[-taken_right] - cards[k - taken_right]
        best = max(best, total)
    return best
""",
    examples=[({"cards": [1, 2, 3, 4, 5, 6, 1], "k": 3}, 12), ({"cards": [2, 2, 2], "k": 2}, 4)],
    tests=[{"cards": [9, 7, 7, 9, 7, 7, 9], "k": 7}, {"cards": [1, 1000, 1], "k": 1}, {"cards": [1, 79, 80, 1, 1, 1, 200, 1], "k": 3}, {"cards": [(i * 13) % 101 + 1 for i in range(3000)], "k": 1200}],
)

problem(
    id="longest-substring-no-repeat",
    source="Longest Substring Without Repeating Characters",
    title="Longest Substring Without Repeats",
    topic="Sliding Window",
    difficulty="Medium",
    structure="string",
    description="""Return the length of the longest substring of s with no repeated character. Keep a window and each
    character's last position; jump the left edge past a repeat.""",
    constraints=["0 <= s.length <= 5 * 10^4", "Printable ASCII."],
    fn="length_of_longest_substring",
    params=[("s", "string")],
    ret="int",
    ref="""
def length_of_longest_substring(s):
    last = {}
    left = best = 0
    for right, char in enumerate(s):
        if char in last and last[char] >= left:
            left = last[char] + 1
        last[char] = right
        best = max(best, right - left + 1)
    return best
""",
    examples=[({"s": "abcabcbb"}, 3), ({"s": "bbbbb"}, 1), ({"s": ""}, 0)],
    tests=[{"s": "pwwkew"}, {"s": "abba"}, {"s": " "}, {"s": "tmmzuxt"}],
)

problem(
    id="max-consecutive-ones-iii",
    source="Max Consecutive Ones III",
    title="Longest Ones with K Flips",
    topic="Sliding Window",
    difficulty="Medium",
    structure="array",
    description="""nums holds 0s and 1s. You may flip at most k zeros to ones. Return the length of the longest run of
    ones you can make. Grow a window and shrink it whenever it holds more than k zeros.""",
    constraints=["1 <= nums.length <= 10^5", "0 <= k <= nums.length"],
    fn="longest_ones",
    params=[("nums", "array"), ("k", "int")],
    ret="int",
    ref="""
def longest_ones(nums, k):
    left = zeros = best = 0
    for right, value in enumerate(nums):
        if value == 0:
            zeros += 1
        while zeros > k:
            if nums[left] == 0:
                zeros -= 1
            left += 1
        best = max(best, right - left + 1)
    return best
""",
    examples=[
        ({"nums": [1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0], "k": 2}, 6),
        ({"nums": [0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1], "k": 3}, 10),
    ],
    tests=[{"nums": [0], "k": 0}, {"nums": [0, 0, 0], "k": 3}, {"nums": [(i % 5 != 0) * 1 for i in range(2000)], "k": 10}],
)

problem(
    id="fruit-into-baskets",
    source="Fruit Into Baskets",
    title="Fruit into Two Baskets",
    topic="Sliding Window",
    difficulty="Medium",
    structure="hashmap",
    description="""Walking right from any tree, you pick one fruit per tree but may carry only two kinds. Return the most
    fruit you can pick: the longest window containing at most two distinct values.""",
    constraints=["1 <= fruits.length <= 10^5", "0 <= fruits[i] < fruits.length"],
    fn="total_fruit",
    params=[("fruits", "array")],
    ret="int",
    ref="""
def total_fruit(fruits):
    counts = {}
    left = best = 0
    for right, kind in enumerate(fruits):
        counts[kind] = counts.get(kind, 0) + 1
        while len(counts) > 2:
            counts[fruits[left]] -= 1
            if counts[fruits[left]] == 0:
                del counts[fruits[left]]
            left += 1
        best = max(best, right - left + 1)
    return best
""",
    examples=[({"fruits": [1, 2, 1]}, 3), ({"fruits": [0, 1, 2, 2]}, 3), ({"fruits": [1, 2, 3, 2, 2]}, 4)],
    tests=[{"fruits": [0]}, {"fruits": [3, 3, 3, 1, 2, 1, 1, 2, 3, 3, 4]}, {"fruits": [i % 3 for i in range(3000)]}],
)

problem(
    id="longest-k-distinct",
    source="Longest Substring With At Most K Distinct Characters",
    title="Longest Substring with K Distinct Letters",
    topic="Sliding Window",
    difficulty="Medium",
    structure="hashmap",
    description="""Return the length of the longest substring of s that contains at most k distinct characters.""",
    constraints=["1 <= s.length <= 5 * 10^4", "0 <= k <= 50"],
    fn="longest_k_distinct",
    params=[("s", "string"), ("k", "int")],
    ret="int",
    ref="""
def longest_k_distinct(s, k):
    counts = {}
    left = best = 0
    for right, char in enumerate(s):
        counts[char] = counts.get(char, 0) + 1
        while len(counts) > k:
            counts[s[left]] -= 1
            if counts[s[left]] == 0:
                del counts[s[left]]
            left += 1
        best = max(best, right - left + 1)
    return best
""",
    examples=[({"s": "eceba", "k": 2}, 3), ({"s": "aa", "k": 1}, 2)],
    tests=[{"s": "abc", "k": 0}, {"s": "aabacbebebe", "k": 3}, {"s": "abcdefghij" * 50, "k": 5}],
)

problem(
    id="longest-repeating-replacement",
    source="Longest Repeating Character Replacement",
    title="Longest Repeat After K Replacements",
    topic="Sliding Window",
    difficulty="Medium",
    structure="string",
    description="""You may replace at most k characters of s. Return the length of the longest substring of one repeated
    letter you can make. A window is valid while its length minus its most common letter's count is at most k.""",
    constraints=["1 <= s.length <= 10^5", "Uppercase English letters.", "0 <= k <= s.length"],
    fn="character_replacement",
    params=[("s", "string"), ("k", "int")],
    ret="int",
    ref="""
def character_replacement(s, k):
    counts = {}
    left = top = best = 0
    for right, char in enumerate(s):
        counts[char] = counts.get(char, 0) + 1
        top = max(top, counts[char])
        while right - left + 1 - top > k:
            counts[s[left]] -= 1
            left += 1
        best = max(best, right - left + 1)
    return best
""",
    examples=[({"s": "ABAB", "k": 2}, 4), ({"s": "AABABBA", "k": 1}, 4)],
    tests=[{"s": "A", "k": 0}, {"s": "ABCDE", "k": 1}, {"s": "ABBB" * 100, "k": 2}],
)

problem(
    id="minimum-window-substring",
    source="Minimum Window Substring",
    title="Minimum Window Substring",
    topic="Sliding Window",
    difficulty="Hard",
    structure="string",
    description="""Return the shortest substring of s that contains every character of t, counting duplicates. If several
    shortest windows exist, return the one that starts first. Return an empty string if no window works.""",
    constraints=["1 <= s.length, t.length <= 10^5", "English letters."],
    fn="min_window",
    params=[("s", "string"), ("t", "string")],
    ret="string",
    ref="""
def min_window(s, t):
    need = {}
    for char in t:
        need[char] = need.get(char, 0) + 1
    missing = len(t)
    left = 0
    best_start, best_length = 0, None
    for right, char in enumerate(s):
        if need.get(char, 0) > 0:
            missing -= 1
        need[char] = need.get(char, 0) - 1
        while missing == 0:
            if best_length is None or right - left + 1 < best_length:
                best_start, best_length = left, right - left + 1
            need[s[left]] += 1
            if need[s[left]] > 0:
                missing += 1
            left += 1
    return "" if best_length is None else s[best_start:best_start + best_length]
""",
    examples=[({"s": "ADOBECODEBANC", "t": "ABC"}, "BANC"), ({"s": "a", "t": "aa"}, "")],
    tests=[{"s": "a", "t": "a"}, {"s": "abcabc", "t": "cb"}, {"s": "aaflslflsldkalskaaa", "t": "aaa"}, {"s": "xyz" * 300 + "abc", "t": "cba"}],
)

problem(
    id="substrings-with-all-three",
    source="Number of Substrings Containing All Three Characters",
    title="Substrings with a, b and c",
    topic="Sliding Window",
    difficulty="Medium",
    structure="string",
    description="""s contains only 'a', 'b' and 'c'. Return how many substrings contain at least one of each. For each
    right edge, every start at or before the earliest last-seen position works.""",
    constraints=["3 <= s.length <= 5 * 10^4"],
    fn="number_of_substrings",
    params=[("s", "string")],
    ret="int",
    ref="""
def number_of_substrings(s):
    last = {"a": -1, "b": -1, "c": -1}
    total = 0
    for index, char in enumerate(s):
        last[char] = index
        total += min(last.values()) + 1
    return total
""",
    examples=[({"s": "abcabc"}, 10), ({"s": "aaacb"}, 3)],
    tests=[{"s": "abc"}, {"s": "aaa"}, {"s": "abc" * 1000}],
)
