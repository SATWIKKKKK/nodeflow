import { NavLink } from "react-router-dom";
import { Logo } from "../Logo";
import { container } from "../ui";

const groups: Array<{ title: string; links: Array<{ to: string; label: string }> }> = [
  {
    title: "Product",
    links: [
      { to: "/problems", label: "Problems" },
      { to: "/workspace", label: "Workspace" },
      { to: "/dashboard", label: "Dashboard" },
      { to: "/problem-map", label: "Problem map" }
    ]
  },
  {
    title: "Learn",
    links: [
      { to: "/how-it-works", label: "How it works" },
      { to: "/tracing", label: "Tracing" },
      { to: "/pricing", label: "Pricing" },
      { to: "/roadmap", label: "Roadmap" }
    ]
  },
  {
    title: "Company",
    links: [
      { to: "/about", label: "About" },
      { to: "/contact", label: "Contact" }
    ]
  },
  {
    title: "Legal",
    links: [
      { to: "/privacy", label: "Privacy" },
      { to: "/terms", label: "Terms" },
      { to: "/security", label: "Security" }
    ]
  }
];

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-blueprint-line bg-background py-10">
      <div className={`${container} grid gap-10 lg:grid-cols-[1.1fr_2fr]`}>
        <div className="max-w-sm">
          <Logo markClassName="h-8" />
          <p className="mt-4 text-body-md text-blueprint-muted">
            Write Python, run it in a sandbox, and replay every step your code took.
          </p>
          <p className="mt-6 text-technical-mono text-blueprint-muted">
            © {new Date().getFullYear()} Noesis
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {groups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <p className="text-ui-label text-primary">{group.title}</p>
              <ul className="mt-4 grid gap-2.5">
                {group.links.map((link) => (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      className="text-body-md text-blueprint-muted transition-colors hover:text-primary"
                    >
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
    </footer>
  );
}
