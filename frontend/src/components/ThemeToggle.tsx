import { MoonStar, SunMedium } from "lucide-react";
import { useThemePreference } from "../lib/theme";
import { cn } from "../lib/cn";
import { button } from "./ui";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useThemePreference();
  const dark = resolved === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(button.icon, className)}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
    >
      {dark ? <SunMedium size={16} aria-hidden /> : <MoonStar size={16} aria-hidden />}
    </button>
  );
}
