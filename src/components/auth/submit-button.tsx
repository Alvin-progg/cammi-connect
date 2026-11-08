import { LoaderCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Full-width primary submit for the auth forms; blocks double submission. */
export function SubmitButton({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full">
      {pending ? <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}
