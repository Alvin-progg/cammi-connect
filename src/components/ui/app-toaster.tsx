"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      theme="system"
      position="bottom-right"
      closeButton
      visibleToasts={3}
      gap={12}
      offset={24}
      mobileOffset={16}
      style={{ zIndex: 60 }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-4 text-ink shadow-overlay",
          title: "text-sm font-medium",
          description: "text-sm text-ink-secondary",
          actionButton:
            "rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-ink focus-ring",
          cancelButton:
            "rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink focus-ring",
          closeButton:
            "rounded-lg p-1 text-ink-muted hover:text-ink focus-ring",
        },
      }}
    />
  );
}
