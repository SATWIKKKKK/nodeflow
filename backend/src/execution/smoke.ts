import { problems } from "../problems/seeds.js";
import { computeDiffs, expandTrace, type ExecutionResponse } from "@nodeflow/shared";
import { previewProblem, runProblemCase, testProblem } from "./service.js";

const diffsOf = (run: ExecutionResponse) =>
  run.ok ? computeDiffs(expandTrace(run.trace, run.heapMode)) : [];

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const main = async () => {
  const reverse = problems.find((problem) => problem.id === "reverse-linked-list");
  const twoSum = problems.find((problem) => problem.id === "two-sum-array");
  const middle = problems.find((problem) => problem.id === "middle-linked-list");
  const merge = problems.find((problem) => problem.id === "merge-sorted-linked-lists");
  const stack = problems.find((problem) => problem.id === "stack-script-replay");
  const queue = problems.find((problem) => problem.id === "queue-ticket-window");
  assert(problems.length >= 8, `expected at least 8 live Phase 1 problems, found ${problems.length}`);
  assert(reverse, "reverse-linked-list seed is missing");
  assert(twoSum, "two-sum-array seed is missing");
  assert(middle, "middle-linked-list seed is missing");
  assert(merge, "merge-sorted-linked-lists seed is missing");
  assert(stack, "stack-script-replay seed is missing");
  assert(queue, "queue-ticket-window seed is missing");

  const reverseRun = await runProblemCase(reverse!, reverse!.referenceCode, reverse!.defaultInput);
  assert(reverseRun.ok, `reverse reference failed: ${!reverseRun.ok ? reverseRun.message : ""}`);
  assert(reverseRun.ok && reverseRun.trace.length > 3, "reverse trace is too short");
  assert(typeof reverseRun.queuedMs === "number", "reverse run did not include queue timing");
  assert(reverseRun.ok && diffsOf(reverseRun).some((diff) => diff.mutated.length > 0), "reverse diff missed pointer mutation");

  const alternateReverse = `def reverse_list(head):
    def walk(node, previous):
        if node is None:
            return previous
        nxt = node.next
        node.next = previous
        return walk(nxt, node)
    return walk(head, None)
`;
  const alternateRun = await runProblemCase(reverse!, alternateReverse, reverse!.defaultInput);
  assert(alternateRun.ok, `alternate reverse failed: ${!alternateRun.ok ? alternateRun.message : ""}`);
  assert(alternateRun.ok && alternateRun.trace.length > 3, "alternate reverse trace is too short");

  const middleRun = await runProblemCase(middle!, middle!.referenceCode, middle!.defaultInput);
  assert(middleRun.ok, `middle reference failed: ${!middleRun.ok ? middleRun.message : ""}`);

  const mergeRun = await runProblemCase(merge!, merge!.referenceCode, merge!.defaultInput);
  assert(mergeRun.ok, `merge reference failed: ${!mergeRun.ok ? mergeRun.message : ""}`);

  const twoSumRun = await testProblem(twoSum!, twoSum!.referenceCode);
  assert(twoSumRun.verdict === "Accepted", "two-sum reference did not pass visible tests");

  const stackRun = await runProblemCase(stack!, stack!.referenceCode, stack!.defaultInput);
  assert(stackRun.ok, `stack reference failed: ${!stackRun.ok ? stackRun.message : ""}`);
  assert(stackRun.ok && stackRun.trace.length > 4, "stack trace is too short");
  assert(stackRun.ok && diffsOf(stackRun).some((diff) => diff.mutated.length > 0), "stack diff missed list mutation");

  const queueRun = await runProblemCase(queue!, queue!.referenceCode, queue!.defaultInput);
  assert(queueRun.ok, `queue reference failed: ${!queueRun.ok ? queueRun.message : ""}`);
  assert(queueRun.ok && queueRun.trace.length > 4, "queue trace is too short");
  assert(queueRun.ok && diffsOf(queueRun).some((diff) => diff.mutated.length > 0), "queue diff missed list/front mutation");

  const livePreview = await previewProblem(reverse!, reverse!.referenceCode);
  assert(livePreview.mode === "live", "live preview returned the wrong mode");
  assert(livePreview.ok, "live preview failed on valid reference code");
  assert(livePreview.execution.ok && livePreview.execution.trace.length > 3, "live preview trace is too short");

  const incompletePreview = await previewProblem(
    reverse!,
    `def reverse_list(head):
    while head is not None
        return head
`
  );
  assert(!incompletePreview.ok, "incomplete live preview unexpectedly succeeded");
  assert(incompletePreview.quiet, "incomplete live preview should be quiet");

  const importAttempt = await runProblemCase(
    twoSum!,
    `import os

def two_sum(nums, target):
    return os.listdir("/")
`,
    twoSum!.defaultInput
  );
  assert(!importAttempt.ok, "sandbox import attempt unexpectedly succeeded");
  assert(
    !importAttempt.ok && importAttempt.errorType === "Sandbox Violation",
    `sandbox import attempt returned ${!importAttempt.ok ? importAttempt.errorType : "ok"}`
  );

  const fileAttempt = await runProblemCase(
    twoSum!,
    `def two_sum(nums, target):
    return open("/etc/passwd").read()
`,
    twoSum!.defaultInput
  );
  assert(!fileAttempt.ok, "sandbox file attempt unexpectedly succeeded");
  assert(
    !fileAttempt.ok && fileAttempt.errorType === "Sandbox Violation",
    `sandbox file attempt returned ${!fileAttempt.ok ? fileAttempt.errorType : "ok"}`
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        reverseSteps: reverseRun.ok ? reverseRun.trace.length : 0,
        alternateReverseSteps: alternateRun.ok ? alternateRun.trace.length : 0,
        middleSteps: middleRun.ok ? middleRun.trace.length : 0,
        mergeSteps: mergeRun.ok ? mergeRun.trace.length : 0,
        stackSteps: stackRun.ok ? stackRun.trace.length : 0,
        queueSteps: queueRun.ok ? queueRun.trace.length : 0,
        twoSumVerdict: twoSumRun.verdict,
        sandboxViolations: 2,
        liveProblems: problems.length,
        livePreviewSteps: livePreview.execution.ok ? livePreview.execution.trace.length : 0
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
