"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useState } from "react";

import { DIALOG_BACKDROP_CLASS, DIALOG_POPUP_CLASS } from "@/components/front-desk/dialog-styles";
import { Button, buttonVariants } from "@/components/ui/button";
import { viewBenefitDocumentAction } from "@/server/benefits/actions";
import type { BenefitKind } from "@/server/benefits/service";

/**
 * Shows an audited, 60-second signed document in a dialog. The image is
 * fetched and shown from a blob URL because the CSP allows only same-site,
 * data:, and blob: images.
 */
export function BenefitDocumentButton({
  kind,
  recordId,
  disabled,
}: {
  kind: BenefitKind;
  recordId: string;
  disabled: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  async function open() {
    setMessage(null);
    setLoading(true);
    try {
      const result = await viewBenefitDocumentAction(kind, recordId);
      if (result.status === "error") {
        setMessage(result.message);
        return;
      }
      const response = await fetch(result.url);
      if (!response.ok) throw new Error("document fetch failed");
      setSrc(URL.createObjectURL(await response.blob()));
    } catch {
      setMessage("The document could not be opened. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="outline" size="sm" onClick={open} disabled={disabled || loading} aria-busy={loading || undefined}>
        {disabled ? "No document" : loading ? "Opening…" : "View document"}
      </Button>
      {message ? <p role="alert" className="text-xs text-danger">{message}</p> : null}
      <Dialog.Root open={src !== null} onOpenChange={(next) => (next ? null : setSrc(null))}>
        <Dialog.Portal>
          <Dialog.Backdrop className={DIALOG_BACKDROP_CLASS} />
          <Dialog.Popup className={`${DIALOG_POPUP_CLASS} max-w-lg`}>
            <Dialog.Title className="text-lg font-semibold text-ink">Benefit document</Dialog.Title>
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element -- a blob: URL; next/image cannot load it.
              <img src={src} alt="Benefit document sent by the patient" className="mt-4 w-full rounded-lg border border-line" />
            ) : null}
            <div className="mt-5 flex justify-end">
              <Dialog.Close className={buttonVariants({ variant: "ghost" })}>Close</Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
