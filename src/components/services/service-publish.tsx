import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Placeholder for publishing a service to Cami's knowledge base. Knowledge
 * documents are written by hand for now (decision D7), so the button stays
 * disabled and admins add the service as a document in the Knowledge Base.
 */
export function ServicePublishPlaceholder() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-secondary">
        Cami doesn&apos;t read services directly. To let Cami answer questions about this service,
        add it as a document in the{" "}
        <Link href="/admin/knowledge-base/new" className="rounded font-medium text-primary underline-offset-4 focus-ring hover:underline">
          Knowledge Base
        </Link>
        .
      </p>
      <Button variant="secondary" disabled className="self-start">
        Publish to Cami AI
      </Button>
    </div>
  );
}
