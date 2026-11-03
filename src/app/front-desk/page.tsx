import type { Metadata } from "next";
import Link from "next/link";

import { AccessDenied } from "@/components/auth/access-denied";
import { FrontDeskShell } from "@/components/front-desk/front-desk-shell";
import { getFrontDeskSession } from "@/server/auth/dal";

export const instant = false;

export const metadata: Metadata = { title: "Front desk" };

export default async function FrontDeskPage() {
  const session = await getFrontDeskSession("/front-desk");

  if (!session) {
    return (
      <AccessDenied message="This dashboard is only available to front desk staff." />
    );
  }

  return (
    <FrontDeskShell
      staffName={session.staff.fullName}
      active="overview"
      crumbs={[{ label: "Overview" }]}
    >
      <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-ink-muted">
        The overview is coming soon. Review appointment requests from Cami in{" "}
        <Link
          href="/front-desk/requests"
          className="rounded font-medium text-primary underline underline-offset-4 focus-ring hover:text-primary-hover"
        >
          Requests
        </Link>
        .
      </p>
    </FrontDeskShell>
  );
}
