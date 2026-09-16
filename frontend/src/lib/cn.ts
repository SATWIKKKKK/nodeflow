import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The design system's type utilities (`text-ui-label`, `text-body-md`, ...) look
 * like colour classes to tailwind-merge. Registering them as font sizes stops
 * `cn("text-ui-label", "text-primary")` from silently dropping one of the two.
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "hero",
            "cta",
            "display-xl",
            "headline-lg",
            "headline-md",
            "headline-sm",
            "metric",
            "body-md",
            "body-lg",
            "ui-label",
            "technical-mono"
          ]
        }
      ]
    }
  }
});

export const cn = (...inputs: ClassValue[]) => merge(clsx(inputs));
