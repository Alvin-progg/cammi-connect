import { Download, Mail, Plus, Trash2 } from "lucide-react";

import { PageHeader, SplitLayout, StaffShell } from "@/components/shell/staff-shell";
import { ActiveBadge, Badge, StatusBadge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Avatar, Card, CardHeader, DetailList } from "@/components/ui/card";
import { Alert, ListRow, ListRows, Pagination, Table, Td, Th, Timeline, Tr } from "@/components/ui/data";
import { Checkbox, ChoiceCard, Field, FieldGrid, Fieldset, FormFooter, Input, Select } from "@/components/ui/field";
import { SearchInput, Segmented, Tabs, Toolbar } from "@/components/ui/navigation";
import { href } from "@/lib/routes";
import { APPOINTMENTS, DOCTORS, USERS } from "@/mock/data";

const admin = { label: "Admin", href: href("/admin") };

/** /admin/appointments — ADM-09: read-only monitoring, server-paginated, URL filters. */
export function AdminAppointmentsScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/appointments" crumbs={[admin, { label: "Appointments" }]} actions={<Button variant="outline" size="sm"><Download aria-hidden />Export CSV</Button>}>
      <PageHeader title="Appointments" lead="Monitor every appointment. Changes are made by the front desk and doctors." />
      <Tabs
        label="Status"
        items={[
          { value: "all", label: "All", count: 584 },
          { value: "requested", label: "Pending confirmation", count: 18 },
          { value: "confirmed", label: "Confirmed" },
          { value: "completed", label: "Completed" },
          { value: "cancelled", label: "Cancelled" },
          { value: "no_show", label: "No-show" },
        ]}
      />
      <Toolbar>
        <SearchInput label="Patient name" placeholder="Patient name" className="flex-1" />
        <Select aria-label="Doctor" className="w-auto"><option>All doctors</option></Select>
        <Select aria-label="Department" className="w-auto"><option>All departments</option></Select>
        <Select aria-label="Source" className="w-auto"><option>All sources</option></Select>
        <Input type="date" aria-label="From" defaultValue="2026-11-09" className="w-auto" />
        <span className="text-sm text-ink-muted">to</span>
        <Input type="date" aria-label="To" defaultValue="2026-11-15" className="w-auto" />
      </Toolbar>
      <Table label="Appointments" footer={<Pagination summary="Showing 1–10 of 61 this week" />}>
        <thead><tr><Th>When</Th><Th>Patient</Th><Th>Doctor</Th><Th>Source</Th><Th>Status</Th><Th>Reference</Th></tr></thead>
        <tbody>
          {APPOINTMENTS.map((a) => (
            <Tr key={a.ref}>
              <Td className="whitespace-nowrap tabular-nums">{a.when} · {a.time}</Td>
              <Td><a href={href("/admin/appointments/detail")} className="font-medium hover:underline">{a.patient}</a></Td>
              <Td><p>{a.doctor}</p><p className="text-xs text-ink-muted">{a.department}</p></Td>
              <Td className="text-ink-secondary">{a.source}</Td>
              <Td><StatusBadge status={a.status} /></Td>
              <Td className="font-mono text-xs text-ink-muted">{a.ref}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </StaffShell>
  );
}

/** /admin/appointments/[id] — contact details, who created and confirmed it, audit timeline. */
export function AdminAppointmentDetailScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/appointments" crumbs={[admin, { label: "Appointments", href: href("/admin/appointments") }, { label: "REQ-7F3A-2210" }]}>
      <PageHeader
        title="Juan Dela Cruz"
        badges={<StatusBadge status="requested" />}
        lead="Pediatrics with Dr. Ana Reyes · Mon, Nov 9, 2026 · 9:30 – 10:00 AM (Asia/Manila)"
        aside={<span className="font-mono text-xs text-ink-muted">REQ-7F3A-2210</span>}
      />
      <Alert tone="info">Admins can only view appointments. Confirm, reschedule or cancel from the <a href={href("/front-desk/requests/detail")} className="font-medium underline underline-offset-4">front desk request</a>.</Alert>
      <SplitLayout
        main={
          <>
            <Card>
              <CardHeader title="Appointment" />
              <DetailList items={[["Doctor", "Dr. Ana Reyes"], ["Department", "Pediatrics"], ["Scheduled", "Mon, Nov 9, 2026 · 9:30 – 10:00 AM"], ["Source", "Chat (CamiConnect)"], ["Created by", "Juan Dela Cruz (patient) · Nov 7, 2:14 PM"], ["Confirmed by", "—"]]} />
            </Card>
            <Card>
              <CardHeader title="Patient" />
              <DetailList items={[["Name", "Juan Dela Cruz"], ["Phone", "0917 000 0000"], ["Email", "juan.delacruz@example.com"]]} />
            </Card>
            <Card>
              <CardHeader title="Patient-provided information" />
              <DetailList items={[["Reason", "Cough for about a week"]]} />
              <p className="mt-3 text-xs text-ink-muted">Chat transcripts are not shared with staff.</p>
            </Card>
          </>
        }
        side={
          <Card>
            <CardHeader title="Status history" description="Oldest first" />
            <Timeline steps={[{ title: "Created · Pending confirmation", meta: "Nov 7 · 2:14 PM · Juan Dela Cruz (patient)", done: true }, { title: "Waiting for front desk", meta: "Pending", done: false }]} />
          </Card>
        }
      />
    </StaffShell>
  );
}

/** /admin/users — ADM-01. */
export function AdminUsersScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/users" crumbs={[admin, { label: "Users" }]} actions={<LinkButton size="sm" href={href("/admin/users/new")}><Plus aria-hidden />Invite staff</LinkButton>}>
      <PageHeader title="Users" lead="Staff and patient accounts. Roles decide which workspace each person sees." />
      <Toolbar>
        <SearchInput label="Search users" placeholder="Name or email" className="flex-1" />
        <Segmented label="Role" options={["All", "Admin", "Front desk", "Doctor", "Patient"]} />
        <Select aria-label="Status" className="w-auto"><option>Any status</option></Select>
      </Toolbar>
      <Table label="Users" footer={<Pagination summary="Showing 1–7 of 312" />}>
        <thead><tr><Th>Name</Th><Th>Role</Th><Th>Status</Th><Th>Last active</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
        <tbody>
          {USERS.map((u) => (
            <Tr key={u.email}>
              <Td><div className="flex items-center gap-3"><Avatar initials={u.initials} /><div><a href={href("/admin/users/detail")} className="font-medium hover:underline">{u.name}</a><p className="text-xs text-ink-muted">{u.email}</p></div></div></Td>
              <Td className="text-ink-secondary">{u.role}</Td>
              <Td><ActiveBadge active={u.active} inactiveLabel="Deactivated" /></Td>
              <Td className="text-ink-secondary tabular-nums">{u.last}</Td>
              <Td className="text-right"><LinkButton variant="ghost" size="sm" href={href("/admin/users/detail")}>Manage</LinkButton></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </StaffShell>
  );
}

/** /admin/users/new — staff invite; the email lands on /auth/confirm → /account/password. */
export function AdminUserInviteScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/users" crumbs={[admin, { label: "Users", href: href("/admin/users") }, { label: "Invite staff" }]}>
      <PageHeader title="Invite staff" lead="They get an email link to set their password." />
      <form className="flex max-w-[880px] flex-col gap-6">
        <Fieldset legend="Person">
          <FieldGrid>
            <Field label="Full name" htmlFor="n"><Input id="n" defaultValue="Lea Tan" /></Field>
            <Field label="Work email" htmlFor="e"><Input id="e" type="email" defaultValue="lea.tan@stcamillus.example" /></Field>
          </FieldGrid>
        </Fieldset>
        <Fieldset legend="Role">
          <div className="flex flex-col gap-2.5">
            <ChoiceCard name="role" checked title="Front desk" description="Confirms requests, books walk-ins, checks patients in." />
            <ChoiceCard name="role" title="Doctor" description="Sees their own schedule and appointments. Link to a doctor profile after inviting." />
            <ChoiceCard name="role" title="Admin" description="Full access, including users, settings and the audit log." />
          </div>
        </Fieldset>
        <FormFooter>
          <LinkButton variant="ghost" size="sm" href={href("/admin/users")}>Cancel</LinkButton>
          <Button size="sm" type="submit"><Mail aria-hidden />Send invite</Button>
        </FormFooter>
      </form>
    </StaffShell>
  );
}

/** /admin/users/[id] — profile, role, status, password reset, activity. */
export function AdminUserDetailScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/users" crumbs={[admin, { label: "Users", href: href("/admin/users") }, { label: "Rosa Garcia" }]}>
      <div className="flex items-center gap-4">
        <Avatar initials="RG" size="lg" />
        <PageHeader title="Rosa Garcia" badges={<ActiveBadge active />} lead="Front desk · rosa.garcia@stcamillus.example" />
      </div>
      <SplitLayout
        main={
          <>
            <Card>
              <CardHeader title="Profile" />
              <FieldGrid>
                <Field label="Full name" htmlFor="fn"><Input id="fn" defaultValue="Rosa Garcia" /></Field>
                <Field label="Phone" htmlFor="ph"><Input id="ph" defaultValue="0918 000 0000" /></Field>
              </FieldGrid>
              <FormFooter><Button size="sm">Save profile</Button></FormFooter>
            </Card>
            <Card>
              <CardHeader title="Role" description="Changing a role signs the person out of their current workspace." />
              <Field label="Role" htmlFor="role"><Select id="role" className="max-w-80"><option>Front desk</option><option>Doctor</option><option>Admin</option><option>Patient</option></Select></Field>
              <FormFooter><Button variant="outline" size="sm">Change role</Button></FormFooter>
            </Card>
            <Card className="border-danger/30">
              <CardHeader title="Access" />
              <ListRows>
                <ListRow><div className="flex-1"><p className="text-sm font-medium">Send password reset</p><p className="text-xs text-ink-muted">Emails a link to set a new password</p></div><Button variant="outline" size="sm">Send reset link</Button></ListRow>
                <ListRow><div className="flex-1"><p className="text-sm font-medium">Deactivate account</p><p className="text-xs text-ink-muted">Blocks sign-in. History stays in the audit log.</p></div><Button variant="outlineDanger" size="sm">Deactivate</Button></ListRow>
              </ListRows>
            </Card>
          </>
        }
        side={
          <Card>
            <CardHeader title="Recent activity" action={<LinkButton variant="ghost" size="sm" href={href("/admin/audit-log")}>Audit log</LinkButton>} />
            <Timeline steps={[
              { title: "Confirmed APT-91C2-0418", meta: "Nov 7 · 9:42 AM", done: true },
              { title: "Checked in Celia Ramos", meta: "Nov 6 · 8:52 AM", done: true },
              { title: "Rejected REQ-6A02-1180", meta: "Nov 6 · 4:10 PM", done: true },
            ]} />
          </Card>
        }
      />
    </StaffShell>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** /admin/schedules — every doctor's weekly hours, filterable by department (ADM-05). */
export function AdminSchedulesScreen() {
  const hours: Record<string, string[]> = {
    "Dr. Ana Reyes": ["8–12, 1–4", "1–4", "8–12", "8–12, 1–3", "8–12, 1–4", "8–11", ""],
    "Dr. Paolo Mendoza": ["", "1–5", "1–5", "", "1–5", "", ""],
    "Dr. Carlo Villanueva": ["1–5", "8–12", "1–5", "8–12", "1–5", "", ""],
    "Dr. Grace Lim": ["8–12", "8–12", "", "8–12", "8–12", "8–10", ""],
    "Dr. Rico Salazar": ["", "", "", "", "", "", ""],
  };
  return (
    <StaffShell workspace="admin" active="/admin/schedules" crumbs={[admin, { label: "Schedules" }]} actions={<LinkButton variant="outline" size="sm" href={href("/admin/schedules/exceptions")}>Exceptions and holidays</LinkButton>}>
      <PageHeader title="Schedules" lead="Weekly clinic hours per doctor. Cami offers only times inside these hours." aside={<Select aria-label="Department" className="w-auto"><option>All departments</option></Select>} />
      <Alert tone="warning" title="1 active doctor has no hours">Dr. Rico Salazar can't be booked in chat until a schedule period is added.</Alert>
      <Table label="Weekly hours">
        <thead><tr><Th>Doctor</Th>{DAYS.map((d) => <Th key={d}>{d}</Th>)}<Th><span className="sr-only">Edit</span></Th></tr></thead>
        <tbody>
          {Object.entries(hours).map(([name, week]) => {
            const doc = DOCTORS.find((d) => d.name === name);
            return (
              <Tr key={name}>
                <Td><p className="font-medium">{name}</p><p className="text-xs text-ink-muted">{doc?.department}</p></Td>
                {week.map((h, i) => (
                  <Td key={i}>{h ? <span className="whitespace-nowrap rounded-md bg-primary-soft px-2 py-0.5 text-xs text-primary-hover tabular-nums">{h}</span> : <span className="text-xs text-ink-muted">—</span>}</Td>
                ))}
                <Td className="text-right"><LinkButton variant="ghost" size="sm" href={href("/admin/doctors/detail")}>Edit</LinkButton></Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </StaffShell>
  );
}

/** /admin/schedules/exceptions — hospital-wide holidays (doctor_id null, type holiday). */
export function AdminScheduleExceptionsScreen() {
  const rows: [string, string, string, string][] = [
    ["All doctors", "Mon, Nov 30", "Holiday", "Bonifacio Day"],
    ["All doctors", "Tue, Dec 8", "Holiday", "Feast of the Immaculate Conception"],
    ["All doctors", "Dec 24 – 25", "Holiday", "Christmas"],
  ];
  return (
    <StaffShell workspace="admin" active="/admin/schedules" crumbs={[admin, { label: "Schedules", href: href("/admin/schedules") }, { label: "Exceptions" }]}>
      <PageHeader title="Holidays and exceptions" lead="Hospital-wide closures apply to every doctor. Doctor leave is added from each doctor's Schedule tab." />
      <SplitLayout
        main={
          <Table label="Hospital holidays">
            <thead><tr><Th>Applies to</Th><Th>When</Th><Th>Type</Th><Th>Note</Th><Th><span className="sr-only">Remove</span></Th></tr></thead>
            <tbody>
              {rows.map(([who, when, type, note]) => (
                <Tr key={when}>
                  <Td>{who}</Td><Td className="tabular-nums">{when}</Td><Td><Badge>{type}</Badge></Td><Td className="text-ink-secondary">{note}</Td>
                  <Td className="text-right"><Button variant="ghost" size="sm" aria-label={`Remove ${note}`}><Trash2 aria-hidden /></Button></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        }
        side={
          <Card>
            <CardHeader title="Add holiday" />
            <form className="flex flex-col gap-4">
              <FieldGrid className="sm:grid-cols-2">
                <Field label="From" htmlFor="f"><Input id="f" type="date" defaultValue="2026-12-30" /></Field>
                <Field label="To" htmlFor="t"><Input id="t" type="date" defaultValue="2026-12-31" /></Field>
              </FieldGrid>
              <Checkbox defaultChecked label="Whole day" />
              <Field label="Note" htmlFor="note"><Input id="note" defaultValue="Rizal Day and New Year's Eve" /></Field>
              <Alert tone="warning">An exception that covers a booked appointment is refused. Nothing is moved automatically.</Alert>
              <Button size="sm" type="submit">Add holiday</Button>
            </form>
          </Card>
        }
      />
    </StaffShell>
  );
}
