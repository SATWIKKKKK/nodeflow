import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "../paths.js";

/**
 * Runs one traced Run and one Test per language through Vercel Sandbox, the
 * execution backend used by deployments without Docker.
 *
 *   npm run verify:sandbox --workspace backend -- noesis-runner:<tag>
 *
 * Needs a linked project and a local OIDC token (`vercel env pull .env.local`).
 */

for (const file of [path.join(repoRoot, ".env.local")]) {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}
process.env.NOESIS_SANDBOX = "vercel";
process.env.NOESIS_SANDBOX_IMAGE ??= process.argv[2] ?? "noesis-runner:6040ced737a0";

const { getProblem } = await import("../problems/seeds.js");
const { runProblemCase, testProblem } = await import("./service.js");

const solutions: Record<string, { language: "python" | "cpp" | "java"; code: string }> = {
  "reverse-linked-list": {
    language: "python",
    code: "def reverse_list(head):\n    prev = None\n    while head:\n        head.next, prev, head = prev, head, head.next\n    return prev\n"
  },
  "max-depth-binary-tree": {
    language: "cpp",
    code: `struct TreeNode { int val; TreeNode* left; TreeNode* right; TreeNode(): val(0), left(nullptr), right(nullptr) {} TreeNode(int x): val(x), left(nullptr), right(nullptr) {} TreeNode(int x, TreeNode* l, TreeNode* r): val(x), left(l), right(r) {} };\n\nint maxDepth(TreeNode* root) {\n    if (!root) return 0;\n    return 1 + max(maxDepth(root->left), maxDepth(root->right));\n}\n`
  },
  "sliding-window-maximum": {
    language: "java",
    code: "import java.util.*;\n\nclass Solution {\n    public int[] maxSlidingWindow(int[] nums, int k) {\n        Deque<Integer> w = new ArrayDeque<>();\n        int[] out = new int[nums.length - k + 1];\n        for (int i = 0; i < nums.length; i++) {\n            while (!w.isEmpty() && nums[w.peekLast()] <= nums[i]) w.pollLast();\n            w.addLast(i);\n            if (w.peekFirst() <= i - k) w.pollFirst();\n            if (i >= k - 1) out[i - k + 1] = nums[w.peekFirst()];\n        }\n        return out;\n    }\n}\n"
  }
};

for (const [id, { language, code }] of Object.entries(solutions)) {
  const problem = getProblem(id)!;
  const started = Date.now();
  const run = await runProblemCase(problem, code, problem.defaultInput, { language });
  const traced = run.ok ? (run.trace?.length ?? 0) : 0;
  console.log(`run   ${language.padEnd(6)} ${id}: ${Date.now() - started}ms ok=${run.ok} steps=${traced} ${run.ok ? "" : run.message}`);
  const judgeStart = Date.now();
  const judged = await testProblem(problem, code, language);
  console.log(`test  ${language.padEnd(6)} ${id}: ${Date.now() - judgeStart}ms ${judged.verdict}`);
}
