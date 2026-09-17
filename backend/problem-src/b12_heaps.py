import random

from dsl import design, method, ops, problem

rng = random.Random(31)
RANDOM = [rng.randint(-1000, 1000) for _ in range(500)]
SIFT_RULES = """Sift up swaps with the parent while the parent is strictly larger; sift down swaps with the smaller child
    (the left one on a tie) while that child is strictly smaller."""

HEAP_HELPERS = """
def sift_down(heap, index, size):
    while True:
        smallest = index
        left, right = 2 * index + 1, 2 * index + 2
        if left < size and heap[left] < heap[smallest]:
            smallest = left
        if right < size and heap[right] < heap[smallest]:
            smallest = right
        if smallest == index:
            return
        heap[index], heap[smallest] = heap[smallest], heap[index]
        index = smallest


def sift_up(heap, index):
    while index > 0:
        parent = (index - 1) // 2
        if heap[parent] <= heap[index]:
            return
        heap[parent], heap[index] = heap[index], heap[parent]
        index = parent
"""

problem(
    id="heapify-update",
    source="Heapify Algorithm",
    title="Heapify After an Update",
    topic="Heap",
    difficulty="Easy",
    structure="heap",
    description=f"""nums is a valid min-heap stored as an array (children of i sit at 2i+1 and 2i+2). Set nums[index] to
    val, restore the heap by sifting that element up or down, and return the array. {SIFT_RULES}""",
    constraints=["1 <= nums.length <= 10^5", "0 <= index < nums.length"],
    fn="heapify_update",
    params=[("nums", "array"), ("index", "int"), ("val", "int")],
    ret="array",
    ref=HEAP_HELPERS
    + """

def heapify_update(nums, index, val):
    old = nums[index]
    nums[index] = val
    if val < old:
        sift_up(nums, index)
    else:
        sift_down(nums, index, len(nums))
    return nums
""",
    examples=[
        ({"nums": [1, 4, 5, 5, 7, 6], "index": 5, "val": 2}, [1, 4, 2, 5, 7, 5]),
        ({"nums": [2, 4, 3, 8, 5], "index": 0, "val": 9}, [3, 4, 9, 8, 5]),
    ],
    tests=[
        {"nums": [5], "index": 0, "val": -5},
        {"nums": list(range(1, 128)), "index": 0, "val": 1000},
        {"nums": list(range(1, 128)), "index": 126, "val": 0},
        {"nums": [1, 1, 1, 1], "index": 1, "val": 1},
    ],
)

problem(
    id="build-min-heap",
    source="Build heap from a given Array",
    title="Build a Min-Heap",
    topic="Heap",
    difficulty="Medium",
    structure="heap",
    description=f"""Turn nums into a min-heap in place in O(n) by sifting down every non-leaf index from the last one
    back to 0, and return the array. {SIFT_RULES}""",
    constraints=["1 <= nums.length <= 10^5"],
    fn="build_min_heap",
    params=[("nums", "array")],
    ret="array",
    ref=HEAP_HELPERS
    + """

def build_min_heap(nums):
    for index in range(len(nums) // 2 - 1, -1, -1):
        sift_down(nums, index, len(nums))
    return nums
""",
    examples=[({"nums": [6, 5, 2, 7, 1, 7]}, [1, 5, 2, 7, 6, 7]), ({"nums": [3, 2, 1]}, [1, 2, 3])],
    tests=[{"nums": [4]}, {"nums": list(range(100, 0, -1))}, {"nums": RANDOM}, {"nums": [2, 2, 1, 1]}],
)

HEAP_METHODS = [
    method("insert", [("x", "int")]),
    method("extract", ret="int"),
    method("peek", ret="int"),
    method("changeKey", [("index", "int"), ("val", "int")]),
    method("isEmpty", ret="bool"),
    method("size", ret="int"),
    method("toArray", ret="array"),
]

problem(
    id="implement-min-heap",
    source="Implement Min Heap",
    title="Implement a Min-Heap",
    topic="Heap",
    difficulty="Medium",
    structure="heap",
    description=f"""Build MinHeap on an array. insert(x) appends and sifts up. extract() removes and returns the minimum
    (move the last element to the root and sift down), or -1 if empty. peek() returns the minimum or -1.
    changeKey(index, val) overwrites the array slot and sifts it into place. toArray() returns the current array.
    {SIFT_RULES}""",
    constraints=["At most 10^4 operations.", "changeKey is only called with a valid index."],
    design=design("MinHeap", methods=HEAP_METHODS),
    ref=HEAP_HELPERS
    + """

class MinHeap:
    def __init__(self):
        self.heap = []

    def insert(self, x):
        self.heap.append(x)
        sift_up(self.heap, len(self.heap) - 1)

    def extract(self):
        if not self.heap:
            return -1
        top = self.heap[0]
        last = self.heap.pop()
        if self.heap:
            self.heap[0] = last
            sift_down(self.heap, 0, len(self.heap))
        return top

    def peek(self):
        return self.heap[0] if self.heap else -1

    def changeKey(self, index, val):
        old = self.heap[index]
        self.heap[index] = val
        if val < old:
            sift_up(self.heap, index)
        else:
            sift_down(self.heap, index, len(self.heap))

    def isEmpty(self):
        return not self.heap

    def size(self):
        return len(self.heap)

    def toArray(self):
        return list(self.heap)
""",
    examples=[
        (
            ops(("MinHeap",), ("insert", 5), ("insert", 3), ("insert", 8), ("insert", 1), ("toArray",), ("extract",), ("peek",), ("size",)),
            [None, None, None, None, None, [1, 3, 8, 5], 1, 3, 3],
        ),
        (ops(("MinHeap",), ("isEmpty",), ("extract",), ("insert", 4), ("insert", 6), ("changeKey", 1, 2), ("toArray",)), [None, True, -1, None, None, None, [2, 4]]),
    ],
    tests=[
        ops(("MinHeap",), ("peek",), ("size",)),
        ops(("MinHeap",), *[("insert", v) for v in RANDOM[:60]], *[("extract",) for _ in range(62)]),
        ops(("MinHeap",), *[("insert", v) for v in range(15)], ("changeKey", 0, 99), ("toArray",), ("changeKey", 14, -1), ("toArray",), ("extract",)),
    ],
)

problem(
    id="implement-max-heap",
    source="Implement Max Heap",
    title="Implement a Max-Heap",
    topic="Heap",
    difficulty="Medium",
    structure="heap",
    description="""Build MaxHeap with the same operations as the min-heap version, but extract() and peek() work with
    the maximum. Sift up swaps with the parent while the parent is strictly smaller; sift down swaps with the larger
    child (the left one on a tie) while that child is strictly larger. extract() and peek() return -1 when empty.""",
    constraints=["At most 10^4 operations.", "changeKey is only called with a valid index."],
    design=design("MaxHeap", methods=HEAP_METHODS),
    ref=HEAP_HELPERS
    + """

class MaxHeap:
    # Store negated values so the min-heap helpers keep the max on top.
    def __init__(self):
        self.heap = []

    def insert(self, x):
        self.heap.append(-x)
        sift_up(self.heap, len(self.heap) - 1)

    def extract(self):
        if not self.heap:
            return -1
        top = self.heap[0]
        last = self.heap.pop()
        if self.heap:
            self.heap[0] = last
            sift_down(self.heap, 0, len(self.heap))
        return -top

    def peek(self):
        return -self.heap[0] if self.heap else -1

    def changeKey(self, index, val):
        old = self.heap[index]
        self.heap[index] = -val
        if -val < old:
            sift_up(self.heap, index)
        else:
            sift_down(self.heap, index, len(self.heap))

    def isEmpty(self):
        return not self.heap

    def size(self):
        return len(self.heap)

    def toArray(self):
        return [-value for value in self.heap]
""",
    examples=[
        (
            ops(("MaxHeap",), ("insert", 5), ("insert", 3), ("insert", 8), ("insert", 10), ("toArray",), ("extract",), ("peek",), ("size",)),
            [None, None, None, None, None, [10, 8, 5, 3], 10, 8, 3],
        ),
        (ops(("MaxHeap",), ("isEmpty",), ("extract",), ("insert", 4), ("insert", 6), ("changeKey", 0, 1), ("toArray",)), [None, True, -1, None, None, None, [4, 1]]),
    ],
    tests=[
        ops(("MaxHeap",), ("peek",), ("size",)),
        ops(("MaxHeap",), *[("insert", v) for v in RANDOM[:60]], *[("extract",) for _ in range(62)]),
        ops(("MaxHeap",), *[("insert", v) for v in range(15)], ("changeKey", 0, -99), ("toArray",), ("changeKey", 14, 100), ("toArray",), ("extract",)),
    ],
)

problem(
    id="is-min-heap",
    source="Check if an array represents a min heap",
    title="Is It a Min-Heap?",
    topic="Heap",
    difficulty="Easy",
    structure="heap",
    description="""Return whether nums, read as a complete binary tree (children of i at 2i+1 and 2i+2), satisfies the
    min-heap property: every parent is less than or equal to its children.""",
    constraints=["1 <= nums.length <= 10^5"],
    fn="is_min_heap",
    params=[("nums", "array")],
    ret="bool",
    ref="""
def is_min_heap(nums):
    for index in range(1, len(nums)):
        if nums[(index - 1) // 2] > nums[index]:
            return False
    return True
""",
    examples=[({"nums": [10, 20, 30, 21, 23]}, True), ({"nums": [10, 20, 30, 25, 15]}, False)],
    tests=[{"nums": [7]}, {"nums": [1, 1, 1, 1]}, {"nums": list(range(1000))}, {"nums": list(range(999)) + [-1]}],
)

problem(
    id="min-heap-to-max-heap",
    source="Convert Min Heap to Max Heap",
    title="Min-Heap to Max-Heap",
    topic="Heap",
    difficulty="Medium",
    structure="heap",
    description="""nums is a min-heap. Rearrange it into a max-heap with a bottom-up build: sift down every non-leaf index
    from the last one back to 0, swapping with the larger child (left on a tie) while it is strictly larger. Return
    the array.""",
    constraints=["1 <= nums.length <= 10^5"],
    fn="min_to_max_heap",
    params=[("nums", "array")],
    ret="array",
    ref="""
def min_to_max_heap(nums):
    size = len(nums)

    def sift_down(index):
        while True:
            largest = index
            left, right = 2 * index + 1, 2 * index + 2
            if left < size and nums[left] > nums[largest]:
                largest = left
            if right < size and nums[right] > nums[largest]:
                largest = right
            if largest == index:
                return
            nums[index], nums[largest] = nums[largest], nums[index]
            index = largest

    for index in range(size // 2 - 1, -1, -1):
        sift_down(index)
    return nums
""",
    examples=[({"nums": [10, 20, 30, 21, 23]}, [30, 23, 10, 21, 20]), ({"nums": [1, 2, 3]}, [3, 2, 1])],
    tests=[{"nums": [5]}, {"nums": list(range(1, 200))}, {"nums": sorted(RANDOM)}],
)

problem(
    id="heap-sort",
    source="Heap Sort",
    title="Heap Sort",
    topic="Heap",
    difficulty="Medium",
    structure="heap",
    description="""Sort nums in ascending order in place with heap sort: build a max-heap, then repeatedly swap the root
    with the last unsorted slot and sift the new root down within the shrinking heap. Return the array.""",
    constraints=["1 <= nums.length <= 10^5"],
    fn="heap_sort",
    params=[("nums", "array")],
    ret="array",
    ref="""
def heap_sort(nums):
    def sift_down(index, size):
        while True:
            largest = index
            left, right = 2 * index + 1, 2 * index + 2
            if left < size and nums[left] > nums[largest]:
                largest = left
            if right < size and nums[right] > nums[largest]:
                largest = right
            if largest == index:
                return
            nums[index], nums[largest] = nums[largest], nums[index]
            index = largest

    n = len(nums)
    for index in range(n // 2 - 1, -1, -1):
        sift_down(index, n)
    for end in range(n - 1, 0, -1):
        nums[0], nums[end] = nums[end], nums[0]
        sift_down(0, end)
    return nums
""",
    examples=[({"nums": [7, 4, 1, 5, 3]}, [1, 3, 4, 5, 7]), ({"nums": [5, 4, 4, 1, 1]}, [1, 1, 4, 4, 5])],
    tests=[{"nums": [2]}, {"nums": list(range(300, 0, -1))}, {"nums": RANDOM}],
)

problem(
    id="kth-largest-array",
    source="K-th Largest element in an array",
    title="Kth Largest Element",
    topic="Heap",
    difficulty="Medium",
    structure="heap",
    description="""Return the kth largest value in nums (counting duplicates, so it is the kth value in descending order).
    Keep a min-heap of size k; its top is the answer.""",
    constraints=["1 <= k <= nums.length <= 10^5", "-10^4 <= nums[i] <= 10^4"],
    fn="find_kth_largest",
    params=[("nums", "array"), ("k", "int")],
    ret="int",
    ref="""
import heapq


def find_kth_largest(nums, k):
    heap = []
    for value in nums:
        heapq.heappush(heap, value)
        if len(heap) > k:
            heapq.heappop(heap)
    return heap[0]
""",
    examples=[({"nums": [3, 2, 1, 5, 6, 4], "k": 2}, 5), ({"nums": [3, 2, 3, 1, 2, 4, 5, 5, 6], "k": 4}, 4)],
    tests=[{"nums": [1], "k": 1}, {"nums": [7, 7, 7], "k": 3}, {"nums": RANDOM, "k": 250}, {"nums": RANDOM, "k": 500}],
)

problem(
    id="kth-largest-stream",
    source="Kth largest element in a stream of running integers",
    title="Kth Largest in a Stream",
    topic="Heap",
    difficulty="Easy",
    structure="heap",
    description="""Build KthLargest(k, nums). add(val) adds a value to the stream and returns the kth largest value seen
    so far. Every add call happens when at least k values exist. Keep a min-heap holding only the k largest.""",
    constraints=["1 <= k <= 10^4", "0 <= nums.length <= 10^4", "At most 10^4 add calls."],
    design=design("KthLargest", ctor=[("k", "int"), ("nums", "array")], methods=[method("add", [("val", "int")], ret="int")]),
    ref="""
import heapq


class KthLargest:
    def __init__(self, k, nums):
        self.k = k
        self.heap = []
        for value in nums:
            self.add(value)

    def add(self, val):
        heapq.heappush(self.heap, val)
        if len(self.heap) > self.k:
            heapq.heappop(self.heap)
        return self.heap[0]
""",
    examples=[
        (ops(("KthLargest", 3, [4, 5, 8, 2]), ("add", 3), ("add", 5), ("add", 10), ("add", 9), ("add", 4)), [None, 4, 5, 5, 8, 8]),
        (ops(("KthLargest", 1, []), ("add", -3), ("add", -2), ("add", -4)), [None, -3, -2, -2]),
    ],
    tests=[
        ops(("KthLargest", 2, [0]), ("add", -1), ("add", 1), ("add", -2), ("add", -4), ("add", 3)),
        ops(("KthLargest", 10, RANDOM[:100]), *[("add", v) for v in RANDOM[100:200]]),
        ops(("KthLargest", 1, [5, 5, 5]), ("add", 5), ("add", 4)),
    ],
)
