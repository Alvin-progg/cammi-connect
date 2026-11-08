import { CopyPlus, Plus, Sparkles } from "lucide-react";

import { PageHeader, SplitLayout, StaffShell } from "@/components/shell/staff-shell";
import { ActiveBadge, Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert, ListRow, ListRows, Table, Td, Th, Timeline, Tr } from "@/components/ui/data";
import { Checkbox, ChoiceCard, Field, FieldGrid, Fieldset, FormFooter, Input, Select, Textarea } from "@/components/ui/field";
import { SearchInput, Segmented, Tabs, Toolbar } from "@/components/ui/navigation";
import { href } from "@/lib/routes";
import { REQUIREMENTS, SERVICES, type RequirementStatus } from "@/mock/data";

const admin = { label: "Admin", href: href("/admin") };

/* -------------------------------------------------------------- services */

/** /admin/services — ADM-07. Services are informational (no scheduling) and admin-only for now. */
export function AdminServicesScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/services" crumbs={[admin, { label: "Services" }]} actions={<LinkButton size="sm" href={href("/admin/services/new")}><Plus aria-hidden />New service</LinkButton>}>
      <PageHeader title="Services" lead="What the hospital offers. Patients and Cami see them once they're published as knowledge documents." />
      <Toolbar>
        <SearchInput label="Search services" placeholder="Search services" className="flex-1" />
        <Select aria-label="Department" className="w-auto"><option>All departments</option></Select>
        <Segmented label="Status" options={["All", "Active", "Inactive"]} />
      </Toolbar>
      <Table label="Services">
        <thead><tr><Th>Service</Th><Th>Department</Th><Th>How patients access it</Th><Th>Requirements</Th><Th>Status</Th></tr></thead>
        <tbody>
          {SERVICES.map((s) => (
            <Tr key={s.name}>
              <Td><a href={href("/admin/services/detail")} className="font-medium hover:underline">{s.name}</a></Td>
              <Td className="text-ink-secondary">{s.department}</Td>
              <Td className="text-ink-secondary">{s.access}</Td>
              <Td className="tabular-nums">{s.requirements}</Td>
              <Td><ActiveBadge active={s.active} /></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </StaffShell>
  );
}

function ServiceFields({ filled }: { filled?: boolean }) {
  return (
    <>
      <FieldGrid>
        <Field label="Name" htmlFor="sn"><Input id="sn" defaultValue={filled ? "Ultrasound" : ""} placeholder="e.g. Ultrasound" /></Field>
        <Field label="Department" htmlFor="sd"><Select id="sd"><option>Radiology</option></Select></Field>
        <Field label="Description" htmlFor="sdesc" className="sm:col-span-2"><Textarea id="sdesc" defaultValue={filled ? "Imaging using sound waves for pregnancy, abdomen and other checks." : ""} /></Field>
      </FieldGrid>
      <div role="radiogroup" aria-label="How patients access it" className="flex flex-col gap-2.5">
        <p className="text-sm font-medium">How patients access it</p>
        <ChoiceCard name="mode" checked title="Appointment required" description="Patients request a time with a doctor." />
        <ChoiceCard name="mode" title="Walk-in" description="Patients come during service hours." />
        <ChoiceCard name="mode" title="Walk-in with a doctor's request" description="Patients bring the request form." />
      </div>
    </>
  );
}

export function AdminServiceNewScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/services" crumbs={[admin, { label: "Services", href: href("/admin/services") }, { label: "New" }]}>
      <PageHeader title="New service" lead="Add requirements after it's created." />
      <form className="flex max-w-[880px] flex-col gap-6">
        <Fieldset legend="Details"><ServiceFields /></Fieldset>
        <FormFooter><LinkButton variant="ghost" size="sm" href={href("/admin/services")}>Cancel</LinkButton><Button size="sm" type="submit">Create service</Button></FormFooter>
      </form>
    </StaffShell>
  );
}

export function AdminServiceDetailScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/services" crumbs={[admin, { label: "Services", href: href("/admin/services") }, { label: "Ultrasound" }]}>
      <PageHeader title="Ultrasound" badges={<ActiveBadge active />} lead="Radiology · Appointment required" />
      <SplitLayout
        main={
          <>
            <Card><CardHeader title="Details" /><div className="flex flex-col gap-4"><ServiceFields filled /></div><FormFooter><Button variant="ghost" size="sm">Discard</Button><Button size="sm">Save changes</Button></FormFooter></Card>
            <Card>
              <CardHeader title="Requirements" action={<LinkButton variant="outline" size="sm" href={href("/admin/requirements/new")}>Add requirement</LinkButton>} />
              <ListRows>
                <ListRow><div className="flex-1"><p className="text-sm font-medium">Doctor's request form</p><p className="text-xs text-ink-muted">Mandatory · since Oct 1, 2026</p></div><Badge tone="info">Published</Badge></ListRow>
                <ListRow><div className="flex-1"><p className="text-sm font-medium">Full bladder for pelvic scans</p><p className="text-xs text-ink-muted">Recommended · since Oct 1, 2026</p></div><Badge tone="info">Published</Badge></ListRow>
              </ListRows>
            </Card>
          </>
        }
        side={
          <>
            <Card>
              <CardHeader title="Cami AI" />
              <p className="text-sm text-ink-secondary">Services reach patients through knowledge documents. Publishing straight to Cami isn't available yet.</p>
              <Button size="sm" className="mt-3 w-full" disabled><Sparkles aria-hidden />Publish to Cami AI</Button>
            </Card>
            <Card className="border-danger/30"><CardHeader title="Status" /><Button variant="outlineDanger" size="sm">Deactivate service</Button></Card>
          </>
        }
      />
    </StaffShell>
  );
}

/* ---------------------------------------------------------- requirements */

const REQ_TONE: Record<RequirementStatus, "info" | "neutral"> = { published: "info", draft: "neutral", archived: "neutral" };

/** /admin/requirements — ADM-08: grouped by service or specialty; draft → published → archived. */
export function AdminRequirementsScreen() {
  const groups = [...new Set(REQUIREMENTS.map((r) => `${r.kind} · ${r.appliesTo}`))];
  return (
    <StaffShell workspace="admin" active="/admin/requirements" crumbs={[admin, { label: "Requirements" }]} actions={<LinkButton size="sm" href={href("/admin/requirements/new")}><Plus aria-hidden />New requirement</LinkButton>}>
      <PageHeader title="Requirements" lead="What patients must bring or do before a service or specialty visit." />
      <Toolbar>
        <Tabs label="Kind" items={[{ value: "all", label: "All" }, { value: "service", label: "Services" }, { value: "specialty", label: "Specialties" }]} />
        <Segmented label="Status" options={["All", "Draft", "Published", "Archived"]} />
      </Toolbar>
      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g} aria-label={g}>
            <h2 className="mb-2.5 text-sm font-semibold text-ink-secondary">{g}</h2>
            <Table label={g}>
              <thead><tr><Th>Requirement</Th><Th>Type</Th><Th>Effective (Asia/Manila)</Th><Th>Status</Th></tr></thead>
              <tbody>
                {REQUIREMENTS.filter((r) => `${r.kind} · ${r.appliesTo}` === g).map((r) => (
                  <Tr key={r.title}>
                    <Td><a href={href("/admin/requirements/detail")} className="font-medium hover:underline">{r.title}</a></Td>
                    <Td className="text-ink-secondary">{r.mandatory ? "Mandatory" : "Recommended"}</Td>
                    <Td className="text-ink-secondary tabular-nums">{r.effective}</Td>
                    <Td><Badge tone={REQ_TONE[r.status]}>{r.status[0].toUpperCase() + r.status.slice(1)}</Badge></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </section>
        ))}
      </div>
    </StaffShell>
  );
}

function RequirementFields({ filled }: { filled?: boolean }) {
  return (
    <>
      <Field label="Title" htmlFor="rt"><Input id="rt" defaultValue={filled ? "8–10 hour fasting" : ""} /></Field>
      <Field label="Description" htmlFor="rd"><Textarea id="rd" defaultValue={filled ? "No food or drinks except water for 8 to 10 hours before your blood test." : ""} /></Field>
      <Checkbox defaultChecked label="Mandatory" hint="Unchecked shows as recommended." />
      <FieldGrid>
        <Field label="Applies to" htmlFor="target"><Select id="target"><option>Service · Laboratory</option><option>Specialty · General pediatrics</option></Select></Field>
        <div />
        <Field label="Effective from" htmlFor="ef"><Input id="ef" type="date" defaultValue="2026-11-15" /></Field>
        <Field label="Effective until (optional)" htmlFor="eu"><Input id="eu" type="date" /></Field>
      </FieldGrid>
    </>
  );
}

export function AdminRequirementNewScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/requirements" crumbs={[admin, { label: "Requirements", href: href("/admin/requirements") }, { label: "New" }]}>
      <PageHeader title="New requirement" lead="Saved as a draft. Write it the way a patient should read it." />
      <form className="flex max-w-[880px] flex-col gap-6">
        <Fieldset legend="Requirement"><RequirementFields /></Fieldset>
        <FormFooter><LinkButton variant="ghost" size="sm" href={href("/admin/requirements")}>Cancel</LinkButton><Button size="sm" type="submit">Save draft</Button></FormFooter>
      </form>
    </StaffShell>
  );
}

/** Draft shown: editable, can be published. A published one is read-only with Supersede. */
export function AdminRequirementDetailScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/requirements" crumbs={[admin, { label: "Requirements", href: href("/admin/requirements") }, { label: "8–10 hour fasting" }]}>
      <PageHeader title="8–10 hour fasting" badges={<><Badge>Draft</Badge><Badge tone="outline">Mandatory</Badge></>} lead="Service · Laboratory · from Nov 15, 2026" />
      <SplitLayout
        main={<Card><CardHeader title="Details" description="Only drafts can be edited." /><div className="flex flex-col gap-4"><RequirementFields filled /></div><FormFooter><Button variant="ghost" size="sm">Discard</Button><Button variant="outline" size="sm">Save draft</Button><Button size="sm">Publish</Button></FormFooter></Card>}
        side={
          <>
            <Alert tone="info" title="Replaces a published rule">“Old fasting rule (8 hours)” ends Nov 14 when this is published.</Alert>
            <Card>
              <CardHeader title="Lifecycle" />
              <Timeline steps={[{ title: "Draft created by Supersede", meta: "Nov 6 · Maria Santos", done: true }, { title: "Published", meta: "Not yet", done: false }, { title: "Archived", meta: "—", done: false }]} />
              <Button variant="outline" size="sm" className="mt-4" disabled><CopyPlus aria-hidden />Supersede</Button>
              <p className="mt-1.5 text-xs text-ink-muted">Available once published. Supersede ends this version and opens a new draft.</p>
            </Card>
          </>
        }
      />
    </StaffShell>
  );
}
