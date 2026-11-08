import Link from "next/link";

import { EmptyState } from "@/components/ui/data";
import { CELL, HEADER_CELL, ROW, Table } from "@/components/ui/data";
import { formatManilaDateTime } from "@/lib/appointments/format";
import { knowledgeCoverage } from "@/lib/knowledge/coverage";
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
    <Table label="Knowledge documents" minWidthClass="min-w-[52rem]">
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
    </Table>
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

/** Per-category counts of what Cami can answer from (ADM-14). */
export function KnowledgeCoveragePanel({ documents }: { documents: KnowledgeDocumentSummary[] }) {
  return (
    <Table label="Knowledge coverage by category" minWidthClass="min-w-[40rem]">
      <thead>
        <tr>
          <th scope="col" className={HEADER_CELL}>Category</th>
          <th scope="col" className={HEADER_CELL}>Published</th>
          <th scope="col" className={HEADER_CELL}>Ready</th>
          <th scope="col" className={HEADER_CELL}>Failed</th>
          <th scope="col" className={HEADER_CELL}>Last updated</th>
        </tr>
      </thead>
      <tbody>
        {knowledgeCoverage(documents).map((row) => (
          <tr key={row.category} className={ROW}>
            <td className={CELL}>{KNOWLEDGE_CATEGORY_LABELS[row.category]}</td>
            <td className={`${CELL} tabular-nums`}>{row.published}</td>
            <td className={`${CELL} tabular-nums`}>{row.ready}</td>
            <td className={`${CELL} tabular-nums`}>{row.failed}</td>
            <td className={`${CELL} tabular-nums`}>
              {row.lastUpdated ? (
                formatManilaDateTime(row.lastUpdated)
              ) : (
                <span className="font-medium text-warning-soft-ink">No published documents</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
