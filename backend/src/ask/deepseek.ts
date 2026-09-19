/**
 * "Ask me anything" on the landing page, answered by DeepSeek.
 *
 * The key stays on the server: the browser posts a question to /api/ask and
 * never sees a provider or a credential. The endpoint is public and every call
 * costs money, so it is bounded on every axis — question length, answer length,
 * wall clock, and how often one caller may ask.
 */

const ENDPOINT = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

export const MAX_QUESTION = 400;
const MAX_ANSWER_TOKENS = 400;
const TIMEOUT_MS = 25_000;

/** Per-caller budget. Serverless instances are short-lived, so this is a speed
 * bump against a hot loop from one browser, not a billing control. */
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 8;
const recent = new Map<string, number[]>();

const apiKey = () => process.env.DEEPSEEK_API_KEY ?? "";

export const askEnabled = () => apiKey().length > 0;

export class AskError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export function withinRateLimit(caller: string) {
  const now = Date.now();
  const hits = (recent.get(caller) ?? []).filter((at) => now - at < WINDOW_MS);
  hits.push(now);
  recent.set(caller, hits);

  // Stop the map growing without bound on a long-lived instance.
  if (recent.size > 500) {
    for (const [key, times] of recent) {
      if (times.every((at) => now - at >= WINDOW_MS)) recent.delete(key);
    }
  }

  return hits.length <= MAX_PER_WINDOW;
}

const SYSTEM_PROMPT = [
  "You are the assistant on Noesis, a site where people solve data-structures and",
  "algorithms problems in Python, C++ or Java and watch a real step-by-step trace",
  "of their own code: every variable and heap object is recorded at every line and",
  "replayed as a diagram.",
  "",
  "Answer the visitor's question directly and briefly — at most 120 words, plain",
  "prose, no markdown headings. If the question is about DSA, answer it on its",
  "merits. If it is about Noesis, answer from what you know: 372 problems across",
  "26 topics, three languages, runs in a sandbox with no network, free to use, an",
  "account is optional. If you do not know, say so in one sentence rather than",
  "guessing. If the question is unrelated to programming or to this site, say that",
  "politely in one sentence."
].join(" ");

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

export async function answerQuestion(question: string): Promise<string> {
  const key = apiKey();
  if (!key) throw new AskError("Questions are not enabled on this deployment.", 503);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_ANSWER_TOKENS,
        temperature: 0.3,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: question }
        ]
      }),
      signal: controller.signal
    });

    const body = (await response.json().catch(() => ({}))) as ChatResponse;

    if (!response.ok) {
      // The provider's message can carry account details; keep it in the log.
      console.error("DeepSeek request failed", response.status, body.error?.message ?? "");
      throw new AskError(
        response.status === 429
          ? "The assistant is busy right now. Try again in a moment."
          : "The assistant could not answer that. Try again shortly.",
        502
      );
    }

    const answer = body.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new AskError("The assistant returned an empty answer.", 502);

    return answer;
  } catch (error) {
    if (error instanceof AskError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AskError("That took too long to answer. Try a shorter question.", 504);
    }
    console.error("DeepSeek request errored", error);
    throw new AskError("The assistant is unreachable right now.", 502);
  } finally {
    clearTimeout(timer);
  }
}
