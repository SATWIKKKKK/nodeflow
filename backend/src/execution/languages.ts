import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Language } from "@nodeflow/shared";

const backendRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

export interface LanguageConfig {
  id: Language;
  /** Image repository; the tag is a content hash of the Dockerfile and harness files. */
  image: string;
  dockerfile: string;
  /** Build-context paths (relative to backend/) whose contents feed the image hash. */
  contextFiles: string[];
  /** Whether this language's harness emits step-by-step trace frames. */
  supportsTracing: boolean;
  /** Container budget for a single traced run (compile + run + trace). */
  timeoutMs: number;
  /** Per-case wall-clock budget inside the container. */
  caseTimeoutMs: number;
  /** Extra container budget before the first case starts (compiler, JVM). */
  startupMs: number;
  /** Recorded steps for Run and for the live preview. */
  runStepLimit: number;
  previewStepLimit: number;
  memoryLimit: string;
  pidsLimit: number;
  /**
   * tmpfs mount options. Interpreted languages keep `noexec`; compiled ones must
   * drop it so the freshly built binary can actually run, and need more space for
   * build artifacts. Every other guard (no network, all caps dropped,
   * no-new-privileges, read-only root FS, pid cap, non-root user) still applies.
   */
  tmpfs: string;
  extraRunArgs: string[];
}

export const languageConfigs: Record<Language, LanguageConfig> = {
  python: {
    id: "python",
    image: "nodeflow-python-sandbox",
    dockerfile: path.join(backendRoot, "docker", "sandbox", "Dockerfile"),
    contextFiles: ["src/execution/python", "src/execution/common"],
    supportsTracing: true,
    timeoutMs: 12000,
    caseTimeoutMs: 4000,
    startupMs: 3000,
    runStepLimit: 4000,
    previewStepLimit: 1500,
    memoryLimit: "256m",
    pidsLimit: 64,
    tmpfs: "/tmp:rw,noexec,nosuid,size=16m",
    extraRunArgs: []
  },
  cpp: {
    id: "cpp",
    image: "nodeflow-cpp-sandbox",
    dockerfile: path.join(backendRoot, "docker", "cpp", "Dockerfile"),
    contextFiles: ["src/execution/cpp", "src/execution/common"],
    supportsTracing: true,
    timeoutMs: 40000,
    caseTimeoutMs: 3000,
    startupMs: 15000,
    runStepLimit: 1500,
    previewStepLimit: 500,
    memoryLimit: "512m",
    pidsLimit: 64,
    tmpfs: "/tmp:rw,exec,nosuid,size=256m",
    extraRunArgs: []
  },
  java: {
    id: "java",
    image: "nodeflow-java-sandbox",
    dockerfile: path.join(backendRoot, "docker", "java", "Dockerfile"),
    contextFiles: ["src/execution/java", "src/execution/common"],
    supportsTracing: true,
    timeoutMs: 45000,
    caseTimeoutMs: 4000,
    startupMs: 15000,
    runStepLimit: 1500,
    previewStepLimit: 500,
    memoryLimit: "1g",
    pidsLimit: 256,
    tmpfs: "/tmp:rw,exec,nosuid,size=512m",
    extraRunArgs: []
  }
};

export const configFor = (language: Language): LanguageConfig => languageConfigs[language];
