import { Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";

import { DoctorShell } from "@/components/shell/staff-shell";
import { Badge, type AppointmentStatus } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Avatar, Card, CardHeader, DetailList, IconTile, KpiCard } from "@/components/ui/card";
import { Alert, ListRow, ListRows } from "@/components/ui/data";
import { Field, FormFooter, Input } from "@/components/ui/field";
import { Segmented, Tabs } from "@/components/ui/navigation";
import { href } from "@/lib/routes";
import { cn } from "@/lib/cn";

/* Week grid uses the repo's slot tokens (bg-slot-*, border-slot-*-edge). */
const SLOT: Partial<Record<AppointmentStatus, string>> = {
  requested: "bg-slot-pending border-slot-pending-edge",
  confirmed: "bg-slot-confirmed border-slot-confirmed-edge",
  checked_in: "bg-slot-completed border-slot-completed-edge",
  completed: "bg-slot-completed border-slot-completed-edge",
  cancelled: "bg-slot-cancelled border-slot-cancelled-edge line-through",
  no_show: "bg-slot-noshow border-slot-noshow-edge",
};
const HOUR = 72;
const START = 8;
type Slot = { patient: string; h: number; m: number; mins: number; status: AppointmentStatus };
const WEEK: { dow: string; num: number; blocked?: string; slots: Slot[] }[] = [
  { dow: "Mon", num: 9, slots: [{ patient: "Miguel Torres", h: 8, m: 30, mins: 30, status: "checked_in" }, { patient: "Juan Dela Cruz", h: 9, m: 30, mins: 30, status: "requested" }, { patient: "Sofia Cruz", h: 10, m: 30, mins: 30, status: "requested" }, { patient: "Bea Santos", h: 14, m: 0, mins: 60, status: "confirmed" }] },
  { dow: "Tue", num: 10, blocked: "Hospital rounds", slots: [{ patient: "Andres Flores", h: 13, m: 30, mins: 30, status: "cancelled" }, { patient: "Nina Garcia", h: 15, m: 30, mins: 30, status: "requested" }] },
  { dow: "Wed", num: 11, slots: [{ patient: "Paolo Diaz", h: 9, m: 0, mins: 30, status: "confirmed" }, { patient: "Kim Uy", h: 11, m: 0, mins: 30, status: "confirmed" }] },
  { dow: "Thu", num: 12, slots: [{ patient: "Lia Ramos", h: 10, m: 0, mins: 30, status: "requested" }, { patient: "Ivan Tan", h: 13, m: 0, mins: 60, status: "confirmed" }] },
  { dow: "Fri", num: 13, slots: [{ patient: "Ella Navarro", h: 8, m: 0, mins: 30, status: "no_show" }, { patient: "Jose Reyes", h: 9, m: 30, mins: 30, status: "requested" }, { patient: "Mara Lim", h: 15, m: 0, mins: 30, status: "confirmed" }] },
];
const fmt = (h: number, m: number) => `${h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;

function WeekLegend() {
  const items: [string, string][] = [["Pending confirmation", "bg-slot-pending border-slot-pending-edge"], ["Confirmed", "bg-slot-confirmed border-slot-confirmed-edge"], ["Checked in / completed", "bg-slot-completed border-slot-completed-edge"], ["Cancelled", "bg-slot-cancelled border-slot-cancelled-edge"], ["No-show", "bg-slot-noshow border-slot-noshow-edge"]];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-secondary">
      {items.map(([label, cls]) => <span key={label} className="inline-flex items-center gap-1.5"><span aria-hidden className={cn("size-3 rounded-[3px] border", cls)} />{label}</span>)}
      <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-[3px] bg-[repeating-linear-gradient(45deg,var(--surface-muted)_0_4px,var(--line)_4px_6px)]" />Not available</span>
    </div>
  );
}

/** /doctor (week view). In the repo: `/doctor?view=…`; board and list views keep their current layout. */
export function DoctorWeekScreen() {
  return (
    <DoctorShell
      active="/doctor"
      title="November 9 – 13"
      actions={<div className="flex gap-1"><Button variant="outline" size="icon" aria-label="Previous week"><ChevronLeft aria-hidden /></Button><Button variant="outline" size="sm">This week</Button><Button variant="outline" size="icon" aria-label="Next week"><ChevronRight aria-hidden /></Button></div>}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs label="View" defaultValue="week" items={[{ value: "board", label: "Board" }, { value: "list", label: "List" }, { value: "week", label: "Week" }]} />
        <WeekLegend />
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[900px] grid-cols-[64px_repeat(5,minmax(0,1fr))]">
          <div />
          {WEEK.map((d, i) => (
            <div key={d.dow} className={cn("border-l border-line px-2.5 pb-2.5 pt-3.5", i === 0 && "bg-primary-soft")}>
              <p className="text-xs text-ink-muted">{d.dow}</p>
              <p className="text-xl font-semibold tabular-nums">{d.num}</p>
            </div>
          ))}
          <div className="relative" style={{ height: HOUR * 9 }}>
            {Array.from({ length: 9 }, (_, i) => START + i).map((h) => (
              <span key={h} className="absolute right-2.5 text-[11px] text-ink-muted tabular-nums" style={{ top: (h - START) * HOUR - 8 }}>
                {h > 12 ? h - 12 : h} {h >= 12 ? "PM" : "AM"}
              </span>
            ))}
          </div>
          {WEEK.map((d) => (
            <div key={d.dow} className="relative border-l border-line bg-[linear-gradient(var(--line)_1px,transparent_1px)]" style={{ height: HOUR * 9, backgroundSize: `100% ${HOUR}px` }}>
              {d.blocked ? (
                <div className="absolute inset-x-0 top-0 flex items-center justify-center bg-[repeating-linear-gradient(45deg,var(--surface-muted)_0_6px,var(--line)_6px_8px)]" style={{ height: HOUR * 4 }}>
                  <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-ink-secondary">{d.blocked}</span>
                </div>
              ) : null}
              {d.slots.map((s) => (
                <button
                  key={s.patient}
                  type="button"
                  className={cn("focus-ring absolute inset-x-1 overflow-hidden rounded-lg border px-2 py-1 text-left", SLOT[s.status])}
                  style={{ top: (s.h - START) * HOUR + (s.m / 60) * HOUR + 2, height: (s.mins / 60) * HOUR - 4 }}
                >
                  {/* 30-minute slots are 32px tall: one line, time first. */}
                  <span className="block truncate text-xs"><span className="tabular-nums text-ink-secondary">{fmt(s.h, s.m)}</span> <span className="font-semibold">{s.patient}</span></span>
                  {s.mins >= 60 ? <span className="block text-[11px] text-ink-secondary">{s.mins} min</span> : null}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </DoctorShell>
  );
}

const WEEKLY: [string, [string, string][]][] = [
  ["Monday", [["08:00", "12:00"], ["13:00", "16:00"]]],
  ["Tuesday", [["13:00", "16:00"]]],
  ["Wednesday", [["08:00", "12:00"]]],
  ["Thursday", [["08:00", "12:00"], ["13:00", "15:00"]]],
  ["Friday", [["08:00", "12:00"], ["13:00", "16:00"]]],
  ["Saturday", [["08:00", "11:00"]]],
  ["Sunday", []],
];

/** Availability (ScheduleManager): weekly hours of the current period + exceptions. */
export function DoctorAvailabilityScreen() {
  return (
    <DoctorShell active="/doctor/availability" title="Availability">
      <p className="text-ink-secondary">Your weekly clinic hours and time off. Patients can only request times inside these hours.</p>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <Card>
          <CardHeader title="Weekly hours" description="Period from Oct 1, 2026 · 30-minute slots" action={<Button size="sm">Save hours</Button>} />
          <ul className="flex flex-col divide-y divide-line">
            {WEEKLY.map(([day, ranges]) => (
              <li key={day} className="flex items-start gap-4 py-3">
                <label className="flex w-36 items-center gap-2.5 pt-2"><input type="checkbox" defaultChecked={ranges.length > 0} className="size-4 accent-primary" /><span className="text-sm font-medium">{day}</span></label>
                <div className="flex flex-1 flex-col gap-2">
                  {ranges.length === 0 ? <p className="pt-2 text-sm text-ink-muted">Not available</p> : null}
                  {ranges.map(([a, b]) => (
                    <div key={a} className="flex items-center gap-2">
                      <Input type="time" defaultValue={a} aria-label={`${day} start`} className="w-32 tabular-nums" />
                      <span className="text-sm text-ink-muted">to</span>
                      <Input type="time" defaultValue={b} aria-label={`${day} end`} className="w-32 tabular-nums" />
                      <Button variant="ghost" size="icon" aria-label="Remove hours"><X aria-hidden /></Button>
                    </div>
                  ))}
                  {ranges.length > 0 ? <Button variant="link" size="sm" className="self-start"><Plus aria-hidden />Add hours</Button> : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Time off and exceptions" />
            <ListRows>
              <ListRow><IconTile tone="warning">!</IconTile><div className="flex-1"><p className="text-sm font-medium">Tue, Nov 10 · 8 AM – 12 PM</p><p className="text-xs text-ink-muted">Hospital rounds</p></div></ListRow>
              <ListRow><IconTile>i</IconTile><div className="flex-1"><p className="text-sm font-medium">Dec 24 – 26</p><p className="text-xs text-ink-muted">Leave</p></div></ListRow>
            </ListRows>
            <Button variant="outline" size="sm" className="mt-4 w-full">Add time off</Button>
          </Card>
          <Alert tone="info">Time off can't cover a booked appointment. Ask the front desk to move it first.</Alert>
        </div>
      </div>
    </DoctorShell>
  );
}

export function DoctorStatsScreen() {
  const wd: [string, number][] = [["Mon", 22], ["Tue", 9], ["Wed", 14], ["Thu", 18], ["Fri", 19], ["Sat", 4]];
  const outcomes: [string, number, string][] = [["Completed", 81, "#1a62f2"], ["Cancelled", 8, "#b45309"], ["No-show", 6, "#7c3aed"], ["Upcoming", 5, "#c9d6ec"]];
  return (
    <DoctorShell active="/doctor/stats" title="Statistics" actions={<Segmented label="Period" options={["This week", "This month", "90 days"]} defaultValue="This month" />}>
      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
        <li><KpiCard label="Patients seen" value="86" detail="October: 79" /></li>
        <li><KpiCard label="Visits completed by you" value="70" detail="Of 86 checked in" /></li>
        <li><KpiCard label="No-shows" value="5" detail="5.8% of appointments" /></li>
        <li><KpiCard label="Hours offered" value="124" detail="78% booked" /></li>
      </ul>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <Card>
          <CardHeader title="Appointments by weekday" description="November so far" />
          <div role="img" aria-label={wd.map(([d, n]) => `${d} ${n}`).join(", ")} className="flex flex-col gap-3">
            {wd.map(([d, n]) => (
              <div key={d} className="flex items-center gap-3">
                <span className="w-10 text-sm text-ink-secondary">{d}</span>
                <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(n / 22) * 100}%` }} /></div>
                <span className="w-7 text-right text-sm tabular-nums">{n}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Outcomes" />
          <div role="img" aria-label="Completed 81%, cancelled 8%, no-show 6%, upcoming 5%" className="flex h-3.5 gap-0.5 overflow-hidden rounded-full">
            {outcomes.map(([l, p, c]) => <span key={l} style={{ width: `${p}%`, background: c }} />)}
          </div>
          <ul className="mt-4 flex flex-col divide-y divide-line text-sm">
            {outcomes.map(([l, p, c]) => <li key={l} className="flex items-center gap-2.5 py-2.5"><span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: c }} /><span className="flex-1">{l}</span><span className="tabular-nums">{p}%</span></li>)}
          </ul>
        </Card>
      </div>
    </DoctorShell>
  );
}

export function DoctorProfileScreen() {
  return (
    <DoctorShell active="/doctor/profile" title="Profile">
      <div className="flex max-w-[960px] flex-col gap-4">
        <Card className="flex items-center gap-5">
          <Avatar initials="AR" size="lg" />
          <div className="flex-1"><h2 className="text-xl font-semibold">Dr. Ana Reyes</h2><p className="text-ink-secondary">Pediatrics · General pediatrics</p></div>
          <Badge tone="success">Bookable in chat</Badge>
        </Card>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title="What patients see" />
            <DetailList items={[["Department", "Pediatrics"], ["Specialties", "General pediatrics"], ["Bio", "Pediatrician focused on newborn care, vaccines and common childhood illness."]]} />
            <p className="mt-4 text-xs text-ink-muted">To change these, ask an administrator.</p>
          </Card>
          <Card>
            <CardHeader title="Contact details" />
            <form className="flex flex-col gap-4">
              <Field label="Contact email" htmlFor="ce"><Input id="ce" defaultValue="ana.reyes@stcamillus.example" /></Field>
              <Field label="Contact phone" htmlFor="cp"><Input id="cp" defaultValue="0917 333 0000" /></Field>
              <FormFooter><Button size="sm" type="submit">Save contact details</Button></FormFooter>
            </form>
          </Card>
        </div>
        <Card>
          <CardHeader title="Account" />
          <ListRows>
            <ListRow><div className="flex-1"><p className="text-sm font-medium">Password</p><p className="text-xs text-ink-muted">Send yourself a reset link</p></div><LinkButton variant="outline" size="sm" href={href("/account/password")}>Change password</LinkButton></ListRow>
            <ListRow><div className="flex-1"><p className="text-sm font-medium">Sign out</p></div><LinkButton variant="outlineDanger" size="sm" href={href("/login")}>Sign out</LinkButton></ListRow>
          </ListRows>
        </Card>
      </div>
    </DoctorShell>
  );
}

/** Notifications open over the week view (NotificationsPanel). Doctors don't confirm; the front desk does. */
export function DoctorNotificationsScreen() {
  const items: { title: string; body: string; when: string; unread: boolean; tone: "warning" | "primary" | "success" }[] = [
    { title: "New request: Juan Dela Cruz", body: "Mon, Nov 9 · 9:30 AM · waiting for front desk", when: "18 h ago", unread: true, tone: "warning" },
    { title: "New request: Sofia Cruz", body: "Mon, Nov 9 · 10:30 AM · waiting for front desk", when: "6 h ago", unread: true, tone: "warning" },
    { title: "Rescheduled by the front desk", body: "Andres Flores moved to Wed, Nov 11 · 1:30 PM", when: "1 h ago", unread: true, tone: "primary" },
    { title: "Confirmed by the front desk", body: "Miguel Torres · Mon, Nov 9 · 8:30 AM", when: "Yesterday", unread: false, tone: "success" },
  ];
  return (
    <DoctorShell active="/doctor" title="November 9 – 13" notificationsOpen>
      <div aria-hidden className="h-[600px] rounded-xl border border-line bg-surface-muted/60" />
      <section role="dialog" aria-label="Notifications" className="absolute right-6 top-2 flex w-[420px] max-w-[calc(100%-3rem)] flex-col rounded-xl border border-line bg-surface shadow-overlay">
        <div className="flex items-center justify-between border-b border-line px-4.5 py-3.5"><h2 className="text-lg font-semibold">Notifications</h2><Button variant="ghost" size="sm">Mark all as read</Button></div>
        <div className="px-3 pt-3"><Tabs label="Filter" items={[{ value: "unread", label: "Unread", count: 3 }, { value: "all", label: "All" }]} /></div>
        <ul className="flex flex-col divide-y divide-line px-4.5 pb-2">
          {items.map((n) => (
            <li key={n.title} className="flex items-start gap-3 py-3.5">
              <IconTile tone={n.tone === "primary" ? "primary" : n.tone}>{n.tone === "success" ? <Check aria-hidden /> : "!"}</IconTile>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm", n.unread ? "font-semibold" : "font-medium")}>{n.title}</p>
                <p className="text-[13px] text-ink-secondary">{n.body}</p>
                <p className="mt-1 text-xs text-ink-muted">{n.when}</p>
              </div>
              {n.unread ? <span className="mt-1.5 size-2 rounded-full bg-primary"><span className="sr-only">Unread</span></span> : null}
            </li>
          ))}
        </ul>
      </section>
    </DoctorShell>
  );
}
