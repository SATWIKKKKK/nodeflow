from dsl import design, method, ops, problem

# ---------------------------------------------------------------- implementations

STACK_METHODS = [
    method("push", [("x", "int")]),
    method("pop", ret="int"),
    method("top", ret="int"),
    method("isEmpty", ret="bool"),
    method("size", ret="int"),
]
QUEUE_METHODS = [
    method("push", [("x", "int")]),
    method("pop", ret="int"),
    method("peek", ret="int"),
    method("isEmpty", ret="bool"),
    method("size", ret="int"),
]


def stack_script(name, *calls):
    return ops((name,), *calls)


STACK_TESTS = lambda name: [  # noqa: E731
    stack_script(name, ("pop",), ("top",), ("isEmpty",), ("size",)),
    stack_script(name, *[("push", i) for i in range(1, 40)], ("size",), *[("pop",) for _ in range(41)], ("isEmpty",)),
    stack_script(name, ("push", -5), ("push", 0), ("pop",), ("push", 7), ("top",), ("size",), ("pop",), ("pop",), ("pop",)),
]
QUEUE_TESTS = lambda name: [  # noqa: E731
    stack_script(name, ("pop",), ("peek",), ("isEmpty",), ("size",)),
    stack_script(name, *[("push", i) for i in range(1, 40)], ("size",), *[("pop",) for _ in range(41)], ("isEmpty",)),
    stack_script(name, ("push", -5), ("push", 0), ("pop",), ("push", 7), ("peek",), ("size",), ("pop",), ("pop",), ("pop",)),
]

problem(
    id="stack-using-array",
    source="Implement Stack using Arrays",
    title="Stack on an Array",
    topic="Stack",
    difficulty="Easy",
    structure="stack",
    description="""Build ArrayStack on top of a plain list plus a top index. push adds x, pop removes and returns the top
    value, top returns it without removing, isEmpty and size report the contents. pop and top return -1 when the
    stack is empty.""",
    constraints=["At most 10^4 operations.", "-10^9 <= x <= 10^9"],
    design=design("ArrayStack", methods=STACK_METHODS),
    ref="""
class ArrayStack:
    def __init__(self):
        self.items = [0] * 1000
        self.top_index = -1

    def push(self, x):
        if self.top_index + 1 == len(self.items):
            self.items.extend([0] * len(self.items))
        self.top_index += 1
        self.items[self.top_index] = x

    def pop(self):
        if self.top_index < 0:
            return -1
        value = self.items[self.top_index]
        self.top_index -= 1
        return value

    def top(self):
        return -1 if self.top_index < 0 else self.items[self.top_index]

    def isEmpty(self):
        return self.top_index < 0

    def size(self):
        return self.top_index + 1
""",
    examples=[
        (stack_script("ArrayStack", ("push", 5), ("push", 10), ("top",), ("pop",), ("size",), ("isEmpty",)), [None, None, None, 10, 10, 1, False]),
        (stack_script("ArrayStack", ("isEmpty",), ("pop",), ("push", 3), ("top",)), [None, True, -1, None, 3]),
    ],
    tests=STACK_TESTS("ArrayStack"),
)

problem(
    id="queue-using-array",
    source="Implement Queue using Arrays",
    title="Queue on an Array",
    topic="Queue",
    difficulty="Easy",
    structure="queue",
    description="""Build ArrayQueue on a circular buffer with front and rear indices. push adds x at the back, pop
    removes and returns the front value, peek returns it without removing, isEmpty and size report the contents.
    pop and peek return -1 when the queue is empty.""",
    constraints=["At most 10^4 operations.", "-10^9 <= x <= 10^9"],
    design=design("ArrayQueue", methods=QUEUE_METHODS),
    ref="""
class ArrayQueue:
    def __init__(self):
        self.items = [0] * 8
        self.front = 0
        self.count = 0

    def push(self, x):
        if self.count == len(self.items):
            ordered = [self.items[(self.front + i) % len(self.items)] for i in range(self.count)]
            self.items = ordered + [0] * len(ordered)
            self.front = 0
        rear = (self.front + self.count) % len(self.items)
        self.items[rear] = x
        self.count += 1

    def pop(self):
        if self.count == 0:
            return -1
        value = self.items[self.front]
        self.front = (self.front + 1) % len(self.items)
        self.count -= 1
        return value

    def peek(self):
        return -1 if self.count == 0 else self.items[self.front]

    def isEmpty(self):
        return self.count == 0

    def size(self):
        return self.count
""",
    examples=[
        (stack_script("ArrayQueue", ("push", 5), ("push", 10), ("peek",), ("pop",), ("size",), ("isEmpty",)), [None, None, None, 5, 5, 1, False]),
        (stack_script("ArrayQueue", ("isEmpty",), ("pop",), ("push", 3), ("peek",)), [None, True, -1, None, 3]),
    ],
    tests=QUEUE_TESTS("ArrayQueue"),
)

problem(
    id="stack-using-queue",
    source="Implement Stack using Queue",
    title="Stack from a Queue",
    topic="Stack",
    difficulty="Easy",
    structure="stack",
    description="""Build QueueStack using only queue operations (add to back, remove from front, size). After each push,
    rotate the older items behind the new one so the front of the queue is always the top of the stack. pop and top
    return -1 when empty.""",
    constraints=["At most 10^3 operations."],
    design=design("QueueStack", methods=STACK_METHODS),
    ref="""
from collections import deque


class QueueStack:
    def __init__(self):
        self.queue = deque()

    def push(self, x):
        self.queue.append(x)
        for _ in range(len(self.queue) - 1):
            self.queue.append(self.queue.popleft())

    def pop(self):
        return self.queue.popleft() if self.queue else -1

    def top(self):
        return self.queue[0] if self.queue else -1

    def isEmpty(self):
        return not self.queue

    def size(self):
        return len(self.queue)
""",
    examples=[
        (stack_script("QueueStack", ("push", 1), ("push", 2), ("top",), ("pop",), ("isEmpty",)), [None, None, None, 2, 2, False]),
        (stack_script("QueueStack", ("push", 4), ("pop",), ("pop",), ("size",)), [None, None, 4, -1, 0]),
    ],
    tests=STACK_TESTS("QueueStack"),
)

problem(
    id="queue-using-stacks",
    source="Implement Queue using Stack",
    title="Queue from Two Stacks",
    topic="Queue",
    difficulty="Easy",
    structure="queue",
    description="""Build StackQueue with two stacks: push onto an input stack, and when the output stack is empty, pour
    the input stack into it so the oldest item ends up on top. pop and peek return -1 when empty.""",
    constraints=["At most 10^3 operations."],
    design=design("StackQueue", methods=QUEUE_METHODS),
    ref="""
class StackQueue:
    def __init__(self):
        self.incoming = []
        self.outgoing = []

    def _shift(self):
        if not self.outgoing:
            while self.incoming:
                self.outgoing.append(self.incoming.pop())

    def push(self, x):
        self.incoming.append(x)

    def pop(self):
        self._shift()
        return self.outgoing.pop() if self.outgoing else -1

    def peek(self):
        self._shift()
        return self.outgoing[-1] if self.outgoing else -1

    def isEmpty(self):
        return not self.incoming and not self.outgoing

    def size(self):
        return len(self.incoming) + len(self.outgoing)
""",
    examples=[
        (stack_script("StackQueue", ("push", 1), ("push", 2), ("peek",), ("pop",), ("isEmpty",)), [None, None, None, 1, 1, False]),
        (stack_script("StackQueue", ("push", 4), ("pop",), ("pop",), ("size",)), [None, None, 4, -1, 0]),
    ],
    tests=QUEUE_TESTS("StackQueue"),
)

problem(
    id="stack-using-linked-list",
    source="Implement stack using Linkedlist",
    title="Stack on a Linked List",
    topic="Stack",
    difficulty="Easy",
    structure="stack",
    description="""Build LinkedStack where every push creates a ListNode in front of the current head, and pop unlinks
    the head. Keep a running size. pop and top return -1 when empty.""",
    constraints=["At most 10^4 operations."],
    design=design("LinkedStack", methods=STACK_METHODS),
    starter="""
class LinkedStack:
    def __init__(self):
        self.head = None  # build the stack from ListNode(val) objects
        self.count = 0

    def push(self, x):
        pass

    def pop(self):
        return -1

    def top(self):
        return -1

    def isEmpty(self):
        return True

    def size(self):
        return 0
""",
    ref="""
class LinkedStack:
    def __init__(self):
        self.head = None
        self.count = 0

    def push(self, x):
        node = ListNode(x)
        node.next = self.head
        self.head = node
        self.count += 1

    def pop(self):
        if self.head is None:
            return -1
        value = self.head.val
        self.head = self.head.next
        self.count -= 1
        return value

    def top(self):
        return -1 if self.head is None else self.head.val

    def isEmpty(self):
        return self.head is None

    def size(self):
        return self.count
""",
    examples=[
        (stack_script("LinkedStack", ("push", 5), ("push", 10), ("top",), ("pop",), ("size",), ("isEmpty",)), [None, None, None, 10, 10, 1, False]),
        (stack_script("LinkedStack", ("isEmpty",), ("pop",), ("push", 3), ("top",)), [None, True, -1, None, 3]),
    ],
    tests=STACK_TESTS("LinkedStack"),
)

problem(
    id="queue-using-linked-list",
    source="Implement queue using Linkedlist",
    title="Queue on a Linked List",
    topic="Queue",
    difficulty="Easy",
    structure="queue",
    description="""Build LinkedQueue with head and tail ListNode pointers: push appends after the tail, pop unlinks the
    head. Remember to clear the tail when the queue becomes empty. pop and peek return -1 when empty.""",
    constraints=["At most 10^4 operations."],
    design=design("LinkedQueue", methods=QUEUE_METHODS),
    starter="""
class LinkedQueue:
    def __init__(self):
        self.head = None  # build the queue from ListNode(val) objects
        self.tail = None
        self.count = 0

    def push(self, x):
        pass

    def pop(self):
        return -1

    def peek(self):
        return -1

    def isEmpty(self):
        return True

    def size(self):
        return 0
""",
    ref="""
class LinkedQueue:
    def __init__(self):
        self.head = None
        self.tail = None
        self.count = 0

    def push(self, x):
        node = ListNode(x)
        if self.tail is None:
            self.head = self.tail = node
        else:
            self.tail.next = node
            self.tail = node
        self.count += 1

    def pop(self):
        if self.head is None:
            return -1
        value = self.head.val
        self.head = self.head.next
        if self.head is None:
            self.tail = None
        self.count -= 1
        return value

    def peek(self):
        return -1 if self.head is None else self.head.val

    def isEmpty(self):
        return self.head is None

    def size(self):
        return self.count
""",
    examples=[
        (stack_script("LinkedQueue", ("push", 5), ("push", 10), ("peek",), ("pop",), ("size",), ("isEmpty",)), [None, None, None, 5, 5, 1, False]),
        (stack_script("LinkedQueue", ("isEmpty",), ("pop",), ("push", 3), ("peek",)), [None, True, -1, None, 3]),
    ],
    tests=QUEUE_TESTS("LinkedQueue"),
)

# ---------------------------------------------------------------- classic stack problems

problem(
    id="balanced-parentheses",
    source="Balanced Paranthesis",
    title="Balanced Brackets",
    topic="Stack",
    difficulty="Easy",
    structure="stack",
    description="""s contains only the characters ()[]{}. Return whether every bracket is closed by the matching type in
    the right order. Push openers and match each closer against the top of the stack.""",
    constraints=["1 <= s.length <= 10^4"],
    fn="is_valid",
    params=[("s", "string")],
    ret="bool",
    ref="""
def is_valid(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for char in s:
        if char in pairs:
            if not stack or stack[-1] != pairs[char]:
                return False
            stack.pop()
        else:
            stack.append(char)
    return not stack
""",
    examples=[({"s": "()[]{}"}, True), ({"s": "([)]"}, False), ({"s": "{[()]}"}, True)],
    tests=[{"s": "("}, {"s": "]"}, {"s": "([{}])" * 200}, {"s": "(((())))("}],
)

problem(
    id="next-greater-element",
    source="Next Greater Element",
    title="Next Greater Element",
    topic="Monotonic Stack",
    difficulty="Medium",
    structure="stack",
    description="""For each position, return the first value to its right that is strictly greater, or -1 if there is
    none. Walk from the right and keep a stack of candidates in decreasing order.""",
    constraints=["1 <= nums.length <= 10^5", "-10^9 <= nums[i] <= 10^9"],
    fn="next_greater",
    params=[("nums", "array")],
    ret="array",
    ref="""
def next_greater(nums):
    result = [-1] * len(nums)
    stack = []
    for index in range(len(nums) - 1, -1, -1):
        while stack and stack[-1] <= nums[index]:
            stack.pop()
        if stack:
            result[index] = stack[-1]
        stack.append(nums[index])
    return result
""",
    examples=[({"nums": [1, 3, 2, 4]}, [3, 4, 4, -1]), ({"nums": [6, 8, 0, 1, 3]}, [8, -1, 1, 3, -1])],
    tests=[{"nums": [5]}, {"nums": [4, 4, 4]}, {"nums": list(range(300, 0, -1))}, {"nums": [(i * 31) % 97 for i in range(500)]}],
)

problem(
    id="next-greater-element-ii",
    source="Next Greater Element - 2",
    title="Next Greater in a Circle",
    topic="Monotonic Stack",
    difficulty="Medium",
    structure="stack",
    description="""nums is circular: after the last element comes the first. For each position return the first strictly
    greater value found while walking forward around the circle, or -1. Scan the array twice from the right.""",
    constraints=["1 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"],
    fn="next_greater_circular",
    params=[("nums", "array")],
    ret="array",
    ref="""
def next_greater_circular(nums):
    n = len(nums)
    result = [-1] * n
    stack = []
    for index in range(2 * n - 1, -1, -1):
        value = nums[index % n]
        while stack and stack[-1] <= value:
            stack.pop()
        if index < n and stack:
            result[index] = stack[-1]
        stack.append(value)
    return result
""",
    examples=[({"nums": [1, 2, 1]}, [2, -1, 2]), ({"nums": [3, 10, 4, 2, 1, 2, 6, 1, 7, 2, 9]}, [10, -1, 6, 6, 2, 6, 7, 7, 9, 9, 10])],
    tests=[{"nums": [7]}, {"nums": [5, 5, 5, 5]}, {"nums": [(i * 37) % 101 for i in range(400)]}],
)

problem(
    id="asteroid-collision",
    source="Asteroid Collision",
    title="Asteroid Collision",
    topic="Stack",
    difficulty="Medium",
    structure="stack",
    description="""Each value is an asteroid: its size is the absolute value and its sign is its direction (positive moves
    right). When a right-mover meets a left-mover, the smaller one explodes; equal sizes both explode. Return the
    asteroids left after every collision.""",
    constraints=["2 <= asteroids.length <= 10^4", "-1000 <= asteroids[i] <= 1000", "asteroids[i] != 0"],
    fn="asteroid_collision",
    params=[("asteroids", "array")],
    ret="array",
    ref="""
def asteroid_collision(asteroids):
    stack = []
    for rock in asteroids:
        alive = True
        while alive and rock < 0 and stack and stack[-1] > 0:
            if stack[-1] < -rock:
                stack.pop()
            elif stack[-1] == -rock:
                stack.pop()
                alive = False
            else:
                alive = False
        if alive:
            stack.append(rock)
    return stack
""",
    examples=[({"asteroids": [5, 10, -5]}, [5, 10]), ({"asteroids": [8, -8]}, []), ({"asteroids": [10, 2, -5]}, [10])],
    tests=[{"asteroids": [-2, -1, 1, 2]}, {"asteroids": [1, -2, -2, -2]}, {"asteroids": [((i * 7) % 13 + 1) * (1 if i % 3 else -1) for i in range(600)]}],
)

problem(
    id="sum-subarray-minimums",
    source="Sum of Subarray Minimums",
    title="Sum of Subarray Minimums",
    topic="Monotonic Stack",
    difficulty="Medium",
    structure="stack",
    description="""Return the sum of min(sub) over every contiguous subarray, modulo 1,000,000,007. Each value is the
    minimum of (left run) × (right run) subarrays; find those runs with a monotonic stack, breaking ties on one side
    only.""",
    constraints=["1 <= arr.length <= 3 * 10^4", "1 <= arr[i] <= 3 * 10^4"],
    fn="sum_subarray_mins",
    params=[("arr", "array")],
    ret="int",
    ref="""
def sum_subarray_mins(arr):
    mod = 1000000007
    n = len(arr)
    left = [0] * n
    right = [0] * n
    stack = []
    for i in range(n):
        while stack and arr[stack[-1]] > arr[i]:
            stack.pop()
        left[i] = i - stack[-1] if stack else i + 1
        stack.append(i)
    stack = []
    for i in range(n - 1, -1, -1):
        while stack and arr[stack[-1]] >= arr[i]:
            stack.pop()
        right[i] = stack[-1] - i if stack else n - i
        stack.append(i)
    total = 0
    for i in range(n):
        total = (total + arr[i] * left[i] * right[i]) % mod
    return total
""",
    examples=[({"arr": [3, 1, 2, 4]}, 17), ({"arr": [11, 81, 94, 43, 3]}, 444)],
    tests=[{"arr": [1]}, {"arr": [2, 2, 2]}, {"arr": [30000] * 3000}],
)

problem(
    id="sum-subarray-ranges",
    source="Sum of Subarray Ranges",
    title="Sum of Subarray Ranges",
    topic="Monotonic Stack",
    difficulty="Medium",
    structure="stack",
    description="""The range of a subarray is its largest value minus its smallest. Return the sum of ranges over every
    contiguous subarray. That equals (sum of subarray maximums) − (sum of subarray minimums).""",
    constraints=["1 <= nums.length <= 1000", "-10^9 <= nums[i] <= 10^9"],
    fn="sub_array_ranges",
    params=[("nums", "array")],
    ret="long",
    ref="""
def sub_array_ranges(nums):
    def contribution(values, better):
        n = len(values)
        total = 0
        stack = []
        for i in range(n + 1):
            while stack and (i == n or better(values[i], values[stack[-1]])):
                mid = stack.pop()
                left = stack[-1] if stack else -1
                total += values[mid] * (mid - left) * (i - mid)
            stack.append(i)
        return total

    maxima = contribution(nums, lambda a, b: a >= b)
    minima = contribution(nums, lambda a, b: a <= b)
    return maxima - minima
""",
    examples=[({"nums": [1, 2, 3]}, 4), ({"nums": [1, 3, 3]}, 4), ({"nums": [4, -2, -3, 4, 1]}, 59)],
    tests=[{"nums": [9]}, {"nums": [-1000000000, 1000000000] * 50}, {"nums": [(i * 53) % 211 - 100 for i in range(800)]}],
)

problem(
    id="remove-k-digits",
    source="Remove K Digits",
    title="Remove K Digits",
    topic="Monotonic Stack",
    difficulty="Medium",
    structure="stack",
    description="""num is a non-negative integer written as a string. Remove exactly k digits so the remaining number is
    as small as possible. Return it without leading zeros, or "0" if nothing is left.""",
    constraints=["1 <= k <= num.length <= 10^5", "num has no leading zeros except the number 0 itself."],
    fn="remove_k_digits",
    params=[("num", "string"), ("k", "int")],
    ret="string",
    ref="""
def remove_k_digits(num, k):
    stack = []
    for digit in num:
        while k and stack and stack[-1] > digit:
            stack.pop()
            k -= 1
        stack.append(digit)
    if k:
        stack = stack[:-k]
    result = "".join(stack).lstrip("0")
    return result or "0"
""",
    examples=[({"num": "1432219", "k": 3}, "1219"), ({"num": "10200", "k": 1}, "200"), ({"num": "10", "k": 2}, "0")],
    tests=[{"num": "112", "k": 1}, {"num": "123456789", "k": 4}, {"num": "9" * 50 + "1" * 50, "k": 60}, {"num": "0", "k": 1}],
)

problem(
    id="min-stack",
    source="Implement Min Stack",
    title="Min Stack",
    topic="Stack",
    difficulty="Medium",
    structure="stack",
    description="""Build MinStack with push, pop, top and getMin, all in O(1). Store each value together with the minimum
    at that depth. Calls to pop, top and getMin are only made on a non-empty stack.""",
    constraints=["At most 3 * 10^4 operations.", "-2^31 <= val <= 2^31 - 1"],
    design=design(
        "MinStack",
        methods=[method("push", [("val", "int")]), method("pop"), method("top", ret="int"), method("getMin", ret="int")],
    ),
    ref="""
class MinStack:
    def __init__(self):
        self.stack = []

    def push(self, val):
        low = val if not self.stack else min(val, self.stack[-1][1])
        self.stack.append((val, low))

    def pop(self):
        self.stack.pop()

    def top(self):
        return self.stack[-1][0]

    def getMin(self):
        return self.stack[-1][1]
""",
    examples=[
        (ops(("MinStack",), ("push", -2), ("push", 0), ("push", -3), ("getMin",), ("pop",), ("top",), ("getMin",)), [None, None, None, None, -3, None, 0, -2]),
        (ops(("MinStack",), ("push", 5), ("push", 5), ("getMin",), ("pop",), ("getMin",)), [None, None, None, 5, None, 5]),
    ],
    tests=[
        ops(("MinStack",), ("push", 2147483647), ("top",), ("getMin",), ("push", -2147483648), ("getMin",), ("pop",), ("getMin",)),
        ops(("MinStack",), *[("push", 100 - i) for i in range(100)], ("getMin",), *[("pop",) for _ in range(60)], ("getMin",), ("top",)),
        ops(("MinStack",), ("push", 0), ("push", 1), ("push", 0), ("getMin",), ("pop",), ("getMin",)),
    ],
)

problem(
    id="sliding-window-maximum",
    source="Sliding Window Maximum",
    title="Sliding Window Maximum",
    topic="Monotonic Queue",
    difficulty="Hard",
    structure="queue",
    description="""A window of size k slides from left to right across nums. Return the maximum of each window. Keep a
    deque of indices whose values decrease from front to back.""",
    constraints=["1 <= nums.length <= 10^5", "1 <= k <= nums.length", "-10^4 <= nums[i] <= 10^4"],
    fn="max_sliding_window",
    params=[("nums", "array"), ("k", "int")],
    ret="array",
    ref="""
from collections import deque


def max_sliding_window(nums, k):
    window = deque()
    result = []
    for index, value in enumerate(nums):
        while window and nums[window[-1]] <= value:
            window.pop()
        window.append(index)
        if window[0] <= index - k:
            window.popleft()
        if index >= k - 1:
            result.append(nums[window[0]])
    return result
""",
    examples=[({"nums": [1, 3, -1, -3, 5, 3, 6, 7], "k": 3}, [3, 3, 5, 5, 6, 7]), ({"nums": [1], "k": 1}, [1])],
    tests=[{"nums": [9, 8, 7, 6, 5], "k": 2}, {"nums": [4, 4, 4, 4], "k": 4}, {"nums": [(i * 17) % 89 - 40 for i in range(2000)], "k": 25}],
)

problem(
    id="trapping-rain-water",
    source="Trapping Rainwater",
    title="Trapping Rain Water",
    topic="Two Pointers",
    difficulty="Hard",
    structure="array",
    description="""heights describes an elevation map made of bars of width 1. Return how much water it holds after rain.
    Move two pointers inward, always from the side with the lower wall, tracking the highest wall seen on each side.""",
    constraints=["1 <= heights.length <= 2 * 10^4", "0 <= heights[i] <= 10^5"],
    fn="trap",
    params=[("heights", "array")],
    ret="int",
    ref="""
def trap(heights):
    left, right = 0, len(heights) - 1
    left_max = right_max = water = 0
    while left < right:
        if heights[left] <= heights[right]:
            left_max = max(left_max, heights[left])
            water += left_max - heights[left]
            left += 1
        else:
            right_max = max(right_max, heights[right])
            water += right_max - heights[right]
            right -= 1
    return water
""",
    examples=[({"heights": [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]}, 6), ({"heights": [4, 2, 0, 3, 2, 5]}, 9)],
    tests=[{"heights": [3]}, {"heights": [1, 2, 3, 4]}, {"heights": [5, 0, 5, 0, 5]}, {"heights": [(i * 29) % 50 for i in range(3000)]}],
)

problem(
    id="largest-rectangle-histogram",
    source="Largest rectangle in a histogram",
    title="Largest Rectangle in a Histogram",
    topic="Monotonic Stack",
    difficulty="Hard",
    structure="stack",
    description="""heights are bars of width 1. Return the area of the largest rectangle that fits inside the histogram.
    When a shorter bar arrives, pop taller bars and measure how far each could stretch.""",
    constraints=["1 <= heights.length <= 10^5", "0 <= heights[i] <= 10^4"],
    fn="largest_rectangle_area",
    params=[("heights", "array")],
    ret="int",
    ref="""
def largest_rectangle_area(heights):
    stack = []
    best = 0
    n = len(heights)
    for i in range(n + 1):
        current = heights[i] if i < n else 0
        while stack and heights[stack[-1]] >= current:
            height = heights[stack.pop()]
            left = stack[-1] if stack else -1
            best = max(best, height * (i - left - 1))
        stack.append(i)
    return best
""",
    examples=[({"heights": [2, 1, 5, 6, 2, 3]}, 10), ({"heights": [2, 4]}, 4)],
    tests=[{"heights": [0]}, {"heights": [3, 3, 3, 3]}, {"heights": list(range(1, 400))}, {"heights": [(i * 13) % 31 for i in range(2000)]}],
)

problem(
    id="maximal-rectangle",
    source="Maximum Rectangles",
    title="Largest Rectangle of Ones",
    topic="Monotonic Stack",
    difficulty="Hard",
    structure="matrix",
    description="""grid holds 0s and 1s. Return the area of the largest rectangle containing only 1s. Treat each row as
    the base of a histogram of stacked ones and reuse the largest-rectangle-in-histogram idea.""",
    constraints=["1 <= rows, cols <= 200"],
    fn="maximal_rectangle",
    params=[("grid", "matrix")],
    ret="int",
    ref="""
def maximal_rectangle(grid):
    cols = len(grid[0])
    heights = [0] * cols
    best = 0
    for row in grid:
        for c in range(cols):
            heights[c] = heights[c] + 1 if row[c] == 1 else 0
        stack = []
        for i in range(cols + 1):
            current = heights[i] if i < cols else 0
            while stack and heights[stack[-1]] >= current:
                height = heights[stack.pop()]
                left = stack[-1] if stack else -1
                best = max(best, height * (i - left - 1))
            stack.append(i)
    return best
""",
    examples=[
        ({"grid": [[1, 0, 1, 0, 0], [1, 0, 1, 1, 1], [1, 1, 1, 1, 1], [1, 0, 0, 1, 0]]}, 6),
        ({"grid": [[0]]}, 0),
    ],
    tests=[{"grid": [[1]]}, {"grid": [[1, 1], [1, 1]]}, {"grid": [[1 if (r * 7 + c * 3) % 5 else 0 for c in range(40)] for r in range(30)]}],
)

problem(
    id="stock-span",
    source="Stock span problem",
    title="Stock Span",
    topic="Monotonic Stack",
    difficulty="Medium",
    structure="stack",
    description="""StockSpanner.next(price) receives one daily price at a time. It returns the span: how many consecutive
    days, ending today, had a price less than or equal to today's. Keep a stack of (price, span) pairs.""",
    constraints=["1 <= price <= 10^5", "At most 10^4 calls."],
    design=design("StockSpanner", methods=[method("next", [("price", "int")], ret="int")]),
    ref="""
class StockSpanner:
    def __init__(self):
        self.stack = []

    def next(self, price):
        span = 1
        while self.stack and self.stack[-1][0] <= price:
            span += self.stack.pop()[1]
        self.stack.append((price, span))
        return span
""",
    examples=[
        (ops(("StockSpanner",), ("next", 100), ("next", 80), ("next", 60), ("next", 70), ("next", 60), ("next", 75), ("next", 85)), [None, 1, 1, 1, 2, 1, 4, 6]),
        (ops(("StockSpanner",), ("next", 5), ("next", 5), ("next", 5)), [None, 1, 2, 3]),
    ],
    tests=[
        ops(("StockSpanner",), ("next", 1)),
        ops(("StockSpanner",), *[("next", 100 - i) for i in range(50)], ("next", 1000)),
        ops(("StockSpanner",), *[("next", (i * 37) % 23 + 1) for i in range(200)]),
    ],
)

problem(
    id="celebrity-problem",
    source="Celebrity Problem",
    title="Find the Celebrity",
    topic="Stack",
    difficulty="Medium",
    structure="matrix",
    description="""knows[i][j] is 1 when person i knows person j. A celebrity is known by everyone else and knows no one.
    Return the celebrity's index, or -1. Eliminate one candidate per comparison, then confirm the survivor.""",
    constraints=["2 <= n <= 3000", "knows[i][i] == 0"],
    fn="celebrity",
    params=[("knows", "matrix")],
    ret="int",
    ref="""
def celebrity(knows):
    n = len(knows)
    top, bottom = 0, n - 1
    while top < bottom:
        if knows[top][bottom] == 1:
            top += 1
        else:
            bottom -= 1
    for person in range(n):
        if person == top:
            continue
        if knows[top][person] == 1 or knows[person][top] == 0:
            return -1
    return top
""",
    examples=[
        ({"knows": [[0, 1, 1, 0], [0, 0, 0, 0], [1, 1, 0, 0], [0, 1, 1, 0]]}, 1),
        ({"knows": [[0, 1], [1, 0]]}, -1),
    ],
    tests=[
        {"knows": [[0, 0], [1, 0]]},
        {"knows": [[0, 0, 0], [0, 0, 0], [0, 0, 0]]},
        {"knows": [[0 if r == c else (1 if c == 17 else (r + c) % 2) for c in range(30)] for r in range(30)]},
    ],
)

problem(
    id="lru-cache",
    source="LRU Cache",
    title="LRU Cache",
    topic="Design",
    difficulty="Hard",
    structure="hashmap",
    description="""Build LRUCache(capacity). get(key) returns the stored value or -1. put(key, value) inserts or updates,
    and when the cache is over capacity it evicts the least recently used key. Both run in O(1): pair a hash map with
    a doubly linked list ordered by recency.""",
    constraints=["1 <= capacity <= 3000", "0 <= key <= 10^4", "At most 2 * 10^5 calls."],
    design=design(
        "LRUCache",
        ctor=[("capacity", "int")],
        methods=[method("get", [("key", "int")], ret="int"), method("put", [("key", "int"), ("value", "int")])],
    ),
    ref="""
class Node:
    def __init__(self, key=0, value=0):
        self.key = key
        self.value = value
        self.prev = None
        self.next = None


class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.nodes = {}
        self.head = Node()
        self.tail = Node()
        self.head.next = self.tail
        self.tail.prev = self.head

    def _unlink(self, node):
        node.prev.next = node.next
        node.next.prev = node.prev

    def _push_front(self, node):
        node.next = self.head.next
        node.prev = self.head
        self.head.next.prev = node
        self.head.next = node

    def get(self, key):
        node = self.nodes.get(key)
        if node is None:
            return -1
        self._unlink(node)
        self._push_front(node)
        return node.value

    def put(self, key, value):
        node = self.nodes.get(key)
        if node is not None:
            node.value = value
            self._unlink(node)
            self._push_front(node)
            return
        if len(self.nodes) == self.capacity:
            oldest = self.tail.prev
            self._unlink(oldest)
            del self.nodes[oldest.key]
        node = Node(key, value)
        self.nodes[key] = node
        self._push_front(node)
""",
    examples=[
        (
            ops(("LRUCache", 2), ("put", 1, 1), ("put", 2, 2), ("get", 1), ("put", 3, 3), ("get", 2), ("put", 4, 4), ("get", 1), ("get", 3), ("get", 4)),
            [None, None, None, 1, None, -1, None, -1, 3, 4],
        ),
        (ops(("LRUCache", 1), ("put", 7, 70), ("put", 7, 71), ("get", 7), ("put", 8, 80), ("get", 7)), [None, None, None, 71, None, -1]),
    ],
    tests=[
        ops(("LRUCache", 1), ("get", 0)),
        ops(("LRUCache", 3), *[("put", i % 7, i) for i in range(40)], *[("get", i) for i in range(7)]),
        ops(("LRUCache", 2), ("put", 2, 1), ("put", 1, 1), ("put", 2, 3), ("put", 4, 1), ("get", 1), ("get", 2)),
    ],
)

problem(
    id="lfu-cache",
    source="LFU Cache",
    title="LFU Cache",
    topic="Design",
    difficulty="Hard",
    structure="hashmap",
    description="""Build LFUCache(capacity). get(key) returns the value or -1 and counts as a use. put(key, value)
    inserts or updates (also a use). When full, evict the key with the fewest uses; among ties, evict the least
    recently used. Keep a map from use count to an ordered group of keys, plus the current minimum count.""",
    constraints=["1 <= capacity <= 10^4", "0 <= key <= 10^5", "At most 2 * 10^5 calls."],
    design=design(
        "LFUCache",
        ctor=[("capacity", "int")],
        methods=[method("get", [("key", "int")], ret="int"), method("put", [("key", "int"), ("value", "int")])],
    ),
    ref="""
from collections import OrderedDict, defaultdict


class LFUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.values = {}
        self.uses = {}
        self.groups = defaultdict(OrderedDict)
        self.min_uses = 0

    def _touch(self, key):
        count = self.uses[key]
        del self.groups[count][key]
        if not self.groups[count]:
            del self.groups[count]
            if self.min_uses == count:
                self.min_uses += 1
        self.uses[key] = count + 1
        self.groups[count + 1][key] = True

    def get(self, key):
        if key not in self.values:
            return -1
        self._touch(key)
        return self.values[key]

    def put(self, key, value):
        if key in self.values:
            self.values[key] = value
            self._touch(key)
            return
        if len(self.values) == self.capacity:
            evicted, _ = self.groups[self.min_uses].popitem(last=False)
            if not self.groups[self.min_uses]:
                del self.groups[self.min_uses]
            del self.values[evicted]
            del self.uses[evicted]
        self.values[key] = value
        self.uses[key] = 1
        self.groups[1][key] = True
        self.min_uses = 1
""",
    examples=[
        (
            ops(("LFUCache", 2), ("put", 1, 1), ("put", 2, 2), ("get", 1), ("put", 3, 3), ("get", 2), ("get", 3), ("put", 4, 4), ("get", 1), ("get", 3), ("get", 4)),
            [None, None, None, 1, None, -1, 3, None, -1, 3, 4],
        ),
        (ops(("LFUCache", 1), ("put", 5, 50), ("get", 5), ("put", 6, 60), ("get", 5), ("get", 6)), [None, None, 50, None, -1, 60]),
    ],
    tests=[
        ops(("LFUCache", 1), ("get", 3)),
        ops(("LFUCache", 3), *[("put", i % 5, i) for i in range(20)], *[("get", i % 4) for i in range(12)], ("put", 9, 9), *[("get", i) for i in range(10)]),
        ops(("LFUCache", 2), ("put", 3, 1), ("put", 2, 1), ("put", 2, 2), ("put", 4, 4), ("get", 2), ("get", 3), ("get", 4)),
    ],
)
