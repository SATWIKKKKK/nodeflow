import type {
  AuthResponse,
  AuthUser,
  ExecutionResponse,
  Language,
  LivePreviewResponse,
  ProgressSummary,
  PublicProblem,
  SubmitResponse,
  TestResponse
} from "@nodeflow/shared";

const jsonHeaders = {
  "Content-Type": "application/json"
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, init);
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
  problems: () => request<PublicProblem[]>("/api/problems"),
  dsaSummary: () => request<DsaSummary>("/api/dsa-summary"),
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
    language: Language = "python"
  ) =>
    request<LivePreviewResponse>("/api/live-preview", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ problemId, code, language }),
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
  resetPassword: (email: string) =>
    request<{ ok: boolean }>("/api/auth/reset", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ email })
    })
};
