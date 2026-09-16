import { cn } from "../lib/cn";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block h-8 w-8 animate-spin rounded-full border-2 border-blueprint-line border-t-primary",
        className
      )}
    />
  );
}

export function PageLoader({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-[50vh] items-center justify-center", className)}>
      <Spinner />
    </div>
  );
}
