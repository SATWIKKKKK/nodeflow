"""Deterministic tree inputs (LeetCode level order, None for gaps) for hidden tests."""

import random
from collections import deque


class _Node:
    def __init__(self, val):
        self.val = val
        self.left = None
        self.right = None


def level_order(root):
    if root is None:
        return []
    output = []
    queue = deque([root])
    while queue:
        node = queue.popleft()
        if node is None:
            output.append(None)
            continue
        output.append(node.val)
        queue.append(node.left)
        queue.append(node.right)
    while output and output[-1] is None:
        output.pop()
    return output


def random_tree(n, seed, low=1, high=None, unique=True):
    """A random binary tree with n nodes (grown by attaching to random free slots)."""
    rng = random.Random(seed)
    if unique:
        values = rng.sample(range(low, (high or low + 4 * n) + 1), n)
    else:
        values = [rng.randint(low, high or low + 20) for _ in range(n)]
    if n == 0:
        return []
    root = _Node(values[0])
    slots = [(root, "left"), (root, "right")]
    for value in values[1:]:
        parent, side = slots.pop(rng.randrange(len(slots)))
        child = _Node(value)
        setattr(parent, side, child)
        slots += [(child, "left"), (child, "right")]
    return level_order(root)


def complete_tree(n, start=1):
    return list(range(start, start + n))


def chain(n, side="left", start=1):
    if n == 0:
        return []
    root = _Node(start)
    node = root
    for value in range(start + 1, start + n):
        child = _Node(value)
        setattr(node, side, child)
        node = child
    return level_order(root)


def bst(values):
    """Level order of the BST made by inserting values in order."""
    root = None
    for value in values:
        if root is None:
            root = _Node(value)
            continue
        node = root
        while True:
            side = "left" if value < node.val else "right"
            nxt = getattr(node, side)
            if nxt is None:
                setattr(node, side, _Node(value))
                break
            node = nxt
    return level_order(root)


def random_bst(n, seed, high=None):
    rng = random.Random(seed)
    return bst(rng.sample(range(1, (high or 5 * n) + 1), n))
