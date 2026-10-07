import type { Language } from "@nodeflow/shared";

/**
 * Formats code in the learner's language, entirely in the browser.
 *
 * C, C++, Java, JavaScript and TypeScript go through clang-format and Python
 * through Ruff, both compiled to WebAssembly. Each is a couple of megabytes, so it is fetched the first
 * time Format is pressed in that language, never with the page.
 */
let clang: Promise<typeof import("@wasm-fmt/clang-format/vite")> | null = null;
let ruff: Promise<typeof import("@wasm-fmt/ruff_fmt/vite")> | null = null;

const loadClang = () => {
  clang ??= import("@wasm-fmt/clang-format/vite").then(async (module) => {
    await module.default();
    return module;
  });
  return clang;
};

const loadRuff = () => {
  ruff ??= import("@wasm-fmt/ruff_fmt/vite").then(async (module) => {
    await module.default();
    return module;
  });
  return ruff;
};

/** clang-format picks its grammar from the file name. */
const FILE_NAMES: Record<Exclude<Language, "python">, string> = {
  cpp: "main.cpp",
  c: "main.c",
  java: "Main.java",
  javascript: "main.js",
  typescript: "main.ts"
};

/** Four-space indents in every language, to match the starter code. */
const CLANG_STYLE = "{BasedOnStyle: Google, IndentWidth: 4, ColumnLimit: 100, AccessModifierOffset: -4, AllowShortFunctionsOnASingleLine: Empty, JavaScriptQuotes: Leave}";

export async function formatCode(code: string, language: Language): Promise<string> {
  if (language === "python") {
    const { format } = await loadRuff();
    return format(code, "main.py", { indent_style: "space", indent_width: 4, line_width: 100 });
  }
  const { format } = await loadClang();
  return format(code, FILE_NAMES[language], CLANG_STYLE);
}
