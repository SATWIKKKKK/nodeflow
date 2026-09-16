import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";

const baseUrl = process.env.NOESIS_UI_BASE_URL ?? "http://localhost:5174";
const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const outputDir = path.join(repoRoot, "output", "playwright");

type ViewportSpec = {
  name: "desktop" | "mobile";
  width: number;
  height: number;
};

type ProblemCounts = {
  total: number;
  arrays: number;
  linkedLists: number;
  stacks: number;
  queues: number;
};

const viewports: ViewportSpec[] = [
  { name: "desktop", width: 1365, height: 900 },
  { name: "mobile", width: 475, height: 842 }
];

const referenceReverseCode = `def reverse_list(head):
    previous = None
    current = head
    while current is not None:
        nxt = current.next
        current.next = previous
        previous = current
        current = nxt
    return previous
`;

const hiddenFailReverseCode = `def reverse_list(head):
    values = []
    current = head
    while current is not None:
        values.append(current.val)
        current = current.next

    if len(values) == 4:
        previous = None
        current = head
        while current is not None:
            nxt = current.next
            current.next = previous
            previous = current
            current = nxt
        return previous

    return head
`;

const defaultReverseInput = `{
  "head": [
    1,
    2,
    3,
    4
  ]
}`;

const customReverseInput = `{
  "head": [
    9,
    8,
    7
  ]
}`;

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const screenshotName = (route: string, viewport: string) => {
  const safeRoute = route === "/" ? "landing" : route.slice(1).replace(/\//g, "-");
  return path.join(outputDir, `verify-ui-${safeRoute}-${viewport}.png`);
};

const filteredBadResponses = (responses: Array<{ status: number; url: string }>) =>
  responses.filter((response) => {
    if (response.url.includes("/favicon")) return false;
    if (response.url.includes("fonts.gstatic.com")) return false;
    return true;
  });

const filteredConsoleErrors = (messages: string[]) =>
  messages.filter((message) => {
    if (message.includes("Failed to load resource") && message.includes("fonts.gstatic.com")) return false;
    if (message.includes("WebGL")) return false;
    return true;
  });

const loadProblemCounts = async (): Promise<ProblemCounts> => {
  const response = await fetch(`${baseUrl}/api/problems`);
  assert(response.ok, `Could not load problem bank: ${response.status}`);
  const problems = (await response.json()) as Array<{ structureType: string }>;

  return {
    total: problems.length,
    arrays: problems.filter((problem) => problem.structureType === "array").length,
    linkedLists: problems.filter((problem) => problem.structureType === "linked_list").length,
    stacks: problems.filter((problem) => problem.structureType === "stack").length,
    queues: problems.filter((problem) => problem.structureType === "queue").length
  };
};

const gotoRoute = async (page: Page, route: string, problemCounts?: ProblemCounts) => {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });

  if (route === "/workspace") {
    await page.waitForFunction(
      (expectedTotal) => document.querySelectorAll("select option").length >= expectedTotal,
      problemCounts?.total ?? 1,
      { timeout: 20_000 }
    );
    await page.waitForTimeout(800);
    return;
  }

  if (route === "/dashboard") {
    await page.waitForFunction(
      ({ arrays, linkedLists, stacks, queues }) => {
        const text = document.body.innerText.replace(/\s+/g, " ");
        return (
          text.includes("Arrays") &&
          text.includes(`/${arrays}`) &&
          text.includes("Lists") &&
          text.includes(`/${linkedLists}`) &&
          text.includes("Stacks") &&
          text.includes(`/${stacks}`) &&
          text.includes("Queues") &&
          text.includes(`/${queues}`)
        );
      },
      problemCounts ?? { arrays: 0, linkedLists: 0, stacks: 0, queues: 0 },
      { timeout: 20_000 }
    );
    return;
  }

  if (route === "/") {
    await page.waitForSelector(".heroImage", { timeout: 15_000 });
    await page.waitForFunction(() =>
      Array.from(document.images)
        .filter((image) => image.classList.contains("heroImage") || image.classList.contains("colorBlockImage"))
        .every((image) => image.complete && image.naturalWidth > 0)
    );
    return;
  }

  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(250);
};

const verifyRouteFit = async (problemCounts: ProblemCounts) => {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const routes = ["/", "/features", "/pricing", "/signin", "/signup", "/forgot-password", "/dashboard", "/workspace"];
  const summaries = [];

  try {
    for (const viewport of viewports) {
      for (const route of routes) {
        const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
        const badResponses: Array<{ status: number; url: string }> = [];
        const consoleErrors: string[] = [];

        page.on("console", (message) => {
          if (message.type() === "error") {
            consoleErrors.push(message.text());
          }
        });
        page.on("pageerror", (error) => consoleErrors.push(error.message));
        page.on("response", (response) => {
          if (response.status() >= 400) {
            badResponses.push({ status: response.status(), url: response.url() });
          }
        });

        await gotoRoute(page, route, problemCounts);
        await page.screenshot({ path: screenshotName(route, viewport.name), fullPage: false });

        const summary = await page.evaluate((routeName) => {
          const root = document.documentElement;
          const routeScreens = Array.from(document.querySelectorAll<HTMLElement>(".routeScreen")).map((screen) =>
            Math.round(screen.getBoundingClientRect().height)
          );
          const landingSections = Array.from(document.querySelectorAll<HTMLElement>(".landingPage > section")).map(
            (section) => Math.round(section.getBoundingClientRect().height)
          );
          const landingImages = Array.from(document.querySelectorAll<HTMLImageElement>(".heroImage, .colorBlockImage")).map(
            (image) => {
              const rect = image.getBoundingClientRect();
              return {
                naturalWidth: image.naturalWidth,
                naturalHeight: image.naturalHeight,
                attrWidth: image.getAttribute("width"),
                attrHeight: image.getAttribute("height"),
                width: Math.round(rect.width * 100) / 100,
                height: Math.round(rect.height * 100) / 100
              };
            }
          );

          return {
            route: routeName,
            bodyHeight: document.body.scrollHeight,
            viewportHeight: window.innerHeight,
            overflowX: root.scrollWidth - window.innerWidth,
            navToggleVisible: getComputedStyle(document.querySelector(".navToggle")!).display !== "none",
            routeScreens,
            landingSections,
            landingImages,
            problemOptions: document.querySelectorAll("select option").length,
            problemRows: document.querySelectorAll(".problemProgress").length,
            authSubmit: document.querySelector("button[type='submit']")?.textContent?.trim() ?? ""
          };
        }, route);

        assert(summary.overflowX === 0, `${route} ${viewport.name} has horizontal overflow`);
        assert(
          summary.routeScreens.every((height) => height <= summary.viewportHeight + 1),
          `${route} ${viewport.name} has a route screen taller than the viewport`
        );
        assert(
          summary.landingSections.every((height) => Math.abs(height - summary.viewportHeight) <= 1),
          `${route} ${viewport.name} has a landing section outside one viewport`
        );

        if (route === "/") {
          const widths = new Set(summary.landingImages.map((image) => image.width));
          const heights = new Set(summary.landingImages.map((image) => image.height));
          const naturalWidths = new Set(summary.landingImages.map((image) => image.naturalWidth));
          const naturalHeights = new Set(summary.landingImages.map((image) => image.naturalHeight));
          assert(summary.landingImages.length === 4, "landing should render four statue images");
          assert(widths.size === 1 && heights.size === 1, "landing statue image boxes should match");
          assert(naturalWidths.size === 1 && naturalHeights.size === 1, "landing statue source dimensions should match");
          assert(
            summary.landingImages.every((image) => image.attrWidth === "1536" && image.attrHeight === "1024"),
            "landing statue images should declare shared intrinsic dimensions"
          );
        }

        if (route === "/dashboard") {
          assert(problemCounts.stacks >= 1, "dashboard should include at least one stack problem");
          assert(problemCounts.queues >= 1, "dashboard should include at least one queue problem");
          assert(summary.problemRows === problemCounts.total, `dashboard should list all ${problemCounts.total} live problems`);
        }

        if (route === "/workspace") {
          assert(summary.problemOptions === problemCounts.total, `workspace should expose all ${problemCounts.total} live problems`);
        }

        const relevantBadResponses = filteredBadResponses(badResponses);
        const relevantConsoleErrors = filteredConsoleErrors(consoleErrors);
        assert(
          relevantBadResponses.length === 0,
          `${route} ${viewport.name} returned failed resources: ${JSON.stringify(relevantBadResponses)}`
        );
        assert(
          relevantConsoleErrors.length === 0,
          `${route} ${viewport.name} emitted console errors: ${JSON.stringify(relevantConsoleErrors)}`
        );

        summaries.push({ viewport: viewport.name, ...summary });
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  return summaries;
};

const verifyMobileNav = async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: viewports[1], deviceScaleFactor: 1 });

  try {
    await gotoRoute(page, "/");
    const before = await page.locator(".navToggle").getAttribute("aria-expanded");
    await page.click(".navToggle");
    await page.waitForTimeout(250);
    const afterOpen = await page.evaluate(() => ({
      expanded: document.querySelector(".navToggle")?.getAttribute("aria-expanded"),
      opacity: getComputedStyle(document.querySelector(".headerNavPanel")!).opacity,
      links: Array.from(document.querySelectorAll(".headerNavPanel a")).map((link) => link.textContent?.trim())
    }));
    await page.click(".navToggle");
    await page.waitForTimeout(250);
    const afterClose = await page.locator(".navToggle").getAttribute("aria-expanded");

    assert(before === "false", "mobile nav should start closed");
    assert(afterOpen.expanded === "true" && afterOpen.opacity === "1", "mobile nav should open");
    assert(afterOpen.links.includes("Sign in") && afterOpen.links.includes("Sign up"), "mobile nav should include auth");
    assert(afterClose === "false", "mobile nav should close");
  } finally {
    await browser.close();
  }
};

const verifyWorkspaceFlow = async (problemCounts: ProblemCounts) => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: viewports[0], deviceScaleFactor: 1 });
  const email = `ui-${Date.now()}@noesis.local`;
  const password = "Password123!";

  try {
    await gotoRoute(page, "/signup", problemCounts);
    await page.fill("input[type='email']", email);
    await page.fill("input[type='password']", password);
    await page.click("button[type='submit']");
    await page.waitForURL("**/workspace", { timeout: 20_000 });
    await page.waitForFunction(
      (expectedTotal) => document.querySelectorAll("select option").length >= expectedTotal,
      problemCounts.total,
      { timeout: 20_000 }
    );

    await page.click("button[aria-label='Hide 3D visualization']");
    await page.waitForFunction(
      () =>
        !document.querySelector(".visualPanel") &&
        document.querySelector(".workspaceShellNoVisual") &&
        window.localStorage.getItem("noesis:visual-enabled") === "false",
      null,
      { timeout: 5_000 }
    );
    assert(
      (await page.locator("button[aria-label='Show 3D visualization']").getAttribute("aria-pressed")) === "false",
      "hidden visualization toggle should expose inactive pressed state"
    );

    await page.click("button[aria-label='Open editor fullscreen']");
    await page.waitForFunction(
      () => {
        const editor = document.querySelector<HTMLElement>(".editorPaneFullscreen");
        if (!editor) return false;
        const rect = editor.getBoundingClientRect();
        const style = window.getComputedStyle(editor);
        return (
          style.position === "fixed" &&
          rect.width >= window.innerWidth * 0.9 &&
          rect.height >= window.innerHeight * 0.9 &&
          document.querySelector(".workspaceShellNoVisual")
        );
      },
      null,
      { timeout: 5_000 }
    );
    assert(
      (await page.locator("button[aria-label='Exit editor fullscreen']").getAttribute("aria-pressed")) === "true",
      "fullscreen editor button should expose active pressed state"
    );

    await page.click("button[aria-label='Exit editor fullscreen']");
    await page.waitForFunction(() => !document.querySelector(".editorPaneFullscreen"), null, { timeout: 5_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      (expectedTotal) =>
        document.querySelectorAll("select option").length >= expectedTotal &&
        !document.querySelector(".visualPanel") &&
        document.querySelector(".workspaceShellNoVisual") &&
        window.localStorage.getItem("noesis:visual-enabled") === "false",
      problemCounts.total,
      { timeout: 20_000 }
    );

    await page.click("button[aria-label='Show 3D visualization']");
    await page.waitForFunction(
      () =>
        Boolean(document.querySelector(".visualPanel")) &&
        !document.querySelector(".workspaceShellNoVisual") &&
        window.localStorage.getItem("noesis:visual-enabled") === "true",
      null,
      { timeout: 5_000 }
    );
    assert(
      (await page.locator("button[aria-label='Hide 3D visualization']").getAttribute("aria-pressed")) === "true",
      "visible visualization toggle should expose active pressed state"
    );

    await page.locator(".cm-content").click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.keyboard.insertText(referenceReverseCode);
    await page.waitForTimeout(700);

    await page.locator(".customInputField textarea").fill(customReverseInput);
    const customRunResponse = page.waitForResponse((response) => response.url().includes("/api/run"), { timeout: 30_000 });
    await page.click(".runButton");
    assert((await customRunResponse).status() === 200, "Custom Run should return 200");
    await page.waitForFunction(
      () => document.querySelector(".outputBox")?.textContent?.replace(/\s+/g, " ").includes("[ 7, 8, 9 ]"),
      null,
      { timeout: 20_000 }
    );

    await page.locator(".customInputField textarea").fill("{ bad json");
    await page.click(".runButton");
    await page.waitForFunction(
      () => document.querySelector(".inputError")?.textContent?.includes("valid JSON"),
      null,
      { timeout: 5_000 }
    );

    await page.click("button[aria-label='Reset to default input']");
    await page.waitForFunction(
      (expected) => (document.querySelector(".customInputField textarea") as HTMLTextAreaElement | null)?.value === expected,
      defaultReverseInput,
      { timeout: 5_000 }
    );

    const runResponse = page.waitForResponse((response) => response.url().includes("/api/run"), { timeout: 30_000 });
    await page.click(".runButton");
    assert((await runResponse).status() === 200, "Run should return 200");
    await page.waitForFunction(
      () => document.querySelector(".outputBox")?.textContent?.replace(/\s+/g, " ").includes("[ 4, 3, 2, 1 ]"),
      null,
      { timeout: 20_000 }
    );

    await page.locator(".cm-content").click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.keyboard.insertText(hiddenFailReverseCode);
    await page.waitForTimeout(700);

    const hiddenFailResponse = page.waitForResponse((response) => response.url().includes("/api/submit"), {
      timeout: 30_000
    });
    await page.click(".submitButton");
    assert((await hiddenFailResponse).status() === 200, "Hidden-failure Submit should return 200");
    await page.waitForFunction(
      () => {
        const text = document.querySelector(".testResultsPanel")?.textContent?.replace(/\s+/g, " ") ?? "";
        return (
          text.includes("Wrong Answer") &&
          text.includes("hidden-2 (hidden)") &&
          text.includes("Hidden case failed. Details stay sealed")
        );
      },
      null,
      { timeout: 20_000 }
    );
    const hiddenPanelText = await page.locator(".testResultsPanel").textContent();
    assert(hiddenPanelText?.includes("hidden-2 (hidden)"), "hidden failure should identify the hidden case id");
    assert(!hiddenPanelText?.includes("[5,4,3,2,1]"), "hidden expected output should stay sealed");
    assert(!hiddenPanelText?.includes("[1,2,3,4,5]"), "hidden input should stay sealed");

    await page.locator(".cm-content").click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.keyboard.insertText(referenceReverseCode);
    await page.waitForTimeout(700);

    const testResponse = page.waitForResponse((response) => response.url().includes("/api/test"), { timeout: 30_000 });
    await page.click(".testButton");
    assert((await testResponse).status() === 200, "Test should return 200");
    await page.waitForFunction(
      () => document.querySelector(".testResultsPanel .outputHeader span:last-child")?.textContent?.includes("Accepted"),
      null,
      { timeout: 20_000 }
    );

    const submitResponse = page.waitForResponse((response) => response.url().includes("/api/submit"), { timeout: 30_000 });
    await page.click(".submitButton");
    assert((await submitResponse).status() === 200, "Submit should return 200");
    await page.waitForFunction(
      () => document.querySelector(".testResultsPanel .outputHeader span:last-child")?.textContent?.includes("Accepted"),
      null,
      { timeout: 20_000 }
    );
    await page.screenshot({ path: path.join(outputDir, "verify-ui-workspace-flow.png"), fullPage: false });

    await gotoRoute(page, "/dashboard", problemCounts);
    await page.waitForFunction(
      ({ linkedLists, stacks, queues }) => {
        const text = document.body.innerText.replace(/\s+/g, " ");
        return (
          text.includes("1 Attempted") &&
          text.includes("1 Accepted") &&
          text.includes(`Lists 1/${linkedLists}`) &&
          text.includes(`Stacks 0/${stacks}`) &&
          text.includes(`Queues 0/${queues}`)
        );
      },
      { linkedLists: problemCounts.linkedLists, stacks: problemCounts.stacks, queues: problemCounts.queues },
      { timeout: 20_000 }
    );
    await page.screenshot({ path: path.join(outputDir, "verify-ui-dashboard-after-flow.png"), fullPage: false });

    return { email };
  } finally {
    await browser.close();
  }
};

const main = async () => {
  const problemCounts = await loadProblemCounts();
  const routeSummaries = await verifyRouteFit(problemCounts);
  await verifyMobileNav();
  const flow = await verifyWorkspaceFlow(problemCounts);

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        problemCounts,
        routeChecks: routeSummaries.length,
        workspaceFlowUser: flow.email,
        screenshots: outputDir
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
