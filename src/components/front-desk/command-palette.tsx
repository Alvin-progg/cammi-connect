"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DIALOG_BACKDROP_CLASS } from "./dialog-styles";
import { FRONT_DESK_NAV_ITEMS } from "./nav-items";

import { StatusBadge } from "@/components/ui/badge";
import { formatManilaDateTime } from "@/lib/appointments/format";
import { PATIENT_SEARCH_MIN_LENGTH } from "@/lib/front-desk/booking";
import {
  searchAppointmentsQuickAction,
  type QuickSearchState,
} from "@/server/front-desk/actions";

const SEARCH_DELAY_MS = 250;
const UNAVAILABLE: QuickSearchState = {
  status: "error",
  message: "Search is unavailable right now. Try again in a moment.",
};

// Anchored near the top rather than centred, so the list grows downward as
// results arrive instead of the box jumping around.
const PALETTE_POPUP_CLASS =
  "fixed top-[12vh] left-1/2 z-50 flex max-h-[min(32rem,76vh)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-overlay outline-none transition-[opacity,scale] duration-200 ease-snappy data-[ending-style]:scale-96 data-[ending-style]:opacity-0 data-[ending-style]:duration-150 data-[starting-style]:scale-96 data-[starting-style]:opacity-0 motion-reduce:transition-opacity motion-reduce:data-[ending-style]:scale-100 motion-reduce:data-[starting-style]:scale-100";
const GROUP_CLASS =
  "px-2 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-muted";
const ITEM_CLASS =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-ink data-[selected=true]:bg-primary-soft";
const NOTE_CLASS = "px-4 py-3 text-sm text-ink-muted";

/**
 * The front desk's ⌘K / Ctrl+K quick search (FD-001 PR 9). It jumps to a
 * front desk page, or finds appointments by patient name or phone through
 * the same validated, staff-only search as the overview. Results come from
 * the server; nothing is filtered or cached in the browser.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Tagged with the query it answers, so a stale reply is never shown.
  const [answer, setAnswer] = useState<{ query: string; state: QuickSearchState } | null>(
    null,
  );

  const trimmed = query.trim();
  const searchable = trimmed.length >= PATIENT_SEARCH_MIN_LENGTH;
  const current = searchable && answer?.query === trimmed ? answer.state : null;
  const searching = searchable && current === null;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((wasOpen) => !wasOpen);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!searchable) return;
    let stale = false;
    const timer = setTimeout(async () => {
      let state: QuickSearchState;
      try {
        state = await searchAppointmentsQuickAction(trimmed);
      } catch {
        // A network or server failure; say so rather than showing "no matches".
        state = UNAVAILABLE;
      }
      if (!stale) setAnswer({ query: trimmed, state });
    }, SEARCH_DELAY_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [trimmed, searchable]);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }

  function go(href: string) {
    changeOpen(false);
    router.push(href);
  }

  const pages = FRONT_DESK_NAV_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(trimmed.toLowerCase()),
  );
  const appointments = current?.status === "success" ? current.items : [];

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger
        aria-keyshortcuts="Meta+K Control+K"
        className="focus-ring flex h-9 w-full items-center gap-2 rounded-md border border-control-line bg-surface px-3 text-sm text-ink-muted shadow-soft hover:bg-surface-muted"
      >
        <Search aria-hidden="true" className="size-4 shrink-0" />
        <span className="flex-1 text-left">Find patient</span>
        <kbd
          aria-hidden="true"
          className="rounded border border-line-strong px-1.5 font-mono text-[11px] text-ink-secondary"
        >
          ⌘K
        </kbd>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={DIALOG_BACKDROP_CLASS} />
        <Dialog.Popup className={PALETTE_POPUP_CLASS}>
          <Dialog.Title className="sr-only">Quick search</Dialog.Title>
          <Command label="Quick search" shouldFilter={false} loop className="flex min-h-0 flex-col">
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Patient name or phone, or a page"
              className="min-h-14 w-full border-b border-line bg-transparent px-4 text-base text-ink outline-none placeholder:text-ink-muted"
            />
            <Command.List className="min-h-0 overflow-y-auto py-2">
              {trimmed.length > 0 && !searchable ? (
                <p className={NOTE_CLASS}>
                  {`Type at least ${PATIENT_SEARCH_MIN_LENGTH} characters to search appointments.`}
                </p>
              ) : null}
              {searching ? (
                <Command.Loading>
                  <p className={NOTE_CLASS}>Searching…</p>
                </Command.Loading>
              ) : null}
              {current?.status === "error" ? (
                <p role="alert" className="px-4 py-3 text-sm text-danger-soft-ink">
                  {current.message}
                </p>
              ) : null}
              {current?.status === "success" && appointments.length === 0 ? (
                <p className={NOTE_CLASS}>{`No appointments match “${trimmed}”.`}</p>
              ) : null}

              {appointments.length > 0 ? (
                <Command.Group heading="Appointments" className={GROUP_CLASS}>
                  {appointments.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={`appointment-${item.id}`}
                      onSelect={() => go(`/front-desk/requests/${item.id}`)}
                      className={ITEM_CLASS}
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{item.patientName}</span>
                        <span className="truncate text-ink-secondary">
                          {`${formatManilaDateTime(item.scheduledAt)} · ${item.doctorName}`}
                        </span>
                      </span>
                      <StatusBadge status={item.status} />
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}

              {pages.length > 0 ? (
                <Command.Group heading="Go to" className={GROUP_CLASS}>
                  {pages.map((item) => (
                    <Command.Item
                      key={item.key}
                      value={`page-${item.key}`}
                      onSelect={() => go(item.href)}
                      className={ITEM_CLASS}
                    >
                      {item.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
            </Command.List>
          </Command>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
