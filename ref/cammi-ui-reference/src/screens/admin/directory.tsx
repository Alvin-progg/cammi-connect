import { Plus } from "lucide-react";
import type { ReactNode } from "react";

import { PageHeader, SplitLayout, StaffShell } from "@/components/shell/staff-shell";
import { ActiveBadge, Badge, StatusBadge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Avatar, Card, CardHeader } from "@/components/ui/card";
import { Alert, ListRow, ListRows, Pagination, Table, Td, Th, Tr } from "@/components/ui/data";
import { Field, FieldGrid, Fieldset, FormFooter, Input, Select, Textarea } from "@/components/ui/field";
import { SearchInput, Segmented, Tabs, Toolbar } from "@/components/ui/navigation";
import { href } from "@/lib/routes";
import { APPOINTMENTS, DEPARTMENTS, DOCTORS, SPECIALTIES } from "@/mock/data";

const admin = { label: "Admin", href: href("/admin") };

/** Danger zone card used by every directory detail page. */
function StatusCard({ what, consequence, blocked }: { what: string; consequence: string; blocked?: string }) {
  return (
    <Card className="border-danger/30">
      <CardHeader title="Status" />
      <p className="text-sm text-ink-secondary">{consequence}</p>
      {blocked ? <Alert tone="warning" className="mt-3">{blocked}</Alert> : null}
      <Button variant="outlineDanger" size="sm" className="mt-3" disabled={Boolean(blocked)}>
        Deactivate {what}
      </Button>
    </Card>
  );
}

function NewForm({ title, lead, back, children, submit }: { title: string; lead: string; back: string; children: ReactNode; submit: string }) {
  return (
    <>
      <PageHeader title={title} lead={lead} />
      <form className="flex max-w-[880px] flex-col gap-6">
        {children}
        <FormFooter>
          <LinkButton variant="ghost" size="sm" href={href(back)}>Cancel</LinkButton>
          <Button size="sm" type="submit">{submit}</Button>
        </FormFooter>
      </form>
    </>
  );
}

/* ----------------------------------------------------------- departments */

export function AdminDepartmentsScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/departments" crumbs={[admin, { label: "Departments" }]} actions={<LinkButton size="sm" href={href("/admin/departments/new")}><Plus aria-hidden />New department</LinkButton>}>
      <PageHeader title="Departments" lead="Group doctors and services. Inactive departments are hidden from patients." />
      <Toolbar>
        <SearchInput label="Search departments" placeholder="Search departments" className="max-w-90" />
        <Segmented label="Status" options={["All", "Active", "Inactive"]} />
      </Toolbar>
      <Table label="Departments">
        <thead><tr><Th>Department</Th><Th>Code</Th><Th>Doctors</Th><Th>Appointments, 30 days</Th><Th>Status</Th></tr></thead>
        <tbody>
          {DEPARTMENTS.map((d) => (
            <Tr key={d.code}>
              <Td><a href={href("/admin/departments/detail")} className="font-medium hover:underline">{d.name}</a></Td>
              <Td className="font-mono text-xs">{d.code}</Td>
              <Td className="tabular-nums">{d.doctors}</Td>
              <Td className="tabular-nums">{d.appointments30d}</Td>
              <Td><ActiveBadge active={d.active} /></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </StaffShell>
  );
}

function DepartmentFields({ filled }: { filled?: boolean }) {
  return (
    <FieldGrid>
      <Field label="Name" htmlFor="dn"><Input id="dn" defaultValue={filled ? "Pediatrics" : ""} placeholder="e.g. Pediatrics" /></Field>
      <Field label="Code" htmlFor="dc" hint="Short code shown on records."><Input id="dc" defaultValue={filled ? "PED" : ""} placeholder="e.g. PED" /></Field>
      <Field label="Description" htmlFor="dd" className="sm:col-span-2" hint="Plain language. Patients may see this.">
        <Textarea id="dd" defaultValue={filled ? "Care for infants, children and teens, from check-ups and vaccines to illness visits." : ""} />
      </Field>
    </FieldGrid>
  );
}

export function AdminDepartmentNewScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/departments" crumbs={[admin, { label: "Departments", href: href("/admin/departments") }, { label: "New" }]}>
      <NewForm title="New department" lead="Add doctors and services to it after it's created." back="/admin/departments" submit="Create department">
        <Fieldset legend="Details"><DepartmentFields /></Fieldset>
      </NewForm>
    </StaffShell>
  );
}

export function AdminDepartmentDetailScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/departments" crumbs={[admin, { label: "Departments", href: href("/admin/departments") }, { label: "Pediatrics" }]}>
      <PageHeader title="Pediatrics" badges={<ActiveBadge active />} lead="4 doctors · 168 appointments in the last 30 days" />
      <SplitLayout
        main={
          <Card>
            <CardHeader title="Details" />
            <DepartmentFields filled />
            <FormFooter><Button variant="ghost" size="sm">Discard</Button><Button size="sm">Save changes</Button></FormFooter>
          </Card>
        }
        side={
          <>
            <Card>
              <CardHeader title="Doctors" description="4 in this department" />
              <ListRows>
                {DOCTORS.filter((d) => d.department === "Pediatrics").map((d) => (
                  <ListRow key={d.id}><Avatar initials={d.initials} /><a href={href("/admin/doctors/detail")} className="flex-1 text-sm hover:underline">{d.name}</a><ActiveBadge active={d.active} /></ListRow>
                ))}
              </ListRows>
            </Card>
            <StatusCard what="department" consequence="Deactivating hides Pediatrics, its doctors and its services from patients." blocked="Can't deactivate while the department has upcoming pending or confirmed appointments (12)." />
          </>
        }
      />
    </StaffShell>
  );
}

/* ----------------------------------------------------------- specialties */

export function AdminSpecialtiesScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/specialties" crumbs={[admin, { label: "Specialties" }]} actions={<LinkButton size="sm" href={href("/admin/specialties/new")}><Plus aria-hidden />New specialty</LinkButton>}>
      <PageHeader title="Specialties" lead="What patients pick first when they book in chat. A doctor can have several." />
      <Toolbar>
        <SearchInput label="Search specialties" placeholder="Search specialties" className="max-w-90" />
        <Segmented label="Status" options={["All", "Active", "Inactive"]} />
      </Toolbar>
      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
        {SPECIALTIES.map((s) => (
          <li key={s.name}>
            <a href={href("/admin/specialties/detail")} className="focus-ring flex h-full flex-col gap-2 rounded-xl border border-line bg-surface p-5 shadow-soft transition-colors hover:border-line-strong">
              <div className="flex items-start justify-between gap-2"><p className="font-semibold">{s.name}</p><ActiveBadge active={s.active} /></div>
              <p className="flex-1 text-sm text-ink-secondary">{s.description}</p>
              <p className="text-xs text-ink-muted tabular-nums">{s.doctors} doctors</p>
            </a>
          </li>
        ))}
      </ul>
    </StaffShell>
  );
}

function SpecialtyFields({ filled }: { filled?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Name" htmlFor="sn"><Input id="sn" defaultValue={filled ? "General pediatrics" : "Pediatric cardiology"} /></Field>
      <Field label="Description" htmlFor="sd" hint="One sentence on what this specialty treats."><Textarea id="sd" defaultValue={filled ? "Check-ups, vaccines and illness visits for children." : ""} /></Field>
    </div>
  );
}

export function AdminSpecialtyNewScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/specialties" crumbs={[admin, { label: "Specialties", href: href("/admin/specialties") }, { label: "New" }]}>
      <NewForm title="New specialty" lead="Assign doctors to it from each doctor's profile." back="/admin/specialties" submit="Create specialty">
        <Fieldset legend="Details"><SpecialtyFields /></Fieldset>
        <Card className="bg-surface-muted shadow-none">
          <p className="text-xs text-ink-muted">Preview in chat</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <span className="inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3 text-sm">General pediatrics</span>
            <span className="inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3 text-sm">Pediatric pulmonology</span>
            <span className="inline-flex h-9 items-center rounded-md border-2 border-primary bg-surface px-3 text-sm">Pediatric cardiology</span>
          </div>
        </Card>
      </NewForm>
    </StaffShell>
  );
}

export function AdminSpecialtyDetailScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/specialties" crumbs={[admin, { label: "Specialties", href: href("/admin/specialties") }, { label: "General pediatrics" }]}>
      <PageHeader title="General pediatrics" badges={<ActiveBadge active />} />
      <SplitLayout
        main={<Card><CardHeader title="Details" /><SpecialtyFields filled /><FormFooter><Button variant="ghost" size="sm">Discard</Button><Button size="sm">Save changes</Button></FormFooter></Card>}
        side={
          <>
            <Card>
              <CardHeader title="Doctors with this specialty" />
              <ListRows>
                {DOCTORS.filter((d) => d.specialties.includes("General pediatrics")).map((d) => (
                  <ListRow key={d.id}><Avatar initials={d.initials} /><div className="flex-1"><p className="text-sm">{d.name}</p><p className="text-xs text-ink-muted">{d.department}{d.active ? "" : " · inactive"}</p></div><LinkButton variant="ghost" size="sm" href={href("/admin/doctors/detail")}>Open</LinkButton></ListRow>
                ))}
              </ListRows>
            </Card>
            <StatusCard what="specialty" consequence="Deactivating only hides it from patients. Doctors keep their other specialties." />
          </>
        }
      />
    </StaffShell>
  );
}

/* --------------------------------------------------------------- doctors */

export function AdminDoctorsScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/doctors" crumbs={[admin, { label: "Doctors" }]} actions={<LinkButton size="sm" href={href("/admin/doctors/new")}><Plus aria-hidden />New doctor</LinkButton>}>
      <PageHeader title="Doctors" lead="Profiles patients see in chat. A doctor needs weekly hours to be bookable." />
      <Toolbar>
        <SearchInput label="Search doctors" placeholder="Search by name" className="flex-1" />
        <Select aria-label="Department" className="w-auto"><option>All departments</option></Select>
        <Select aria-label="Specialty" className="w-auto"><option>All specialties</option></Select>
        <Segmented label="Status" options={["All", "Active", "Inactive"]} />
      </Toolbar>
      <Table label="Doctors" footer={<Pagination summary="6 of 24 doctors" />}>
        <thead><tr><Th>Doctor</Th><Th>Department</Th><Th>Specialties</Th><Th>Next open slot</Th><Th>Account</Th><Th>Status</Th></tr></thead>
        <tbody>
          {DOCTORS.map((d) => (
            <Tr key={d.id}>
              <Td><div className="flex items-center gap-3"><Avatar initials={d.initials} /><a href={href("/admin/doctors/detail")} className="font-medium hover:underline">{d.name}</a></div></Td>
              <Td className="text-ink-secondary">{d.department}</Td>
              <Td className="text-[13px] text-ink-secondary">{d.specialties.join(", ")}</Td>
              <Td className="tabular-nums">{d.nextOpen}</Td>
              <Td className="text-[13px] text-ink-secondary">{d.linked ? "Linked" : "Not linked"}</Td>
              <Td>{!d.active ? <ActiveBadge active={false} /> : d.hasHours ? <ActiveBadge active activeLabel="Bookable" /> : <Badge tone="warning">Needs hours</Badge>}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </StaffShell>
  );
}

function DoctorProfileFields({ filled }: { filled?: boolean }) {
  return (
    <FieldGrid>
      <Field label="Full name" htmlFor="fn" className="sm:col-span-2"><Input id="fn" defaultValue={filled ? "Dr. Ana Reyes" : ""} placeholder="Dr. First Last" /></Field>
      <Field label="Department" htmlFor="dep"><Select id="dep"><option>Pediatrics</option></Select></Field>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span id="spec" className="text-sm font-medium">Specialties</span>
        <div role="group" aria-labelledby="spec" className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-control-line px-2 py-1.5 shadow-soft">
          <Badge tone="info">General pediatrics ×</Badge>
          <span className="text-xs text-ink-muted">Add…</span>
        </div>
      </div>
      <Field label="Bio" htmlFor="bio" className="sm:col-span-2" hint="Admin-only for now."><Textarea id="bio" defaultValue={filled ? "Pediatrician focused on newborn care, vaccines and common childhood illness." : ""} /></Field>
      <Field label="Contact email" htmlFor="ce"><Input id="ce" type="email" defaultValue={filled ? "ana.reyes@stcamillus.example" : ""} /></Field>
      <Field label="Contact phone" htmlFor="cp"><Input id="cp" defaultValue={filled ? "0917 333 0000" : ""} /></Field>
    </FieldGrid>
  );
}

export function AdminDoctorNewScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/doctors" crumbs={[admin, { label: "Doctors", href: href("/admin/doctors") }, { label: "New" }]}>
      <NewForm title="New doctor" lead="Add the profile now, then set weekly hours on the Schedule tab." back="/admin/doctors" submit="Create doctor">
        <Fieldset legend="Profile"><DoctorProfileFields /></Fieldset>
        <Fieldset legend="Account" description="Link an unlinked Doctor-role user so they can sign in to the doctor workspace.">
          <Field label="Linked account" htmlFor="acct"><Select id="acct"><option>Not linked yet</option></Select></Field>
        </Fieldset>
      </NewForm>
    </StaffShell>
  );
}

const WEEK_OPEN: number[][] = [[8, 9, 10, 11, 13, 14, 15], [13, 14, 15], [8, 9, 10, 11], [8, 9, 10, 11, 13, 14], [8, 9, 10, 11, 13, 14, 15], [8, 9, 10], []];

/** /admin/doctors/[id] — tabs Profile, Schedule, Appointments (Schedule shown). */
export function AdminDoctorDetailScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/doctors" crumbs={[admin, { label: "Doctors", href: href("/admin/doctors") }, { label: "Dr. Ana Reyes" }]} actions={<Button variant="outlineDanger" size="sm">Deactivate</Button>}>
      <div className="flex items-center gap-4">
        <Avatar initials="AR" size="lg" />
        <PageHeader title="Dr. Ana Reyes" badges={<ActiveBadge active activeLabel="Bookable" />} lead="Pediatrics · General pediatrics · account linked" />
      </div>
      <Tabs label="Doctor sections" defaultValue="schedule" items={[{ value: "profile", label: "Profile" }, { value: "schedule", label: "Schedule" }, { value: "appointments", label: "Appointments", count: 12 }]} />
      <SplitLayout
        main={
          <Card>
            <CardHeader title="Weekly hours" description="Effective Oct 1, 2026 – open-ended · 30-minute slots" action={<Button variant="outline" size="sm">Edit period</Button>} />
            <div className="overflow-x-auto">
              <div className="grid min-w-[560px] grid-cols-[56px_repeat(7,minmax(0,1fr))] gap-1.5">
                <span />
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d} className="text-center text-xs font-medium text-ink-muted">{d}</span>)}
                {[8, 9, 10, 11, 12, 13, 14, 15, 16].map((h) => (
                  <div key={h} className="contents">
                    <span className="pr-1.5 text-right text-[11px] text-ink-muted tabular-nums">{h > 12 ? h - 12 : h} {h >= 12 ? "PM" : "AM"}</span>
                    {WEEK_OPEN.map((open, d) => (
                      <span key={d} className={open.includes(h) ? "h-7 rounded-md border border-primary/30 bg-primary/15" : "h-7 rounded-md border border-line bg-surface-muted"} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-ink-secondary"><span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-[3px] border border-primary/30 bg-primary/15" />Clinic hours</span><span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-[3px] border border-line bg-surface-muted" />Not available</span></div>
            <p className="mt-2 text-xs text-ink-muted">Saving refuses an edit that would move an upcoming appointment outside these hours.</p>
          </Card>
        }
        side={
          <>
            <Card>
              <CardHeader title="Exceptions" action={<Button variant="ghost" size="sm">Add</Button>} />
              <ListRows>
                <ListRow><div className="flex-1"><p className="text-sm font-medium">Tue, Nov 10 · 8 AM – 12 PM</p><p className="text-xs text-ink-muted">Hospital rounds</p></div></ListRow>
                <ListRow><div className="flex-1"><p className="text-sm font-medium">Dec 24 – 26</p><p className="text-xs text-ink-muted">Leave</p></div></ListRow>
              </ListRows>
            </Card>
            <Card>
              <CardHeader title="Next appointments" />
              <ListRows>
                {APPOINTMENTS.filter((a) => a.doctor === "Dr. Ana Reyes").slice(0, 3).map((a) => (
                  <ListRow key={a.ref}><span className="w-16 text-xs text-ink-muted tabular-nums">{a.time}</span><span className="flex-1 text-sm">{a.patient}</span><StatusBadge status={a.status} /></ListRow>
                ))}
              </ListRows>
            </Card>
          </>
        }
      />
    </StaffShell>
  );
}
