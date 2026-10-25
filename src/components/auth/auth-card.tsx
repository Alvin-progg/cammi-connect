import type { ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-card sm:p-8">
      <h1 className="text-3xl font-semibold tracking-tight text-ink text-balance">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-sm leading-6 text-ink-secondary text-pretty">
          {subtitle}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-4">{children}</div>
    </div>
  );
}
