import { useEffect, useState, type FormEvent } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, Plus, Users } from "lucide-react";
import type { ClassroomSummary } from "@nodeflow/shared";
import { api } from "../lib/api";
import { readError } from "../lib/errors";
import { useSession } from "../lib/session";
import { cn } from "../lib/cn";
import { SectionHeading } from "../components/SectionHeading";
import { Spinner } from "../components/PageLoader";
import { button, container, field } from "../components/ui";

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

function SignedOut() {
  return (
    <div className="surface-card mx-auto max-w-2xl text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-blueprint-line text-primary">
        <Users size={20} aria-hidden />
      </span>
      <h2 className="mt-5 text-headline-sm text-primary">Sign in to open a classroom</h2>
      <p className="mt-3 text-body-md text-blueprint-muted">
        Classrooms tie progress to accounts, so teachers and students both need one. It takes a few seconds.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <NavLink to="/signin?next=/classrooms" className={button.primary}>
          Sign in
        </NavLink>
        <NavLink to="/signup?next=/classrooms" className={button.outlineSm}>
          Create an account
        </NavLink>
      </div>
    </div>
  );
}

function ActionCard({
  title,
  lead,
  label,
  placeholder,
  action,
  busy,
  error,
  onSubmit,
  maxLength,
  mono = false
}: {
  title: string;
  lead: string;
  label: string;
  placeholder: string;
  action: string;
  busy: boolean;
  error: string;
  onSubmit: (value: string) => void;
  maxLength: number;
  mono?: boolean;
}) {
  const [value, setValue] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  };

  return (
    <form onSubmit={submit} className="surface-card flex flex-col">
      <h2 className="text-headline-sm text-primary">{title}</h2>
      <p className="mt-2 text-body-md text-blueprint-muted">{lead}</p>
      <label className="mt-6 block">
        <span className={field.label}>{label}</span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={cn(field.underline, mono && "font-mono uppercase tracking-[0.2em]")}
        />
      </label>
      {error && <p className="status-error mt-4 rounded-xl border px-4 py-3 text-sm">{error}</p>}
      <button type="submit" disabled={busy || !value.trim()} className={cn(button.primary, "mt-6 self-start")}>
        {busy ? <Loader2 size={14} aria-hidden className="animate-spin" /> : <Plus size={14} aria-hidden />}
        {action}
      </button>
    </form>
  );
}

export default function ClassroomsPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<ClassroomSummary[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [errors, setErrors] = useState({ create: "", join: "" });

  useEffect(() => {
    if (!session.user) return;
    let mounted = true;
    api
      .classrooms(session.token)
      .then((response) => mounted && setRooms(response.classrooms))
      .catch((error) => mounted && setLoadError(readError(error, "Could not load your classrooms.")));
    return () => {
      mounted = false;
    };
  }, [session.user, session.token]);

  const run = async (kind: "create" | "join", value: string) => {
    setBusy(kind);
    setErrors({ create: "", join: "" });
    try {
      const room =
        kind === "create"
          ? await api.createClassroom(value, session.token)
          : await api.joinClassroom(value, session.token);
      navigate(`/classrooms/${room.id}`);
    } catch (error) {
      setErrors((current) => ({ ...current, [kind]: readError(error, "That did not work. Try again.") }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`${container} py-10 sm:py-14`}>
      <SectionHeading
        as="h1"
        eyebrow="Classrooms"
        title="Practise together, see who is stuck."
        lead="A teacher opens a classroom, shares its join code and assigns problems. Everyone in the room sees the same progress board, built from real Submit results."
      />

      {session.loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : !session.user ? (
        <SignedOut />
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            <ActionCard
              title="Open a classroom"
              lead="You become its owner: you get the join code, choose the assignments and see everyone's progress."
              label="Classroom name"
              placeholder="DSA batch, spring term"
              action="Create classroom"
              busy={busy === "create"}
              error={errors.create}
              maxLength={60}
              onSubmit={(value) => void run("create", value)}
            />
            <ActionCard
              title="Join with a code"
              lead="Your teacher shares a six-character code. Your submissions show up on the room's board."
              label="Join code"
              placeholder="ABC234"
              action="Join classroom"
              busy={busy === "join"}
              error={errors.join}
              maxLength={12}
              mono
              onSubmit={(value) => void run("join", value)}
            />
          </div>

          <section aria-labelledby="rooms-heading" className="surface-frame mt-8 overflow-hidden">
            <div className="flex items-center justify-between border-b border-blueprint-line px-5 py-4 sm:px-6">
              <h2 id="rooms-heading" className="text-headline-sm text-primary">
                Your classrooms
              </h2>
              <Users size={18} aria-hidden className="text-blueprint-muted" />
            </div>

            {loadError ? (
              <p className="status-error m-6 rounded-xl border px-5 py-4 text-body-md">{loadError}</p>
            ) : !rooms ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : rooms.length === 0 ? (
              <p className="px-6 py-12 text-center text-body-md text-blueprint-muted">
                You are not in any classroom yet. Open one or join with a code above.
              </p>
            ) : (
              <ul className="divide-y divide-blueprint-line">
                {rooms.map((room) => (
                  <li key={room.id}>
                    <NavLink
                      to={`/classrooms/${room.id}`}
                      className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-hover sm:px-6"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-primary">{room.name}</span>
                        <span className="mt-1 block text-xs text-blueprint-muted">
                          {room.memberCount} {room.memberCount === 1 ? "person" : "people"} · {room.assignmentCount}{" "}
                          {room.assignmentCount === 1 ? "assignment" : "assignments"} · since{" "}
                          {dateFormat.format(new Date(room.createdAt))}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
                          room.isOwner ? "badge-current" : "border-blueprint-line text-blueprint-muted"
                        )}
                      >
                        {room.isOwner ? "Owner" : "Member"}
                      </span>
                      <ArrowRight
                        size={14}
                        aria-hidden
                        className="shrink-0 text-blueprint-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                      />
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
