from dsl import problem

LONG = [((i * 37) % 101) for i in range(300)]

problem(
    id="array-to-linked-list",
    source="Introduction to Singly LinkedList",
    title="Array to Linked List",
    topic="Linked List",
    difficulty="Easy",
    structure="linked_list",
    description="""Build a singly linked list holding the values of nums in order and return its head. Keep a tail
    pointer so each new node is attached in constant time.""",
    constraints=["0 <= nums.length <= 1000"],
    fn="array_to_list",
    params=[("nums", "array")],
    ret="linked_list",
    ref="""
def array_to_list(nums):
    dummy = ListNode(0)
    tail = dummy
    for value in nums:
        tail.next = ListNode(value)
        tail = tail.next
    return dummy.next
""",
    examples=[({"nums": [1, 2, 3]}, [1, 2, 3]), ({"nums": []}, [])],
    tests=[{"nums": [9]}, {"nums": [5, 5, 5]}, {"nums": LONG}],
)

problem(
    id="delete-value-linked-list",
    source="Delete the element with value X",
    title="Delete the First Node with Value X",
    topic="Linked List",
    difficulty="Easy",
    structure="linked_list",
    description="""Remove the first node whose value is x and return the head. If no node holds x, return the list
    unchanged.""",
    constraints=["0 <= list length <= 1000"],
    fn="delete_value",
    params=[("head", "linked_list"), ("x", "int")],
    ret="linked_list",
    ref="""
def delete_value(head, x):
    dummy = ListNode(0, head)
    previous = dummy
    while previous.next is not None:
        if previous.next.val == x:
            previous.next = previous.next.next
            break
        previous = previous.next
    return dummy.next
""",
    examples=[({"head": [1, 2, 3, 2], "x": 2}, [1, 3, 2]), ({"head": [5], "x": 7}, [5])],
    tests=[{"head": [], "x": 1}, {"head": [4], "x": 4}, {"head": [1, 2, 3], "x": 3}, {"head": LONG, "x": 50}],
)

problem(
    id="array-to-doubly-linked-list",
    source="Convert Array to Doubly Linked List",
    title="Array to Doubly Linked List",
    topic="Doubly Linked List",
    difficulty="Easy",
    structure="linked_list",
    description="""Build a doubly linked list holding nums in order. Every node's prev must point at the node before it
    (the head's prev is None). Return the head.""",
    constraints=["0 <= nums.length <= 1000"],
    fn="array_to_dll",
    params=[("nums", "array")],
    ret="doubly_linked_list",
    ref="""
def array_to_dll(nums):
    head = tail = None
    for value in nums:
        node = DListNode(value)
        if head is None:
            head = tail = node
        else:
            tail.next = node
            node.prev = tail
            tail = node
    return head
""",
    examples=[({"nums": [4, 5, 6]}, [4, 5, 6]), ({"nums": []}, [])],
    tests=[{"nums": [1]}, {"nums": [2, 2]}, {"nums": LONG[:100]}],
)

problem(
    id="dll-delete-head",
    source="Delete head of Doubly Linked List",
    title="Delete the Head of a Doubly Linked List",
    topic="Doubly Linked List",
    difficulty="Easy",
    structure="linked_list",
    description="""Remove the first node and return the new head. Remember to clear the new head's prev pointer.""",
    constraints=["1 <= list length <= 1000"],
    fn="dll_delete_head",
    params=[("head", "doubly_linked_list")],
    ret="doubly_linked_list",
    ref="""
def dll_delete_head(head):
    new_head = head.next
    if new_head is not None:
        new_head.prev = None
    head.next = None
    return new_head
""",
    examples=[({"head": [1, 2, 3]}, [2, 3]), ({"head": [7]}, [])],
    tests=[{"head": [1, 2]}, {"head": [9, 8, 7, 6]}, {"head": LONG[:50]}],
)

problem(
    id="dll-delete-tail",
    source="Delete Tail of Doubly Linked List",
    title="Delete the Tail of a Doubly Linked List",
    topic="Doubly Linked List",
    difficulty="Easy",
    structure="linked_list",
    description="""Remove the last node and return the head (None if the list becomes empty).""",
    constraints=["1 <= list length <= 1000"],
    fn="dll_delete_tail",
    params=[("head", "doubly_linked_list")],
    ret="doubly_linked_list",
    ref="""
def dll_delete_tail(head):
    if head.next is None:
        return None
    tail = head
    while tail.next is not None:
        tail = tail.next
    tail.prev.next = None
    tail.prev = None
    return head
""",
    examples=[({"head": [1, 2, 3]}, [1, 2]), ({"head": [7]}, [])],
    tests=[{"head": [1, 2]}, {"head": [4, 4, 4]}, {"head": LONG[:50]}],
)

problem(
    id="dll-delete-kth",
    source="Delete Kth Element of Doubly Linked List",
    title="Delete the Kth Node of a Doubly Linked List",
    topic="Doubly Linked List",
    difficulty="Easy",
    structure="linked_list",
    description="""Remove the k-th node (counting from 1) and return the head. If the list has fewer than k nodes,
    return it unchanged. Fix both neighbours' pointers.""",
    constraints=["0 <= list length <= 1000", "1 <= k <= 1000"],
    fn="dll_delete_kth",
    params=[("head", "doubly_linked_list"), ("k", "int")],
    ret="doubly_linked_list",
    ref="""
def dll_delete_kth(head, k):
    node = head
    position = 1
    while node is not None and position < k:
        node = node.next
        position += 1
    if node is None:
        return head
    if node.prev is not None:
        node.prev.next = node.next
    else:
        head = node.next
    if node.next is not None:
        node.next.prev = node.prev
    node.prev = node.next = None
    return head
""",
    examples=[({"head": [1, 2, 3, 4], "k": 2}, [1, 3, 4]), ({"head": [1, 2], "k": 5}, [1, 2])],
    tests=[{"head": [1], "k": 1}, {"head": [1, 2, 3], "k": 1}, {"head": [1, 2, 3], "k": 3}, {"head": [], "k": 1}],
)

problem(
    id="dll-delete-value",
    source="Removing given node in Doubly Linked List",
    title="Remove a Given Node from a Doubly Linked List",
    topic="Doubly Linked List",
    difficulty="Easy",
    structure="linked_list",
    description="""Values are distinct. Remove the node holding x (it is always present) and return the head.""",
    constraints=["1 <= list length <= 1000", "Values are distinct and x is in the list."],
    fn="dll_delete_value",
    params=[("head", "doubly_linked_list"), ("x", "int")],
    ret="doubly_linked_list",
    ref="""
def dll_delete_value(head, x):
    node = head
    while node.val != x:
        node = node.next
    if node.prev is not None:
        node.prev.next = node.next
    else:
        head = node.next
    if node.next is not None:
        node.next.prev = node.prev
    return head
""",
    examples=[({"head": [3, 1, 4], "x": 1}, [3, 4]), ({"head": [3], "x": 3}, [])],
    tests=[{"head": [3, 1, 4], "x": 3}, {"head": [3, 1, 4], "x": 4}, {"head": list(range(100)), "x": 57}],
)

problem(
    id="dll-insert-before-head",
    source="Insert node before head in Doubly Linked List",
    title="Insert Before the Head",
    topic="Doubly Linked List",
    difficulty="Easy",
    structure="linked_list",
    description="""Insert a node holding value in front of the head and return the new head.""",
    constraints=["0 <= list length <= 1000"],
    fn="dll_insert_before_head",
    params=[("head", "doubly_linked_list"), ("value", "int")],
    ret="doubly_linked_list",
    ref="""
def dll_insert_before_head(head, value):
    node = DListNode(value)
    node.next = head
    if head is not None:
        head.prev = node
    return node
""",
    examples=[({"head": [2, 3], "value": 1}, [1, 2, 3]), ({"head": [], "value": 5}, [5])],
    tests=[{"head": [9], "value": 9}, {"head": [1, 2, 3, 4], "value": 0}, {"head": list(range(50)), "value": -5}],
)

problem(
    id="dll-insert-before-tail",
    source="Insert node before tail in Doubly Linked List",
    title="Insert Before the Tail",
    topic="Doubly Linked List",
    difficulty="Easy",
    structure="linked_list",
    description="""Insert a node holding value just before the last node and return the head. If the list is empty,
    the new node becomes the whole list.""",
    constraints=["0 <= list length <= 1000"],
    fn="dll_insert_before_tail",
    params=[("head", "doubly_linked_list"), ("value", "int")],
    ret="doubly_linked_list",
    ref="""
def dll_insert_before_tail(head, value):
    node = DListNode(value)
    if head is None:
        return node
    tail = head
    while tail.next is not None:
        tail = tail.next
    node.next = tail
    node.prev = tail.prev
    if tail.prev is not None:
        tail.prev.next = node
    else:
        head = node
    tail.prev = node
    return head
""",
    examples=[({"head": [1, 2, 4], "value": 3}, [1, 2, 3, 4]), ({"head": [9], "value": 8}, [8, 9])],
    tests=[{"head": [], "value": 1}, {"head": [1, 2], "value": 5}, {"head": list(range(20)), "value": 99}],
)

problem(
    id="dll-insert-before-kth",
    source="Insert node before (kth node) in Doubly Linked List",
    title="Insert Before the Kth Node",
    topic="Doubly Linked List",
    difficulty="Easy",
    structure="linked_list",
    description="""Insert a node holding value just before the k-th node (counting from 1) and return the head.
    k is always between 1 and the list length.""",
    constraints=["1 <= k <= list length <= 1000"],
    fn="dll_insert_before_kth",
    params=[("head", "doubly_linked_list"), ("k", "int"), ("value", "int")],
    ret="doubly_linked_list",
    ref="""
def dll_insert_before_kth(head, k, value):
    target = head
    for _ in range(k - 1):
        target = target.next
    node = DListNode(value)
    node.next = target
    node.prev = target.prev
    if target.prev is not None:
        target.prev.next = node
    else:
        head = node
    target.prev = node
    return head
""",
    examples=[({"head": [1, 2, 4], "k": 3, "value": 3}, [1, 2, 3, 4]), ({"head": [5], "k": 1, "value": 4}, [4, 5])],
    tests=[{"head": [1, 2, 3], "k": 1, "value": 0}, {"head": [1, 2, 3], "k": 2, "value": 9}, {"head": list(range(30)), "k": 30, "value": -1}],
)

problem(
    id="dll-insert-before-value",
    source="Insert before given node in Doubly Linked List",
    title="Insert Before a Given Node",
    topic="Doubly Linked List",
    difficulty="Easy",
    structure="linked_list",
    description="""Values are distinct and x is always in the list. Insert a node holding value just before the node
    holding x, and return the head.""",
    constraints=["1 <= list length <= 1000"],
    fn="dll_insert_before_value",
    params=[("head", "doubly_linked_list"), ("x", "int"), ("value", "int")],
    ret="doubly_linked_list",
    ref="""
def dll_insert_before_value(head, x, value):
    target = head
    while target.val != x:
        target = target.next
    node = DListNode(value)
    node.next = target
    node.prev = target.prev
    if target.prev is not None:
        target.prev.next = node
    else:
        head = node
    target.prev = node
    return head
""",
    examples=[({"head": [10, 20, 30], "x": 20, "value": 15}, [10, 15, 20, 30]), ({"head": [10], "x": 10, "value": 5}, [5, 10])],
    tests=[{"head": [1, 2, 3], "x": 3, "value": 0}, {"head": [1, 2, 3], "x": 1, "value": 7}, {"head": list(range(40)), "x": 21, "value": 100}],
)

problem(
    id="intersection-y-linked-lists",
    source="Find the intersection point of Y LL",
    title="Where Two Lists Meet",
    topic="Linked List",
    difficulty="Medium",
    structure="linked_list",
    description="""Two singly linked lists may merge into one shared tail, forming a Y. Return the value of the first
    shared node, or -1 if they never meet. (headA and headB are built from their own values followed by the shared
    values in common.) Two pointers that switch lists at the end meet at the join after at most m + n steps.""",
    constraints=["0 <= lengths <= 1000", "Compare nodes by identity, not by value."],
    fn="intersection_node",
    params=[("headA", "y_list"), ("headB", "y_list")],
    ret="list_node_value",
    shared_tail="common",
    ref="""
def intersection_node(headA, headB):
    a, b = headA, headB
    while a is not b:
        a = a.next if a is not None else headB
        b = b.next if b is not None else headA
    return a
""",
    examples=[
        ({"headA": [4, 1], "headB": [5, 6, 1], "common": [8, 4, 5]}, 8, "Both lists continue into 8 → 4 → 5; the equal 1s are different nodes."),
        ({"headA": [2, 6, 4], "headB": [1, 5], "common": []}, -1),
    ],
    tests=[
        {"headA": [], "headB": [], "common": [3]},
        {"headA": [1, 9, 1], "headB": [3], "common": [2, 4]},
        {"headA": list(range(100)), "headB": list(range(5)), "common": [777, 778]},
        {"headA": [1], "headB": [1], "common": []},
    ],
)

problem(
    id="detect-cycle",
    source="Detect a loop in Linked List",
    title="Detect a Cycle",
    topic="Linked List",
    difficulty="Easy",
    structure="linked_list",
    description="""Return whether the list contains a cycle. The input gives the node values and pos, the index the tail
    links back to (-1 means no cycle). Use a slow and a fast pointer; if they ever meet, there is a cycle.""",
    constraints=["0 <= list length <= 10^4"],
    fn="has_cycle",
    params=[("head", "cyclic_list")],
    ret="bool",
    ref="""
def has_cycle(head):
    slow = fast = head
    while fast is not None and fast.next is not None:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            return True
    return False
""",
    examples=[({"head": {"values": [3, 2, 0, -4], "pos": 1}}, True), ({"head": {"values": [1], "pos": -1}}, False)],
    tests=[{"head": {"values": [], "pos": -1}}, {"head": {"values": [1], "pos": 0}}, {"head": {"values": list(range(500)), "pos": 250}}, {"head": {"values": list(range(500)), "pos": -1}}],
)

problem(
    id="cycle-start",
    source="Find the starting point in LL",
    title="Where the Cycle Starts",
    topic="Linked List",
    difficulty="Medium",
    structure="linked_list",
    description="""Return the value of the node where the cycle begins, or -1 if there is no cycle. Values are distinct.
    After the slow and fast pointers meet, a pointer from the head and the slow pointer meet exactly at the start.""",
    constraints=["0 <= list length <= 10^4", "Values are distinct."],
    fn="cycle_start",
    params=[("head", "cyclic_list")],
    ret="list_node_value",
    ref="""
def cycle_start(head):
    slow = fast = head
    while fast is not None and fast.next is not None:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            finder = head
            while finder is not slow:
                finder = finder.next
                slow = slow.next
            return finder
    return None
""",
    examples=[({"head": {"values": [3, 2, 0, -4], "pos": 1}}, 2), ({"head": {"values": [1, 2], "pos": -1}}, -1)],
    tests=[{"head": {"values": [1], "pos": 0}}, {"head": {"values": [1, 2], "pos": 0}}, {"head": {"values": list(range(1, 400)), "pos": 123}}],
)

problem(
    id="cycle-length",
    source="Length of loop in LL",
    title="Length of the Cycle",
    topic="Linked List",
    difficulty="Medium",
    structure="linked_list",
    description="""Return how many nodes the cycle contains, or 0 if the list has no cycle.""",
    constraints=["0 <= list length <= 10^4"],
    fn="loop_length",
    params=[("head", "cyclic_list")],
    ret="int",
    ref="""
def loop_length(head):
    slow = fast = head
    while fast is not None and fast.next is not None:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            length = 1
            walker = slow.next
            while walker is not slow:
                walker = walker.next
                length += 1
            return length
    return 0
""",
    examples=[({"head": {"values": [1, 2, 3, 4, 5], "pos": 1}}, 4), ({"head": {"values": [1], "pos": -1}}, 0)],
    tests=[{"head": {"values": [7], "pos": 0}}, {"head": {"values": [1, 2, 3], "pos": 0}}, {"head": {"values": list(range(1000)), "pos": 10}}],
)

problem(
    id="flatten-multilevel-list",
    source="Flattening of LL",
    title="Flatten a Multi-Level List",
    topic="Linked List",
    difficulty="Hard",
    structure="linked_list",
    description="""Heads are joined left to right by next, and each head starts a sorted vertical list joined by child.
    Merge everything into one sorted list linked through child pointers and return its head. The input lists each
    vertical column top to bottom.""",
    constraints=["0 <= number of columns <= 50", "0 <= total nodes <= 1000", "Each column is sorted ascending."],
    fn="flatten",
    params=[("head", "child_list")],
    ret="child_list",
    ref="""
def flatten(head):
    def merge(a, b):
        dummy = ChildNode(0)
        tail = dummy
        while a is not None and b is not None:
            if a.val <= b.val:
                tail.child, a = a, a.child
            else:
                tail.child, b = b, b.child
            tail = tail.child
            tail.next = None
        tail.child = a if a is not None else b
        return dummy.child

    if head is None or head.next is None:
        return head
    rest = flatten(head.next)
    head.next = None
    return merge(head, rest)
""",
    examples=[
        ({"head": [[5, 7, 8, 30], [10, 20], [19, 22, 50], [28, 35, 40, 45]]}, [5, 7, 8, 10, 19, 20, 22, 28, 30, 35, 40, 45, 50]),
        ({"head": [[1, 2]]}, [1, 2]),
    ],
    tests=[{"head": []}, {"head": [[3], [1], [2]]}, {"head": [[1, 1, 1], [1, 2], [0, 3]]}, {"head": [[c * 3 + r for r in range(10)] for c in range(20)]}],
)

problem(
    id="sort-linked-list",
    source="Sort LL",
    title="Sort a Linked List",
    topic="Linked List",
    difficulty="Medium",
    structure="linked_list",
    description="""Sort the list in ascending order in O(n log n) time with merge sort: find the middle with slow and
    fast pointers, sort both halves, then merge.""",
    constraints=["0 <= list length <= 5 * 10^4", "-10^5 <= values <= 10^5"],
    fn="sort_list",
    params=[("head", "linked_list")],
    ret="linked_list",
    ref="""
def sort_list(head):
    if head is None or head.next is None:
        return head
    slow, fast = head, head.next
    while fast is not None and fast.next is not None:
        slow = slow.next
        fast = fast.next.next
    right = slow.next
    slow.next = None
    left = sort_list(head)
    right = sort_list(right)
    dummy = ListNode(0)
    tail = dummy
    while left is not None and right is not None:
        if left.val <= right.val:
            tail.next, left = left, left.next
        else:
            tail.next, right = right, right.next
        tail = tail.next
    tail.next = left if left is not None else right
    return dummy.next
""",
    examples=[({"head": [4, 2, 1, 3]}, [1, 2, 3, 4]), ({"head": []}, [])],
    tests=[{"head": [1]}, {"head": [-1, 5, 3, 4, 0]}, {"head": [2, 2, 1, 1]}, {"head": LONG}],
)

problem(
    id="copy-random-list",
    source="Clone a LL with random and next pointer",
    title="Copy a List with Random Pointers",
    topic="Linked List",
    difficulty="Hard",
    structure="linked_list",
    description="""Each node has next and random pointers; random may point at any node or be None. Return a deep copy:
    brand-new nodes whose next and random pointers mirror the original. The input lists [value, index of random]
    for each node. Interleaving copies between the originals avoids a hash map.""",
    constraints=["0 <= list length <= 1000", "-10^4 <= values <= 10^4"],
    fn="copy_random_list",
    params=[("head", "random_list")],
    ret="random_list",
    ref="""
def copy_random_list(head):
    node = head
    while node is not None:
        copy = RandomNode(node.val)
        copy.next = node.next
        node.next = copy
        node = copy.next
    node = head
    while node is not None:
        node.next.random = node.random.next if node.random is not None else None
        node = node.next.next
    dummy = RandomNode(0)
    tail = dummy
    node = head
    while node is not None:
        copy = node.next
        node.next = copy.next
        tail.next = copy
        tail = copy
        node = node.next
    return dummy.next
""",
    examples=[
        ({"head": [[7, None], [13, 0], [11, 4], [10, 2], [1, 0]]}, [[7, None], [13, 0], [11, 4], [10, 2], [1, 0]]),
        ({"head": []}, []),
    ],
    tests=[{"head": [[1, 0]]}, {"head": [[3, None], [3, 0], [3, None]]}, {"head": [[i, (i * 7) % 60] for i in range(60)]}],
)

problem(
    id="dll-delete-all-key",
    source="Delete all occurrences of a key in DLL",
    title="Delete Every Occurrence of a Key",
    topic="Doubly Linked List",
    difficulty="Medium",
    structure="linked_list",
    description="""Remove every node whose value equals key from the doubly linked list and return the head.""",
    constraints=["0 <= list length <= 10^4"],
    fn="dll_delete_all",
    params=[("head", "doubly_linked_list"), ("key", "int")],
    ret="doubly_linked_list",
    ref="""
def dll_delete_all(head, key):
    node = head
    while node is not None:
        following = node.next
        if node.val == key:
            if node.prev is not None:
                node.prev.next = node.next
            else:
                head = node.next
            if node.next is not None:
                node.next.prev = node.prev
        node = following
    return head
""",
    examples=[({"head": [2, 2, 10, 8, 4, 2, 5, 2], "key": 2}, [10, 8, 4, 5]), ({"head": [1], "key": 1}, [])],
    tests=[{"head": [], "key": 3}, {"head": [1, 2, 3], "key": 4}, {"head": [7, 7, 7], "key": 7}, {"head": [i % 3 for i in range(90)], "key": 1}],
)

problem(
    id="dll-remove-duplicates",
    source="Remove duplicated from sorted DLL",
    title="Remove Duplicates from a Sorted Doubly Linked List",
    topic="Doubly Linked List",
    difficulty="Medium",
    structure="linked_list",
    description="""The list is sorted. Keep one node for every distinct value and return the head.""",
    constraints=["0 <= list length <= 10^4", "The list is sorted ascending."],
    fn="dll_remove_duplicates",
    params=[("head", "doubly_linked_list")],
    ret="doubly_linked_list",
    ref="""
def dll_remove_duplicates(head):
    node = head
    while node is not None and node.next is not None:
        if node.next.val == node.val:
            duplicate = node.next
            node.next = duplicate.next
            if duplicate.next is not None:
                duplicate.next.prev = node
        else:
            node = node.next
    return head
""",
    examples=[({"head": [1, 1, 1, 2, 3, 3, 4]}, [1, 2, 3, 4]), ({"head": [5]}, [5])],
    tests=[{"head": []}, {"head": [2, 2]}, {"head": [1, 2, 3]}, {"head": sorted(i % 10 for i in range(100))}],
)
