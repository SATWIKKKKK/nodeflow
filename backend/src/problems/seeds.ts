import type { Problem, PublicProblem } from "@nodeflow/shared";
import { reviewedPhaseOneProblems } from "./reviewedPhase1.js";
import { buildStarterCodeByLanguage } from "./starterCode.js";

const visible = (
  id: string,
  input: Record<string, unknown>,
  expectedOutput: unknown
) => ({
  id,
  input,
  expectedOutput,
  visible: true
});

const hidden = (
  id: string,
  input: Record<string, unknown>,
  expectedOutput: unknown
) => ({
  id,
  input,
  expectedOutput,
  visible: false
});

// starterCodeByLanguage is derived below, so seeds only author the Python stub.
const seededProblems: Omit<Problem, "starterCodeByLanguage">[] = [
  {
    id: "reverse-linked-list",
    title: "Reverse a Singly Linked List",
    topic: "Linked List",
    difficulty: "Easy",
    structureType: "linked_list",
    description:
      "Given the head of a singly linked list, return the new head after reversing every pointer in the list. The returned chain should contain the same nodes in opposite order.",
    constraints: [
      "The list may be empty.",
      "Each node stores an integer value.",
      "Return the head node of the reversed list."
    ],
    examples: [
      {
        input: { head: [1, 2, 3, 4] },
        output: [4, 3, 2, 1],
        explanation: "Every next pointer is rewired so 4 becomes the head."
      },
      {
        input: { head: [7] },
        output: [7]
      }
    ],
    signature: {
      functionName: "reverse_list",
      parameters: [{ name: "head", kind: "linked_list" }],
      returnKind: "linked_list"
    },
    starterCode: `def reverse_list(head):
    # Reverse the list by changing next pointers.
    return head
`,
    referenceCode: `def reverse_list(head):
    prev = None
    curr = head
    while curr is not None:
        nxt = curr.next
        curr.next = prev
        prev = curr
        curr = nxt
    return prev
`,
    defaultInput: { head: [1, 2, 3, 4] },
    visibleTestCases: [],
    testCases: [
      visible("sample-1", { head: [1, 2, 3, 4] }, [4, 3, 2, 1]),
      visible("sample-2", { head: [7] }, [7]),
      hidden("hidden-1", { head: [] }, []),
      hidden("hidden-2", { head: [1, 2, 3, 4, 5] }, [5, 4, 3, 2, 1])
    ]
  },
  {
    id: "middle-linked-list",
    title: "Find the Middle Node",
    topic: "Linked List",
    difficulty: "Easy",
    structureType: "linked_list",
    description:
      "Return the node where the second half of a singly linked list begins. When the list has an even number of nodes, return the later of the two middle nodes.",
    constraints: [
      "The list contains at least one node.",
      "Use the existing nodes; do not build a replacement list.",
      "Return a ListNode."
    ],
    examples: [
      {
        input: { head: [1, 2, 3, 4, 5] },
        output: [3, 4, 5]
      },
      {
        input: { head: [1, 2, 3, 4, 5, 6] },
        output: [4, 5, 6]
      }
    ],
    signature: {
      functionName: "middle_node",
      parameters: [{ name: "head", kind: "linked_list" }],
      returnKind: "linked_list"
    },
    starterCode: `def middle_node(head):
    # Move through the list and return the middle node.
    return head
`,
    referenceCode: `def middle_node(head):
    slow = head
    fast = head
    while fast is not None and fast.next is not None:
        slow = slow.next
        fast = fast.next.next
    return slow
`,
    defaultInput: { head: [1, 2, 3, 4, 5] },
    visibleTestCases: [],
    testCases: [
      visible("sample-1", { head: [1, 2, 3, 4, 5] }, [3, 4, 5]),
      visible("sample-2", { head: [1, 2, 3, 4, 5, 6] }, [4, 5, 6]),
      hidden("hidden-1", { head: [9] }, [9]),
      hidden("hidden-2", { head: [2, 4] }, [4])
    ]
  },
  {
    id: "merge-sorted-linked-lists",
    title: "Merge Two Sorted Lists",
    topic: "Linked List",
    difficulty: "Easy",
    structureType: "linked_list",
    description:
      "Given the heads of two nondecreasing singly linked lists, stitch the existing nodes into one nondecreasing list and return its head.",
    constraints: [
      "Either input list may be empty.",
      "The result should preserve sorted order.",
      "Reusing nodes is preferred so pointer changes are visible."
    ],
    examples: [
      {
        input: { list1: [1, 2, 4], list2: [1, 3, 4] },
        output: [1, 1, 2, 3, 4, 4]
      }
    ],
    signature: {
      functionName: "merge_sorted_lists",
      parameters: [
        { name: "list1", kind: "linked_list" },
        { name: "list2", kind: "linked_list" }
      ],
      returnKind: "linked_list"
    },
    starterCode: `def merge_sorted_lists(list1, list2):
    # Join the two sorted chains and return the merged head.
    return list1 or list2
`,
    referenceCode: `def merge_sorted_lists(list1, list2):
    dummy = ListNode(0)
    tail = dummy
    a = list1
    b = list2
    while a is not None and b is not None:
        if a.val <= b.val:
            tail.next = a
            a = a.next
        else:
            tail.next = b
            b = b.next
        tail = tail.next
    tail.next = a if a is not None else b
    return dummy.next
`,
    defaultInput: { list1: [1, 2, 4], list2: [1, 3, 4] },
    visibleTestCases: [],
    testCases: [
      visible("sample-1", { list1: [1, 2, 4], list2: [1, 3, 4] }, [1, 1, 2, 3, 4, 4]),
      visible("sample-2", { list1: [], list2: [0] }, [0]),
      hidden("hidden-1", { list1: [2, 5, 9], list2: [1, 3, 8] }, [1, 2, 3, 5, 8, 9]),
      hidden("hidden-2", { list1: [], list2: [] }, [])
    ]
  },
  {
    id: "two-sum-array",
    title: "Two Sum Indices",
    topic: "Array",
    difficulty: "Easy",
    structureType: "array",
    description:
      "Return the indices of two different elements whose values add up to the target. Any valid pair is acceptable when more than one pair exists.",
    constraints: [
      "The input contains exactly one valid answer for these tests.",
      "Return the two indices as a list in the order you discover them.",
      "Do not use the same element twice."
    ],
    examples: [
      {
        input: { nums: [2, 7, 11, 15], target: 9 },
        output: [0, 1]
      },
      {
        input: { nums: [3, 2, 4], target: 6 },
        output: [1, 2]
      }
    ],
    signature: {
      functionName: "two_sum",
      parameters: [
        { name: "nums", kind: "array" },
        { name: "target", kind: "int" }
      ],
      returnKind: "array"
    },
    starterCode: `def two_sum(nums, target):
    # Return indices of the two values that add to target.
    return []
`,
    referenceCode: `def two_sum(nums, target):
    seen = {}
    for i, value in enumerate(nums):
        need = target - value
        if need in seen:
            return [seen[need], i]
        seen[value] = i
    return []
`,
    defaultInput: { nums: [2, 7, 11, 15], target: 9 },
    visibleTestCases: [],
    testCases: [
      visible("sample-1", { nums: [2, 7, 11, 15], target: 9 }, [0, 1]),
      visible("sample-2", { nums: [3, 2, 4], target: 6 }, [1, 2]),
      hidden("hidden-1", { nums: [3, 3], target: 6 }, [0, 1]),
      hidden("hidden-2", { nums: [1, 5, 8, 10], target: 18 }, [2, 3])
    ]
  },
  {
    id: "dedupe-sorted-array",
    title: "Compact a Sorted Array",
    topic: "Array",
    difficulty: "Easy",
    structureType: "array",
    description:
      "Given a sorted array, return a new array containing one copy of each value in the same order. The trace should make each comparison and append visible.",
    constraints: [
      "The input array is already sorted.",
      "The input may be empty.",
      "Return the compacted array."
    ],
    examples: [
      {
        input: { nums: [1, 1, 2, 2, 3] },
        output: [1, 2, 3]
      }
    ],
    signature: {
      functionName: "compact_sorted_array",
      parameters: [{ name: "nums", kind: "array" }],
      returnKind: "array"
    },
    starterCode: `def compact_sorted_array(nums):
    # Keep one copy of each sorted value.
    return nums
`,
    referenceCode: `def compact_sorted_array(nums):
    result = []
    previous = None
    has_previous = False
    for value in nums:
        if not has_previous or value != previous:
            result.append(value)
            previous = value
            has_previous = True
    return result
`,
    defaultInput: { nums: [1, 1, 2, 2, 3] },
    visibleTestCases: [],
    testCases: [
      visible("sample-1", { nums: [1, 1, 2, 2, 3] }, [1, 2, 3]),
      visible("sample-2", { nums: [] }, []),
      hidden("hidden-1", { nums: [4, 4, 4] }, [4]),
      hidden("hidden-2", { nums: [-2, -2, 0, 3, 3, 8] }, [-2, 0, 3, 8])
    ]
  },
  {
    id: "stack-script-replay",
    title: "Replay a Stack Script",
    topic: "Stack",
    difficulty: "Easy",
    structureType: "stack",
    description:
      "Given a list of stack operations, replay each push and pop in order and return the values removed from the top. The trace should show the stack list growing and shrinking as each command runs.",
    constraints: [
      "Operations are strings: push, pop, peek, and size.",
      "Push operations take the value at the same index in values; other operations ignore their entry (it is 0).",
      "Return only the values removed by pop operations. A pop on an empty stack records -1."
    ],
    examples: [
      {
        input: { operations: ["push", "push", "pop"], values: [4, 9, 0] },
        output: [9],
        explanation: "The second pushed value sits on top, so it is the first value removed."
      }
    ],
    signature: {
      functionName: "replay_stack",
      parameters: [
        { name: "operations", kind: "string_array" },
        { name: "values", kind: "array" }
      ],
      returnKind: "array"
    },
    starterCode: `def replay_stack(operations, values):
    stack = []
    popped = []
    # Replay each stack command and collect pop results.
    return popped
`,
    referenceCode: `def replay_stack(operations, values):
    stack = []
    popped = []
    for index, operation in enumerate(operations):
        if operation == "push":
            stack.append(values[index])
        elif operation == "pop":
            popped.append(stack.pop() if stack else -1)
        elif operation == "peek":
            top = stack[-1] if stack else None
        elif operation == "size":
            size = len(stack)
    return popped
`,
    defaultInput: { operations: ["push", "push", "peek", "pop", "push", "pop"], values: [3, 8, 0, 0, 5, 0] },
    visibleTestCases: [],
    testCases: [
      visible("sample-1", { operations: ["push", "push", "pop"], values: [4, 9, 0] }, [9]),
      visible("sample-2", { operations: ["pop", "push", "pop", "pop"], values: [0, 2, 0, 0] }, [-1, 2, -1]),
      hidden("hidden-1", { operations: ["push", "push", "push", "pop", "pop"], values: [1, 2, 3, 0, 0] }, [3, 2]),
      hidden(
        "hidden-2",
        { operations: ["push", "size", "peek", "push", "pop", "pop"], values: [7, 0, 0, 11, 0, 0] },
        [11, 7]
      )
    ]
  },
  {
    id: "queue-ticket-window",
    title: "Serve a Queue Window",
    topic: "Queue",
    difficulty: "Easy",
    structureType: "queue",
    description:
      "Replay arrivals and service calls at a ticket window. Return the tickets served in order while the trace shows the front index moving through the queue instead of repeatedly shifting the whole list.",
    constraints: [
      "Operations are strings: arrive, serve, peek, and size.",
      "Arrive operations take the ticket at the same index in tickets; other operations ignore their entry (it is 0).",
      "Return only served tickets. Serving an empty queue records -1."
    ],
    examples: [
      {
        input: { operations: ["arrive", "arrive", "serve"], tickets: [10, 11, 0] },
        output: [10],
        explanation: "Queues serve the earliest waiting ticket first."
      }
    ],
    signature: {
      functionName: "serve_queue",
      parameters: [
        { name: "operations", kind: "string_array" },
        { name: "tickets", kind: "array" }
      ],
      returnKind: "array"
    },
    starterCode: `def serve_queue(operations, tickets):
    queue = []
    front = 0
    served = []
    # Replay each queue command and collect served tickets.
    return served
`,
    referenceCode: `def serve_queue(operations, tickets):
    queue = []
    front = 0
    served = []
    for index, operation in enumerate(operations):
        if operation == "arrive":
            queue.append(tickets[index])
        elif operation == "serve":
            if front < len(queue):
                served.append(queue[front])
                front += 1
            else:
                served.append(-1)
        elif operation == "peek":
            next_ticket = queue[front] if front < len(queue) else None
        elif operation == "size":
            waiting = len(queue) - front
    return served
`,
    defaultInput: {
      operations: ["arrive", "arrive", "peek", "serve", "arrive", "serve", "serve"],
      tickets: [12, 14, 0, 0, 21, 0, 0]
    },
    visibleTestCases: [],
    testCases: [
      visible("sample-1", { operations: ["arrive", "arrive", "serve"], tickets: [10, 11, 0] }, [10]),
      visible("sample-2", { operations: ["serve", "arrive", "serve", "serve"], tickets: [0, 6, 0, 0] }, [-1, 6, -1]),
      hidden("hidden-1", { operations: ["arrive", "arrive", "arrive", "serve", "serve"], tickets: [1, 2, 3, 0, 0] }, [1, 2]),
      hidden(
        "hidden-2",
        { operations: ["arrive", "size", "arrive", "peek", "serve", "serve"], tickets: [7, 0, 9, 0, 0, 0] },
        [7, 9]
      )
    ]
  }
];

const allProblems = [...seededProblems, ...reviewedPhaseOneProblems];

// Derive per-language stubs centrally so seeds and reviewed records stay consistent.
export const problems: Problem[] = allProblems.map((problem) => ({
  ...problem,
  starterCodeByLanguage: buildStarterCodeByLanguage(problem.signature, problem.starterCode),
  visibleTestCases: problem.testCases.filter((testCase) => testCase.visible)
}));

export const publicProblem = (problem: Problem): PublicProblem => {
  const { referenceCode: _referenceCode, testCases: _testCases, ...safeProblem } = problem;
  return safeProblem;
};

export const getProblem = (id: string): Problem | undefined =>
  problems.find((problem) => problem.id === id);
