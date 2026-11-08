import { useEffect, useState, type ComponentType } from "react";

import { SCREENS } from "@/screens/registry";

function currentPath() {
  const hash = window.location.hash.replace(/^#/, "");
  return hash || "/_screens";
}

/** Lists every screen with its repo route, grouped like the design canvas. */
function ScreenIndex() {
  const groups = [...new Set(SCREENS.map((s) => s.group))];
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-sm font-medium text-primary">CamiConnect redesign</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">UI reference</h1>
      <p className="mt-2 max-w-2xl text-ink-secondary">
        Static, mock-data versions of every redesigned screen. Each entry shows the route it replaces in the repo. Open one, then
        compare it with the real page.
      </p>
      <div className="mt-10 grid gap-8 md:grid-cols-2">
        {groups.map((group) => (
          <section key={group}>
            <h2 className="text-lg font-semibold text-ink">{group}</h2>
            <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface shadow-soft">
              {SCREENS.filter((s) => s.group === group).map((s) => (
                <li key={s.path}>
                  <a href={`#${s.path}`} className="focus-ring flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-surface-muted">
                    <span className="font-medium text-ink">{s.title}</span>
                    <code className="font-mono text-xs text-ink-muted">{s.route}</code>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

export default function App() {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => {
      setPath(currentPath());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const screen = SCREENS.find((s) => s.path === path);
  const Component: ComponentType = screen?.component ?? ScreenIndex;
  return <Component />;
}
