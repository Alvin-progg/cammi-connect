import { Bell, Calendar } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ActiveBadge, Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, KpiCard } from "@/components/ui/card";
import { Alert, EmptyState, Table, Td, Th, Timeline, Tr } from "@/components/ui/data";
import { Checkbox, Field, FieldGrid, Input, Select, Textarea } from "@/components/ui/field";
import { Breadcrumb, SearchInput, Tabs, Toolbar } from "@/components/ui/navigation";
import { APPOINTMENT_STATUSES } from "@/lib/appointments/status";

export const metadata: Metadata = { title: "Component kit · CamiConnect", robots: { index: false } };

const TOKENS: [string, string, string][] = [
  ["canvas / surface", "#ffffff", "Page, cards, tables"],
  ["surface-muted", "#f3f7fe", "Panels, kanban columns"],
  ["ink", "#0f2342", "Text and headings"],
  ["ink-secondary", "#3b5275", "Supporting text"],
  ["ink-muted", "#587093", "Metadata on white"],
  ["line", "#e3eaf6", "Card and row borders"],
  ["line-strong", "#c9d6ec", "Hover, outline buttons"],
  ["control-line", "#7a8fb0", "Every input border (3:1)"],
  ["primary", "#1a62f2", "Actions, links, selection"],
  ["primary-soft", "#e9f1ff", "Selected rows, active nav"],
  ["accent", "#0369a1", "AI and information cues"],
  ["warning", "#92400e", "Pending confirmation"],
  ["success", "#166534", "Completed, saved"],
  ["danger", "#991b1b", "Errors, destructive"],
];

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={note} />
      {children}
    </Card>
  );
}

/** Development-only gallery of the redesign kit (not linked; 404 in production). */
export default function KitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const statuses = APPOINTMENT_STATUSES;
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 text-ink">
      <header>
        <p className="text-sm font-medium text-primary">CamiConnect redesign</p>
        <h1 className="text-3xl font-semibold tracking-tight">Component kit</h1>
        <p className="mt-1 max-w-2xl text-ink-secondary">shadcn/ui-style primitives themed with the Calm Care tokens. Every screen in this reference is built only from these.</p>
      </header>

      <Section title="Colour tokens" note="Values from src/app/globals.css. Use the token class (bg-primary, text-ink…), never raw hex.">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {TOKENS.map(([name, hex, use]) => (
            <li key={name} className="overflow-hidden rounded-lg border border-line">
              <div className="h-12 border-b border-line" style={{ background: hex }} />
              <div className="px-2.5 py-2">
                <p className="text-xs font-medium">{name}</p>
                <p className="font-mono text-[11px] text-ink-muted">{hex}</p>
                <p className="text-[11px] leading-4 text-ink-muted">{use}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Button" note="primary · secondary · outline · ghost · danger · outlineDanger · link; sm (36px staff) and md/lg (44px)">
          <div className="flex flex-wrap gap-2">
            <Button>Confirm booking</Button>
            <Button variant="secondary">Change time</Button>
            <Button variant="outline">Export CSV</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="danger">Reject request</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm">Small · 36px</Button>
            <Button variant="outlineDanger" size="sm">Deactivate</Button>
            <Button disabled aria-busy>Booking…</Button>
            <Button variant="outline" size="icon" aria-label="Notifications"><Bell aria-hidden /></Button>
            <Button variant="link">Text link</Button>
          </div>
        </Section>
        <Section title="Badge" note="One status map (matches APPOINTMENT_STATUS_LABELS) plus record states">
          <div className="flex flex-wrap gap-2">{statuses.map((s) => <StatusBadge key={s} status={s} />)}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActiveBadge isActive />
            <ActiveBadge isActive={false} />
            <Badge>Draft</Badge>
            <Badge tone="info">Published</Badge>
            <Badge tone="ai">AI-generated</Badge>
          </div>
        </Section>
        <Section title="Form controls" note="Input, Select, Textarea, Checkbox inside Field (label, hint or error)">
          <FieldGrid>
            <Field label="Department name" htmlFor="k1" hint="Shown to patients."><Input id="k1" defaultValue="Pediatrics" /></Field>
            <Field label="Email" htmlFor="k2" error="Enter a full email address." errorId="k2e"><Input id="k2" defaultValue="ana.reyes@" aria-invalid aria-describedby="k2e" /></Field>
            <Field label="Specialty" htmlFor="k3"><Select id="k3"><option>General pediatrics</option></Select></Field>
            <Field label="Reference" htmlFor="k4"><Input id="k4" defaultValue="REQ-7F3A-2210" disabled /></Field>
            <Field label="Notes" htmlFor="k5" className="sm:col-span-2"><Textarea id="k5" defaultValue="Patient asked for a morning slot." /></Field>
          </FieldGrid>
          <Checkbox className="mt-4" defaultChecked label="Visible in chat" hint="Patients can book this doctor through Cami." />
        </Section>
        <Section title="Navigation" note="Tabs, search, breadcrumb">
          <div className="flex flex-col gap-4">
            <Tabs label="Example" items={[{ value: "a", label: "Profile" }, { value: "b", label: "Schedule" }, { value: "c", label: "Appointments", count: 12 }]} />
            <Toolbar><SearchInput label="Search" placeholder="Search doctors" shortcut="/" /></Toolbar>
            <Breadcrumb items={[{ label: "Admin", href: "#" }, { label: "Doctors", href: "#" }, { label: "Dr. Ana Reyes" }]} />
          </div>
        </Section>
      </div>

      <Section title="Table" note="Bordered card, labelled scroll region, sticky header">
        <Table label="Example">
          <thead><tr><Th>Name</Th><Th>Department</Th><Th>Status</Th></tr></thead>
          <tbody>
            <Tr><Td className="font-medium">Dr. Ana Reyes</Td><Td className="text-ink-secondary">Pediatrics</Td><Td><ActiveBadge isActive /></Td></Tr>
            <Tr><Td className="font-medium">Dr. Joy Lim</Td><Td className="text-ink-secondary">Pediatrics</Td><Td><ActiveBadge isActive={false} /></Td></Tr>
          </tbody>
        </Table>
      </Section>

      <div className="grid gap-6 lg:grid-cols-3">
        <KpiCard label="Pending confirmation" value="18" detail="5 waiting over 24 h" detailTone="warning" />
        <div className="flex flex-col gap-3">
          <Alert tone="info">AI-generated. Not medical advice and not an appointment confirmation.</Alert>
          <Alert tone="warning">Your changes were not saved. Check your connection and try again.</Alert>
          <Alert tone="success">Schedule saved. Patients can book the new times now.</Alert>
        </div>
        <EmptyState icon={<Calendar aria-hidden />} title="No appointments for this period" description="Try another date range or clear the filters." action={<Button variant="outline" size="sm">Clear filters</Button>} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card><CardHeader title="Status history" /><Timeline steps={[{ key: "1", title: "Requested in chat", meta: "Nov 7 · 2:14 PM · patient", done: true }, { key: "2", title: "Confirmed", meta: "Nov 7 · 4:02 PM · front desk", done: true }, { key: "3", title: "Checked in", meta: "Pending" }]} /></Card>
        </div>
      </div>
    </main>
  );
}
