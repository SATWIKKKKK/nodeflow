from dsl import design, method, ops, problem
from treegen import chain, random_bst

N = None
BST7 = [4, 2, 7, 1, 3]
BST8 = [8, 5, 12, 4, 7, 10, 14, N, N, 6]
BIG = random_bst(300, seed=21)
BIG_SORTED = sorted(v for v in BIG if v is not None)

BST_CONSTRAINTS = ["0 <= number of nodes <= 10^4", "Values are unique.", "root is a valid binary search tree."]

problem(
    id="search-in-bst",
    source="Search in BST",
    title="Search in a BST",
    topic="Binary Search Tree",
    difficulty="Easy",
    structure="tree",
    description="""Return the subtree rooted at the node whose value is val, or an empty tree if there is none. Go left
    when val is smaller than the current node and right when it is larger.""",
    constraints=BST_CONSTRAINTS,
    fn="search_bst",
    params=[("root", "tree"), ("val", "int")],
    ret="tree",
    ref="""
def search_bst(root, val):
    node = root
    while node and node.val != val:
        node = node.left if val < node.val else node.right
    return node
""",
    examples=[({"root": BST7, "val": 2}, [2, 1, 3]), ({"root": BST7, "val": 5}, [])],
    tests=[{"root": [], "val": 1}, {"root": BIG, "val": BIG[0]}, {"root": BIG, "val": BIG_SORTED[100]}, {"root": chain(40, "right"), "val": 35}],
)

problem(
    id="floor-ceil-bst",
    source="Floor and Ceil in a BST",
    title="Floor and Ceil in a BST",
    topic="Binary Search Tree",
    difficulty="Medium",
    structure="tree",
    description="""Return [floor, ceil] for key: the largest value ≤ key and the smallest value ≥ key, using -1 for
    either one that does not exist. Walk down once for each, recording candidates as you go.""",
    constraints=BST_CONSTRAINTS,
    fn="floor_ceil",
    params=[("root", "tree"), ("key", "int")],
    ret="array",
    ref="""
def floor_ceil(root, key):
    floor = ceil = -1
    node = root
    while node:
        if node.val == key:
            return [key, key]
        if node.val < key:
            floor = node.val
            node = node.right
        else:
            ceil = node.val
            node = node.left
    return [floor, ceil]
""",
    examples=[({"root": BST8, "key": 11}, [10, 12]), ({"root": BST8, "key": 15}, [14, -1])],
    tests=[{"root": BST8, "key": 1}, {"root": BST8, "key": 6}, {"root": [], "key": 3}, {"root": BIG, "key": 777}],
)

problem(
    id="insert-into-bst",
    source="Insert a given node in BST",
    title="Insert into a BST",
    topic="Binary Search Tree",
    difficulty="Medium",
    structure="tree",
    description="""val is not in the tree. Insert it as a new leaf in the only place that keeps the BST valid and return
    the root.""",
    constraints=BST_CONSTRAINTS,
    fn="insert_into_bst",
    params=[("root", "tree"), ("val", "int")],
    ret="tree",
    ref="""
def insert_into_bst(root, val):
    if root is None:
        return TreeNode(val)
    node = root
    while True:
        if val < node.val:
            if node.left is None:
                node.left = TreeNode(val)
                return root
            node = node.left
        else:
            if node.right is None:
                node.right = TreeNode(val)
                return root
            node = node.right
""",
    examples=[({"root": BST7, "val": 5}, [4, 2, 7, 1, 3, 5]), ({"root": [], "val": 9}, [9])],
    tests=[{"root": [40, 20, 60, 10, 30, 50, 70], "val": 25}, {"root": chain(30, "right"), "val": 31}, {"root": BIG, "val": 1501}],
)

problem(
    id="delete-node-bst",
    source="Delete a node in BST",
    title="Delete from a BST",
    topic="Binary Search Tree",
    difficulty="Medium",
    structure="tree",
    description="""Delete the node with value key (if present) and return the root. When the node has two children,
    replace its value with its inorder successor (the smallest value in its right subtree) and delete that successor
    instead. A node with one child is replaced by that child.""",
    constraints=BST_CONSTRAINTS,
    fn="delete_node",
    params=[("root", "tree"), ("key", "int")],
    ret="tree",
    ref="""
def delete_node(root, key):
    if root is None:
        return None
    if key < root.val:
        root.left = delete_node(root.left, key)
    elif key > root.val:
        root.right = delete_node(root.right, key)
    else:
        if root.left is None:
            return root.right
        if root.right is None:
            return root.left
        successor = root.right
        while successor.left:
            successor = successor.left
        root.val = successor.val
        root.right = delete_node(root.right, successor.val)
    return root
""",
    examples=[({"root": [5, 3, 6, 2, 4, N, 7], "key": 3}, [5, 4, 6, 2, N, N, 7]), ({"root": [5, 3, 6, 2, 4, N, 7], "key": 0}, [5, 3, 6, 2, 4, N, 7])],
    tests=[{"root": [], "key": 0}, {"root": [1], "key": 1}, {"root": BIG, "key": BIG[0]}, {"root": BST8, "key": 5}],
)

problem(
    id="kth-smallest-largest-bst",
    source="Kth Smallest and Largest element in BST",
    title="Kth Smallest and Largest in a BST",
    topic="Binary Search Tree",
    difficulty="Medium",
    structure="tree",
    description="""Return [kth smallest, kth largest] value in the BST (k is 1-indexed and at most the node count). An
    inorder walk visits values in ascending order.""",
    constraints=["1 <= k <= number of nodes <= 10^4", "Values are unique."],
    fn="kth_smallest_largest",
    params=[("root", "tree"), ("k", "int")],
    ret="array",
    ref="""
def kth_smallest_largest(root, k):
    values = []
    stack = []
    node = root
    while stack or node:
        while node:
            stack.append(node)
            node = node.left
        node = stack.pop()
        values.append(node.val)
        node = node.right
    return [values[k - 1], values[-k]]
""",
    examples=[({"root": [3, 1, 4, N, 2], "k": 1}, [1, 4]), ({"root": [5, 3, 6, 2, 4, N, N, 1], "k": 3}, [3, 4])],
    tests=[{"root": [7], "k": 1}, {"root": BIG, "k": 150}, {"root": BIG, "k": 300}],
)

problem(
    id="validate-bst",
    source="Check if a tree is a BST or not",
    title="Validate a BST",
    topic="Binary Search Tree",
    difficulty="Medium",
    structure="tree",
    description="""Return whether the tree is a strict binary search tree: every value in a left subtree is smaller than
    the node and every value in a right subtree is larger. Pass the allowed (low, high) range down the recursion.""",
    constraints=["1 <= number of nodes <= 10^4", "-2^31 <= Node.val <= 2^31 - 1"],
    fn="is_valid_bst",
    params=[("root", "tree")],
    ret="bool",
    ref="""
def is_valid_bst(root):
    def check(node, low, high):
        if node is None:
            return True
        if not (low < node.val < high):
            return False
        return check(node.left, low, node.val) and check(node.right, node.val, high)

    return check(root, float("-inf"), float("inf"))
""",
    examples=[({"root": [2, 1, 3]}, True), ({"root": [5, 1, 4, N, N, 3, 6]}, False)],
    tests=[{"root": [1]}, {"root": [2, 2, 2]}, {"root": [5, 4, 6, N, N, 3, 7]}, {"root": BIG}, {"root": [-2147483648, N, 2147483647]}],
)

problem(
    id="lca-bst",
    source="LCA in BST",
    title="Lowest Common Ancestor in a BST",
    topic="Binary Search Tree",
    difficulty="Medium",
    structure="tree",
    description="""p and q are values in the BST. Return the value of their lowest common ancestor. Walk down from the
    root: while both values are on the same side, go that way; the first split point is the answer.""",
    constraints=["2 <= number of nodes <= 10^5", "Values are unique.", "p != q"],
    fn="lca_bst",
    params=[("root", "tree"), ("p", "int"), ("q", "int")],
    ret="int",
    ref="""
def lca_bst(root, p, q):
    node = root
    while node:
        if p < node.val and q < node.val:
            node = node.left
        elif p > node.val and q > node.val:
            node = node.right
        else:
            return node.val
    return -1
""",
    examples=[({"root": [6, 2, 8, 0, 4, 7, 9, N, N, 3, 5], "p": 2, "q": 8}, 6), ({"root": [6, 2, 8, 0, 4, 7, 9, N, N, 3, 5], "p": 2, "q": 4}, 2)],
    tests=[{"root": [2, 1], "p": 2, "q": 1}, {"root": BIG, "p": BIG_SORTED[3], "q": BIG_SORTED[40]}, {"root": BIG, "p": BIG_SORTED[250], "q": BIG_SORTED[299]}],
)

problem(
    id="bst-from-preorder",
    source="Construct a BST from a preorder traversal",
    title="BST from Preorder",
    topic="Binary Search Tree",
    difficulty="Medium",
    structure="tree",
    description="""preorder is the preorder traversal of a BST with unique values. Rebuild the tree and return its root in
    O(n): pass down an upper bound, and stop building a subtree when the next value exceeds it.""",
    constraints=["1 <= preorder.length <= 100", "Values are unique."],
    fn="bst_from_preorder",
    params=[("preorder", "array")],
    ret="tree",
    ref="""
def bst_from_preorder(preorder):
    position = 0

    def build(bound):
        nonlocal position
        if position == len(preorder) or preorder[position] > bound:
            return None
        node = TreeNode(preorder[position])
        position += 1
        node.left = build(node.val)
        node.right = build(bound)
        return node

    return build(float("inf"))
""",
    examples=[({"preorder": [8, 5, 1, 7, 10, 12]}, [8, 5, 10, 1, 7, N, 12]), ({"preorder": [1, 3]}, [1, N, 3])],
    tests=[{"preorder": [4]}, {"preorder": list(range(50, 0, -1))}, {"preorder": [20, 10, 5, 15, 13, 18, 30, 25, 40, 35, 45]}],
)

problem(
    id="inorder-successor-predecessor",
    source="Inorder successor and predecessor in BST",
    title="Successor and Predecessor in a BST",
    topic="Binary Search Tree",
    difficulty="Medium",
    structure="tree",
    description="""Return [predecessor, successor] of key: the largest value strictly smaller than key and the smallest
    value strictly larger, with -1 when either is missing. key may or may not be in the tree.""",
    constraints=BST_CONSTRAINTS,
    fn="pred_succ",
    params=[("root", "tree"), ("key", "int")],
    ret="array",
    ref="""
def pred_succ(root, key):
    pred = succ = -1
    node = root
    while node:
        if node.val < key:
            pred = node.val
            node = node.right
        else:
            node = node.left
    node = root
    while node:
        if node.val > key:
            succ = node.val
            node = node.left
        else:
            node = node.right
    return [pred, succ]
""",
    examples=[({"root": BST8, "key": 8}, [7, 10]), ({"root": BST8, "key": 4}, [-1, 5])],
    tests=[{"root": BST8, "key": 14}, {"root": BST8, "key": 9}, {"root": [], "key": 1}, {"root": BIG, "key": BIG_SORTED[123]}],
)

problem(
    id="bst-iterator",
    source="BST iterator",
    title="BST Iterator",
    topic="Binary Search Tree",
    difficulty="Medium",
    structure="tree",
    description="""Build BSTIterator(root). next() returns the next value in ascending order and hasNext() says whether
    one remains. Use O(height) memory: keep a stack of the left spine and refill it from each popped node's right
    child. next() is only called when a value remains.""",
    constraints=["1 <= number of nodes <= 10^5", "At most 10^5 calls."],
    design=design(
        "BSTIterator",
        ctor=[("root", "tree")],
        methods=[method("next", ret="int"), method("hasNext", ret="bool")],
    ),
    ref="""
class BSTIterator:
    def __init__(self, root):
        self.stack = []
        self._push_left(root)

    def _push_left(self, node):
        while node:
            self.stack.append(node)
            node = node.left

    def next(self):
        node = self.stack.pop()
        self._push_left(node.right)
        return node.val

    def hasNext(self):
        return bool(self.stack)
""",
    examples=[
        (
            ops(("BSTIterator", [7, 3, 15, N, N, 9, 20]), ("next",), ("next",), ("hasNext",), ("next",), ("hasNext",), ("next",), ("hasNext",), ("next",), ("hasNext",)),
            [None, 3, 7, True, 9, True, 15, True, 20, False],
        ),
        (ops(("BSTIterator", [1]), ("hasNext",), ("next",), ("hasNext",)), [None, True, 1, False]),
    ],
    tests=[
        ops(("BSTIterator", chain(30, "left", 1)), *[("next",) for _ in range(5)], ("hasNext",)),
        ops(("BSTIterator", BIG), *[("next",) for _ in range(300)], ("hasNext",)),
        ops(("BSTIterator", BST8), ("hasNext",), ("next",), ("next",), ("next",)),
    ],
)

problem(
    id="two-sum-bst",
    source="Two sum in BST",
    title="Two Sum in a BST",
    topic="Binary Search Tree",
    difficulty="Medium",
    structure="tree",
    description="""Return whether two different nodes add up to k. Run an ascending and a descending BST iterator toward
    each other, like two pointers on a sorted array.""",
    constraints=["1 <= number of nodes <= 10^4", "Values are unique."],
    fn="find_target",
    params=[("root", "tree"), ("k", "int")],
    ret="bool",
    ref="""
def find_target(root, k):
    def smallest_first(node):
        stack = []
        while stack or node:
            while node:
                stack.append(node)
                node = node.left
            node = stack.pop()
            yield node.val
            node = node.right

    def largest_first(node):
        stack = []
        while stack or node:
            while node:
                stack.append(node)
                node = node.right
            node = stack.pop()
            yield node.val
            node = node.left

    low_iter = smallest_first(root)
    high_iter = largest_first(root)
    low = next(low_iter)
    high = next(high_iter)
    while low < high:
        total = low + high
        if total == k:
            return True
        if total < k:
            low = next(low_iter)
        else:
            high = next(high_iter)
    return False
""",
    examples=[({"root": [5, 3, 6, 2, 4, N, 7], "k": 9}, True), ({"root": [5, 3, 6, 2, 4, N, 7], "k": 28}, False)],
    tests=[{"root": [1], "k": 2}, {"root": [2, 1, 3], "k": 4}, {"root": BIG, "k": BIG_SORTED[10] + BIG_SORTED[200]}, {"root": BIG, "k": 1}],
)

problem(
    id="recover-bst",
    source="Correct BST with two nodes swapped",
    title="Recover a Swapped BST",
    topic="Binary Search Tree",
    difficulty="Hard",
    structure="tree",
    description="""Exactly two nodes of a BST had their values swapped. Swap them back without changing the shape and
    return the root. In the inorder sequence, the first misplaced value is the larger of the first drop and the second
    is the smaller of the last drop.""",
    constraints=["2 <= number of nodes <= 1000", "Values are unique."],
    fn="recover_tree",
    params=[("root", "tree")],
    ret="tree",
    ref="""
def recover_tree(root):
    first = second = prev = None
    stack = []
    node = root
    while stack or node:
        while node:
            stack.append(node)
            node = node.left
        node = stack.pop()
        if prev and prev.val > node.val:
            if first is None:
                first = prev
            second = node
        prev = node
        node = node.right
    first.val, second.val = second.val, first.val
    return root
""",
    examples=[({"root": [1, 3, N, N, 2]}, [3, 1, N, N, 2]), ({"root": [3, 1, 4, N, N, 2]}, [2, 1, 4, N, N, 3])],
    tests=[
        {"root": [1, 2]},
        {"root": [8, 5, 12, 4, 14, 10, 7]},
        {"root": [BIG_SORTED[-1] if v == BIG_SORTED[0] else BIG_SORTED[0] if v == BIG_SORTED[-1] else v for v in BIG]},
    ],
)

problem(
    id="largest-bst-in-tree",
    source="Largest BST in Binary Tree",
    title="Largest BST Subtree",
    topic="Binary Search Tree",
    difficulty="Hard",
    structure="tree",
    description="""Return the node count of the largest subtree that is a valid BST (a subtree means a node and all of its
    descendants). Post-order: each subtree reports (is BST, size, min, max).""",
    constraints=["0 <= number of nodes <= 10^4"],
    fn="largest_bst",
    params=[("root", "tree")],
    ret="int",
    ref="""
def largest_bst(root):
    best = 0

    def visit(node):
        nonlocal best
        if node is None:
            return True, 0, float("inf"), float("-inf")
        left_ok, left_size, left_min, left_max = visit(node.left)
        right_ok, right_size, right_min, right_max = visit(node.right)
        if left_ok and right_ok and left_max < node.val < right_min:
            size = left_size + right_size + 1
            best = max(best, size)
            return True, size, min(left_min, node.val), max(right_max, node.val)
        return False, 0, 0, 0

    visit(root)
    return best
""",
    examples=[({"root": [10, 5, 15, 1, 8, N, 7]}, 3), ({"root": [2, 1, 3]}, 3)],
    tests=[{"root": []}, {"root": [5, 5, 5]}, {"root": [1, 4, 3, 2, 4, 2, 5, N, N, N, N, N, N, 4, 6]}, {"root": [0] + BIG[1:]}],
)
