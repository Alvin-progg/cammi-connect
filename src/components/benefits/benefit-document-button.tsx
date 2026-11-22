"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { viewBenefitDocumentAction } from "@/server/benefits/actions";
import type { BenefitKind } from "@/server/benefits/service";

/** Opens an audited, 60-second link to the stored ID or card image. */
export function BenefitDocumentButton({
  kind,
  recordId,
  disabled,
}: {
  kind: BenefitKind;
  recordId: string;
  disabled: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open() {
    setMessage(null);
    startTransition(async () => {
      const result = await viewBenefitDocumentAction(kind, recordId);
      if (result.status === "error") {
        setMessage(result.message);
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="outline" size="sm" onClick={open} disabled={disabled || pending}>
        {disabled ? "No document" : pending ? "Opening…" : "View document"}
      </Button>
      {message ? <p role="alert" className="text-xs text-danger">{message}</p> : null}
    </div>
  );
}
