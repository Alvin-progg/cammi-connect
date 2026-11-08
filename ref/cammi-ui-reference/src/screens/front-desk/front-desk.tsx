import { CalendarPlus, Check, ChevronLeft, ChevronRight, Printer, UserPlus, X } from "lucide-react";
import { useState } from "react";

import { PageHeader, SplitLayout, StaffShell } from "@/components/shell/staff-shell";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Avatar, Card, CardHeader, DetailList, KpiCard } from "@/components/ui/card";
import { Alert, ListRow, ListRows, Table, Td, Th, Timeline, Tr } from "@/components/ui/data";
import { Field, FieldGrid, Fieldset, FormFooter, Input, Select, Textarea } from "@/components/ui/field";
import { SearchInput, Segmented, Tabs, Toolbar } from "@/components/ui/navigation";
import { href } from "@/lib/routes";
import { cn } from "@/lib/cn";
import { APPOINTMENTS, type Appointment } from "@/mock/data";

const pending = APPOINTMENTS.filter((a) => a.status === "requested");

/** "26 h" / "40 min" → minutes, so the queue can sort oldest first. */
function waitingMinutes(a: Appointment): number {
  const [value, unit] = (a.waiting ?? "0 min").split(" ");
  return Number(value) * (unit === "h" ? 60 : 1);
}
const today = APPOINTMENTS.filter((a) => a.when === "Mon, Nov 9");

/** /front-desk — PR 8 overview: Manila-day cards, pending first, today's schedule, activity, search. */
export function FrontDeskOverviewScreen() {
  return (
    <StaffShell workspace="front-desk" active="/front-desk" crumbs={[{ label: "Overview" }]} actions={<><span className="text-sm text-ink-secondary">Monday, November 9 · Asia/Manila</span><LinkButton size="sm" href={href("/front-desk/book")}><CalendarPlus aria-hidden />New appointment</LinkButton></>}>
      <PageHeader title="Good morning, Rosa" lead="7 requests need a decision. 14 patients are scheduled today." />
      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
        <li><KpiCard label="Pending confirmation" value="7" detail="1 waiting over 24 h" detailTone="danger" /></li>
        <li><KpiCard label="Today's appointments" value="14" detail="9 confirmed · 5 pending" /></li>
        <li><KpiCard label="Checked in" value="3" detail="Next: 10:00 AM" /></li>
        <li><KpiCard label="Completed today" value="1" detail="1 no-show" /></li>
      </ul>
      <SplitLayout
        main={
          <Card>
            <CardHeader title="Pending, oldest first" action={<LinkButton variant="ghost" size="sm" href={href("/front-desk/requests")}>All requests</LinkButton>} />
            <ListRows>
              {[...pending].sort((a, b) => waitingMinutes(b) - waitingMinutes(a)).map((a) => (
                <ListRow key={a.ref}>
                  <Avatar initials={a.initials} />
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium">{a.patient}</p><p className="text-xs text-ink-muted">{a.doctor} · {a.when} · {a.time}</p></div>
                  <Badge tone={a.waiting === "26 h" ? "danger" : "warning"}>Waiting {a.waiting}</Badge>
                  <LinkButton variant="outline" size="sm" href={href("/front-desk/requests/detail")}>Review</LinkButton>
                </ListRow>
              ))}
            </ListRows>
          </Card>
        }
        side={
          <Card>
            <CardHeader title="Today" action={<LinkButton variant="ghost" size="sm" href={href("/front-desk/schedule")}>Daily schedule</LinkButton>} />
            <ListRows>
              {today.slice(0, 6).map((a) => (
                <ListRow key={a.ref}><span className="w-16 text-sm font-medium tabular-nums">{a.time}</span><div className="min-w-0 flex-1"><p className="truncate text-sm">{a.patient}</p><p className="truncate text-xs text-ink-muted">{a.doctor}</p></div><StatusBadge status={a.status} /></ListRow>
              ))}
            </ListRows>
          </Card>
        }
      />
      <Card>
        <CardHeader title="Recent activity" />
        <ListRows>
          <ListRow><span className="w-16 text-xs text-ink-muted tabular-nums">9:42 AM</span><p className="flex-1 text-sm">You confirmed <b className="font-medium">Teresa Lopez</b> with Dr. Carlo Villanueva</p></ListRow>
          <ListRow><span className="w-16 text-xs text-ink-muted tabular-nums">8:52 AM</span><p className="flex-1 text-sm">You checked in <b className="font-medium">Celia Ramos</b></p></ListRow>
          <ListRow><span className="w-16 text-xs text-ink-muted tabular-nums">8:20 AM</span><p className="flex-1 text-sm"><b className="font-medium">Ella Navarro</b> marked as no-show</p></ListRow>
        </ListRows>
      </Card>
    </StaffShell>
  );
}

function RequestCard({ a }: { a: Appointment }) {
  return (
    <a href={href("/front-desk/requests/detail")} className="focus-ring flex flex-col gap-2 rounded-xl border border-line bg-surface p-3.5 shadow-card transition-colors hover:border-line-strong">
      <div className="flex justify-between gap-2"><p className="font-semibold">{a.patient}</p><span className="font-mono text-[11px] text-ink-muted">{a.ref.slice(0, 8)}</span></div>
      <p className="text-[13px] text-ink-secondary">{a.doctor} · {a.department}</p>
      <p className="text-[13px] tabular-nums">{a.when} · {a.time}</p>
      <div className="flex flex-wrap gap-1.5"><Badge tone="ai">{a.source}</Badge>{a.waiting ? <Badge tone={a.waiting === "26 h" ? "danger" : "warning"}>Waiting {a.waiting}</Badge> : <StatusBadge status={a.status} />}</div>
    </a>
  );
}

/** /front-desk/requests — Cami request queue. Board view (columns by status) + list view. */
export function FrontDeskRequestsScreen() {
  const [view, setView] = useState("board");
  const columns: { title: string; dot: string; items: Appointment[] }[] = [
    { title: "Pending confirmation", dot: "bg-warning", items: pending },
    { title: "Confirmed", dot: "bg-primary", items: APPOINTMENTS.filter((a) => a.status === "confirmed") },
    { title: "Checked in", dot: "bg-success", items: APPOINTMENTS.filter((a) => a.status === "checked_in") },
    { title: "Cancelled or rejected", dot: "bg-danger", items: APPOINTMENTS.filter((a) => a.status === "cancelled") },
  ];
  return (
    <StaffShell workspace="front-desk" active="/front-desk/requests" crumbs={[{ label: "Requests" }]} actions={<><SearchInput label="Search requests" placeholder="Patient or reference" shortcut="⌘K" /><LinkButton size="sm" href={href("/front-desk/book")}><CalendarPlus aria-hidden />New appointment</LinkButton></>}>
      <PageHeader title="Appointment requests" lead="Confirm, reschedule or reject requests from Cami and walk-ins. Patients see the change right away." />
      <Tabs label="View" value={view} onValueChange={setView} items={[{ value: "board", label: "Board" }, { value: "list", label: "List" }]} />
      {view === "board" ? (
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[1000px] grid-cols-4 gap-4">
            {columns.map((c) => (
              <section key={c.title} aria-label={c.title} className="flex flex-col gap-2.5 rounded-xl bg-surface-muted p-3">
                <div className="flex items-center justify-between px-1"><h2 className="flex items-center gap-2 text-sm font-semibold"><span aria-hidden className={cn("size-2 rounded-full", c.dot)} />{c.title}</h2><span className="text-xs text-ink-secondary tabular-nums">{c.items.length}</span></div>
                {c.items.map((a) => <RequestCard key={a.ref} a={a} />)}
              </section>
            ))}
          </div>
        </div>
      ) : (
        <Table label="Requests">
          <thead><tr><Th>Requested for</Th><Th>Patient</Th><Th>Doctor</Th><Th>Waiting</Th><Th>Status</Th></tr></thead>
          <tbody>{pending.map((a) => <Tr key={a.ref}><Td className="tabular-nums">{a.when} · {a.time}</Td><Td><a href={href("/front-desk/requests/detail")} className="font-medium hover:underline">{a.patient}</a></Td><Td className="text-ink-secondary">{a.doctor}</Td><Td className="tabular-nums">{a.waiting}</Td><Td><StatusBadge status={a.status} /></Td></Tr>)}</tbody>
        </Table>
      )}
    </StaffShell>
  );
}

/** /front-desk/requests/[id] — patient, appointment, patient-provided info, history; decide. */
export function FrontDeskRequestDetailScreen() {
  return (
    <StaffShell workspace="front-desk" active="/front-desk/requests" crumbs={[{ label: "Requests", href: href("/front-desk/requests") }, { label: "REQ-7F3A-2210" }]} actions={<><span className="text-xs text-ink-muted">1 of 7</span><Button variant="outline" size="sm">Next request <ChevronRight aria-hidden /></Button></>}>
      <PageHeader title="Juan Dela Cruz" badges={<StatusBadge status="requested" />} lead="Pediatrics with Dr. Ana Reyes · Mon, Nov 9 · 9:30 – 10:00 AM · requested 18 h ago in chat" />
      <SplitLayout
        main={
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card><CardHeader title="Patient" /><DetailList termWidth="6rem" items={[["Name", "Juan Dela Cruz"], ["Phone", "0917 000 0000"], ["Email", "juan.delacruz@example.com"]]} /></Card>
              <Card><CardHeader title="Appointment" /><DetailList termWidth="6rem" items={[["Doctor", "Dr. Ana Reyes"], ["Specialty", "General pediatrics"], ["When", "Mon, Nov 9 · 9:30 AM"], ["Reference", <span key="r" className="font-mono text-xs">REQ-7F3A-2210</span>]]} /></Card>
            </div>
            <Card><CardHeader title="Patient-provided information" /><DetailList items={[["Reason for visit", "Cough for about a week"]]} /><p className="mt-3 text-xs text-ink-muted">Chat transcripts are not shared with staff.</p></Card>
            <Card><CardHeader title="Status history" description="Oldest first" /><Timeline steps={[{ title: "Requested in chat", meta: "Nov 7 · 2:14 PM · Juan Dela Cruz (patient)", done: true }, { title: "Your decision", meta: "Pending", done: false }]} /></Card>
          </>
        }
        side={
          <Card className="shadow-card">
            <CardHeader title="Decide" description="The patient sees your decision in CamiConnect right away." />
            <Alert tone="success">Dr. Reyes is free at 9:30 AM. No conflicts.</Alert>
            <div className="mt-4 flex flex-col gap-2">
              <Button size="lg"><Check aria-hidden />Confirm appointment</Button>
              <LinkButton variant="outline" size="lg" href={href("/front-desk/reschedule")}>Reschedule</LinkButton>
              <Button variant="outlineDanger" size="lg"><X aria-hidden />Reject</Button>
            </div>
          </Card>
        }
      />
    </StaffShell>
  );
}

/** /front-desk/requests/[id]/reschedule — same doctor, free-slot picker, preset reasons. */
export function FrontDeskRescheduleScreen() {
  const slots: [string, "free" | "picked" | "taken"][] = [["8:00 AM", "free"], ["8:30 AM", "taken"], ["9:00 AM", "free"], ["9:30 AM", "taken"], ["10:00 AM", "picked"], ["10:30 AM", "free"], ["11:00 AM", "free"], ["11:30 AM", "taken"]];
  return (
    <StaffShell workspace="front-desk" active="/front-desk/requests" crumbs={[{ label: "Requests", href: href("/front-desk/requests") }, { label: "REQ-7F3A-2210", href: href("/front-desk/requests/detail") }, { label: "Reschedule" }]}>
      <PageHeader title="Reschedule Juan Dela Cruz" lead="Currently Mon, Nov 9 · 9:30 AM with Dr. Ana Reyes. Rescheduling keeps the same doctor." />
      <SplitLayout
        main={
          <Card>
            <form className="flex flex-col gap-5">
              <FieldGrid>
                <Field label="Doctor" htmlFor="doc"><Input id="doc" value="Dr. Ana Reyes" disabled readOnly /></Field>
                <Field label="Date" htmlFor="dt"><Input id="dt" type="date" defaultValue="2026-11-11" /></Field>
              </FieldGrid>
              <div role="group" aria-labelledby="slots-label">
                <p id="slots-label" className="text-sm font-medium">Free times · Wed, Nov 11</p>
                <ul className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
                  {slots.map(([t, s]) => (
                    <li key={t}>
                      <button type="button" disabled={s === "taken"} aria-pressed={s === "picked"} className={cn("focus-ring min-h-11 w-full rounded-lg text-sm font-medium tabular-nums", s === "picked" && "border-2 border-primary bg-primary-soft", s === "free" && "border border-line-strong bg-surface hover:bg-primary-soft", s === "taken" && "border border-line bg-surface-muted text-ink-muted line-through")}>{t}</button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-ink-muted">Asia/Manila. Taken times can't be picked.</p>
              </div>
              <Field label="Reason (shown to the patient)" htmlFor="reason"><Select id="reason"><option>Doctor unavailable at the original time</option><option>Patient asked to move</option><option>Clinic schedule change</option></Select></Field>
              <Field label="Note to patient (optional)" htmlFor="note"><Textarea id="note" defaultValue="Dr. Reyes has hospital rounds on Monday morning." /></Field>
              <FormFooter><LinkButton variant="ghost" size="sm" href={href("/front-desk/requests/detail")}>Cancel</LinkButton><Button size="sm" type="submit">Reschedule to 10:00 AM</Button></FormFooter>
            </form>
          </Card>
        }
        side={
          <Card>
            <CardHeader title="Change summary" />
            <DetailList termWidth="4rem" items={[["From", <span key="f" className="text-ink-muted line-through tabular-nums">Mon, Nov 9 · 9:30 AM</span>], ["To", <span key="t" className="font-medium tabular-nums">Wed, Nov 11 · 10:00 AM</span>], ["Doctor", "Dr. Ana Reyes (same)"]]} />
            <Alert tone="info" className="mt-4">The patient is notified in CamiConnect.</Alert>
          </Card>
        }
      />
    </StaffShell>
  );
}

/** /front-desk/schedule — PR 5: check in, complete, no-show for the Manila day. */
export function FrontDeskScheduleScreen() {
  return (
    <StaffShell
      workspace="front-desk"
      active="/front-desk/schedule"
      crumbs={[{ label: "Daily schedule" }]}
      actions={<><Button variant="outline" size="icon" aria-label="Previous day"><ChevronLeft aria-hidden /></Button><Input type="date" aria-label="Date" defaultValue="2026-11-09" className="w-auto" /><Button variant="outline" size="icon" aria-label="Next day"><ChevronRight aria-hidden /></Button><Button variant="outline" size="sm">Today</Button></>}
    >
      <PageHeader title="Monday, November 9" lead="14 appointments · 3 checked in · 1 no-show so far" aside={<Toolbar><Select aria-label="Doctor" className="w-auto"><option>All doctors</option></Select><Button variant="outline" size="sm"><Printer aria-hidden />Print list</Button></Toolbar>} />
      <Table label="Today's appointments">
        <thead><tr><Th>Time</Th><Th>Patient</Th><Th>Doctor</Th><Th>Status</Th><Th>Attendance</Th></tr></thead>
        <tbody>
          {today.map((a) => (
            <Tr key={a.ref}>
              <Td className="whitespace-nowrap font-medium tabular-nums">{a.time}</Td>
              <Td><a href={href("/front-desk/requests/detail")} className="font-medium hover:underline">{a.patient}</a><p className="font-mono text-xs text-ink-muted">{a.ref}</p></Td>
              <Td className="text-ink-secondary">{a.doctor}</Td>
              <Td><StatusBadge status={a.status} /></Td>
              <Td>
                {a.status === "confirmed" ? (
                  <div className="flex gap-2"><Button size="sm">Check in</Button><Button variant="ghost" size="sm">No-show</Button></div>
                ) : a.status === "checked_in" ? (
                  <Button variant="outline" size="sm">Mark completed</Button>
                ) : a.status === "requested" ? (
                  <span className="text-xs text-ink-muted">Confirm first</span>
                ) : (
                  <span className="text-xs text-ink-muted">—</span>
                )}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </StaffShell>
  );
}

/** /front-desk/book — PR 7: patient search or walk-in record, doctor and time; confirmed at once. */
export function FrontDeskBookScreen() {
  return (
    <StaffShell workspace="front-desk" active="/front-desk/book" crumbs={[{ label: "New appointment" }]}>
      <PageHeader title="New appointment" lead="For walk-ins and phone calls. Bookings made here are confirmed right away." />
      <SplitLayout
        main={
          <form className="flex flex-col gap-4">
            <Fieldset legend="1 · Patient">
              <SearchInput label="Find patient" placeholder="Name or phone" defaultValue="Ramos" />
              <ul className="flex flex-col divide-y divide-line rounded-xl border border-line px-3">
                <li className="flex items-center gap-3 py-2.5"><Avatar initials="CR" /><div className="flex-1"><p className="text-sm font-medium">Celia Ramos</p><p className="text-xs text-ink-muted">0917 111 0000 · last visit Nov 6</p></div><Badge tone="info">Selected</Badge></li>
                <li className="flex items-center gap-3 py-2.5"><Avatar initials="LR" /><div className="flex-1"><p className="text-sm font-medium">Lia Ramos</p><p className="text-xs text-ink-muted">0918 222 0000 · walk-in record</p></div><Button variant="ghost" size="sm">Select</Button></li>
              </ul>
              <Button variant="outline" size="sm" className="self-start"><UserPlus aria-hidden />Register walk-in patient</Button>
            </Fieldset>
            <Fieldset legend="2 · Doctor and time">
              <FieldGrid className="lg:grid-cols-3">
                <Field label="Specialty" htmlFor="sp"><Select id="sp"><option>Obstetrics</option></Select></Field>
                <Field label="Doctor" htmlFor="dc"><Select id="dc"><option>Dr. Grace Lim</option></Select></Field>
                <Field label="Date" htmlFor="bd"><Input id="bd" type="date" defaultValue="2026-11-10" /></Field>
              </FieldGrid>
              <Segmented label="Time" options={["8:00 AM", "8:30 AM", "9:00 AM", "10:30 AM", "11:00 AM"]} defaultValue="9:00 AM" />
            </Fieldset>
            <Fieldset legend="3 · Visit details">
              <Field label="Reason for visit" htmlFor="rs"><Input id="rs" defaultValue="Prenatal check-up" /></Field>
            </Fieldset>
          </form>
        }
        side={
          <Card className="shadow-card xl:sticky xl:top-6">
            <CardHeader title="Summary" />
            <DetailList termWidth="4.5rem" items={[["Patient", "Celia Ramos"], ["Doctor", "Dr. Grace Lim"], ["When", "Tue, Nov 10 · 9:00 – 9:30 AM"], ["Source", "Front desk"]]} />
            <Button size="lg" className="mt-5 w-full">Book appointment</Button>
            <p className="mt-2 text-center text-xs text-ink-muted">Confirmed immediately. The patient sees it in CamiConnect if they have an account.</p>
          </Card>
        }
      />
    </StaffShell>
  );
}
