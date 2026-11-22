import type { Metadata } from "next";

import { AccessDenied } from "@/components/auth/access-denied";
import { BenefitDecisionForm } from "@/components/benefits/benefit-decision-form";
import { BenefitDocumentButton } from "@/components/benefits/benefit-document-button";
import { FrontDeskShell } from "@/components/front-desk/front-desk-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, ListRow, ListRows } from "@/components/ui/data";
import { getFrontDeskSession } from "@/server/auth/dal";
import {
  readPendingBenefitQueue,
  readRecentBenefitHistory,
  type BenefitQueueItem,
} from "@/server/benefits/repository";
import type { BenefitKind } from "@/server/benefits/service";
import { formatManilaDate } from "@/lib/appointments/format";

export const instant = false;

export const metadata: Metadata = { title: "Benefits verification" };

const PATH = "/front-desk/benefits";

const TABS: { key: BenefitKind; label: string }[] = [
  { key: "pwd", label: "PWD" },
  { key: "hmo", label: "HMO" },
];

export default async function FrontDeskBenefitsPage({ searchParams }: PageProps<"/front-desk/benefits">) {
  const session = await getFrontDeskSession(PATH);
  if (!session) {
    return <AccessDenied message="This dashboard is only available to front desk staff." />;
  }

  const params = await searchParams;
  const tab: BenefitKind = params.tab === "hmo" ? "hmo" : "pwd";
  const [queue, history] = await Promise.all([
    readPendingBenefitQueue(tab),
    readRecentBenefitHistory(25),
  ]);

  return (
    <FrontDeskShell
      staffName={session.staff.fullName}
      active="benefits"
      crumbs={[{ label: "Benefits verification" }]}
      title="Benefits verification"
      lead="Check PWD IDs and HMO membership cards against the patient's details. Verify or reject each one; a rejection needs a reason. Every decision and document view is recorded."
    >
      <nav aria-label="Benefit type" className="flex gap-2">
        {TABS.map((item) => (
          <a
            key={item.key}
            href={`${PATH}?tab=${item.key}`}
            aria-current={item.key === tab ? "page" : undefined}
            className={
              item.key === tab
                ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                : "rounded-md border border-line px-3 py-1.5 text-sm text-ink-secondary hover:bg-surface-muted"
            }
          >
            {item.label} ({item.key === tab ? queue.length : "pending"})
          </a>
        ))}
      </nav>

      <Card>
        <CardHeader title={tab === "pwd" ? "Pending PWD declarations" : "Pending HMO memberships"} />
        {queue.length === 0 ? (
          <EmptyState title="Nothing waiting" description="No pending submissions." />
        ) : (
          <ListRows>
            {queue.map((item) => (
              <QueueRow key={item.recordId} kind={tab} item={item} />
            ))}
          </ListRows>
        )}
      </Card>

      <Card>
        <CardHeader title="Recent decisions and document views" />
        {history.length === 0 ? (
          <EmptyState title="No activity yet" description="Decisions and document views appear here." />
        ) : (
          <ListRows>
            {history.map((entry) => (
              <ListRow key={entry.id}>
                <div className="flex flex-col gap-0.5 text-sm">
                  <span className="font-medium text-ink">{entry.action}</span>
                  <span className="text-ink-muted">
                    {entry.actorName} · {formatManilaDate(entry.createdAt.slice(0, 10))}
                    {entry.reason ? ` · ${entry.reason}` : ""}
                  </span>
                </div>
              </ListRow>
            ))}
          </ListRows>
        )}
      </Card>
    </FrontDeskShell>
  );
}

function QueueRow({ kind, item }: { kind: BenefitKind; item: BenefitQueueItem }) {
  return (
    <ListRow>
      <div className="grid w-full gap-4 md:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{item.patientName}</span>
            <Badge tone="warning">Pending</Badge>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-ink-muted">{kind === "pwd" ? "PWD ID" : "Membership"}</dt>
            <dd className="font-mono text-ink">{item.identifier}</dd>
            {item.providerName ? (
              <>
                <dt className="text-ink-muted">Provider</dt>
                <dd className="text-ink">{item.providerName}</dd>
              </>
            ) : null}
            <dt className="text-ink-muted">Submitted</dt>
            <dd className="text-ink">{formatManilaDate(item.submittedAt.slice(0, 10))}</dd>
          </dl>
          <BenefitDocumentButton kind={kind} recordId={item.recordId} disabled={!item.hasDocument} />
        </div>
        <BenefitDecisionForm kind={kind} recordId={item.recordId} />
      </div>
    </ListRow>
  );
}
