import { NavLink, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useProblems } from "../lib/problems";
import { useSession } from "../lib/session";
import { cn } from "../lib/cn";
import { Pagination, paginate } from "../components/Pagination";
import { SectionHeading } from "../components/SectionHeading";
import { Spinner } from "../components/PageLoader";
import { UnfinishedRow, useUnfinished } from "../components/UnfinishedList";
import { button, container } from "../components/ui";

const PAGE_SIZE = 10;

/** Every problem started and not solved, ten to a page, each one a way back in. */
export default function ContinuePage() {
  const session = useSession();
  const { problems, error } = useUnfinished();
  const { problems: bank } = useProblems();
  const [params, setParams] = useSearchParams();
  const requested = Number(params.get("page") ?? "1") || 1;
  const numbers = new Map(bank.map((problem, at) => [problem.id, at + 1]));

  const setPage = (page: number) => {
    const next = new URLSearchParams(params);
    if (page > 1) next.set("page", String(page));
    else next.delete("page");
    setParams(next, { replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const paged = paginate(problems ?? [], requested, PAGE_SIZE);

  return (
    <div className={`${container} py-10 sm:py-14`}>
      <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          as="h1"
          className="mb-0"
          eyebrow="Continue solving"
          title="Pick up where you left off."
          lead="Every problem you started and have not solved yet. Your code is saved to your account, so it opens exactly as you left it, on any device."
        />
        <NavLink to="/dashboard" className={cn(button.outlineSm, "self-start lg:self-auto")}>
          <ArrowLeft size={14} aria-hidden /> Dashboard
        </NavLink>
      </div>

      {!session.user ? (
        <div className="surface-card text-center">
          <p className="text-headline-sm text-primary">Sign in to keep your place.</p>
          <p className="mt-2 text-body-md text-blueprint-muted">
            Unfinished problems follow your account, so they survive signing out and closing the window.
          </p>
          <NavLink to="/signin?next=/continue" className={cn(button.primary, "mt-6")}>
            Sign in
          </NavLink>
        </div>
      ) : problems === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : error ? (
        <div className="status-error rounded-xl border px-5 py-4 text-body-md">
          Could not load your unfinished problems. Check that the Noesis backend is running, then reload.
        </div>
      ) : problems.length === 0 ? (
        <div className="surface-card text-center">
          <p className="text-headline-sm text-primary">Nothing left hanging.</p>
          <p className="mt-2 text-body-md text-blueprint-muted">
            Every problem you started is solved. Pick a new one and it will wait here if you step away.
          </p>
          <NavLink to="/problems" className={cn(button.outlineSm, "mt-6")}>
            Browse problems
          </NavLink>
        </div>
      ) : (
        <>
          <p className="mb-4 text-technical-mono text-blueprint-muted" aria-live="polite">
            {problems.length > PAGE_SIZE
              ? `${(paged.page - 1) * PAGE_SIZE + 1}–${(paged.page - 1) * PAGE_SIZE + paged.items.length} of ${problems.length} unfinished`
              : `${problems.length} unfinished`}
          </p>
          <ul className="surface-frame divide-y divide-blueprint-line overflow-hidden">
            {paged.items.map((entry) => (
              <li key={entry.problemId}>
                <UnfinishedRow entry={entry} number={numbers.get(entry.problemId)} />
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Pagination page={paged.page} pages={paged.pages} onPage={setPage} label="Unfinished problem pages" />
          </div>
        </>
      )}
    </div>
  );
}
