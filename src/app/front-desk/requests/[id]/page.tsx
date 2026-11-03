import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/auth/access-denied";
import { FrontDeskShell } from "@/components/front-desk/front-desk-shell";
import { RequestDetailsView } from "@/components/front-desk/request-details";
import { formatRequestId } from "@/lib/front-desk/requests";
import { getFrontDeskSession } from "@/server/auth/dal";
import { supabaseFrontDeskRequestsRepository } from "@/server/front-desk/repository";
import { getRequestDetails } from "@/server/front-desk/service";

export const instant = false;

export const metadata: Metadata = { title: "Appointment request" };

export default async function FrontDeskRequestPage({
  params,
}: PageProps<"/front-desk/requests/[id]">) {
  const { id } = await params;
  const session = await getFrontDeskSession(`/front-desk/requests/${encodeURIComponent(id)}`);

  if (!session) {
    return (
      <AccessDenied message="This dashboard is only available to front desk staff." />
    );
  }

  const request = await getRequestDetails(id, supabaseFrontDeskRequestsRepository);
  if (!request) {
    notFound();
  }

  return (
    <FrontDeskShell
      staffName={session.staff.fullName}
      active="requests"
      crumbs={[
        { label: "Requests", href: "/front-desk/requests" },
        { label: `Request ${formatRequestId(request.id)}` },
      ]}
    >
      <RequestDetailsView request={request} />
    </FrontDeskShell>
  );
}
