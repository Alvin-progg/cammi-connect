import { Button } from "@/components/ui/button";

/**
 * Placeholder for publishing a service to Cami's knowledge base. Knowledge
 * documents are written by hand (decision D7) and arrive with ADM-13, so the
 * button stays disabled until then.
 */
export function ServicePublishPlaceholder() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-secondary">
        Cami can&apos;t answer questions about this service yet. Publishing to the knowledge base
        becomes available with knowledge documents.
      </p>
      <Button variant="secondary" disabled className="self-start">
        Publish to Cami AI
      </Button>
    </div>
  );
}
