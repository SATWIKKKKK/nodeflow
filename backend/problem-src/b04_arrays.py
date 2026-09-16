from dsl import problem

LONG = [((i * 7919 + 13) % 2001) - 1000 for i in range(3000)]

problem(
    id="linear-search",
    source="Linear Search",
    title="Linear Search",
    topic="Array",
    difficulty="Easy",
    structure="array",
    description="""Scan nums from left to right and return the index of the first value equal to target, or -1 if it
    never appears.""",
    constraints=["0 <= nums.length <= 10^4"],
    fn="linear_search",
    params=[("nums", "array"), ("target", "int")],
    ret="int",
    ref="""
def linear_search(nums, target):
    for index in range(len(nums)):
        if nums[index] == target:
            return index
    return -1
""",
    examples=[({"nums": [4, 2, 7, 2], "target": 2}, 1), ({"nums": [1, 3], "target": 5}, -1)],
    tests=[{"nums": [], "target": 1}, {"nums": [9], "target": 9}, {"nums": LONG, "target": LONG[-1]}, {"nums": [5, 5, 5], "target": 5}],
)

problem(
    id="largest-element",
    source="Largest Element",
    title="Largest Element",
    topic="Array",
    difficulty="Easy",
    structure="array",
    description="""Return the largest value in a non-empty array in a single pass.""",
    constraints=["1 <= nums.length <= 10^5", "-10^9 <= nums[i] <= 10^9"],
    fn="largest_element",
    params=[("nums", "array")],
    ret="int",
    ref="""
def largest_element(nums):
    best = nums[0]
    for value in nums:
        if value > best:
            best = value
    return best
""",
    examples=[({"nums": [3, 9, 2]}, 9), ({"nums": [-5]}, -5)],
    tests=[{"nums": [-3, -9, -1]}, {"nums": [7, 7, 7]}, {"nums": LONG}, {"nums": [1000000000, -1000000000]}],
)

problem(
    id="second-largest-element",
    source="Second Largest Element",
    title="Second Largest Element",
    topic="Array",
    difficulty="Easy",
    structure="array",
    description="""Return the largest value that is strictly smaller than the maximum, or -1 if no such value exists.
    Do it in one pass by tracking the best and second-best values.""",
    constraints=["1 <= nums.length <= 10^5", "0 <= nums[i] <= 10^9"],
    fn="second_largest",
    params=[("nums", "array")],
    ret="int",
    ref="""
def second_largest(nums):
    first = -1
    second = -1
    for value in nums:
        if value > first:
            second = first
            first = value
        elif first > value > second:
            second = value
    return second
""",
    examples=[({"nums": [10, 5, 10, 8]}, 8), ({"nums": [7, 7]}, -1)],
    tests=[{"nums": [1]}, {"nums": [1, 2]}, {"nums": [5, 4, 3, 2, 1]}, {"nums": [0, 0, 1]}, {"nums": [i % 997 for i in range(5000)]}],
)

problem(
    id="max-consecutive-ones",
    source="Maximum Consecutive Ones",
    title="Longest Run of Ones",
    topic="Array",
    difficulty="Easy",
    structure="array",
    description="""nums contains only 0s and 1s. Return the length of the longest run of consecutive 1s.""",
    constraints=["1 <= nums.length <= 10^5", "nums[i] is 0 or 1."],
    fn="max_consecutive_ones",
    params=[("nums", "array")],
    ret="int",
    ref="""
def max_consecutive_ones(nums):
    best = 0
    run = 0
    for value in nums:
        run = run + 1 if value == 1 else 0
        best = max(best, run)
    return best
""",
    examples=[({"nums": [1, 1, 0, 1, 1, 1]}, 3), ({"nums": [0, 0]}, 0)],
    tests=[{"nums": [1]}, {"nums": [1, 0, 1, 0, 1]}, {"nums": [1] * 50 + [0] + [1] * 49}, {"nums": [0, 1, 1, 1, 1]}],
)

problem(
    id="move-zeroes",
    source="Move Zeros to End",
    title="Move Zeros to the End",
    topic="Array",
    difficulty="Easy",
    structure="array",
    description="""Move every 0 in nums to the end while keeping the other values in their original order. Do it in
    place with a write pointer, then return nums.""",
    constraints=["1 <= nums.length <= 10^5"],
    fn="move_zeroes",
    params=[("nums", "array")],
    ret="array",
    ref="""
def move_zeroes(nums):
    write = 0
    for read in range(len(nums)):
        if nums[read] != 0:
            nums[write], nums[read] = nums[read], nums[write]
            write += 1
    return nums
""",
    examples=[({"nums": [0, 1, 0, 3, 12]}, [1, 3, 12, 0, 0]), ({"nums": [0]}, [0])],
    tests=[{"nums": [1, 2, 3]}, {"nums": [0, 0, 1]}, {"nums": [4, 0, 5, 0, 0, 6, -1, 0]}, {"nums": [0, 0, 0]}],
)

problem(
    id="missing-number",
    source="Find missing number",
    title="Find the Missing Number",
    topic="Array",
    difficulty="Easy",
    structure="array",
    description="""nums holds n distinct values taken from 0, 1, ..., n, so exactly one value in that range is
    missing. Return it using O(1) extra space.""",
    constraints=["1 <= n <= 10^4"],
    fn="missing_number",
    params=[("nums", "array")],
    ret="int",
    ref="""
def missing_number(nums):
    n = len(nums)
    expected = n * (n + 1) // 2
    return expected - sum(nums)
""",
    examples=[({"nums": [3, 0, 1]}, 2), ({"nums": [0, 1]}, 2, "Every value up to n = 2 is present except 2.")],
    tests=[{"nums": [0]}, {"nums": [1]}, {"nums": [9, 6, 4, 2, 3, 5, 7, 0, 1]}, {"nums": [i for i in range(1000) if i != 437]}],
)

problem(
    id="majority-element",
    source="Majority Element-I",
    title="Majority Element",
    topic="Array",
    difficulty="Easy",
    structure="array",
    description="""One value in nums appears more than n / 2 times. Return it. Moore's voting algorithm finds it in one
    pass with a single candidate and a counter.""",
    constraints=["1 <= nums.length <= 10^5", "A majority element always exists."],
    fn="majority_element",
    params=[("nums", "array")],
    ret="int",
    ref="""
def majority_element(nums):
    candidate = nums[0]
    count = 0
    for value in nums:
        if count == 0:
            candidate = value
        count += 1 if value == candidate else -1
    return candidate
""",
    examples=[({"nums": [2, 2, 1, 1, 1, 2, 2]}, 2), ({"nums": [7]}, 7)],
    tests=[{"nums": [3, 2, 3]}, {"nums": [1, 1, 1, 2, 3]}, {"nums": [5, 1, 5, 2, 5, 3, 5]}, {"nums": [-1] * 51 + [4] * 50}],
)

problem(
    id="spiral-matrix",
    source="Print the matrix in spiral manner",
    title="Spiral Order",
    topic="Matrix",
    difficulty="Medium",
    structure="matrix",
    description="""Return the values of an m × n matrix in clockwise spiral order, starting from the top-left
    corner and moving right.""",
    constraints=["1 <= m, n <= 20"],
    fn="spiral_order",
    params=[("matrix", "matrix")],
    ret="array",
    ref="""
def spiral_order(matrix):
    result = []
    top, bottom = 0, len(matrix) - 1
    left, right = 0, len(matrix[0]) - 1
    while top <= bottom and left <= right:
        for col in range(left, right + 1):
            result.append(matrix[top][col])
        top += 1
        for row in range(top, bottom + 1):
            result.append(matrix[row][right])
        right -= 1
        if top <= bottom:
            for col in range(right, left - 1, -1):
                result.append(matrix[bottom][col])
            bottom -= 1
        if left <= right:
            for row in range(bottom, top - 1, -1):
                result.append(matrix[row][left])
            left += 1
    return result
""",
    examples=[({"matrix": [[1, 2, 3], [4, 5, 6], [7, 8, 9]]}, [1, 2, 3, 6, 9, 8, 7, 4, 5]), ({"matrix": [[1, 2, 3, 4]]}, [1, 2, 3, 4])],
    tests=[{"matrix": [[1]]}, {"matrix": [[1], [2], [3]]}, {"matrix": [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]}, {"matrix": [[r * 5 + c for c in range(5)] for r in range(6)]}],
)

problem(
    id="pascal-value",
    source="Pascal's Triangle I",
    title="Pascal's Triangle: One Value",
    topic="Array",
    difficulty="Easy",
    structure="number",
    description="""Rows and columns of Pascal's triangle are numbered from 1. Return the value at row r, column c.
    It equals the binomial coefficient C(r - 1, c - 1), which you can build with a running product.""",
    constraints=["1 <= c <= r <= 30"],
    fn="pascal_value",
    params=[("r", "int"), ("c", "int")],
    ret="long",
    ref="""
def pascal_value(r, c):
    n, k = r - 1, c - 1
    result = 1
    for i in range(k):
        result = result * (n - i) // (i + 1)
    return result
""",
    examples=[({"r": 5, "c": 3}, 6, "Row 5 is 1 4 6 4 1."), ({"r": 1, "c": 1}, 1)],
    tests=[{"r": 30, "c": 15}, {"r": 10, "c": 10}, {"r": 7, "c": 2}, {"r": 20, "c": 11}],
)

problem(
    id="pascal-row",
    source="Pascal's Triangle II",
    title="Pascal's Triangle: One Row",
    topic="Array",
    difficulty="Easy",
    structure="array",
    description="""Return row n of Pascal's triangle (rows numbered from 1).""",
    constraints=["1 <= n <= 30"],
    fn="pascal_row",
    params=[("n", "int")],
    ret="array",
    ref="""
def pascal_row(n):
    row = [1]
    value = 1
    for i in range(1, n):
        value = value * (n - i) // i
        row.append(value)
    return row
""",
    examples=[({"n": 5}, [1, 4, 6, 4, 1]), ({"n": 1}, [1])],
    tests=[{"n": 2}, {"n": 10}, {"n": 30}],
)

problem(
    id="pascal-triangle",
    source="Pascal's Triangle III",
    title="Pascal's Triangle: First N Rows",
    topic="Array",
    difficulty="Easy",
    structure="matrix",
    description="""Return the first n rows of Pascal's triangle. Each value is the sum of the two values above it.""",
    constraints=["1 <= n <= 30"],
    fn="pascal_triangle",
    params=[("n", "int")],
    ret="matrix",
    ref="""
def pascal_triangle(n):
    rows = [[1]]
    for _ in range(n - 1):
        previous = rows[-1]
        row = [1]
        for i in range(1, len(previous)):
            row.append(previous[i - 1] + previous[i])
        row.append(1)
        rows.append(row)
    return rows
""",
    examples=[({"n": 4}, [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1]]), ({"n": 1}, [[1]])],
    tests=[{"n": 2}, {"n": 6}, {"n": 20}],
)

problem(
    id="rotate-matrix",
    source="Rotate matrix by 90 degrees",
    title="Rotate a Matrix",
    topic="Matrix",
    difficulty="Medium",
    structure="matrix",
    description="""Rotate an n × n matrix 90 degrees clockwise in place, then return it. Transposing the matrix and
    then reversing every row does exactly that.""",
    constraints=["1 <= n <= 20"],
    fn="rotate_matrix",
    params=[("matrix", "matrix")],
    ret="matrix",
    ref="""
def rotate_matrix(matrix):
    n = len(matrix)
    for i in range(n):
        for j in range(i + 1, n):
            matrix[i][j], matrix[j][i] = matrix[j][i], matrix[i][j]
    for row in matrix:
        row.reverse()
    return matrix
""",
    examples=[({"matrix": [[1, 2, 3], [4, 5, 6], [7, 8, 9]]}, [[7, 4, 1], [8, 5, 2], [9, 6, 3]]), ({"matrix": [[1]]}, [[1]])],
    tests=[{"matrix": [[1, 2], [3, 4]]}, {"matrix": [[5, 1, 9, 11], [2, 4, 8, 10], [13, 3, 6, 7], [15, 14, 12, 16]]}, {"matrix": [[r * 6 + c for c in range(6)] for r in range(6)]}],
)

problem(
    id="three-sum",
    source="3 Sum",
    title="Three Sum",
    topic="Two Pointers",
    difficulty="Medium",
    structure="array",
    description="""Return every distinct triplet [a, b, c] from nums with a + b + c = 0. Write each triplet in
    ascending order; the triplets themselves may come in any order, but none may repeat.""",
    constraints=["3 <= nums.length <= 3000", "-10^5 <= nums[i] <= 10^5"],
    fn="three_sum",
    params=[("nums", "array")],
    ret="matrix",
    compare="unordered",
    ref="""
def three_sum(nums):
    nums.sort()
    result = []
    for i in range(len(nums) - 2):
        if i > 0 and nums[i] == nums[i - 1]:
            continue
        left, right = i + 1, len(nums) - 1
        while left < right:
            total = nums[i] + nums[left] + nums[right]
            if total < 0:
                left += 1
            elif total > 0:
                right -= 1
            else:
                result.append([nums[i], nums[left], nums[right]])
                left += 1
                right -= 1
                while left < right and nums[left] == nums[left - 1]:
                    left += 1
                while left < right and nums[right] == nums[right + 1]:
                    right -= 1
    return result
""",
    examples=[({"nums": [-1, 0, 1, 2, -1, -4]}, [[-1, -1, 2], [-1, 0, 1]]), ({"nums": [0, 0, 0]}, [[0, 0, 0]]), ({"nums": [0, 1, 1]}, [])],
    tests=[{"nums": [-2, 0, 1, 1, 2]}, {"nums": [0, 0, 0, 0]}, {"nums": [-4, -2, -2, -2, 0, 1, 2, 2, 2, 3, 3, 4, 4, 6, 6]}, {"nums": [(i % 41) - 20 for i in range(300)]}],
)

problem(
    id="four-sum",
    source="4 Sum",
    title="Four Sum",
    topic="Two Pointers",
    difficulty="Medium",
    structure="array",
    description="""Return every distinct quadruplet [a, b, c, d] from nums whose sum equals target. Write each
    quadruplet in ascending order; the list may be in any order, without repeats.""",
    constraints=["1 <= nums.length <= 200", "-10^9 <= nums[i], target <= 10^9"],
    fn="four_sum",
    params=[("nums", "array"), ("target", "int")],
    ret="matrix",
    compare="unordered",
    ref="""
def four_sum(nums, target):
    nums.sort()
    n = len(nums)
    result = []
    for i in range(n - 3):
        if i > 0 and nums[i] == nums[i - 1]:
            continue
        for j in range(i + 1, n - 2):
            if j > i + 1 and nums[j] == nums[j - 1]:
                continue
            left, right = j + 1, n - 1
            while left < right:
                total = nums[i] + nums[j] + nums[left] + nums[right]
                if total < target:
                    left += 1
                elif total > target:
                    right -= 1
                else:
                    result.append([nums[i], nums[j], nums[left], nums[right]])
                    left += 1
                    right -= 1
                    while left < right and nums[left] == nums[left - 1]:
                        left += 1
                    while left < right and nums[right] == nums[right + 1]:
                        right -= 1
    return result
""",
    examples=[
        ({"nums": [1, 0, -1, 0, -2, 2], "target": 0}, [[-2, -1, 1, 2], [-2, 0, 0, 2], [-1, 0, 0, 1]]),
        ({"nums": [2, 2, 2, 2, 2], "target": 8}, [[2, 2, 2, 2]]),
    ],
    tests=[{"nums": [1], "target": 1}, {"nums": [1000000000, 1000000000, 1000000000, 1000000000], "target": -294967296}, {"nums": [-3, -1, 0, 2, 4, 5], "target": 2}, {"nums": [(i % 13) - 6 for i in range(80)], "target": 3}],
)

problem(
    id="kadane-max-subarray",
    source="Kadane's Algorithm",
    title="Maximum Subarray Sum",
    topic="Array",
    difficulty="Medium",
    structure="array",
    description="""Return the largest sum of any non-empty contiguous subarray. Kadane's algorithm keeps the best sum
    ending at the current index and drops it as soon as it turns negative.""",
    constraints=["1 <= nums.length <= 10^5", "-10^4 <= nums[i] <= 10^4"],
    fn="max_subarray_sum",
    params=[("nums", "array")],
    ret="long",
    ref="""
def max_subarray_sum(nums):
    best = nums[0]
    current = 0
    for value in nums:
        current += value
        best = max(best, current)
        if current < 0:
            current = 0
    return best
""",
    examples=[({"nums": [-2, 1, -3, 4, -1, 2, 1, -5, 4]}, 6, "[4, -1, 2, 1] sums to 6."), ({"nums": [-3, -1, -2]}, -1)],
    tests=[{"nums": [5]}, {"nums": [5, 4, -1, 7, 8]}, {"nums": LONG}, {"nums": [-2, -3, 4, -1, -2, 1, 5, -3]}],
)

problem(
    id="next-permutation",
    source="Next Permutation",
    title="Next Permutation",
    topic="Array",
    difficulty="Medium",
    structure="array",
    description="""Rearrange nums into the next permutation in lexicographic order, in place, and return it. If nums is
    already the largest arrangement, wrap around to the smallest (ascending) one.""",
    constraints=["1 <= nums.length <= 100", "0 <= nums[i] <= 100"],
    fn="next_permutation",
    params=[("nums", "array")],
    ret="array",
    ref="""
def next_permutation(nums):
    pivot = len(nums) - 2
    while pivot >= 0 and nums[pivot] >= nums[pivot + 1]:
        pivot -= 1
    if pivot >= 0:
        swap = len(nums) - 1
        while nums[swap] <= nums[pivot]:
            swap -= 1
        nums[pivot], nums[swap] = nums[swap], nums[pivot]
    left, right = pivot + 1, len(nums) - 1
    while left < right:
        nums[left], nums[right] = nums[right], nums[left]
        left += 1
        right -= 1
    return nums
""",
    examples=[({"nums": [1, 2, 3]}, [1, 3, 2]), ({"nums": [3, 2, 1]}, [1, 2, 3]), ({"nums": [1, 1, 5]}, [1, 5, 1])],
    tests=[{"nums": [1]}, {"nums": [2, 3, 1]}, {"nums": [1, 3, 2]}, {"nums": [2, 1, 5, 4, 3, 0, 0]}, {"nums": [5, 5, 5]}],
)

problem(
    id="majority-element-ii",
    source="Majority Element-II",
    title="Elements Above n / 3",
    topic="Array",
    difficulty="Medium",
    structure="array",
    description="""Return every value that appears more than n / 3 times in nums, in ascending order. There can be at
    most two such values, so an extended voting algorithm needs only two candidates.""",
    constraints=["1 <= nums.length <= 5 * 10^4", "-10^9 <= nums[i] <= 10^9"],
    fn="majority_elements",
    params=[("nums", "array")],
    ret="array",
    ref="""
def majority_elements(nums):
    first = second = None
    count_first = count_second = 0
    for value in nums:
        if value == first:
            count_first += 1
        elif value == second:
            count_second += 1
        elif count_first == 0:
            first, count_first = value, 1
        elif count_second == 0:
            second, count_second = value, 1
        else:
            count_first -= 1
            count_second -= 1
    result = []
    for candidate in (first, second):
        if candidate is not None and candidate not in result and nums.count(candidate) > len(nums) // 3:
            result.append(candidate)
    return sorted(result)
""",
    examples=[({"nums": [3, 2, 3]}, [3]), ({"nums": [1, 2]}, [1, 2]), ({"nums": [1, 1, 1, 3, 3, 2, 2, 2]}, [1, 2])],
    tests=[{"nums": [1]}, {"nums": [1, 2, 3]}, {"nums": [2, 2]}, {"nums": [4, 1, 4, 2, 4, 3, 4, 5, 6]}, {"nums": [0, -1, 0, -1, 0, -1, 7]}],
)

problem(
    id="repeating-and-missing",
    source="Find the repeating and missing number",
    title="Repeating and Missing Number",
    topic="Array",
    difficulty="Hard",
    structure="array",
    description="""nums has n values from 1 to n, except one value appears twice and one is missing. Return
    [repeating, missing]. The sums of values and of squares give two equations for the two unknowns.""",
    constraints=["2 <= n <= 10^5"],
    fn="find_repeating_missing",
    params=[("nums", "array")],
    ret="array",
    ref="""
def find_repeating_missing(nums):
    n = len(nums)
    sum_diff = sum(nums) - n * (n + 1) // 2
    square_diff = sum(value * value for value in nums) - n * (n + 1) * (2 * n + 1) // 6
    both = square_diff // sum_diff
    repeating = (sum_diff + both) // 2
    return [repeating, repeating - sum_diff]
""",
    examples=[({"nums": [3, 1, 2, 5, 3]}, [3, 4]), ({"nums": [1, 1]}, [1, 2])],
    tests=[{"nums": [2, 2]}, {"nums": [4, 3, 6, 2, 1, 1]}, {"nums": [i if i != 700 else 3 for i in range(1, 1001)]}],
)

problem(
    id="count-inversions",
    source="Count Inversions",
    title="Count Inversions",
    topic="Sorting",
    difficulty="Hard",
    structure="array",
    description="""An inversion is a pair of indices i < j with nums[i] > nums[j]. Return how many there are. Count
    them while merge sorting: each time a right-half value is placed first, it jumps every remaining left-half value.""",
    constraints=["1 <= nums.length <= 10^5", "1 <= nums[i] <= 10^9"],
    fn="count_inversions",
    params=[("nums", "array")],
    ret="long",
    ref="""
def count_inversions(nums):
    def sort(low, high):
        if low >= high:
            return 0
        mid = (low + high) // 2
        count = sort(low, mid) + sort(mid + 1, high)
        merged = []
        left, right = low, mid + 1
        while left <= mid and right <= high:
            if nums[left] <= nums[right]:
                merged.append(nums[left])
                left += 1
            else:
                merged.append(nums[right])
                count += mid - left + 1
                right += 1
        merged.extend(nums[left:mid + 1])
        merged.extend(nums[right:high + 1])
        nums[low:high + 1] = merged
        return count

    return sort(0, len(nums) - 1)
""",
    examples=[({"nums": [5, 3, 2, 4, 1]}, 8), ({"nums": [1, 2, 3]}, 0)],
    tests=[{"nums": [1]}, {"nums": [2, 2, 2]}, {"nums": list(range(500, 0, -1))}, {"nums": [(i * 7919) % 1009 + 1 for i in range(3000)]}],
)

problem(
    id="reverse-pairs",
    source="Reverse Pairs",
    title="Reverse Pairs",
    topic="Sorting",
    difficulty="Hard",
    structure="array",
    description="""Count pairs of indices i < j with nums[i] > 2 × nums[j]. A merge sort can count them between the
    two sorted halves before merging.""",
    constraints=["1 <= nums.length <= 5 * 10^4", "-2^31 <= nums[i] <= 2^31 - 1"],
    fn="reverse_pairs",
    params=[("nums", "array")],
    ret="long",
    ref="""
def reverse_pairs(nums):
    def sort(low, high):
        if low >= high:
            return 0
        mid = (low + high) // 2
        count = sort(low, mid) + sort(mid + 1, high)
        right = mid + 1
        for left in range(low, mid + 1):
            while right <= high and nums[left] > 2 * nums[right]:
                right += 1
            count += right - (mid + 1)
        nums[low:high + 1] = sorted(nums[low:high + 1])
        return count

    return sort(0, len(nums) - 1)
""",
    examples=[({"nums": [1, 3, 2, 3, 1]}, 2), ({"nums": [2, 4, 3, 5, 1]}, 3)],
    tests=[{"nums": [1]}, {"nums": [-5, -5]}, {"nums": [2147483647, 2147483647, -2147483647, -2147483647]}, {"nums": LONG[:2000]}],
)
