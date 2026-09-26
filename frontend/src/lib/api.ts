import type {
  AuthResponse,
  AuthUser,
  ClassroomDetail,
  ClassroomSummary,
  ExecutionResponse,
  ExpectedOutputResponse,
  Language,
  LivePreviewResponse,
  ProblemSummary,
  ProgressSummary,
  PublicProblem,
  SubmitResponse,
  TestResponse,
  VariantOutcome,
  VariantStage
} from "@nodeflow/shared";

const jsonHeaders = {
  "Content-Type": "application/json"
};

/** Empty in development (Vite proxies /api); set VITE_API_URL when the API lives on another host. */
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
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
    const response = await fetch(`/api/problems/${encodeURIComponent(problemId)}/variant`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ term, replacement })
    });
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
