import { AlertTriangle, ArrowRight, BookOpen, CalendarClock, Check, Download, RefreshCw, Upload } from "lucide-react";

import { StaffShell, PageHeader, SplitLayout } from "@/components/shell/staff-shell";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Avatar, Card, CardHeader, IconTile, KpiCard } from "@/components/ui/card";
import { Alert, DialogPreview, ListRow, ListRows, Pagination, Table, Td, Th, Tr } from "@/components/ui/data";
import { Field, FieldGrid, FormFooter, Input, Select, Textarea } from "@/components/ui/field";
import { SearchInput, Segmented, Tabs, Toolbar } from "@/components/ui/navigation";
import { href } from "@/lib/routes";
import { ANALYTICS, APPOINTMENTS } from "@/mock/data";

import {
  ByDoctorChart,
  ChartCard,
  ChartLegend,
  DailyActivityChart,
  MonthlyVolumeChart,
  OutcomesChart,
  PeakHeatmap,
  RatesChart,
  SERIES,
} from "./charts";

const crumbs = (label: string) => [{ label: "Admin", href: href("/admin") }, { label }];

function Filters() {
  return (
    <Toolbar>
      <Select aria-label="Doctor" className="w-auto">
        <option>All doctors</option>
      </Select>
      <Select aria-label="Department" className="w-auto">
        <option>All departments</option>
      </Select>
      <Segmented label="Period" options={["Today", "This week", "This month", "Custom"]} defaultValue="This week" />
    </Toolbar>
  );
}

/** /admin — ADM-12: six cards with their date basis, trend vs previous period, charts, queue, feeds. */
export function AdminDashboardScreen() {
  const cards = [
    { label: "Appointments scheduled", basis: "By scheduled date", value: "142", detail: "+12% vs previous week" },
    { label: "Pending confirmation", basis: "Now", value: "18", detail: "5 waiting over 24 h", tone: "warning" as const },
    { label: "Completed", basis: "By scheduled date", value: "96", detail: "+8% vs previous week" },
    { label: "Cancelled", basis: "By cancellation date", value: "11", detail: "Same as previous week" },
    { label: "No-shows", basis: "By scheduled date", value: "6", detail: "−2 vs previous week" },
    { label: "Booked through chat", basis: "By request date", value: "62%", detail: "Rest: front desk and walk-in" },
  ];
  return (
    <StaffShell workspace="admin" active="/admin" crumbs={crumbs("Dashboard")}>
      <PageHeader title="Good morning, Maria" lead="Saturday, November 7 · Asia/Manila" aside={<Filters />} />
      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <li key={c.label}>
            <a href={href("/admin/appointments")} className="focus-ring block rounded-xl">
              <KpiCard label={c.label} value={c.value} detail={`${c.basis} · ${c.detail}`} detailTone={c.tone ?? "muted"} />
            </a>
          </li>
        ))}
      </ul>
      <SplitLayout
        main={
          <ChartCard id="daily" title="Daily activity" takeaway="Requests peaked Friday (27); completed visits trail requests by about a day." aside={<ChartLegend items={[["Requests", "#9dbcf8"], ["Completed", SERIES.primary]]} />}>
            <DailyActivityChart />
          </ChartCard>
        }
        side={
          <Card>
            <CardHeader title="Top doctors" description="By appointments this week" />
            <ListRows>
              {["Dr. Carlo Villanueva · 31", "Dr. Ana Reyes · 27", "Dr. Grace Lim · 22", "Dr. Paolo Mendoza · 18", "Dr. Rico Salazar · 12"].map((r, i) => {
                const [name, n] = r.split(" · ");
                return (
                  <ListRow key={name}>
                    <span className="w-4 text-xs text-ink-muted tabular-nums">{i + 1}</span>
                    <span className="flex-1 text-sm">{name}</span>
                    <span className="text-sm font-medium tabular-nums">{n}</span>
                  </ListRow>
                );
              })}
            </ListRows>
          </Card>
        }
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Front desk queue" description="Read-only. The front desk confirms requests." action={<LinkButton variant="ghost" size="sm" href={href("/front-desk/requests")}>Open queue <ArrowRight aria-hidden /></LinkButton>} />
          <ListRows>
            {APPOINTMENTS.filter((a) => a.status === "requested").map((a) => (
              <ListRow key={a.ref}>
                <Avatar initials={a.initials} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.patient}</p>
                  <p className="text-xs text-ink-muted">
                    {a.doctor} · {a.when} · {a.time}
                  </p>
                </div>
                <Badge tone={a.waiting?.includes("26") ? "danger" : "warning"}>Waiting {a.waiting}</Badge>
              </ListRow>
            ))}
          </ListRows>
        </Card>
        <Card>
          <CardHeader title="Recent activity" action={<LinkButton variant="ghost" size="sm" href={href("/admin/audit-log")}>Audit log <ArrowRight aria-hidden /></LinkButton>} />
          <ListRows>
            {[
              ["9:42 AM", "Rosa Garcia confirmed APT-91C2-0418", "Appointment"],
              ["9:15 AM", "Maria Santos published “Laboratory services”", "Knowledge"],
              ["8:58 AM", "Dr. Ana Reyes added an exception on Tue, Nov 10", "Schedule"],
              ["8:21 AM", "Rosa Garcia checked in Miguel Torres", "Appointment"],
            ].map(([t, what, kind]) => (
              <ListRow key={t}>
                <span className="w-16 shrink-0 text-xs text-ink-muted tabular-nums">{t}</span>
                <span className="flex-1 text-sm">{what}</span>
                <Badge>{kind}</Badge>
              </ListRow>
            ))}
          </ListRows>
        </Card>
      </div>
    </StaffShell>
  );
}

/** /admin/analytics — ADM-11, the instructor's six graphs, grouped Demand / Outcomes. */
export function AdminAnalyticsScreen() {
  const outcomesLegend = <ChartLegend items={[["Completed", SERIES.completed], ["Cancelled", SERIES.cancelled], ["No-show", SERIES.noShow]]} />;
  const ratesLegend = <ChartLegend items={[["Cancellation rate", SERIES.cancelled], ["No-show rate", SERIES.noShow]]} />;
  return (
    <StaffShell
      workspace="admin"
      active="/admin/analytics"
      crumbs={crumbs("Analytics")}
      actions={
        <>
          <Badge>Sample data</Badge>
          <Button variant="outline" size="sm">
            <Download aria-hidden />
            Export CSV
          </Button>
        </>
      }
    >
      <PageHeader title="Analytics" lead="Appointment volume, doctor workload, peak hours and outcomes · 2026 · Asia/Manila" aside={<Filters />} />
      {/* In the repo the KPI numbers use React Bits CountUp (src/components/ui/count-up.tsx). */}
      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
        <li><KpiCard label="Appointments this year" value="1,575" detail="Dec is the busiest month (178)" /></li>
        <li><KpiCard label="Completed, Jan–Jun" value="80.2%" detail="521 of 650 appointments" /></li>
        <li><KpiCard label="Cancelled · No-show, Jan–Jun" value="11.5% · 8.3%" detail="75 cancelled · 54 no-shows" /></li>
        <li><KpiCard label="Peak slot" value="Thu 11–1" detail="29 appointments" /></li>
      </ul>

      <SectionTitle title="Demand" description="How many appointments, with whom, and when" />
      <ChartCard
        id="g1"
        title="1 · Monthly appointment volume"
        takeaway="Volume more than doubled from January (82) to December (178), with small dips in Apr, Jul, Sep and Nov."
        aside={<span className="text-xs text-ink-muted">Appointments per month, 2026</span>}
        table={
          <table className="w-full text-left tabular-nums">
            <tbody>
              <tr>{ANALYTICS.monthly.map((m) => <th key={m.month} className="border-t border-line px-2 py-1.5 font-medium text-ink-muted">{m.month}</th>)}</tr>
              <tr>{ANALYTICS.monthly.map((m) => <td key={m.month} className="border-t border-line px-2 py-1.5">{m.value}</td>)}</tr>
            </tbody>
          </table>
        }
      >
        <MonthlyVolumeChart />
      </ChartCard>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard id="g2" title="2 · Appointments per doctor" takeaway="Dr. Villanueva carries 2.7× the load of Dr. Joy Lim." aside={<span className="text-xs text-ink-muted">This year</span>}>
          <ByDoctorChart />
        </ChartCard>
        <ChartCard id="g3" title="3 · Peak consultation days and times" takeaway="Late mornings are busiest every day; Thursday 11 AM–1 PM peaks at 29. Fridays after 3 PM are quietest." aside={<span className="text-xs text-ink-muted">Appointments per slot</span>}>
          <PeakHeatmap />
        </ChartCard>
      </div>

      <SectionTitle title="Outcomes" description="What happened to booked appointments" />
      <ChartCard id="g4" title="4 · Monthly appointment outcomes" takeaway="Completed visits grew from 65 to 113; cancellations and no-shows stayed near 20% of each month." aside={outcomesLegend}>
        <OutcomesChart />
      </ChartCard>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard id="g5" title="5 · Cancellation and no-show rate by weekday" takeaway="Both rates climb through the week. Friday is worst: 15% cancelled, 11% no-show." aside={ratesLegend}>
          <RatesChart data={ANALYTICS.ratesByWeekday} label="Rates by weekday" />
        </ChartCard>
        <ChartCard id="g6" title="6 · Cancellation and no-show rate by doctor" takeaway="Dr. G. Lim's patients cancel most (14%) and miss most (10%); Dr. Villanueva's least (6% and 4%)." aside={ratesLegend}>
          <RatesChart data={ANALYTICS.ratesByDoctor} label="Rates by doctor" />
        </ChartCard>
      </div>
    </StaffShell>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-3 border-t border-line pt-2">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-ink-secondary">{description}</p>
    </div>
  );
}

/** /admin/audit-log — ADM-16: read-only, URL filters, CSV export (capped at 10,000 rows). */
export function AdminAuditLogScreen() {
  const rows = [
    ["Nov 7 · 9:42 AM", "Rosa Garcia", "Front desk", "appointment.confirm", "Appointment", "APT-91C2-0418"],
    ["Nov 7 · 9:15 AM", "Maria Santos", "Admin", "knowledge.publish", "Knowledge document", "KB-LAB-004"],
    ["Nov 7 · 8:58 AM", "Dr. Ana Reyes", "Doctor", "schedule.exception.add", "Schedule exception", "SCH-EX-0207"],
    ["Nov 6 · 5:31 PM", "Maria Santos", "Admin", "doctor.update", "Doctor", "DOC-AR-001"],
    ["Nov 6 · 2:44 PM", "Maria Santos", "Admin", "user.deactivate", "User", "USR-0042"],
    ["Nov 6 · 11:02 AM", "Maria Santos", "Admin", "user.invite", "User", "USR-0051"],
    ["Nov 6 · 9:30 AM", "Maria Santos", "Admin", "settings.update", "Settings", "appointment.min_lead_hours"],
    ["Nov 5 · 4:12 PM", "Maria Santos", "Admin", "analytics.export", "Export", "—"],
  ];
  return (
    <StaffShell workspace="admin" active="/admin/audit-log" crumbs={crumbs("Audit log")} actions={<Button variant="outline" size="sm"><Download aria-hidden />Export CSV</Button>}>
      <PageHeader title="Audit log" lead="Every change staff make. Entries can't be edited or deleted." />
      <Toolbar>
        <SearchInput label="Actor" placeholder="Actor name" className="flex-1" />
        <Select aria-label="Action" className="w-auto"><option>All actions</option></Select>
        <Select aria-label="Target type" className="w-auto"><option>All targets</option></Select>
        <Input type="date" aria-label="From" defaultValue="2026-11-01" className="w-auto" />
        <Input type="date" aria-label="To" defaultValue="2026-11-07" className="w-auto" />
      </Toolbar>
      <Table label="Audit entries" footer={<Pagination summary="Showing 1–8 of 1,204" />}>
        <thead><tr><Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Record</Th><Th><span className="sr-only">Open</span></Th></tr></thead>
        <tbody>
          {rows.map(([t, who, role, action, target, rec]) => (
            <Tr key={t + action}>
              <Td className="whitespace-nowrap text-ink-secondary tabular-nums">{t}</Td>
              <Td><p className="font-medium">{who}</p><p className="text-xs text-ink-muted">{role}</p></Td>
              <Td><code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">{action}</code></Td>
              <Td className="text-ink-secondary">{target}</Td>
              <Td className="font-mono text-xs text-ink-muted">{rec}</Td>
              <Td className="text-right"><LinkButton variant="ghost" size="sm" href="#detail">View</LinkButton></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </StaffShell>
  );
}

/** /admin/settings — ADM-15: Appointment, Hospital, Chatbot tabs; review dialog before save. */
export function AdminSettingsScreen() {
  return (
    <StaffShell workspace="admin" active="/admin/settings" crumbs={crumbs("Settings")}>
      <PageHeader title="Settings" lead="Hospital-wide rules for booking and the chatbot. Every save is recorded in the audit log." />
      <Tabs label="Settings group" items={[{ value: "appointment", label: "Appointment" }, { value: "hospital", label: "Hospital" }, { value: "chatbot", label: "Chatbot" }]} />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <form className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Booking" description="Applies to Cami's slot offers. Front desk bookings are not limited by these." />
            <FieldGrid>
              <Field label="Default slot length" htmlFor="slot" hint="New schedule periods start with this length.">
                <Select id="slot"><option>30 minutes</option><option>15 minutes</option><option>45 minutes</option><option>60 minutes</option></Select>
              </Field>
              <Field label="Minimum notice" htmlFor="lead" hint="Cami hides slots closer than this.">
                <Input id="lead" type="number" defaultValue={2} />
              </Field>
              <Field label="Booking horizon (days)" htmlFor="adv" hint="How far ahead Cami offers times.">
                <Input id="adv" type="number" defaultValue={60} />
              </Field>
              <Field label="Request expiry" htmlFor="exp" hint="Not active yet. Stored for later.">
                <Select id="exp" disabled><option>Off</option></Select>
              </Field>
            </FieldGrid>
          </Card>
          <Card>
            <CardHeader title="Policies" description="Shown to patients. Use “Send to knowledge base” so Cami can quote them." />
            <div className="flex flex-col gap-4">
              <Field label="Cancellation policy" htmlFor="cp"><Textarea id="cp" defaultValue="Cancel at least 24 hours before your appointment so another patient can use the slot." /></Field>
              <Field label="Reschedule policy" htmlFor="rp"><Textarea id="rp" placeholder="How patients can move an appointment" /></Field>
            </div>
            <FormFooter note="Last saved Nov 5 by Maria Santos">
              <Button variant="outline" size="sm"><BookOpen aria-hidden />Send to knowledge base</Button>
              <Button size="sm">Review changes</Button>
            </FormFooter>
          </Card>
        </form>
        <DialogPreview
          title="Review changes"
          description="1 setting will change. This is recorded in the audit log."
          footer={<><Button variant="ghost" size="sm">Keep editing</Button><Button size="sm">Save settings</Button></>}
        >
          <div className="rounded-lg border border-line text-sm">
            <div className="grid grid-cols-3 gap-2 border-b border-line px-3 py-2 text-xs text-ink-muted"><span>Setting</span><span>Before</span><span>After</span></div>
            <div className="grid grid-cols-3 gap-2 px-3 py-2"><span>Minimum notice</span><span className="text-ink-muted line-through">4 hours</span><span className="font-medium">2 hours</span></div>
          </div>
        </DialogPreview>
      </div>
    </StaffShell>
  );
}

/** /admin/knowledge-base — ADM-13/14: list by category and status, failed panel, coverage. */
export function AdminKnowledgeScreen() {
  const docs: [string, string, "published" | "draft" | "archived", "ready" | "failed" | "processing" | "pending", string, number][] = [
    ["Laboratory services", "Services", "published", "ready", "Nov 7", 3],
    ["Patient guide", "Other patient information", "published", "ready", "Nov 2", 5],
    ["PhilHealth and HMO", "Appointment requirements", "published", "processing", "Nov 7", 2],
    ["Emergency Room", "Hospital information", "published", "failed", "Oct 28", 1],
    ["Visiting policy 2027", "Appointment procedures", "draft", "pending", "—", 1],
    ["Old visiting hours", "Hospital information", "archived", "pending", "Sep 2", 4],
  ];
  const statusTone = { published: "info", draft: "neutral", archived: "neutral" } as const;
  const procTone = { ready: "success", failed: "danger", processing: "info", pending: "neutral" } as const;
  const coverage: [string, number, number, number, string][] = [
    ["Hospital information", 4, 3, 1, "Nov 7"],
    ["Departments", 6, 6, 0, "Nov 3"],
    ["Specialties", 8, 8, 0, "Nov 3"],
    ["Doctor profiles", 0, 0, 0, "—"],
    ["Services", 12, 12, 0, "Nov 7"],
    ["Appointment requirements", 5, 4, 0, "Nov 7"],
    ["Appointment procedures", 2, 2, 0, "Oct 30"],
    ["Other patient information", 3, 3, 0, "Nov 2"],
  ];
  return (
    <StaffShell
      workspace="admin"
      active="/admin/knowledge-base"
      crumbs={crumbs("Knowledge base")}
      actions={<><Button variant="outline" size="sm"><Upload aria-hidden />Upload file</Button><Button size="sm">New document</Button></>}
    >
      <PageHeader title="Knowledge base" lead="What Cami searches to answer patients. Only published documents are searchable." />
      <Alert tone="danger" title="1 document failed to process">
        “Emergency Room” couldn't be indexed. Its previous version is still searchable. <a href="#reprocess" className="font-medium underline underline-offset-4">Reprocess</a>
      </Alert>
      <SplitLayout
        main={
          <>
            <Toolbar>
              <SearchInput label="Search documents" placeholder="Search documents" className="flex-1" />
              <Select aria-label="Category" className="w-auto"><option>All categories</option></Select>
              <Segmented label="Status" options={["All", "Published", "Draft", "Archived"]} />
            </Toolbar>
            <Table label="Knowledge documents">
              <thead><tr><Th>Document</Th><Th>Category</Th><Th>Version</Th><Th>Status</Th><Th>Processing</Th><Th>Updated</Th></tr></thead>
              <tbody>
                {docs.map(([title, cat, status, proc, when, version]) => (
                  <Tr key={title}>
                    <Td><a href="#doc" className="font-medium hover:underline">{title}</a></Td>
                    <Td className="text-ink-secondary">{cat}</Td>
                    <Td className="tabular-nums">v{version}</Td>
                    <Td><Badge tone={statusTone[status]}>{status[0].toUpperCase() + status.slice(1)}</Badge></Td>
                    <Td><Badge tone={procTone[proc]}>{proc === "processing" ? <RefreshCw aria-hidden /> : proc === "failed" ? <AlertTriangle aria-hidden /> : null}{proc[0].toUpperCase() + proc.slice(1)}</Badge></Td>
                    <Td className="text-ink-secondary tabular-nums">{when}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </>
        }
        side={
          <Card>
            <CardHeader title="Coverage by category" description="Categories with nothing published can't be answered." />
            <ul className="flex flex-col divide-y divide-line text-sm">
              {coverage.map(([cat, pub, ready, failed, last]) => (
                <li key={cat} className="flex items-center gap-2 py-2.5">
                  {pub === 0 ? <IconTile tone="warning" className="size-6 rounded-md"><AlertTriangle aria-hidden /></IconTile> : <IconTile tone="success" className="size-6 rounded-md"><Check aria-hidden /></IconTile>}
                  <span className="flex-1">{cat}</span>
                  <span className="text-xs text-ink-muted tabular-nums">{pub === 0 ? "Nothing published" : `${ready}/${pub} ready${failed ? ` · ${failed} failed` : ""} · ${last}`}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-center gap-2 text-xs text-ink-muted"><CalendarClock aria-hidden className="size-3.5" />Embeddings: gemini-embedding-001, 768 dimensions</p>
          </Card>
        }
      />
    </StaffShell>
  );
}

