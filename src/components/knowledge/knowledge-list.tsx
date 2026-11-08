import Link from "next/link";

import { EmptyState } from "@/components/admin/empty-state";
import { CELL, HEADER_CELL, ROW, TableFrame } from "@/components/front-desk/table-frame";
import { formatManilaDateTime } from "@/lib/appointments/format";
import { KNOWLEDGE_CATEGORY_LABELS, type KnowledgeDocumentSummary } from "@/lib/knowledge/types";

import { KnowledgeProcessingBadge, KnowledgeStatusBadge } from "./knowledge-badges";

const LINK_CLASS =
  "rounded font-medium text-primary underline-offset-4 focus-ring hover:text-primary-hover hover:underline";

function documentHref(document: KnowledgeDocumentSummary): string {
  return `/admin/knowledge-base/${document.id}`;
}

export function KnowledgeList({ documents }: { documents: KnowledgeDocumentSummary[] }) {
  if (documents.length === 0) {
    return <EmptyState>No documents match.</EmptyState>;
  }

  return (
    <TableFrame label="Knowledge documents" minWidthClass="min-w-[52rem]">
      <thead>
        <tr>
          <th scope="col" className={HEADER_CELL}>Title</th>
          <th scope="col" className={HEADER_CELL}>Category</th>
          <th scope="col" className={HEADER_CELL}>Status</th>
          <th scope="col" className={HEADER_CELL}>Processing</th>
          <th scope="col" className={HEADER_CELL}>Version</th>
          <th scope="col" className={HEADER_CELL}>Updated</th>
        </tr>
      </thead>
      <tbody>
        {documents.map((document) => (
          <tr key={document.id} className={ROW}>
            <td className={CELL}>
              <Link href={documentHref(document)} className={LINK_CLASS}>
                {document.title}
              </Link>
            </td>
            <td className={CELL}>{KNOWLEDGE_CATEGORY_LABELS[document.category]}</td>
            <td className={CELL}>
              <KnowledgeStatusBadge status={document.status} />
            </td>
            <td className={CELL}>
              <KnowledgeProcessingBadge status={document.processingStatus} />
            </td>
            <td className={`${CELL} tabular-nums`}>{`v${document.version}`}</td>
            <td className={`${CELL} tabular-nums`}>{formatManilaDateTime(document.updatedAt)}</td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

/** Documents whose ingestion failed (ADM-14 sets the error), shown above the list. */
export function FailedDocumentsPanel({ documents }: { documents: KnowledgeDocumentSummary[] }) {
  if (documents.length === 0) {
    return null;
  }
  return (
    <section
      aria-labelledby="knowledge-failed-heading"
      className="flex flex-col gap-2 rounded-xl border border-danger-soft bg-danger-soft/40 p-4"
    >
      <h2 id="knowledge-failed-heading" className="text-base font-semibold text-danger-soft-ink">
        Processing failed
      </h2>
      <ul className="flex flex-col gap-2">
        {documents.map((document) => (
          <li key={document.id} className="text-sm">
            <Link href={documentHref(document)} className={LINK_CLASS}>
              {document.title}
            </Link>
            <p className="text-ink-secondary">{document.processingError ?? "No details recorded."}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
