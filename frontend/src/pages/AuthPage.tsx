import { useState, type FormEvent } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { cn } from "../lib/cn";
import { button, field } from "../components/ui";

type Mode = "signin" | "signup" | "forgot";

const copy: Record<Mode, { title: string; lead: string; action: string }> = {
  signin: {
    title: "Welcome back.",
    lead: "Sign in to keep your submissions and progress attached to your account.",
    action: "Sign in"
  },
  signup: {
    title: "Create your account.",
    lead: "Free, and optional: an account keeps every submission and accepted problem on your record.",
    action: "Create account"
  },
  forgot: {
    title: "Reset your password.",
    lead: "Enter the email you signed up with and Noesis will record a reset request.",
    action: "Request reset"
  }
};

/** Reads the backend's `{ message }` error body, falling back to the raw text. */
const readError = (error: unknown) => {
  if (!(error instanceof Error)) return "Something went wrong. Try again.";
  try {
    const parsed = JSON.parse(error.message) as { message?: string };
    return parsed.message ?? error.message;
  } catch {
    return error.message || "Something went wrong. Try again.";
  }
};

/** Only same-site paths are honoured, so a crafted ?next= cannot send people off-site. */
const safeNext = (value: string | null) => (value && /^\/(?![/\\])/.test(value) ? value : "/problems");

/**
 * Signing in or up lands on the problem list — that is the entry point to the
 * product — unless a page sent the learner here with ?next=.
 */
export default function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const text = copy[mode];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      if (mode === "forgot") {
        await api.resetPassword(email);
        setSentTo(email);
        return;
      }

      if (mode === "signup") await session.signUp(email, password);
      else await session.signIn(email, password);

      navigate(safeNext(params.get("next")));
    } catch (requestError) {
      setError(readError(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-[480px] rounded-3xl border border-blueprint-line bg-card/90 p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.04)] backdrop-blur-sm sm:p-8">
      <p className="text-ui-label text-blueprint-muted">Noesis account</p>
      <h1 className="mt-2 text-headline-lg text-primary">{text.title}</h1>
      <p className="mt-3 text-body-md text-blueprint-muted">{text.lead}</p>

      <form className="mt-8 grid gap-6" onSubmit={submit} noValidate={false}>
        <div>
          <label htmlFor="auth-email" className={field.label}>
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            className={field.underline}
          />
        </div>

        {mode !== "forgot" && (
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="auth-password" className={field.label}>
                Password
              </label>
              {mode === "signin" && (
                <NavLink to="/forgot-password" className="mb-2 text-xs text-blueprint-muted hover:text-primary">
                  Forgot password?
                </NavLink>
              )}
            </div>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
                className={cn(field.underline, "pr-10")}
              />
              <span className="absolute right-0 top-1/2 -translate-y-1/2">
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="no-lift flex h-8 w-8 items-center justify-center rounded-full text-blueprint-muted hover:text-primary"
                  style={{ minHeight: 0, width: "2rem" }}
                >
                  {showPassword ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                </button>
              </span>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="status-error flex gap-2 rounded-xl border px-4 py-3 text-sm">
            <AlertCircle size={16} aria-hidden className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {mode === "forgot" && sentTo && (
          <p role="status" className="flex gap-2 rounded-xl border border-blueprint-line bg-surface-inset px-4 py-3 text-sm text-primary">
            <CheckCircle2 size={16} aria-hidden className="check-icon mt-0.5 shrink-0" />
            <span>
              Reset request recorded for {sentTo}. Email delivery is not set up yet, so no message will arrive.
            </span>
          </p>
        )}

        <button type="submit" disabled={busy} className={cn(button.primary, "w-full py-3")}>
          {busy ? <Loader2 size={14} aria-hidden className="animate-spin" /> : null}
          {text.action}
          {!busy && <ArrowRight size={14} aria-hidden />}
        </button>
      </form>

      <div className="mt-8 flex items-center gap-4">
        <span className="h-px flex-1 bg-blueprint-line" />
        <span className="text-ui-label text-blueprint-muted">or</span>
        <span className="h-px flex-1 bg-blueprint-line" />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        {mode !== "signin" && (
          <NavLink to="/signin" className={button.text}>
            Sign in instead
          </NavLink>
        )}
        {mode !== "signup" && (
          <NavLink to="/signup" className={button.text}>
            Create an account
          </NavLink>
        )}
        <NavLink to="/problems" className={button.text}>
          Continue without one
        </NavLink>
      </div>
    </div>
  );
}
