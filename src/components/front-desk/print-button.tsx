"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Prints the current page; the shell's navigation is hidden in print. */
export function PrintButton({ label = "Print list" }: { label?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <Printer aria-hidden="true" />
      {label}
    </Button>
  );
}
