import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import type { ClassroomDetail, ClassroomMember } from "@nodeflow/shared";
import { api } from "../lib/api";
import { readError } from "../lib/errors";
import { useProblems } from "../lib/problems";
import { useSession } from "../lib/session";
import { cn } from "../lib/cn";
import { Modal } from "../components/Modal";
import { Pagination, paginate } from "../components/Pagination";
import { Spinner } from "../components/PageLoader";
import { button, chip, container, difficultyTone } from "../components/ui";

type Tab = "progress" | "assignments";

const MEMBERS_PER_PAGE = 15;
const ASSIGNMENTS_PER_PAGE = 12;

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const when = (timestamp?: string) => (timestamp ? dateFormat.format(new Date(timestamp)) : "—");

function Bar({ value, total }: { value: number; total: number }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-inset" aria-hidden>
      <div className="progress-fill h-full rounded-full transition-[width] duration-500" style={{ width: `${percent}%` }} />
    </div>
  );
}

function JoinCodePanel({ room, onRotate, busy }: { room: ClassroomDetail; onRotate: () => void; busy: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!room.joinCode) return;
    try {
      await navigator.clipboard.writeText(room.joinCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked; the code is still on screen to copy by hand.
    }
  };

  return (
    <div className="surface-card-compact flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-technical-mono text-blueprint-muted">join code</p>
        <p className="mt-2 font-mono text-3xl font-semibold tracking-[0.3em] text-primary">{room.joinCode}</p>
        <p className="mt-2 text-body-md text-blueprint-muted">Share it with students. They join from the Classrooms page.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => void copy()} className={button.outlineSm}>
          {copied ? <Check size={14} aria-hidden className="check-icon" /> : <Copy size={14} aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={onRotate} disabled={busy} className={button.outlineSm} title="Old code stops working">
          <RefreshCw size={14} aria-hidden className={cn(busy && "animate-spin")} /> New code
        </button>
      </div>
    </div>
  );
}

function AssignmentPicker({
  assigned,
  onAdd,
  busy
}: {
  assigned: Set<string>;
  onAdd: (problemId: string) => void;
  busy: boolean;
}) {
  const { problems } = useProblems();
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return problems
      .filter((problem) => !assigned.has(problem.id))
      .filter(
        (problem) => problem.title.toLowerCase().includes(needle) || problem.topic.toLowerCase().includes(needle)
      )
      .slice(0, 8);
  }, [problems, query, assigned]);

  return (
    <div className="relative">
      <Search
        size={16}
        aria-hidden
        className="pointer-events-none absolute left-4 top-[1.4rem] -translate-y-1/2 text-blueprint-muted"
      />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Add a problem by title or topic"
        aria-label="Find a problem to assign"
        className="h-11 w-full rounded-full border border-blueprint-line bg-background pl-11 pr-4 text-[15px] text-primary outline-none placeholder:text-blueprint-muted focus:border-primary"
      />
      {matches.length > 0 && (
        <ul className="mt-2 divide-y divide-blueprint-line overflow-hidden rounded-2xl border border-blueprint-line bg-card">
          {matches.map((problem) => (
            <li key={problem.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-primary">{problem.title}</span>
                <span className="text-xs text-blueprint-muted">
                  {problem.topic} · {problem.difficulty}
                </span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onAdd(problem.id);
                  setQuery("");
                }}
                className={cn(button.outlineSm, "px-3 py-1.5")}
                style={{ minHeight: 0 }}
              >
                <Plus size={13} aria-hidden /> Assign
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ClassroomPage() {
  const { classroomId = "" } = useParams<{ classroomId: string }>();
  const session = useSession();
  const navigate = useNavigate();
  const [room, setRoom] = useState<ClassroomDetail | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("progress");
  const [memberPage, setMemberPage] = useState(1);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [confirm, setConfirm] = useState<"delete" | "leave" | null>(null);

  const load = useCallback(() => {
    if (!session.user) return;
    api
      .classroom(classroomId, session.token)
      .then((detail) => {
        setRoom(detail);
        setError("");
      })
      .catch((requestError) => setError(readError(requestError, "Could not load this classroom.")));
  }, [classroomId, session.user, session.token]);

  useEffect(() => {
    load();
    // Progress changes whenever anyone submits; a light poll keeps the board current.
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const act = async (key: string, action: () => Promise<ClassroomDetail | { ok: boolean }>, after?: () => void) => {
    setBusy(key);
    setActionError("");
    try {
      const result = await action();
      if ("members" in result) setRoom(result);
      after?.();
    } catch (requestError) {
      setActionError(readError(requestError, "That did not work. Try again."));
    } finally {
      setBusy(null);
    }
  };

  const assigned = useMemo(() => new Set(room?.assignments.map((entry) => entry.problemId) ?? []), [room]);
  const me = room?.members.find((member) => member.id === session.user?.id);
  const students = room?.members.filter((member) => member.role === "member") ?? [];

  const board = useMemo(
    () =>
      [...(room?.members ?? [])].sort(
        (a, b) => b.assignmentsSolved - a.assignmentsSolved || b.solved - a.solved || a.name.localeCompare(b.name)
      ),
    [room]
  );
  const memberSlice = paginate(board, memberPage, MEMBERS_PER_PAGE);
  const assignmentSlice = paginate(room?.assignments ?? [], assignmentPage, ASSIGNMENTS_PER_PAGE);
  const total = room?.assignments.length ?? 0;

  if (!session.loading && !session.user) {
    return (
      <div className={`${container} py-10 sm:py-14`}>
        <div className="surface-card mx-auto max-w-xl text-center">
          <h1 className="text-headline-sm text-primary">Sign in to see this classroom</h1>
          <NavLink to={`/signin?next=/classrooms/${classroomId}`} className={cn(button.primary, "mt-6")}>
            Sign in
          </NavLink>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${container} py-10 sm:py-14`}>
        <div className="surface-card mx-auto max-w-xl text-center">
          <h1 className="text-headline-sm text-primary">{error}</h1>
          <p className="mt-3 text-body-md text-blueprint-muted">It may have been deleted, or you may have left it.</p>
          <NavLink to="/classrooms" className={cn(button.outlineSm, "mt-6")}>
            Back to classrooms
          </NavLink>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  const memberRow = (member: ClassroomMember) => (
    <li
      key={member.id}
      className={cn(
        "grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_5rem_7rem_2.5rem] sm:items-center sm:px-6",
        member.id === me?.id && "bg-surface-hover"
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-[15px] font-medium text-primary">
          {member.name}
          {member.id === me?.id && <span className="ml-2 text-xs font-normal text-blueprint-muted">you</span>}
        </p>
        <p className="mt-0.5 truncate text-xs text-blueprint-muted">
          {member.role === "owner" ? "Owner" : `Joined ${when(member.joinedAt)}`}
          {member.email ? ` · ${member.email}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Bar value={member.assignmentsSolved} total={total} />
        <span className="shrink-0 text-technical-mono text-primary">
          {member.assignmentsSolved}/{total}
        </span>
      </div>
      <p className="text-technical-mono text-blueprint-muted sm:text-right">
        <span className="sm:hidden">solved </span>
        {member.solved}
      </p>
      <p className="text-technical-mono text-blueprint-muted sm:text-right">
        <span className="sm:hidden">last submit </span>
        {when(member.lastSubmittedAt)}
      </p>
      <div className="sm:text-right">
        {room.isOwner && member.role === "member" && (
          <button
            type="button"
            onClick={() => void act(`remove-${member.id}`, () => api.removeMember(room.id, member.id, session.token), load)}
            disabled={busy !== null}
            className={cn(button.icon, "h-8 w-8")}
            style={{ minHeight: 0 }}
            aria-label={`Remove ${member.name}`}
            title="Remove from classroom"
          >
            <X size={14} aria-hidden />
          </button>
        )}
      </div>
    </li>
  );

  return (
    <div className={`${container} py-10 sm:py-14`}>
      <NavLink to="/classrooms" className={cn(button.ghost, "-ml-3 mb-6")}>
        <ArrowLeft size={14} aria-hidden /> Classrooms
      </NavLink>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-ui-label text-blueprint-muted">{room.isOwner ? "You own this classroom" : "Classroom"}</p>
          <h1 className="mt-3 text-balance text-headline-lg text-primary">{room.name}</h1>
          <p className="mt-3 text-body-md text-blueprint-muted">
            {students.length} {students.length === 1 ? "student" : "students"} · {total}{" "}
            {total === 1 ? "assignment" : "assignments"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirm(room.isOwner ? "delete" : "leave")}
          className={cn(button.outlineSm, "self-start lg:self-auto")}
        >
          <Trash2 size={14} aria-hidden /> {room.isOwner ? "Delete classroom" : "Leave classroom"}
        </button>
      </div>

      {room.isOwner && (
        <JoinCodePanel
          room={room}
          busy={busy === "rotate"}
          onRotate={() => void act("rotate", () => api.rotateJoinCode(room.id, session.token))}
        />
      )}

      {actionError && <p className="status-error mt-6 rounded-xl border px-5 py-4 text-body-md">{actionError}</p>}

      <div role="tablist" aria-label="Classroom view" className="mt-8 inline-flex rounded-full border border-blueprint-line bg-card p-1">
        {(["progress", "assignments"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "no-lift rounded-full px-4 py-1.5 text-ui-label transition-colors",
              tab === value ? "bg-primary text-primary-foreground" : "text-blueprint-muted hover:text-primary"
            )}
            style={{ minHeight: 0 }}
          >
            {value === "progress" ? "Progress" : `Assignments · ${total}`}
          </button>
        ))}
      </div>

      {tab === "progress" ? (
        <section aria-label="Progress board" className="surface-frame mt-4 overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_5rem_7rem_2.5rem] gap-3 border-b border-blueprint-line px-6 py-3 text-technical-mono text-blueprint-muted sm:grid">
            <span>member</span>
            <span>assignments</span>
            <span className="text-right">solved</span>
            <span className="text-right">last submit</span>
            <span />
          </div>
          {room.members.length === 1 && room.isOwner && (
            <p className="border-b border-blueprint-line px-6 py-4 text-body-md text-blueprint-muted">
              No students yet. Share the join code above to fill the board.
            </p>
          )}
          <ul className="divide-y divide-blueprint-line">
            {memberSlice.items.map(memberRow)}
          </ul>
          {memberSlice.pages > 1 && (
            <div className="border-t border-blueprint-line px-5 py-4">
              <Pagination page={memberSlice.page} pages={memberSlice.pages} onPage={setMemberPage} label="Member pages" />
            </div>
          )}
        </section>
      ) : (
        <section aria-label="Assignments" className="mt-4 grid gap-4">
          {room.isOwner && (
            <div className="surface-card-compact">
              <AssignmentPicker
                assigned={assigned}
                busy={busy !== null}
                onAdd={(problemId) =>
                  void act("assign", () => api.setAssignments(room.id, [...assigned, problemId], session.token))
                }
              />
            </div>
          )}

          <div className="surface-frame overflow-hidden">
            {room.assignments.length === 0 ? (
              <p className="px-6 py-12 text-center text-body-md text-blueprint-muted">
                {room.isOwner
                  ? "Nothing assigned yet. Search for a problem above to add it."
                  : "Your teacher has not assigned anything yet."}
              </p>
            ) : (
              <ul className="divide-y divide-blueprint-line">
                {assignmentSlice.items.map((assignment) => {
                  const done = me?.solvedAssignments.includes(assignment.problemId) ?? false;
                  return (
                    <li key={assignment.problemId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                          done ? "border-blueprint-line" : "border-dashed border-blueprint-line"
                        )}
                      >
                        {done && <Check size={15} aria-hidden className="check-icon" />}
                        <span className="sr-only">{done ? "You solved this" : "Not solved yet"}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-primary">{assignment.title}</span>
                        <span className="mt-1 block text-xs text-blueprint-muted">
                          {assignment.topic} · <span className={difficultyTone[assignment.difficulty]}>{assignment.difficulty}</span>{" "}
                          · solved by {assignment.solvedBy}/{students.length} {students.length === 1 ? "student" : "students"}
                        </span>
                      </span>
                      <span className={cn(chip.small, "hidden text-blueprint-muted sm:inline-flex")}>
                        added {when(assignment.addedAt)}
                      </span>
                      <NavLink to={`/workspace/${assignment.problemId}`} className={cn(button.outlineSm, "px-3 py-1.5")} style={{ minHeight: 0 }}>
                        Open <ArrowRight size={13} aria-hidden />
                      </NavLink>
                      {room.isOwner && (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() =>
                            void act("assign", () =>
                              api.setAssignments(
                                room.id,
                                room.assignments.map((entry) => entry.problemId).filter((id) => id !== assignment.problemId),
                                session.token
                              )
                            )
                          }
                          className={cn(button.icon, "h-8 w-8")}
                          style={{ minHeight: 0 }}
                          aria-label={`Unassign ${assignment.title}`}
                        >
                          {busy === "assign" ? <Loader2 size={13} aria-hidden className="animate-spin" /> : <X size={14} aria-hidden />}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {assignmentSlice.pages > 1 && (
              <div className="border-t border-blueprint-line px-5 py-4">
                <Pagination
                  page={assignmentSlice.page}
                  pages={assignmentSlice.pages}
                  onPage={setAssignmentPage}
                  label="Assignment pages"
                />
              </div>
            )}
          </div>
        </section>
      )}

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        eyebrow="Classroom"
        title={confirm === "delete" ? `Delete ${room.name}?` : `Leave ${room.name}?`}
        actions={
          <>
            <button type="button" className={button.outlineSm} onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={button.danger}
              disabled={busy !== null}
              onClick={() =>
                void act(
                  confirm ?? "leave",
                  () =>
                    confirm === "delete"
                      ? api.deleteClassroom(room.id, session.token)
                      : api.removeMember(room.id, session.user?.id ?? "", session.token),
                  () => navigate("/classrooms")
                )
              }
            >
              {confirm === "delete" ? "Delete" : "Leave"}
            </button>
          </>
        }
      >
        {confirm === "delete"
          ? "Everyone loses access to the board and assignments. Submissions stay on each person's own dashboard."
          : "Your submissions stay on your dashboard. You can rejoin later with the join code."}
      </Modal>
    </div>
  );
}
