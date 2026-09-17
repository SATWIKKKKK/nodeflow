from dsl import design, method, ops, problem
from treegen import chain, complete_tree, random_tree

N = None
SAMPLE = [3, 9, 20, N, N, 15, 7]
FULL7 = [1, 2, 3, 4, 5, 6, 7]
BIG = random_tree(300, seed=10)
LCA_TREE = [3, 5, 1, 6, 2, 0, 8, N, N, 7, 4]


def tree_tests(*extra):
    return [{"root": []}, {"root": [42]}, {"root": chain(40)}, {"root": BIG}, *extra]


TRAVERSAL_CONSTRAINTS = ["0 <= number of nodes <= 10^4", "-100 <= Node.val <= 10^4"]

# ---------------------------------------------------------------- traversals

problem(
    id="inorder-traversal",
    source="Inorder Traversal",
    title="Inorder Traversal",
    topic="Binary Tree",
    difficulty="Easy",
    structure="tree",
    description="""Return the values of the tree in inorder: left subtree, node, right subtree.""",
    constraints=TRAVERSAL_CONSTRAINTS,
    fn="inorder",
    params=[("root", "tree")],
    ret="array",
    ref="""
def inorder(root):
    result = []

    def visit(node):
        if node is None:
            return
        visit(node.left)
        result.append(node.val)
        visit(node.right)

    visit(root)
    return result
""",
    examples=[({"root": SAMPLE}, [9, 3, 15, 20, 7]), ({"root": FULL7}, [4, 2, 5, 1, 6, 3, 7])],
    tests=tree_tests(),
)

problem(
    id="preorder-traversal",
    source="Preorder Traversal",
    title="Preorder Traversal",
    topic="Binary Tree",
    difficulty="Easy",
    structure="tree",
    description="""Return the values of the tree in preorder: node, left subtree, right subtree.""",
    constraints=TRAVERSAL_CONSTRAINTS,
    fn="preorder",
    params=[("root", "tree")],
    ret="array",
    ref="""
def preorder(root):
    result = []
    stack = [root] if root else []
    while stack:
        node = stack.pop()
        result.append(node.val)
        if node.right:
            stack.append(node.right)
        if node.left:
            stack.append(node.left)
    return result
""",
    examples=[({"root": SAMPLE}, [3, 9, 20, 15, 7]), ({"root": FULL7}, [1, 2, 4, 5, 3, 6, 7])],
    tests=tree_tests(),
)

problem(
    id="postorder-traversal",
    source="Postorder Traversal",
    title="Postorder Traversal",
    topic="Binary Tree",
    difficulty="Easy",
    structure="tree",
    description="""Return the values of the tree in postorder: left subtree, right subtree, node.""",
    constraints=TRAVERSAL_CONSTRAINTS,
    fn="postorder",
    params=[("root", "tree")],
    ret="array",
    ref="""
def postorder(root):
    result = []

    def visit(node):
        if node is None:
            return
        visit(node.left)
        visit(node.right)
        result.append(node.val)

    visit(root)
    return result
""",
    examples=[({"root": SAMPLE}, [9, 15, 7, 20, 3]), ({"root": FULL7}, [4, 5, 2, 6, 7, 3, 1])],
    tests=tree_tests(),
)

problem(
    id="level-order-traversal",
    source="Level Order Traversal",
    title="Level Order Traversal",
    topic="Binary Tree",
    difficulty="Medium",
    structure="tree",
    description="""Return the values level by level, left to right, one list per level. Use a queue and process one
    level's worth of nodes at a time.""",
    constraints=TRAVERSAL_CONSTRAINTS,
    fn="level_order",
    params=[("root", "tree")],
    ret="matrix",
    ref="""
from collections import deque


def level_order(root):
    if root is None:
        return []
    levels = []
    queue = deque([root])
    while queue:
        level = []
        for _ in range(len(queue)):
            node = queue.popleft()
            level.append(node.val)
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        levels.append(level)
    return levels
""",
    examples=[({"root": SAMPLE}, [[3], [9, 20], [15, 7]]), ({"root": [1]}, [[1]])],
    tests=tree_tests(),
)

problem(
    id="all-traversals-one-pass",
    source="Pre, Post, Inorder in one traversal",
    title="Three Traversals in One Pass",
    topic="Binary Tree",
    difficulty="Medium",
    structure="tree",
    description="""Return [preorder, inorder, postorder] using a single stack walk. Push (node, state) pairs: state 1
    records preorder, state 2 records inorder, state 3 records postorder.""",
    constraints=TRAVERSAL_CONSTRAINTS,
    fn="all_traversals",
    params=[("root", "tree")],
    ret="matrix",
    ref="""
def all_traversals(root):
    pre, ino, post = [], [], []
    stack = [(root, 1)] if root else []
    while stack:
        node, state = stack.pop()
        if state == 1:
            pre.append(node.val)
            stack.append((node, 2))
            if node.left:
                stack.append((node.left, 1))
        elif state == 2:
            ino.append(node.val)
            stack.append((node, 3))
            if node.right:
                stack.append((node.right, 1))
        else:
            post.append(node.val)
    return [pre, ino, post]
""",
    examples=[
        ({"root": FULL7}, [[1, 2, 4, 5, 3, 6, 7], [4, 2, 5, 1, 6, 3, 7], [4, 5, 2, 6, 7, 3, 1]]),
        ({"root": []}, [[], [], []]),
    ],
    tests=tree_tests(),
)

problem(
    id="morris-inorder",
    source="Morris Inorder Traversal",
    title="Morris Inorder Traversal",
    topic="Binary Tree",
    difficulty="Hard",
    structure="tree",
    description="""Return the inorder traversal using O(1) extra space. Before going left, thread the rightmost node of
    the left subtree back to the current node; remove the thread on the second visit.""",
    constraints=TRAVERSAL_CONSTRAINTS,
    fn="morris_inorder",
    params=[("root", "tree")],
    ret="array",
    ref="""
def morris_inorder(root):
    result = []
    current = root
    while current:
        if current.left is None:
            result.append(current.val)
            current = current.right
            continue
        prev = current.left
        while prev.right and prev.right is not current:
            prev = prev.right
        if prev.right is None:
            prev.right = current
            current = current.left
        else:
            prev.right = None
            result.append(current.val)
            current = current.right
    return result
""",
    examples=[({"root": SAMPLE}, [9, 3, 15, 20, 7]), ({"root": [1, N, 2, 3]}, [1, 3, 2])],
    tests=tree_tests(),
)

problem(
    id="morris-preorder",
    source="Morris Preorder Traversal",
    title="Morris Preorder Traversal",
    topic="Binary Tree",
    difficulty="Hard",
    structure="tree",
    description="""Return the preorder traversal using O(1) extra space with Morris threading. Record a node when you
    first create its thread, not when you return along it.""",
    constraints=TRAVERSAL_CONSTRAINTS,
    fn="morris_preorder",
    params=[("root", "tree")],
    ret="array",
    ref="""
def morris_preorder(root):
    result = []
    current = root
    while current:
        if current.left is None:
            result.append(current.val)
            current = current.right
            continue
        prev = current.left
        while prev.right and prev.right is not current:
            prev = prev.right
        if prev.right is None:
            result.append(current.val)
            prev.right = current
            current = current.left
        else:
            prev.right = None
            current = current.right
    return result
""",
    examples=[({"root": SAMPLE}, [3, 9, 20, 15, 7]), ({"root": [1, N, 2, 3]}, [1, 2, 3])],
    tests=tree_tests(),
)

problem(
    id="zigzag-level-order",
    source="Zig Zag or Spiral Traversal",
    title="Zigzag Level Order",
    topic="Binary Tree",
    difficulty="Medium",
    structure="tree",
    description="""Return the level order traversal, reading the first level left to right, the next right to left, and
    so on, alternating.""",
    constraints=TRAVERSAL_CONSTRAINTS,
    fn="zigzag_level_order",
    params=[("root", "tree")],
    ret="matrix",
    ref="""
def zigzag_level_order(root):
    levels = []
    current = [root] if root else []
    left_to_right = True
    while current:
        values = [node.val for node in current]
        levels.append(values if left_to_right else values[::-1])
        left_to_right = not left_to_right
        current = [child for node in current for child in (node.left, node.right) if child]
    return levels
""",
    examples=[({"root": SAMPLE}, [[3], [20, 9], [15, 7]]), ({"root": FULL7}, [[1], [3, 2], [4, 5, 6, 7]])],
    tests=tree_tests(),
)

problem(
    id="boundary-traversal",
    source="Boundary Traversal",
    title="Boundary Traversal",
    topic="Binary Tree",
    difficulty="Medium",
    structure="tree",
    description="""Return the tree's boundary anticlockwise: the root, then the left edge from the top (leaves excluded),
    then every leaf from left to right, then the right edge from the bottom (leaves excluded). The left edge follows
    left children when they exist, otherwise right children; the right edge mirrors that.""",
    constraints=TRAVERSAL_CONSTRAINTS,
    fn="boundary",
    params=[("root", "tree")],
    ret="array",
    ref="""
def boundary(root):
    if root is None:
        return []

    def is_leaf(node):
        return node.left is None and node.right is None

    result = [root.val]
    if is_leaf(root):
        return result

    node = root.left
    while node:
        if not is_leaf(node):
            result.append(node.val)
        node = node.left if node.left else node.right

    def leaves(node):
        if node is None:
            return
        if is_leaf(node):
            result.append(node.val)
            return
        leaves(node.left)
        leaves(node.right)

    leaves(root)

    right_edge = []
    node = root.right
    while node:
        if not is_leaf(node):
            right_edge.append(node.val)
        node = node.right if node.right else node.left
    result.extend(reversed(right_edge))
    return result
""",
    examples=[({"root": FULL7}, [1, 2, 4, 5, 6, 7, 3]), ({"root": [1, N, 2, N, 3]}, [1, 3, 2])],
    tests=tree_tests({"root": [1, 2, N, 4, 9, 6, 5, N, 3, N, N, N, N, 7, 8]}),
)

problem(
    id="vertical-order-traversal",
    source="Vertical Order Traversal",
    title="Vertical Order Traversal",
    topic="Binary Tree",
    difficulty="Hard",
    structure="tree",
    description="""Place the root at column 0 and row 0; a left child is at (row + 1, col − 1) and a right child at
    (row + 1, col + 1). Return one list per column from left to right. Inside a column, order nodes by row, and nodes
    sharing a row and column by value.""",
    constraints=["1 <= number of nodes <= 1000", "0 <= Node.val <= 1000"],
    fn="vertical_traversal",
    params=[("root", "tree")],
    ret="matrix",
    ref="""
def vertical_traversal(root):
    entries = []

    def visit(node, row, col):
        if node is None:
            return
        entries.append((col, row, node.val))
        visit(node.left, row + 1, col - 1)
        visit(node.right, row + 1, col + 1)

    visit(root, 0, 0)
    entries.sort()
    columns = []
    last = None
    for col, _, value in entries:
        if col != last:
            columns.append([])
            last = col
        columns[-1].append(value)
    return columns
""",
    examples=[({"root": SAMPLE}, [[9], [3, 15], [20], [7]]), ({"root": FULL7}, [[4], [2], [1, 5, 6], [3], [7]])],
    tests=[{"root": [42]}, {"root": chain(30, "right")}, {"root": random_tree(200, seed=11, low=0, high=1000, unique=False)}, {"root": [3, 1, 4, 0, 2, 2]}],
)

problem(
    id="top-view",
    source="Top View of BT",
    title="Top View",
    topic="Binary Tree",
    difficulty="Medium",
    structure="tree",
    description="""Using the same columns as vertical order, return what you see looking down from above: for each column
    from left to right, the first node reached in a level order walk.""",
    constraints=TRAVERSAL_CONSTRAINTS,
    fn="top_view",
    params=[("root", "tree")],
    ret="array",
    ref="""
from collections import deque


def top_view(root):
    if root is None:
        return []
    first = {}
    queue = deque([(root, 0)])
    while queue:
        node, col = queue.popleft()
        if col not in first:
            first[col] = node.val
        if node.left:
            queue.append((node.left, col - 1))
        if node.right:
            queue.append((node.right, col + 1))
    return [first[col] for col in sorted(first)]
""",
    examples=[({"root": FULL7}, [4, 2, 1, 3, 7]), ({"root": [1, 2, 3, N, 4, N, N, N, 5, N, 6]}, [2, 1, 3, 6])],
    tests=tree_tests(),
)

problem(
    id="bottom-view",
    source="Bottom view of BT",
    title="Bottom View",
    topic="Binary Tree",
    difficulty="Medium",
    structure="tree",
    description="""Using vertical-order columns, return what you see from below: for each column from left to right, the
    last node reached in a level order walk (so a later node in the same column replaces an earlier one).""",
    constraints=TRAVERSAL_CONSTRAINTS,
    fn="bottom_view",
    params=[("root", "tree")],
    ret="array",
    ref="""
from collections import deque


def bottom_view(root):
    if root is None:
        return []
    last = {}
    queue = deque([(root, 0)])
    while queue:
        node, col = queue.popleft()
        last[col] = node.val
        if node.left:
            queue.append((node.left, col - 1))
        if node.right:
            queue.append((node.right, col + 1))
    return [last[col] for col in sorted(last)]
""",
    examples=[({"root": FULL7}, [4, 2, 6, 3, 7]), ({"root": [20, 8, 22, 5, 3, N, 25, N, N, 10, 14]}, [5, 10, 3, 14, 25])],
    tests=tree_tests(),
)

problem(
    id="left-right-view",
    source="Right/Left View of BT",
    title="Right and Left Views",
    topic="Binary Tree",
    difficulty="Medium",
    structure="tree",
    description="""Return [right view, left view]. The right view lists the last node of each level, the left view the
    first node of each level, both from the top down.""",
    constraints=TRAVERSAL_CONSTRAINTS,
    fn="side_views",
    params=[("root", "tree")],
    ret="matrix",
    ref="""
def side_views(root):
    right, left = [], []

    def visit(node, depth):
        if node is None:
            return
        if depth == len(left):
            left.append(node.val)
            right.append(node.val)
        right[depth] = node.val
        visit(node.left, depth + 1)
        visit(node.right, depth + 1)

    visit(root, 0)
    return [right, left]
""",
    examples=[({"root": [1, 2, 3, N, 5, N, 4]}, [[1, 3, 4], [1, 2, 5]]), ({"root": [1, N, 3]}, [[1, 3], [1, 3]])],
    tests=tree_tests(),
)

# ---------------------------------------------------------------- properties

problem(
    id="max-depth-binary-tree",
    source="Binary Tree Maximum Depth in BT",
    title="Maximum Depth",
    topic="Binary Tree",
    difficulty="Easy",
    structure="tree",
    description="""Return the number of nodes on the longest path from the root down to a leaf. An empty tree has depth
    0.""",
    constraints=TRAVERSAL_CONSTRAINTS,
    fn="max_depth",
    params=[("root", "tree")],
    ret="int",
    ref="""
def max_depth(root):
    if root is None:
        return 0
    return 1 + max(max_depth(root.left), max_depth(root.right))
""",
    examples=[({"root": SAMPLE}, 3), ({"root": [1, N, 2]}, 2)],
    tests=tree_tests(),
)

problem(
    id="identical-trees",
    source="Check if two trees are identical or not",
    title="Identical Trees",
    topic="Binary Tree",
    difficulty="Easy",
    structure="tree",
    description="""Return whether p and q have the same shape and the same value at every position.""",
    constraints=["0 <= number of nodes <= 100"],
    fn="is_same_tree",
    params=[("p", "tree"), ("q", "tree")],
    ret="bool",
    ref="""
def is_same_tree(p, q):
    if p is None or q is None:
        return p is q
    return p.val == q.val and is_same_tree(p.left, q.left) and is_same_tree(p.right, q.right)
""",
    examples=[({"p": [1, 2, 3], "q": [1, 2, 3]}, True), ({"p": [1, 2], "q": [1, N, 2]}, False)],
    tests=[
        {"p": [], "q": []},
        {"p": [1], "q": []},
        {"p": random_tree(80, seed=5), "q": random_tree(80, seed=5)},
        {"p": [1, 2, 1], "q": [1, 1, 2]},
    ],
)

problem(
    id="balanced-binary-tree",
    source="Check for balanced binary tree",
    title="Height-Balanced Tree",
    topic="Binary Tree",
    difficulty="Easy",
    structure="tree",
    description="""A tree is height-balanced when, at every node, the heights of the two subtrees differ by at most one.
    Return whether root is balanced. Compute heights bottom-up and return -1 as soon as a subtree is unbalanced.""",
    constraints=TRAVERSAL_CONSTRAINTS,
    fn="is_balanced",
    params=[("root", "tree")],
    ret="bool",
    ref="""
def is_balanced(root):
    def height(node):
        if node is None:
            return 0
        left = height(node.left)
        if left < 0:
            return -1
        right = height(node.right)
        if right < 0 or abs(left - right) > 1:
            return -1
        return 1 + max(left, right)

    return height(root) >= 0
""",
    examples=[({"root": SAMPLE}, True), ({"root": [1, 2, 2, 3, 3, N, N, 4, 4]}, False)],
    tests=tree_tests({"root": complete_tree(127)}, {"root": [1, 2, 2, 3, N, N, 3, 4, N, N, 4]}),
)

problem(
    id="diameter-binary-tree",
    source="Diameter of Binary Tree",
    title="Diameter of a Tree",
    topic="Binary Tree",
    difficulty="Easy",
    structure="tree",
    description="""The diameter is the number of edges on the longest path between any two nodes (the path may skip the
    root). Return it. At each node, the best path through it is left height + right height.""",
    constraints=["1 <= number of nodes <= 10^4"],
    fn="diameter",
    params=[("root", "tree")],
    ret="int",
    ref="""
def diameter(root):
    best = 0

    def height(node):
        nonlocal best
        if node is None:
            return 0
        left = height(node.left)
        right = height(node.right)
        best = max(best, left + right)
        return 1 + max(left, right)

    height(root)
    return best
""",
    examples=[({"root": [1, 2, 3, 4, 5]}, 3), ({"root": [1, 2]}, 1)],
    tests=[{"root": [42]}, {"root": chain(40)}, {"root": BIG}, {"root": [1, 2, N, 3, 4, 5, N, N, 6, 7, N, N, 8]}],
)

problem(
    id="max-path-sum",
    source="Maximum path sum",
    title="Maximum Path Sum",
    topic="Binary Tree",
    difficulty="Hard",
    structure="tree",
    description="""A path is any sequence of connected nodes, each used at most once, with at least one node. Return the
    largest possible sum of a path. At each node, only non-negative branch gains are worth adding.""",
    constraints=["1 <= number of nodes <= 3 * 10^4", "-1000 <= Node.val <= 1000"],
    fn="max_path_sum",
    params=[("root", "tree")],
    ret="int",
    ref="""
def max_path_sum(root):
    best = root.val

    def gain(node):
        nonlocal best
        if node is None:
            return 0
        left = max(gain(node.left), 0)
        right = max(gain(node.right), 0)
        best = max(best, node.val + left + right)
        return node.val + max(left, right)

    gain(root)
    return best
""",
    examples=[({"root": [1, 2, 3]}, 6), ({"root": [-10, 9, 20, N, N, 15, 7]}, 42)],
    tests=[{"root": [-3]}, {"root": [-2, -1]}, {"root": random_tree(250, seed=12, low=-1000, high=1000, unique=False)}, {"root": [5, 4, 8, 11, N, 13, 4, 7, 2, N, N, N, 1]}],
)

problem(
    id="symmetric-tree",
    source="Check for symmetrical BTs",
    title="Symmetric Tree",
    topic="Binary Tree",
    difficulty="Easy",
    structure="tree",
    description="""Return whether the tree is a mirror image of itself around its centre.""",
    constraints=["1 <= number of nodes <= 1000"],
    fn="is_symmetric",
    params=[("root", "tree")],
    ret="bool",
    ref="""
def is_symmetric(root):
    def mirror(a, b):
        if a is None or b is None:
            return a is b
        return a.val == b.val and mirror(a.left, b.right) and mirror(a.right, b.left)

    return mirror(root.left, root.right)
""",
    examples=[({"root": [1, 2, 2, 3, 4, 4, 3]}, True), ({"root": [1, 2, 2, N, 3, N, 3]}, False)],
    tests=[{"root": [1]}, {"root": [1, 2, 2, 2, N, 2]}, {"root": [1] * 127}, {"root": [1, 2, 3]}],
)

problem(
    id="root-to-node-path",
    source="Print root to node path in BT",
    title="Path from Root to a Node",
    topic="Binary Tree",
    difficulty="Medium",
    structure="tree",
    description="""Values are unique. Return the values on the path from the root down to the node holding target, or an
    empty list if target is not in the tree. Backtrack: add a node, search its subtrees, remove it if neither has the
    target.""",
    constraints=["0 <= number of nodes <= 10^4", "Values are unique."],
    fn="root_to_node",
    params=[("root", "tree"), ("target", "int")],
    ret="array",
    ref="""
def root_to_node(root, target):
    path = []

    def find(node):
        if node is None:
            return False
        path.append(node.val)
        if node.val == target or find(node.left) or find(node.right):
            return True
        path.pop()
        return False

    find(root)
    return path
""",
    examples=[({"root": FULL7, "target": 5}, [1, 2, 5]), ({"root": FULL7, "target": 9}, [])],
    tests=[{"root": [], "target": 1}, {"root": [7], "target": 7}, {"root": BIG, "target": BIG[-1]}, {"root": chain(50), "target": 50}],
)

problem(
    id="lca-binary-tree",
    source="LCA in BT",
    title="Lowest Common Ancestor",
    topic="Binary Tree",
    difficulty="Medium",
    structure="tree",
    description="""Values are unique and both p and q are in the tree. Return the value of their lowest common ancestor:
    the deepest node that has both as descendants (a node counts as its own descendant).""",
    constraints=["2 <= number of nodes <= 10^5", "Values are unique.", "p != q"],
    fn="lowest_common_ancestor",
    params=[("root", "tree"), ("p", "int"), ("q", "int")],
    ret="int",
    ref="""
def lowest_common_ancestor(root, p, q):
    def search(node):
        if node is None or node.val == p or node.val == q:
            return node
        left = search(node.left)
        right = search(node.right)
        if left and right:
            return node
        return left or right

    return search(root).val
""",
    examples=[({"root": LCA_TREE, "p": 5, "q": 1}, 3), ({"root": LCA_TREE, "p": 5, "q": 4}, 5)],
    tests=[
        {"root": [1, 2], "p": 1, "q": 2},
        {"root": LCA_TREE, "p": 7, "q": 8},
        {"root": BIG, "p": [v for v in BIG if v is not None][-1], "q": [v for v in BIG if v is not None][-7]},
    ],
)

problem(
    id="max-width-binary-tree",
    source="Maximum Width of BT",
    title="Maximum Width",
    topic="Binary Tree",
    difficulty="Medium",
    structure="tree",
    description="""The width of a level is the distance between its leftmost and rightmost nodes, counting the gaps as if
    the tree were complete. Return the largest width. Number the nodes like a heap: children of i are 2i+1 and 2i+2.""",
    constraints=["1 <= number of nodes <= 3000"],
    fn="width_of_binary_tree",
    params=[("root", "tree")],
    ret="int",
    ref="""
def width_of_binary_tree(root):
    best = 0
    level = [(root, 0)]
    while level:
        best = max(best, level[-1][1] - level[0][1] + 1)
        nxt = []
        for node, index in level:
            if node.left:
                nxt.append((node.left, 2 * index + 1))
            if node.right:
                nxt.append((node.right, 2 * index + 2))
        level = nxt
    return best
""",
    examples=[({"root": [1, 3, 2, 5, 3, N, 9]}, 4), ({"root": [1, 3, 2, 5]}, 2)],
    tests=[{"root": [1]}, {"root": [1, 3, 2, 5, N, N, 9, 6, N, 7]}, {"root": BIG}, {"root": complete_tree(63)}],
)

problem(
    id="nodes-at-distance-k",
    source="Print all nodes at a distance of K in BT",
    title="Nodes at Distance K",
    topic="Binary Tree",
    difficulty="Medium",
    structure="tree",
    description="""Values are unique and target is in the tree. Return, in ascending order, the values of every node
    exactly k edges away from target. Record each node's parent, then walk outward in all three directions.""",
    constraints=["1 <= number of nodes <= 500", "0 <= k <= 1000"],
    fn="distance_k",
    params=[("root", "tree"), ("target", "int"), ("k", "int")],
    ret="array",
    ref="""
def distance_k(root, target, k):
    parent = {}
    start = None
    stack = [root]
    while stack:
        node = stack.pop()
        if node.val == target:
            start = node
        for child in (node.left, node.right):
            if child:
                parent[child] = node
                stack.append(child)
    seen = {start}
    frontier = [start]
    for _ in range(k):
        nxt = []
        for node in frontier:
            for other in (node.left, node.right, parent.get(node)):
                if other and other not in seen:
                    seen.add(other)
                    nxt.append(other)
        frontier = nxt
    return sorted(node.val for node in frontier)
""",
    examples=[({"root": LCA_TREE, "target": 5, "k": 2}, [1, 4, 7]), ({"root": [1], "target": 1, "k": 3}, [])],
    tests=[
        {"root": LCA_TREE, "target": 3, "k": 0},
        {"root": LCA_TREE, "target": 7, "k": 3},
        {"root": random_tree(200, seed=13), "target": random_tree(200, seed=13)[0], "k": 4},
    ],
)

problem(
    id="burn-binary-tree",
    source="Minimum time taken to burn the BT from a given Node",
    title="Time to Burn a Tree",
    topic="Binary Tree",
    difficulty="Hard",
    structure="tree",
    description="""A fire starts at the node holding start (values are unique). Each second it spreads from every burning
    node to its children and parent. Return how many seconds it takes for the whole tree to burn.""",
    constraints=["1 <= number of nodes <= 10^5", "Values are unique."],
    fn="burn_time",
    params=[("root", "tree"), ("start", "int")],
    ret="int",
    ref="""
def burn_time(root, start):
    parent = {}
    origin = None
    stack = [root]
    while stack:
        node = stack.pop()
        if node.val == start:
            origin = node
        for child in (node.left, node.right):
            if child:
                parent[child] = node
                stack.append(child)
    seen = {origin}
    frontier = [origin]
    seconds = 0
    while True:
        nxt = []
        for node in frontier:
            for other in (node.left, node.right, parent.get(node)):
                if other and other not in seen:
                    seen.add(other)
                    nxt.append(other)
        if not nxt:
            return seconds
        frontier = nxt
        seconds += 1
""",
    examples=[({"root": FULL7, "start": 2}, 3), ({"root": FULL7, "start": 1}, 2)],
    tests=[{"root": [9], "start": 9}, {"root": chain(60), "start": 30}, {"root": BIG, "start": BIG[0]}, {"root": [1, 5, 3, N, 4, 10, 6, 9, 2], "start": 3}],
)

problem(
    id="count-complete-tree-nodes",
    source="Count total nodes in a complete BT",
    title="Count Nodes in a Complete Tree",
    topic="Binary Tree",
    difficulty="Medium",
    structure="tree",
    description="""root is a complete binary tree. Return its node count in less than O(n): when the leftmost and
    rightmost depths match the subtree is perfect and holds 2^h − 1 nodes; otherwise recurse into both children.""",
    constraints=["0 <= number of nodes <= 5 * 10^4", "The tree is complete."],
    fn="count_nodes",
    params=[("root", "tree")],
    ret="int",
    ref="""
def count_nodes(root):
    if root is None:
        return 0
    left_depth = right_depth = 0
    node = root
    while node:
        left_depth += 1
        node = node.left
    node = root
    while node:
        right_depth += 1
        node = node.right
    if left_depth == right_depth:
        return (1 << left_depth) - 1
    return 1 + count_nodes(root.left) + count_nodes(root.right)
""",
    examples=[({"root": [1, 2, 3, 4, 5, 6]}, 6), ({"root": []}, 0)],
    tests=[{"root": [1]}, {"root": complete_tree(1023)}, {"root": complete_tree(1500)}],
)

# ---------------------------------------------------------------- construction

problem(
    id="unique-tree-requirements",
    source="Requirements needed to construct a unique BT",
    title="Which Traversal Pairs Fix a Tree",
    topic="Binary Tree",
    difficulty="Easy",
    structure="tree",
    description="""a and b each name a traversal: "inorder", "preorder", "postorder" or "levelorder". Return whether
    knowing both traversals (with unique values) always pins down exactly one binary tree. That is true only when one
    of them is inorder and the other is not.""",
    constraints=["a and b are one of the four names."],
    fn="can_build_unique",
    params=[("a", "string"), ("b", "string")],
    ret="bool",
    ref="""
def can_build_unique(a, b):
    return (a == "inorder") != (b == "inorder")
""",
    examples=[({"a": "inorder", "b": "preorder"}, True), ({"a": "preorder", "b": "postorder"}, False)],
    tests=[{"a": "inorder", "b": "inorder"}, {"a": "levelorder", "b": "inorder"}, {"a": "postorder", "b": "levelorder"}],
)

problem(
    id="build-tree-preorder-inorder",
    source="Construct a BT from Preorder and Inorder",
    title="Tree from Preorder and Inorder",
    topic="Binary Tree",
    difficulty="Medium",
    structure="tree",
    description="""Values are unique. Rebuild the tree from its preorder and inorder traversals and return its root. The
    first preorder value is the root; its position in inorder splits the left and right subtrees.""",
    constraints=["1 <= n <= 3000", "Values are unique."],
    fn="build_tree",
    params=[("preorder", "array"), ("inorder", "array")],
    ret="tree",
    ref="""
def build_tree(preorder, inorder):
    where = {value: index for index, value in enumerate(inorder)}
    position = 0

    def build(low, high):
        nonlocal position
        if low > high:
            return None
        value = preorder[position]
        position += 1
        node = TreeNode(value)
        mid = where[value]
        node.left = build(low, mid - 1)
        node.right = build(mid + 1, high)
        return node

    return build(0, len(inorder) - 1)
""",
    examples=[
        ({"preorder": [3, 9, 20, 15, 7], "inorder": [9, 3, 15, 20, 7]}, SAMPLE),
        ({"preorder": [-1], "inorder": [-1]}, [-1]),
    ],
    tests=[
        {"preorder": [1, 2, 3], "inorder": [3, 2, 1]},
        {"preorder": list(range(1, 60)), "inorder": list(range(1, 60))},
        {"preorder": [1, 2, 4, 5, 3, 6, 7], "inorder": [4, 2, 5, 1, 6, 3, 7]},
    ],
)

problem(
    id="build-tree-postorder-inorder",
    source="Construct a BT from Postorder and Inorder",
    title="Tree from Postorder and Inorder",
    topic="Binary Tree",
    difficulty="Medium",
    structure="tree",
    description="""Values are unique. Rebuild the tree from its inorder and postorder traversals and return its root.
    Read postorder from the back: each value is a root, and you build its right subtree before its left.""",
    constraints=["1 <= n <= 3000", "Values are unique."],
    fn="build_tree_post",
    params=[("inorder", "array"), ("postorder", "array")],
    ret="tree",
    ref="""
def build_tree_post(inorder, postorder):
    where = {value: index for index, value in enumerate(inorder)}
    position = len(postorder) - 1

    def build(low, high):
        nonlocal position
        if low > high:
            return None
        value = postorder[position]
        position -= 1
        node = TreeNode(value)
        mid = where[value]
        node.right = build(mid + 1, high)
        node.left = build(low, mid - 1)
        return node

    return build(0, len(inorder) - 1)
""",
    examples=[
        ({"inorder": [9, 3, 15, 20, 7], "postorder": [9, 15, 7, 20, 3]}, SAMPLE),
        ({"inorder": [2, 1], "postorder": [2, 1]}, [1, 2]),
    ],
    tests=[
        {"inorder": [5], "postorder": [5]},
        {"inorder": list(range(1, 60)), "postorder": list(range(1, 60))},
        {"inorder": [4, 2, 5, 1, 6, 3, 7], "postorder": [4, 5, 2, 6, 7, 3, 1]},
    ],
)

problem(
    id="serialize-deserialize-tree",
    source="Serialize and De-serialize BT",
    title="Serialize and Deserialize a Tree",
    topic="Binary Tree",
    difficulty="Hard",
    structure="tree",
    description="""Build Codec. serialize(root) writes the tree in level order as comma-separated values, with # for a
    missing child and no trailing #s ("" for an empty tree): [1,2,3,null,null,4,5] becomes "1,2,3,#,#,4,5".
    deserialize(data) turns such a string back into the tree.""",
    constraints=["0 <= number of nodes <= 10^4", "-1000 <= Node.val <= 1000"],
    design=design(
        "Codec",
        methods=[method("serialize", [("root", "tree")], ret="string"), method("deserialize", [("data", "string")], ret="tree")],
    ),
    ref="""
from collections import deque


class Codec:
    def serialize(self, root):
        if root is None:
            return ""
        parts = []
        queue = deque([root])
        while queue:
            node = queue.popleft()
            if node is None:
                parts.append("#")
                continue
            parts.append(str(node.val))
            queue.append(node.left)
            queue.append(node.right)
        while parts and parts[-1] == "#":
            parts.pop()
        return ",".join(parts)

    def deserialize(self, data):
        if not data:
            return None
        parts = data.split(",")
        root = TreeNode(int(parts[0]))
        queue = deque([root])
        index = 1
        while queue and index < len(parts):
            node = queue.popleft()
            if index < len(parts) and parts[index] != "#":
                node.left = TreeNode(int(parts[index]))
                queue.append(node.left)
            index += 1
            if index < len(parts) and parts[index] != "#":
                node.right = TreeNode(int(parts[index]))
                queue.append(node.right)
            index += 1
        return root
""",
    examples=[
        (ops(("Codec",), ("serialize", [1, 2, 3, N, N, 4, 5]), ("deserialize", "1,2,3,#,#,4,5")), [None, "1,2,3,#,#,4,5", [1, 2, 3, N, N, 4, 5]]),
        (ops(("Codec",), ("serialize", []), ("deserialize", "")), [None, "", []]),
    ],
    tests=[
        ops(("Codec",), ("serialize", [-7]), ("deserialize", "-7")),
        ops(("Codec",), ("serialize", BIG), ("deserialize", ",".join("#" if v is None else str(v) for v in BIG))),
        ops(("Codec",), ("serialize", chain(20, "right")), ("deserialize", "1,#,2,#,3")),
    ],
)
