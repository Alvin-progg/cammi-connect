import Link from "next/link";

import { Table, Td, Th, Tr } from "@/components/ui/data";
import { formatPesos } from "@/lib/billing/money";
import type { RefundDueItem } from "@/lib/billing/verification";

import { MarkRefundedDialog } from "./payment-actions";

/**
 * PAY-05 "Refund due": paid appointments that were cancelled (D4). Staff
 * send the refund outside CamiConnect, then record its reference here.
 */
export function RefundDueList({ items }: { items: RefundDueItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="refund-due-heading" className="flex flex-col gap-3">
      <h2 id="refund-due-heading" className="text-lg font-semibold leading-7 text-ink">
        Refund due
      </h2>
      <Table label="Refunds due" minWidthClass="min-w-[44rem]">
        <thead>
          <tr>
            <Th>Patient</Th>
            <Th>Reference code</Th>
            <Th>Paid</Th>
            <Th>Transaction ref.</Th>
            <Th>
              <span className="sr-only">Action</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <Tr key={item.paymentId}>
              <Td>
                <Link
                  href={`/front-desk/requests/${item.appointmentId}`}
                  className="focus-ring rounded-sm font-medium text-ink underline-offset-4 hover:underline"
                >
                  {item.patientName}
                </Link>
              </Td>
              <Td className="font-mono text-xs">{item.referenceCode}</Td>
              <Td className="tabular-nums">
                {item.amountReceivedCentavos === null ? "—" : formatPesos(item.amountReceivedCentavos)}
              </Td>
              <Td className="font-mono text-xs">{item.transactionReference ?? "—"}</Td>
              <Td className="w-48">
                <MarkRefundedDialog paymentId={item.paymentId} appointmentId={item.appointmentId} />
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}
