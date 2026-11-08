import Link from "next/link";

import { ActiveBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/data";
import { CELL, HEADER_CELL, ROW, Table } from "@/components/ui/data";
import { SERVICE_BOOKING_MODE_LABELS, type HospitalService } from "@/lib/services/types";

export function ServicesTable({ services }: { services: HospitalService[] }) {
  if (services.length === 0) {
    return <EmptyState>No services match.</EmptyState>;
  }

  return (
    <Table label="Services" minWidthClass="min-w-[44rem]">
      <thead>
        <tr>
          <th scope="col" className={HEADER_CELL}>Name</th>
          <th scope="col" className={HEADER_CELL}>Department</th>
          <th scope="col" className={HEADER_CELL}>Access</th>
          <th scope="col" className={HEADER_CELL}>Appointment</th>
          <th scope="col" className={HEADER_CELL}>Status</th>
        </tr>
      </thead>
      <tbody>
        {services.map((service) => (
          <tr key={service.id} className={ROW}>
            <td className={CELL}>
              <Link
                href={`/admin/services/${service.id}`}
                className="rounded font-medium text-primary underline-offset-4 focus-ring hover:text-primary-hover hover:underline"
              >
                {service.name}
              </Link>
            </td>
            <td className={CELL}>
              {service.departmentName ?? <span className="text-ink-muted">No department</span>}
            </td>
            <td className={CELL}>{SERVICE_BOOKING_MODE_LABELS[service.bookingMode]}</td>
            <td className={CELL}>{service.requiresAppointment ? "Required" : "Not required"}</td>
            <td className={CELL}>
              <ActiveBadge isActive={service.isActive} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
