import type {
  AuthResponse,
  AuthUser,
  CoinBreakdown,
  ClassroomDetail,
  ClassroomSummary,
  ExecutionResponse,
  ExpectedOutputResponse,
  Language,
  LivePreviewResponse,
  ProblemSummary,
  ProgressSummary,
  PublicProblem,
  SavedDraft,
  SubmitResponse,
  TestResponse,
  UnfinishedProblem,
  VariantOutcome,
  VariantStage
} from "@nodeflow/shared";

const jsonHeaders = {
  "Content-Type": "application/json"
};

/** Empty in development (Vite proxies /api); set VITE_API_URL when the API lives on another host. */
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

/**
 * A failed request that still says what kind of failure it was.
 *
 * "Gone" and "unreachable" call for opposite responses — one means stop
 * showing this, the other means keep what you have and wait — and a bare
 * message cannot be asked which it is.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The signed-in session's token, read where the session keeps it.
 *
 * Attached to every request that does not set one itself, so no call can
 * forget it: a signed-in learner is never turned away by an endpoint that
 * simply was not handed the token.
 */
const storedToken = (): string | null => {
  try {
    const raw = window.localStorage.getItem("noesis:session");
    return raw ? ((JSON.parse(raw) as { token?: string }).token ?? null) : null;
  } catch {
    return null;
  }
};

const withSession = (init?: RequestInit): RequestInit => {
  const headers = new Headers(init?.headers);
  const token = storedToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, withSession(init));
  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(text || `Request failed with ${response.status}`, response.status);
  }
  return (await response.json()) as T;
};

const authHeaders = (token?: string | null) => ({
  ...jsonHeaders,
  ...(token ? { Authorization: `Bearer ${token}` } : {})
});

export interface DsaSummary {
  /** Problems on the DSA sheet (section headings excluded). */
  total: number;
  covered: number;
  unpublished: number;
}

export const api = {
  health: () => request<{ ok: boolean; sandbox?: boolean; accounts?: boolean; emails?: boolean; ask?: boolean }>(
      "/api/health"
    ),
  problems: () => request<ProblemSummary[]>("/api/problems"),
  problem: (id: string) => request<PublicProblem>(`/api/problems/${encodeURIComponent(id)}`),
  dsaSummary: () => request<DsaSummary>("/api/dsa-summary"),
  /**
   * Change one word of a statement.
   *
   * Slow by nature — the server rewrites the problem and then runs the
   * rewrite's own solution to work out the answers — so it answers in lines
   * rather than in one go: a stage at a time, then the outcome. The stages are
   * what the server is actually doing, not a timer pretending to be one.
   */
  variant: async (
    problemId: string,
    term: string,
    replacement: string,
    onStage: (stage: VariantStage) => void = () => {}
  ): Promise<VariantOutcome> => {
    const response = await fetch(
      `${API_BASE}/api/problems/${encodeURIComponent(problemId)}/variant`,
      withSession({
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ term, replacement })
      })
    );
    if (!response.ok || !response.body) {
      const message = await response.json().catch(() => ({ message: "That change could not be made." }));
      throw new Error((message as { message?: string }).message ?? "That change could not be made.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let outcome: VariantOutcome | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as { stage?: string; outcome?: VariantOutcome };
        if (event.outcome) outcome = event.outcome;
        else onStage(event as VariantStage);
      }
    }
    if (!outcome) throw new Error("The server stopped before answering.");
    return outcome;
  },
  progress: (token?: string | null) =>
    request<ProgressSummary>("/api/progress", {
      headers: authHeaders(token)
    }),
  run: (
    problemId: string,
    code: string,
    input: Record<string, unknown>,
    language: Language = "python"
  ) =>
    request<ExecutionResponse>("/api/run", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ problemId, code, input, language })
    }),
  livePreview: (
    problemId: string,
    code: string,
    signal?: AbortSignal,
    language: Language = "python",
    input?: Record<string, unknown>
  ) =>
    request<LivePreviewResponse>("/api/live-preview", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ problemId, code, language, input }),
      signal
    }),
  expected: (problemId: string, input: Record<string, unknown>, signal?: AbortSignal) =>
    request<ExpectedOutputResponse>("/api/expected", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ problemId, input }),
      signal
    }),
  ask: (question: string, signal?: AbortSignal) =>
    request<{ answer: string }>("/api/ask", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ question }),
      signal
    }),
  test: (problemId: string, code: string, language: Language = "python") =>
    request<TestResponse>("/api/test", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ problemId, code, language })
    }),
  submit: (problemId: string, code: string, language: Language = "python") =>
    request<SubmitResponse>("/api/submit", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ problemId, code, language })
    }),
  coins: (token?: string | null) => request<{ coins: number }>("/api/coins", { headers: authHeaders(token) }),
  coinBreakdown: (token?: string | null) =>
    request<CoinBreakdown>("/api/coins/breakdown", { headers: authHeaders(token) }),
  addCoins: (delta: number, token?: string | null) =>
    request<{ coins: number }>("/api/coins", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ delta })
    }),
  unfinished: (token?: string | null) =>
    request<{ problems: UnfinishedProblem[] }>("/api/unfinished", { headers: authHeaders(token) }),
  draft: (problemId: string, token?: string | null) =>
    request<{ draft: SavedDraft | null }>(`/api/drafts/${encodeURIComponent(problemId)}`, { headers: authHeaders(token) }),
  saveDraft: (problemId: string, language: Language, code: string, token?: string | null) =>
    request<{ draft: SavedDraft }>(`/api/drafts/${encodeURIComponent(problemId)}`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ language, code }),
      // The last save is often sent as the window closes; keepalive lets it
      // finish after the page has gone instead of being cancelled with it.
      keepalive: code.length < 60_000
    }),
  touchDraft: (problemId: string, language: Language, token?: string | null) =>
    request<{ ok: boolean }>(`/api/drafts/${encodeURIComponent(problemId)}/touch`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ language }),
      keepalive: true
    }),
  syncStarted: (entries: Array<{ problemId: string; language: Language; at: string }>, token?: string | null) =>
    request<{ ok: boolean; kept: number }>("/api/drafts/sync", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ entries })
    }),
  clearDraft: (problemId: string, token?: string | null) =>
    request<{ ok: boolean }>(`/api/drafts/${encodeURIComponent(problemId)}`, {
      method: "DELETE",
      headers: authHeaders(token)
    }),
  submitWithSession: (
    problemId: string,
    code: string,
    token?: string | null,
    language: Language = "python"
  ) =>
    request<SubmitResponse>("/api/submit", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ problemId, code, language })
    }),
  signUp: (email: string, password: string) =>
    request<AuthResponse>("/api/auth/signup", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ email, password })
    }),
  signIn: (email: string, password: string) =>
    request<AuthResponse>("/api/auth/signin", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ email, password })
    }),
  me: (token?: string | null) =>
    request<{ user: AuthUser | null }>("/api/auth/me", {
      headers: authHeaders(token)
    }),
  signOut: (token?: string | null) =>
    request<{ ok: boolean }>("/api/auth/signout", {
      method: "POST",
      headers: authHeaders(token)
    }),
  classrooms: (token?: string | null) =>
    request<{ classrooms: ClassroomSummary[] }>("/api/classrooms", { headers: authHeaders(token) }),
  classroom: (id: string, token?: string | null) =>
    request<ClassroomDetail>(`/api/classrooms/${encodeURIComponent(id)}`, { headers: authHeaders(token) }),
  createClassroom: (name: string, token?: string | null) =>
    request<ClassroomDetail>("/api/classrooms", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ name })
    }),
  joinClassroom: (code: string, token?: string | null) =>
    request<ClassroomDetail>("/api/classrooms/join", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ code })
    }),
  renameClassroom: (id: string, name: string, token?: string | null) =>
    request<ClassroomDetail>(`/api/classrooms/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ name })
    }),
  deleteClassroom: (id: string, token?: string | null) =>
    request<{ ok: boolean }>(`/api/classrooms/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders(token)
    }),
  setAssignments: (id: string, problemIds: string[], token?: string | null) =>
    request<ClassroomDetail>(`/api/classrooms/${encodeURIComponent(id)}/assignments`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ problemIds })
    }),
  rotateJoinCode: (id: string, token?: string | null) =>
    request<ClassroomDetail>(`/api/classrooms/${encodeURIComponent(id)}/join-code`, {
      method: "POST",
      headers: authHeaders(token)
    }),
  removeMember: (id: string, memberId: string, token?: string | null) =>
    request<{ ok: boolean }>(
      `/api/classrooms/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`,
      { method: "DELETE", headers: authHeaders(token) }
    ),
  resetPassword: (email: string) =>
    request<{ ok: boolean }>("/api/auth/reset", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ email })
    }),
  confirmReset: (token: string, password: string) =>
    request<AuthResponse>("/api/auth/reset/confirm", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ token, password })
    })
};
