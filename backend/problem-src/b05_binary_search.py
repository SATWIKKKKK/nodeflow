from dsl import problem

SORTED = sorted(((i * 37) % 500) for i in range(800))


def peak_grid(rows, cols, pr, pc):
    return [[1000 - 3 * (abs(r - pr) + abs(c - pc)) for c in range(cols)] for r in range(rows)]


problem(
    id="lower-bound",
    source="Lower Bound",
    title="Lower Bound",
    topic="Binary Search",
    difficulty="Easy",
    structure="array",
    description="""nums is sorted in ascending order. Return the first index whose value is at least x, or
    nums.length if every value is smaller.""",
    constraints=["0 <= nums.length <= 10^5", "nums is sorted ascending."],
    fn="lower_bound",
    params=[("nums", "array"), ("x", "int")],
    ret="int",
    ref="""
def lower_bound(nums, x):
    low, high = 0, len(nums)
    while low < high:
        mid = (low + high) // 2
        if nums[mid] >= x:
            high = mid
        else:
            low = mid + 1
    return low
""",
    examples=[({"nums": [1, 2, 2, 3], "x": 2}, 1), ({"nums": [1, 2, 3], "x": 4}, 3)],
    tests=[{"nums": [], "x": 5}, {"nums": [5], "x": 1}, {"nums": SORTED, "x": 250}, {"nums": [2, 2, 2], "x": 2}],
)

problem(
    id="upper-bound",
    source="Upper Bound",
    title="Upper Bound",
    topic="Binary Search",
    difficulty="Easy",
    structure="array",
    description="""nums is sorted in ascending order. Return the first index whose value is strictly greater than x,
    or nums.length if there is none.""",
    constraints=["0 <= nums.length <= 10^5", "nums is sorted ascending."],
    fn="upper_bound",
    params=[("nums", "array"), ("x", "int")],
    ret="int",
    ref="""
def upper_bound(nums, x):
    low, high = 0, len(nums)
    while low < high:
        mid = (low + high) // 2
        if nums[mid] > x:
            high = mid
        else:
            low = mid + 1
    return low
""",
    examples=[({"nums": [1, 2, 2, 3], "x": 2}, 3), ({"nums": [1, 2, 3], "x": 0}, 0)],
    tests=[{"nums": [], "x": 5}, {"nums": [5], "x": 5}, {"nums": SORTED, "x": 250}, {"nums": [2, 2, 2], "x": 2}],
)

problem(
    id="search-insert-position",
    source="Search insert position",
    title="Search Insert Position",
    topic="Binary Search",
    difficulty="Easy",
    structure="array",
    description="""nums is sorted and has distinct values. Return the index of target if it is present, otherwise the
    index where it would be inserted to keep nums sorted.""",
    constraints=["1 <= nums.length <= 10^4", "Values are distinct and sorted ascending."],
    fn="search_insert",
    params=[("nums", "array"), ("target", "int")],
    ret="int",
    ref="""
def search_insert(nums, target):
    low, high = 0, len(nums)
    while low < high:
        mid = (low + high) // 2
        if nums[mid] < target:
            low = mid + 1
        else:
            high = mid
    return low
""",
    examples=[({"nums": [1, 3, 5, 6], "target": 5}, 2), ({"nums": [1, 3, 5, 6], "target": 2}, 1), ({"nums": [1, 3, 5, 6], "target": 7}, 4)],
    tests=[{"nums": [1], "target": 0}, {"nums": [1], "target": 1}, {"nums": list(range(0, 2000, 2)), "target": 999}],
)

problem(
    id="first-last-occurrence",
    source="First and last occurrence",
    title="First and Last Position",
    topic="Binary Search",
    difficulty="Medium",
    structure="array",
    description="""nums is sorted. Return [first, last], the first and last indices where target appears, or
    [-1, -1] if it does not appear. Use two binary searches.""",
    constraints=["0 <= nums.length <= 10^5", "nums is sorted ascending."],
    fn="first_last",
    params=[("nums", "array"), ("target", "int")],
    ret="array",
    ref="""
def first_last(nums, target):
    def boundary(find_first):
        low, high, answer = 0, len(nums) - 1, -1
        while low <= high:
            mid = (low + high) // 2
            if nums[mid] == target:
                answer = mid
                if find_first:
                    high = mid - 1
                else:
                    low = mid + 1
            elif nums[mid] < target:
                low = mid + 1
            else:
                high = mid - 1
        return answer

    return [boundary(True), boundary(False)]
""",
    examples=[({"nums": [5, 7, 7, 8, 8, 10], "target": 8}, [3, 4]), ({"nums": [5, 7, 7, 8, 8, 10], "target": 6}, [-1, -1])],
    tests=[{"nums": [], "target": 0}, {"nums": [1], "target": 1}, {"nums": [2, 2, 2, 2], "target": 2}, {"nums": SORTED, "target": 111}],
)

problem(
    id="floor-square-root",
    source="Find square root of a number",
    title="Integer Square Root",
    topic="Binary Search",
    difficulty="Easy",
    structure="number",
    description="""Return the largest integer whose square is at most n, without using a square-root function.""",
    constraints=["0 <= n <= 2^31 - 1"],
    fn="floor_sqrt",
    params=[("n", "long")],
    ret="long",
    ref="""
def floor_sqrt(n):
    low, high = 0, n
    while low < high:
        mid = (low + high + 1) // 2
        if mid * mid <= n:
            low = mid
        else:
            high = mid - 1
    return low
""",
    examples=[({"n": 36}, 6), ({"n": 8}, 2)],
    tests=[{"n": 0}, {"n": 1}, {"n": 2147483647}, {"n": 1000000}, {"n": 99}],
)

problem(
    id="nth-root",
    source="Find Nth root of a number",
    title="Nth Root",
    topic="Binary Search",
    difficulty="Medium",
    structure="number",
    description="""Return the integer r with r^n = m, or -1 if no such integer exists. Binary search on r, and stop
    multiplying as soon as the power passes m.""",
    constraints=["1 <= n <= 30", "1 <= m <= 10^9"],
    fn="nth_root",
    params=[("n", "int"), ("m", "int")],
    ret="int",
    ref="""
def nth_root(n, m):
    low, high = 1, m
    while low <= high:
        mid = (low + high) // 2
        power = 1
        for _ in range(n):
            power *= mid
            if power > m:
                break
        if power == m:
            return mid
        if power < m:
            low = mid + 1
        else:
            high = mid - 1
    return -1
""",
    examples=[({"n": 3, "m": 27}, 3), ({"n": 4, "m": 69}, -1)],
    tests=[{"n": 1, "m": 14}, {"n": 2, "m": 1}, {"n": 9, "m": 1000000000}, {"n": 30, "m": 1073741824}, {"n": 5, "m": 243}],
)

problem(
    id="smallest-divisor-threshold",
    source="Find the smallest divisor",
    title="Smallest Divisor Under a Threshold",
    topic="Binary Search",
    difficulty="Medium",
    structure="array",
    description="""Choose a positive integer divisor, divide every value in nums by it rounding up, and add the
    results. Return the smallest divisor whose total is at most threshold.""",
    constraints=["1 <= nums.length <= 5 * 10^4", "1 <= nums[i] <= 10^6", "nums.length <= threshold <= 10^6"],
    fn="smallest_divisor",
    params=[("nums", "array"), ("threshold", "int")],
    ret="int",
    ref="""
def smallest_divisor(nums, threshold):
    low, high = 1, max(nums)
    while low < high:
        mid = (low + high) // 2
        total = sum((value + mid - 1) // mid for value in nums)
        if total <= threshold:
            high = mid
        else:
            low = mid + 1
    return low
""",
    examples=[({"nums": [1, 2, 5, 9], "threshold": 6}, 5), ({"nums": [44, 22, 33, 11, 1], "threshold": 5}, 44)],
    tests=[{"nums": [1], "threshold": 1}, {"nums": [2, 3, 5, 7, 11], "threshold": 11}, {"nums": [1000000] * 10, "threshold": 10}, {"nums": list(range(1, 3001)), "threshold": 5000}],
)

problem(
    id="koko-eating-bananas",
    source="Koko eating bananas",
    title="Eating Speed",
    topic="Binary Search",
    difficulty="Medium",
    structure="array",
    description="""Each pile holds piles[i] bananas. Eating at speed k, you finish min(k, pile) bananas from one pile
    per hour. Return the smallest integer speed that finishes every pile within h hours.""",
    constraints=["1 <= piles.length <= 10^4", "piles.length <= h <= 10^9", "1 <= piles[i] <= 10^9"],
    fn="min_eating_speed",
    params=[("piles", "array"), ("h", "int")],
    ret="int",
    ref="""
def min_eating_speed(piles, h):
    low, high = 1, max(piles)
    while low < high:
        mid = (low + high) // 2
        hours = sum((pile + mid - 1) // mid for pile in piles)
        if hours <= h:
            high = mid
        else:
            low = mid + 1
    return low
""",
    examples=[({"piles": [3, 6, 7, 11], "h": 8}, 4), ({"piles": [30, 11, 23, 4, 20], "h": 5}, 30)],
    tests=[{"piles": [30, 11, 23, 4, 20], "h": 6}, {"piles": [1], "h": 1}, {"piles": [1000000000], "h": 2}, {"piles": [312884470], "h": 968709470}],
)

problem(
    id="min-days-bouquets",
    source="Minimum days to make M bouquets",
    title="Days to Make Bouquets",
    topic="Binary Search",
    difficulty="Medium",
    structure="array",
    description="""Flower i blooms on day bloom[i]. A bouquet needs k adjacent bloomed flowers. Return the fewest days
    to wait before you can make m bouquets, or -1 if it can never happen.""",
    constraints=["1 <= bloom.length <= 10^5", "1 <= bloom[i] <= 10^9", "1 <= m <= 10^6", "1 <= k <= bloom.length"],
    fn="min_days",
    params=[("bloom", "array"), ("m", "int"), ("k", "int")],
    ret="int",
    ref="""
def min_days(bloom, m, k):
    if m * k > len(bloom):
        return -1

    def bouquets_by(day):
        made = run = 0
        for value in bloom:
            if value <= day:
                run += 1
                if run == k:
                    made += 1
                    run = 0
            else:
                run = 0
        return made

    low, high = min(bloom), max(bloom)
    while low < high:
        mid = (low + high) // 2
        if bouquets_by(mid) >= m:
            high = mid
        else:
            low = mid + 1
    return low
""",
    examples=[({"bloom": [1, 10, 3, 10, 2], "m": 3, "k": 1}, 3), ({"bloom": [1, 10, 3, 10, 2], "m": 3, "k": 2}, -1)],
    tests=[{"bloom": [7, 7, 7, 7, 12, 7, 7], "m": 2, "k": 3}, {"bloom": [1000000000, 1000000000], "m": 1, "k": 1}, {"bloom": [5], "m": 1, "k": 1}, {"bloom": [(i * 17) % 101 + 1 for i in range(500)], "m": 20, "k": 5}],
)

problem(
    id="aggressive-cows",
    source="Aggressive Cows",
    title="Aggressive Cows",
    topic="Binary Search",
    difficulty="Hard",
    structure="array",
    description="""Place cows in stalls at the given positions so that the smallest distance between any two cows is as
    large as possible. Return that largest possible minimum distance.""",
    constraints=["2 <= cows <= stalls.length <= 10^5", "0 <= stalls[i] <= 10^9", "Positions are distinct."],
    fn="aggressive_cows",
    params=[("stalls", "array"), ("cows", "int")],
    ret="int",
    ref="""
def aggressive_cows(stalls, cows):
    stalls.sort()

    def fits(gap):
        placed, last = 1, stalls[0]
        for position in stalls[1:]:
            if position - last >= gap:
                placed += 1
                last = position
        return placed >= cows

    low, high = 1, stalls[-1] - stalls[0]
    while low < high:
        mid = (low + high + 1) // 2
        if fits(mid):
            low = mid
        else:
            high = mid - 1
    return low
""",
    examples=[({"stalls": [1, 2, 4, 8, 9], "cows": 3}, 3), ({"stalls": [0, 3, 4, 7, 10, 9], "cows": 4}, 3)],
    tests=[{"stalls": [0, 1000000000], "cows": 2}, {"stalls": [1, 2], "cows": 2}, {"stalls": list(range(0, 3000, 3)), "cows": 100}, {"stalls": [10, 1, 2, 7, 5], "cows": 3}],
)

problem(
    id="book-allocation",
    source="Book Allocation Problem",
    title="Allocate Books",
    topic="Binary Search",
    difficulty="Hard",
    structure="array",
    description="""Books must be handed out in order, each student receiving a contiguous run of at least one book.
    Minimise the largest number of pages any student gets and return it, or -1 if there are more students than books.""",
    constraints=["1 <= pages.length <= 10^5", "1 <= pages[i] <= 10^4", "1 <= students <= 10^5"],
    fn="allocate_books",
    params=[("pages", "array"), ("students", "int")],
    ret="int",
    ref="""
def allocate_books(pages, students):
    if students > len(pages):
        return -1

    def students_needed(limit):
        count, load = 1, 0
        for page in pages:
            if load + page > limit:
                count += 1
                load = page
            else:
                load += page
        return count

    low, high = max(pages), sum(pages)
    while low < high:
        mid = (low + high) // 2
        if students_needed(mid) <= students:
            high = mid
        else:
            low = mid + 1
    return low
""",
    examples=[({"pages": [12, 34, 67, 90], "students": 2}, 113), ({"pages": [10, 20], "students": 3}, -1)],
    tests=[{"pages": [15, 17, 20], "students": 2}, {"pages": [5], "students": 1}, {"pages": [25, 46, 28, 49, 24], "students": 4}, {"pages": [(i * 31) % 97 + 1 for i in range(1000)], "students": 7}],
)

problem(
    id="find-peak-element",
    source="Find peak element",
    title="Find a Peak",
    topic="Binary Search",
    difficulty="Medium",
    structure="array",
    description="""A peak is a value strictly greater than its neighbours (outside the array counts as -∞). Neighbours
    are never equal, and in these tests the array has exactly one peak. Return its index in O(log n) time.""",
    constraints=["1 <= nums.length <= 10^5", "nums[i] != nums[i + 1]"],
    fn="find_peak",
    params=[("nums", "array")],
    ret="int",
    ref="""
def find_peak(nums):
    low, high = 0, len(nums) - 1
    while low < high:
        mid = (low + high) // 2
        if nums[mid] < nums[mid + 1]:
            low = mid + 1
        else:
            high = mid
    return low
""",
    examples=[({"nums": [1, 2, 3, 1]}, 2), ({"nums": [1, 3, 5, 6, 4]}, 3)],
    tests=[{"nums": [7]}, {"nums": [5, 4, 3]}, {"nums": [1, 2, 3, 4]}, {"nums": list(range(1000)) + list(range(998, 0, -1))}],
)

problem(
    id="median-two-sorted-arrays",
    source="Median of 2 sorted arrays",
    title="Median of Two Sorted Arrays",
    topic="Binary Search",
    difficulty="Hard",
    structure="array",
    description="""Return the median of the combined values of two sorted arrays in O(log(min(m, n))) time by binary
    searching the partition of the shorter array.""",
    constraints=["0 <= m, n <= 1000", "1 <= m + n <= 2000"],
    fn="find_median",
    params=[("nums1", "array"), ("nums2", "array")],
    ret="double",
    compare="float",
    ref="""
def find_median(nums1, nums2):
    if len(nums1) > len(nums2):
        nums1, nums2 = nums2, nums1
    m, n = len(nums1), len(nums2)
    half = (m + n + 1) // 2
    low, high = 0, m
    inf = float("inf")
    while low <= high:
        cut1 = (low + high) // 2
        cut2 = half - cut1
        left1 = nums1[cut1 - 1] if cut1 > 0 else -inf
        right1 = nums1[cut1] if cut1 < m else inf
        left2 = nums2[cut2 - 1] if cut2 > 0 else -inf
        right2 = nums2[cut2] if cut2 < n else inf
        if left1 <= right2 and left2 <= right1:
            if (m + n) % 2 == 1:
                return float(max(left1, left2))
            return (max(left1, left2) + min(right1, right2)) / 2
        if left1 > right2:
            high = cut1 - 1
        else:
            low = cut1 + 1
    return 0.0
""",
    examples=[({"nums1": [1, 3], "nums2": [2]}, 2.0), ({"nums1": [1, 2], "nums2": [3, 4]}, 2.5)],
    tests=[{"nums1": [], "nums2": [1]}, {"nums1": [2], "nums2": []}, {"nums1": [1, 1, 1], "nums2": [1, 1, 1]}, {"nums1": list(range(0, 1000, 3)), "nums2": list(range(1, 1500, 2))}],
)

problem(
    id="minimize-gas-station-distance",
    source="Minimize Max Distance to Gas Station",
    title="Minimise the Largest Gap",
    topic="Binary Search",
    difficulty="Hard",
    structure="heap",
    description="""stations holds sorted positions on a road. Add exactly k new stations anywhere (not necessarily at
    whole numbers) so that the largest gap between neighbouring stations is as small as possible. Return that gap.
    Answers within 1e-5 are accepted.""",
    constraints=["2 <= stations.length <= 2000", "0 <= stations[i] <= 10^8", "1 <= k <= 10^5"],
    fn="minimise_max_gap",
    params=[("stations", "array"), ("k", "int")],
    ret="double",
    compare="float",
    ref="""
import heapq

def minimise_max_gap(stations, k):
    gaps = [stations[i + 1] - stations[i] for i in range(len(stations) - 1)]
    parts = [1] * len(gaps)
    heap = [(-gap, index) for index, gap in enumerate(gaps)]
    heapq.heapify(heap)
    for _ in range(k):
        _, index = heapq.heappop(heap)
        parts[index] += 1
        heapq.heappush(heap, (-gaps[index] / parts[index], index))
    return -heap[0][0] * 1.0
""",
    examples=[
        ({"stations": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "k": 9}, 0.5),
        ({"stations": [1, 13, 17, 23], "k": 5}, 3.0, "Split 12 into four, 6 into two and 4 into two."),
    ],
    tests=[{"stations": [0, 10], "k": 1}, {"stations": [3, 6, 12, 19, 33, 44, 67, 72, 89, 95], "k": 2}, {"stations": [0, 100000000], "k": 100000}, {"stations": list(range(0, 400, 7)), "k": 25}],
)

problem(
    id="row-with-max-ones",
    source="Find row with maximum 1's",
    title="Row with the Most Ones",
    topic="Binary Search",
    difficulty="Easy",
    structure="matrix",
    description="""Every row of the binary matrix is sorted (0s before 1s). Return the index of the row with the most
    1s, the smallest such index on a tie, or -1 if the matrix has no 1s.""",
    constraints=["1 <= rows, cols <= 100", "Each row is sorted ascending."],
    fn="row_with_max_ones",
    params=[("matrix", "matrix")],
    ret="int",
    ref="""
def row_with_max_ones(matrix):
    best_row, best_count = -1, 0
    cols = len(matrix[0])
    for index, row in enumerate(matrix):
        low, high = 0, cols
        while low < high:
            mid = (low + high) // 2
            if row[mid] == 1:
                high = mid
            else:
                low = mid + 1
        count = cols - low
        if count > best_count:
            best_row, best_count = index, count
    return best_row
""",
    examples=[({"matrix": [[0, 1, 1], [0, 0, 1], [1, 1, 1]]}, 2), ({"matrix": [[0, 0], [0, 0]]}, -1)],
    tests=[{"matrix": [[1]]}, {"matrix": [[0, 1], [0, 1], [0, 1]]}, {"matrix": [[0] * (100 - r) + [1] * r for r in range(0, 100, 7)]}],
)

problem(
    id="search-2d-matrix",
    source="Search in a 2D matrix",
    title="Search a Sorted Matrix",
    topic="Binary Search",
    difficulty="Medium",
    structure="matrix",
    description="""Rows are sorted, and each row starts after the previous row ends, so the matrix reads as one sorted
    list. Return whether target is present, using a single binary search over all cells.""",
    constraints=["1 <= m, n <= 100", "-10^4 <= values, target <= 10^4"],
    fn="search_matrix",
    params=[("matrix", "matrix"), ("target", "int")],
    ret="bool",
    ref="""
def search_matrix(matrix, target):
    rows, cols = len(matrix), len(matrix[0])
    low, high = 0, rows * cols - 1
    while low <= high:
        mid = (low + high) // 2
        value = matrix[mid // cols][mid % cols]
        if value == target:
            return True
        if value < target:
            low = mid + 1
        else:
            high = mid - 1
    return False
""",
    examples=[({"matrix": [[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], "target": 3}, True), ({"matrix": [[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], "target": 13}, False)],
    tests=[{"matrix": [[1]], "target": 1}, {"matrix": [[1]], "target": 2}, {"matrix": [[r * 10 + c for c in range(10)] for r in range(10)], "target": 57}, {"matrix": [[1, 3]], "target": 3}],
)

problem(
    id="search-2d-matrix-ii",
    source="Search in 2D matrix - II",
    title="Search a Row- and Column-Sorted Matrix",
    topic="Binary Search",
    difficulty="Medium",
    structure="matrix",
    description="""Every row and every column is sorted ascending. Return whether target is present. Start at the
    top-right corner and move left or down, discarding a row or column at every step.""",
    constraints=["1 <= m, n <= 300", "-10^9 <= values, target <= 10^9"],
    fn="search_matrix_sorted",
    params=[("matrix", "matrix"), ("target", "int")],
    ret="bool",
    ref="""
def search_matrix_sorted(matrix, target):
    row, col = 0, len(matrix[0]) - 1
    while row < len(matrix) and col >= 0:
        value = matrix[row][col]
        if value == target:
            return True
        if value > target:
            col -= 1
        else:
            row += 1
    return False
""",
    examples=[
        ({"matrix": [[1, 4, 7, 11, 15], [2, 5, 8, 12, 19], [3, 6, 9, 16, 22], [10, 13, 14, 17, 24], [18, 21, 23, 26, 30]], "target": 5}, True),
        ({"matrix": [[1, 4, 7, 11, 15], [2, 5, 8, 12, 19], [3, 6, 9, 16, 22], [10, 13, 14, 17, 24], [18, 21, 23, 26, 30]], "target": 20}, False),
    ],
    tests=[{"matrix": [[-5]], "target": -5}, {"matrix": [[1, 1]], "target": 2}, {"matrix": [[r + c for c in range(40)] for r in range(40)], "target": 77}],
)

problem(
    id="find-peak-grid",
    source="Find Peak Element - II",
    title="Find a Peak in a Grid",
    topic="Binary Search",
    difficulty="Hard",
    structure="matrix",
    description="""A peak cell is strictly greater than its up, down, left and right neighbours. Adjacent cells are never
    equal, and in these tests the grid has exactly one peak. Return its position [row, col]. Binary search on
    columns: in the middle column take the largest cell and move toward a larger neighbour.""",
    constraints=["1 <= m, n <= 500", "Adjacent cells differ."],
    fn="find_peak_grid",
    params=[("mat", "matrix")],
    ret="array",
    ref="""
def find_peak_grid(mat):
    low, high = 0, len(mat[0]) - 1
    while low <= high:
        mid = (low + high) // 2
        row = max(range(len(mat)), key=lambda r: mat[r][mid])
        left = mat[row][mid - 1] if mid > 0 else -1
        right = mat[row][mid + 1] if mid + 1 < len(mat[0]) else -1
        if mat[row][mid] > left and mat[row][mid] > right:
            return [row, mid]
        if left > mat[row][mid]:
            high = mid - 1
        else:
            low = mid + 1
    return [-1, -1]
""",
    examples=[({"mat": peak_grid(2, 2, 0, 1)}, [0, 1]), ({"mat": peak_grid(3, 4, 2, 0)}, [2, 0])],
    tests=[{"mat": [[5]]}, {"mat": peak_grid(1, 6, 0, 3)}, {"mat": peak_grid(30, 40, 17, 5)}, {"mat": peak_grid(10, 10, 9, 9)}],
)

problem(
    id="matrix-median",
    source="Matrix Median",
    title="Median of a Row-Sorted Matrix",
    topic="Binary Search",
    difficulty="Hard",
    structure="matrix",
    description="""Each row is sorted and the matrix has an odd number of cells. Return the median of all values
    without flattening: binary search on the answer and count values not larger than it in each row.""",
    constraints=["1 <= rows, cols <= 500", "rows × cols is odd", "1 <= values <= 10^9"],
    fn="matrix_median",
    params=[("matrix", "matrix")],
    ret="int",
    ref="""
def matrix_median(matrix):
    def count_at_most(x):
        total = 0
        for row in matrix:
            low, high = 0, len(row)
            while low < high:
                mid = (low + high) // 2
                if row[mid] <= x:
                    low = mid + 1
                else:
                    high = mid
            total += low
        return total

    need = len(matrix) * len(matrix[0]) // 2 + 1
    low = min(row[0] for row in matrix)
    high = max(row[-1] for row in matrix)
    while low < high:
        mid = (low + high) // 2
        if count_at_most(mid) >= need:
            high = mid
        else:
            low = mid + 1
    return low
""",
    examples=[({"matrix": [[1, 3, 5], [2, 6, 9], [3, 6, 9]]}, 5, "Sorted: 1 2 3 3 5 6 6 9 9."), ({"matrix": [[1], [2], [3]]}, 2)],
    tests=[{"matrix": [[7]]}, {"matrix": [[1, 1, 1], [1, 1, 1], [1, 1, 2]]}, {"matrix": [sorted(((r * 31 + c * 17) % 1000) + 1 for c in range(21)) for r in range(15)]}],
)
