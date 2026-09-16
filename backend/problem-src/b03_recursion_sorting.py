from dsl import problem

SORT_TESTS = [
    {"nums": [1]},
    {"nums": [3, -1, 0, -1, 8, 2]},
    {"nums": [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]},
    {"nums": [4, 4, 4, 4]},
    {"nums": [12, -7, 33, 0, 5, 5, -20, 18, 1, 2, 90, -3]},
]

# ---------------------------------------------------------------- recursion basics

problem(
    id="sum-first-n-recursive",
    source="Sum of First N Numbers",
    title="Sum of the First N Numbers",
    topic="Recursion",
    difficulty="Easy",
    structure="number",
    description="""Return 1 + 2 + ... + n using recursion: the sum up to n is n plus the sum up to n - 1, and the
    sum up to 0 is 0. Watch the call stack grow to the base case and unwind.""",
    constraints=["0 <= n <= 500"],
    fn="sum_first_n",
    params=[("n", "int")],
    ret="long",
    ref="""
def sum_first_n(n):
    if n == 0:
        return 0
    return n + sum_first_n(n - 1)
""",
    examples=[({"n": 5}, 15), ({"n": 0}, 0)],
    tests=[{"n": 1}, {"n": 100}, {"n": 500}, {"n": 37}],
)

problem(
    id="factorial-recursive",
    source="Factorial of a Given Number",
    title="Factorial with Recursion",
    topic="Recursion",
    difficulty="Easy",
    structure="number",
    description="""Compute n! recursively: n! = n × (n - 1)!, with 0! = 1. Step through the replay to see each call
    wait for the one below it.""",
    constraints=["0 <= n <= 20"],
    fn="factorial_recursive",
    params=[("n", "int")],
    ret="long",
    ref="""
def factorial_recursive(n):
    if n <= 1:
        return 1
    return n * factorial_recursive(n - 1)
""",
    examples=[({"n": 4}, 24), ({"n": 0}, 1)],
    tests=[{"n": 1}, {"n": 12}, {"n": 20}],
)

problem(
    id="sum-array-recursive",
    source="Sum of Array Elements",
    title="Array Sum with Recursion",
    topic="Recursion",
    difficulty="Easy",
    structure="array",
    description="""Return the sum of nums without a loop: the sum from index i is nums[i] plus the sum from i + 1, and
    the sum past the end is 0.""",
    constraints=["0 <= nums.length <= 500", "-10^4 <= nums[i] <= 10^4"],
    fn="sum_array_recursive",
    params=[("nums", "array")],
    ret="long",
    starter="""
def sum_array_recursive(nums):
    def total_from(index):
        # Return the sum of nums[index:].
        return 0
    return total_from(0)
""",
    ref="""
def sum_array_recursive(nums):
    def total_from(index):
        if index == len(nums):
            return 0
        return nums[index] + total_from(index + 1)
    return total_from(0)
""",
    examples=[({"nums": [3, 1, 4]}, 8), ({"nums": []}, 0)],
    tests=[{"nums": [-5]}, {"nums": [10, -10, 10, -10, 7]}, {"nums": list(range(1, 401))}],
)

problem(
    id="reverse-string-recursive",
    source="Reverse a String I",
    title="Reverse a String",
    topic="Recursion",
    difficulty="Easy",
    structure="string",
    description="""Return s reversed. Work recursively on a list of its characters: swap the outermost pair, then
    reverse what lies between them.""",
    constraints=["0 <= s.length <= 1000", "s contains printable ASCII characters."],
    fn="reverse_string",
    params=[("s", "string")],
    ret="string",
    ref="""
def reverse_string(s):
    chars = list(s)

    def reverse(left, right):
        if left >= right:
            return
        chars[left], chars[right] = chars[right], chars[left]
        reverse(left + 1, right - 1)

    reverse(0, len(chars) - 1)
    return "".join(chars)
""",
    examples=[({"s": "hello"}, "olleh"), ({"s": "a"}, "a")],
    tests=[{"s": ""}, {"s": "ab"}, {"s": "Noesis traces"}, {"s": "racecar"}],
)

problem(
    id="palindrome-string-recursive",
    source="Check if String is Palindrome or Not",
    title="Palindrome String with Recursion",
    topic="Recursion",
    difficulty="Easy",
    structure="string",
    description="""Return whether s reads the same in both directions, comparing characters exactly (case matters).
    A string is a palindrome if its ends match and its middle is a palindrome.""",
    constraints=["0 <= s.length <= 1000"],
    fn="is_palindrome_recursive",
    params=[("s", "string")],
    ret="bool",
    ref="""
def is_palindrome_recursive(s):
    def check(left, right):
        if left >= right:
            return True
        if s[left] != s[right]:
            return False
        return check(left + 1, right - 1)

    return check(0, len(s) - 1)
""",
    examples=[({"s": "madam"}, True), ({"s": "Madam"}, False, "M and m are different characters.")],
    tests=[{"s": ""}, {"s": "ab"}, {"s": "abba"}, {"s": "abcba"}, {"s": "abca"}],
)

problem(
    id="prime-check-recursive",
    source="Check if a Number is Prime or Not",
    title="Prime Check with Recursion",
    topic="Recursion",
    difficulty="Easy",
    structure="number",
    description="""Return whether n is prime by trying divisors recursively: check d, and if it does not divide n,
    check d + 1, stopping once d × d exceeds n.""",
    constraints=["1 <= n <= 10^5"],
    fn="is_prime_recursive",
    params=[("n", "int")],
    ret="bool",
    ref="""
def is_prime_recursive(n):
    def no_divisor_from(d):
        if d * d > n:
            return True
        if n % d == 0:
            return False
        return no_divisor_from(d + 1)

    return n >= 2 and no_divisor_from(2)
""",
    examples=[({"n": 7}, True), ({"n": 1}, False), ({"n": 49}, False)],
    tests=[{"n": 2}, {"n": 97}, {"n": 99991}, {"n": 100000}],
)

problem(
    id="reverse-array-recursive",
    source="Reverse an array",
    title="Reverse an Array with Recursion",
    topic="Recursion",
    difficulty="Easy",
    structure="array",
    description="""Reverse nums in place using recursion on two indices, then return it.""",
    constraints=["0 <= nums.length <= 1000"],
    fn="reverse_array_recursive",
    params=[("nums", "array")],
    ret="array",
    ref="""
def reverse_array_recursive(nums):
    def swap(left, right):
        if left >= right:
            return
        nums[left], nums[right] = nums[right], nums[left]
        swap(left + 1, right - 1)

    swap(0, len(nums) - 1)
    return nums
""",
    examples=[({"nums": [1, 2, 3, 4]}, [4, 3, 2, 1]), ({"nums": [5]}, [5])],
    tests=[{"nums": []}, {"nums": [1, 2, 3]}, {"nums": [9, -1, 9, -1, 0]}],
)

problem(
    id="sum-of-digits-recursive",
    source="Sum of Digits in a Given Number",
    title="Sum of Digits",
    topic="Recursion",
    difficulty="Easy",
    structure="number",
    description="""Return the sum of the decimal digits of a non-negative integer n, recursively: the last digit plus
    the digit sum of n // 10.""",
    constraints=["0 <= n <= 10^9"],
    fn="sum_digits",
    params=[("n", "int")],
    ret="int",
    ref="""
def sum_digits(n):
    if n < 10:
        return n
    return n % 10 + sum_digits(n // 10)
""",
    examples=[({"n": 9045}, 18), ({"n": 0}, 0)],
    tests=[{"n": 7}, {"n": 999999999}, {"n": 1000000000}, {"n": 12345}],
)

problem(
    id="fibonacci-number",
    source="Fibonacci Number",
    title="Fibonacci Number",
    topic="Recursion",
    difficulty="Easy",
    structure="number",
    description="""F(0) = 0, F(1) = 1 and F(n) = F(n - 1) + F(n - 2). Return F(n). The plain recursion repeats a lot
    of work; the replay makes the repeated calls easy to spot.""",
    constraints=["0 <= n <= 25"],
    fn="fib",
    params=[("n", "int")],
    ret="int",
    ref="""
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)
""",
    examples=[({"n": 6}, 8, "0, 1, 1, 2, 3, 5, 8"), ({"n": 0}, 0), ({"n": 1}, 1)],
    tests=[{"n": 2}, {"n": 10}, {"n": 20}, {"n": 25}],
    default_input={"n": 5},
)

# ---------------------------------------------------------------- sorting

problem(
    id="selection-sort",
    source="Selection Sort",
    title="Selection Sort",
    topic="Sorting",
    difficulty="Easy",
    structure="array",
    description="""Sort nums in ascending order with selection sort: for each position, find the smallest remaining
    value and swap it into place. Return the sorted array.""",
    constraints=["0 <= nums.length <= 1000", "-10^5 <= nums[i] <= 10^5"],
    fn="selection_sort",
    params=[("nums", "array")],
    ret="array",
    ref="""
def selection_sort(nums):
    n = len(nums)
    for i in range(n - 1):
        smallest = i
        for j in range(i + 1, n):
            if nums[j] < nums[smallest]:
                smallest = j
        nums[i], nums[smallest] = nums[smallest], nums[i]
    return nums
""",
    examples=[({"nums": [5, 2, 9, 1, 5]}, [1, 2, 5, 5, 9]), ({"nums": []}, [])],
    tests=SORT_TESTS,
)

problem(
    id="bubble-sort",
    source="Bubble Sort",
    title="Bubble Sort",
    topic="Sorting",
    difficulty="Easy",
    structure="array",
    description="""Sort nums in ascending order with bubble sort: repeatedly swap neighbours that are out of order,
    and stop early once a full pass makes no swaps.""",
    constraints=["0 <= nums.length <= 1000", "-10^5 <= nums[i] <= 10^5"],
    fn="bubble_sort",
    params=[("nums", "array")],
    ret="array",
    ref="""
def bubble_sort(nums):
    n = len(nums)
    for end in range(n - 1, 0, -1):
        swapped = False
        for i in range(end):
            if nums[i] > nums[i + 1]:
                nums[i], nums[i + 1] = nums[i + 1], nums[i]
                swapped = True
        if not swapped:
            break
    return nums
""",
    examples=[({"nums": [5, 2, 9, 1, 5]}, [1, 2, 5, 5, 9]), ({"nums": [1, 2, 3]}, [1, 2, 3], "Already sorted: one pass and done.")],
    tests=SORT_TESTS,
)

problem(
    id="insertion-sort",
    source="Insertion Sorting",
    title="Insertion Sort",
    topic="Sorting",
    difficulty="Easy",
    structure="array",
    description="""Sort nums in ascending order with insertion sort: grow a sorted prefix by sliding each new value
    left until it sits in order.""",
    constraints=["0 <= nums.length <= 1000", "-10^5 <= nums[i] <= 10^5"],
    fn="insertion_sort",
    params=[("nums", "array")],
    ret="array",
    ref="""
def insertion_sort(nums):
    for i in range(1, len(nums)):
        value = nums[i]
        j = i - 1
        while j >= 0 and nums[j] > value:
            nums[j + 1] = nums[j]
            j -= 1
        nums[j + 1] = value
    return nums
""",
    examples=[({"nums": [4, 3, 2, 10, 12, 1]}, [1, 2, 3, 4, 10, 12]), ({"nums": [7]}, [7])],
    tests=SORT_TESTS,
)

problem(
    id="merge-sort",
    source="Merge Sorting",
    title="Merge Sort",
    topic="Sorting",
    difficulty="Medium",
    structure="array",
    description="""Sort nums in ascending order with merge sort: split the range in half, sort each half recursively,
    then merge the two sorted halves.""",
    constraints=["0 <= nums.length <= 10^4", "-10^5 <= nums[i] <= 10^5"],
    fn="merge_sort",
    params=[("nums", "array")],
    ret="array",
    ref="""
def merge_sort(nums):
    def sort(low, high):
        if low >= high:
            return
        mid = (low + high) // 2
        sort(low, mid)
        sort(mid + 1, high)
        merged = []
        left, right = low, mid + 1
        while left <= mid and right <= high:
            if nums[left] <= nums[right]:
                merged.append(nums[left])
                left += 1
            else:
                merged.append(nums[right])
                right += 1
        merged.extend(nums[left:mid + 1])
        merged.extend(nums[right:high + 1])
        nums[low:high + 1] = merged

    sort(0, len(nums) - 1)
    return nums
""",
    examples=[({"nums": [38, 27, 43, 3, 9, 82, 10]}, [3, 9, 10, 27, 38, 43, 82]), ({"nums": [2, 1]}, [1, 2])],
    tests=SORT_TESTS + [{"nums": [(i * 7919) % 1000 - 500 for i in range(2000)]}],
)

problem(
    id="quick-sort",
    source="Quick Sorting",
    title="Quick Sort",
    topic="Sorting",
    difficulty="Medium",
    structure="array",
    description="""Sort nums in ascending order with quick sort: pick the first value of the range as the pivot,
    move smaller values to its left and larger ones to its right, then sort both sides recursively.""",
    constraints=["0 <= nums.length <= 10^4", "-10^5 <= nums[i] <= 10^5"],
    fn="quick_sort",
    params=[("nums", "array")],
    ret="array",
    ref="""
def quick_sort(nums):
    def partition(low, high):
        pivot = nums[low]
        i, j = low, high
        while i < j:
            while i <= high - 1 and nums[i] <= pivot:
                i += 1
            while j >= low + 1 and nums[j] > pivot:
                j -= 1
            if i < j:
                nums[i], nums[j] = nums[j], nums[i]
        nums[low], nums[j] = nums[j], nums[low]
        return j

    def sort(low, high):
        if low < high:
            p = partition(low, high)
            sort(low, p - 1)
            sort(p + 1, high)

    sort(0, len(nums) - 1)
    return nums
""",
    examples=[({"nums": [4, 6, 2, 5, 7, 9, 1, 3]}, [1, 2, 3, 4, 5, 6, 7, 9]), ({"nums": [3, 3, 1]}, [1, 3, 3])],
    tests=SORT_TESTS + [{"nums": [(i * 7919) % 1000 - 500 for i in range(2000)]}],
)
