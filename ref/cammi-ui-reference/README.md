# CamiConnect UI reference

A static, mock-data React app that shows every redesigned CamiConnect screen. It is the **visual source** for implementing the redesign in `Alvin-progg/cammi-connect`. It is not wired to Supabase and has no server code.

```bash
npm install
npm run dev            # http://localhost:5173 → index of every screen
npm run build && npx vite preview --port 4173
node scripts/capture.mjs   # needs `playwright`; writes reference-screenshots/{1440,390}/
```

`reference-screenshots/` already holds every screen at 1440px and 390px. They were captured from this app with Geist loaded.

## For Claude Code: how to use this

1. **Treat this as the spec for looks, not for behavior.** Behavior, data, auth, and copy rules come from the repo (`SPEC.md`, `AGENTS.md`, `design.md`). When this reference and the repo disagree on *what happens*, the repo wins. When they disagree on *how it looks*, this reference wins.
2. **Port the kit first** (`src/components/ui/*`), then shells, then screens (order below). Every screen here is built only from the kit, so most screens become a matter of swapping in real data.
3. **Copy the Tailwind classes as written.** They use the repo's own token utilities (`bg-primary`, `text-ink-secondary`, `border-line`, `bg-slot-*`…), so they work unchanged in the repo.
4. **Swap the reference-only parts:**
   - `<a href={href("/x")}>` and `LinkButton` → `next/link` with the real route (column `route` in `src/screens/registry.ts`).
   - Mock arrays in `src/mock/data.ts` → the existing server data (`src/server/<domain>`), passed in as props from the page.
   - Static `DialogPreview` → the repo's Base UI dialogs. Static `ToastPreview` → Sonner (`AppToaster`).
   - `useState` demos (slot picking, tabs) → the existing client components' state and Server Actions.
5. **Keep everything the repo already does right**: `useActionState` forms, `aria-*` wiring, `focus-ring`, `pressable`, reduced-motion handling, the MascotStage on auth pages, CountUp on analytics KPIs, Recharts only inside `src/components/analytics/analytics-charts.tsx`.
6. **Verify each screen** by capturing the real route at 1440 and 390 and comparing it with `reference-screenshots/`. Judge layout, spacing, type and color; data will differ.

## What's in here

| Path | Contents |
|---|---|
| `src/styles/globals.css` | The repo's `globals.css`, copied verbatim, plus a clearly marked **Redesign additions** block at the end: shadcn variable names mapped to the existing tokens, `shadow-soft`/`shadow-lift`, the analytics series colors, `bg-grid-soft`. Copy only that block into the repo. |
| `src/lib/cn.ts` | shadcn's `cn()` (clsx + tailwind-merge). |
| `src/components/ui/button.tsx` | Redesigned `Button`/`buttonVariants`. Same variant names as the repo, plus `outline` and `link`, and a 36px `sm` size for dense staff screens. `md`/`lg` stay 44px. |
| `src/components/ui/badge.tsx` | `Badge`, `StatusBadge` (mirrors `APPOINTMENT_STATUSES`/`APPOINTMENT_STATUS_LABELS`, including "Pending confirmation" and "Rejected"), `ActiveBadge`. |
| `src/components/ui/card.tsx` | `Card`, `CardHeader`, `KpiCard`, `IconTile`, `Avatar`, `DetailList`. |
| `src/components/ui/field.tsx` | `Input`, `Select`, `Textarea`, `Label`, `Field`, `Checkbox`, `Fieldset`, `FieldGrid`, `ChoiceCard`, `FormFooter`. Borders use `control-line` (3:1). |
| `src/components/ui/navigation.tsx` | `Tabs`, `Segmented`, `SearchInput`, `Breadcrumb`, `Toolbar`. |
| `src/components/ui/data.tsx` | `Table`/`Th`/`Td`/`Tr`, `Pagination`, `Alert`, `EmptyState`, `Timeline`, `ListRows`, `ToastPreview`, `DialogPreview`. |
| `src/components/shell/staff-shell.tsx` | `StaffShell` (grouped 240px sidebar + breadcrumb top bar) for admin and front desk, `DoctorShell` (keeps the 64px rail), `PageHeader`, `SplitLayout`. |
| `src/screens/**` | One component per screen. `registry.ts` maps each to its repo route. |
| `src/screens/admin/charts.tsx` | Recharts versions of the six analytics graphs, plus the dashboard chart and the HTML peak heatmap. |

## Implementation order

1. **Foundations**: the `globals.css` additions, `cn()`, and approval for `tailwind-merge` and `lucide-react` (see below).
2. **Kit**: replace `src/components/ui/button.tsx`, and add the rest of `src/components/ui/*`. Add a `/dev/kit` page from `src/screens/kit/kit.tsx`. Replace the per-folder copies the inventory found (`admin/empty-state`, `front-desk/empty-state`, `front-desk/table-frame`, `admin/active-badge`, `requirements/requirement-badges`, the chat `*_BUTTON` strings, the three icon sets).
3. **Shells**: `StaffShell` replaces `AdminShell`/`admin-rail.tsx` and `FrontDeskShell`/`front-desk-rail.tsx` (decision: grouped sidebar instead of `WorkspaceRail`). `DoctorShell` restyles the doctor rail and header.
4. **Public and auth**: `/` (replaces the create-next-app page), `/login`, `/register`, `/account/password`, `/account`.
5. **Patient chat**: `/chat` and its views.
6. **Front desk**, then **doctor**, then **admin** (lists and forms go fastest once the kit is in).

Change only presentation: no edits to server actions, services or migrations. Keep the existing tests green and never weaken an assertion to fit new markup. Update component tests where markup legitimately changes.

## Decisions baked into this reference

- **Navigation**: admin and front desk use a grouped 240px sidebar (Overview · Operations · Directory · Chatbot · System). The doctor workspace keeps a 64px icon rail.
- **Confirmation**: only the front desk confirms. Doctors never get a Confirm button. Chat copy says "waiting for the front desk".
- **Status labels**: `requested` shows as **Pending confirmation** (repo label), warning tone. Blue = confirmed, never success.
- **Analytics colors**: completed `#1a62f2`, cancelled `#b45309`, no-show `#7c3aed` in every chart (validated for color-blind and normal-vision separation). One axis per chart. Chart animation off.
- **Motion**: React Bits only on the landing page, marked with `data-motion="…"` attributes and described at the top of `src/screens/public/landing.tsx`. Nothing loops, and everything renders its final state under reduced motion.

## Needs approval before porting (AGENTS.md: dependencies)

- `tailwind-merge`: used by `cn()`.
- `lucide-react`: icons used throughout; replaces the hand-drawn sets in `auth/`, `chat/` and `doctor/icons.tsx`.
- `motion`, `recharts`, `class-variance-authority`, `clsx`, `@base-ui/react`: already approved and in the repo.
- `@fontsource-variable/geist*`: reference app only. The repo keeps `next/font`.

## Content that is placeholder or invented

- All people, numbers and references are synthetic.
- `[FRONT DESK PHONE]`, `[HOSPITAL ADDRESS]`, `[PHONE]`, `[TERMS]`, `[PRIVACY NOTICE]`: fill from hospital settings (`hospital.*`) or remove.
- Landing "24/7" and "Works on any phone" claims, the wayfinding sign directions, and the analytics sample data (from the instructor's activity) need real confirmation.
- Admin dashboard card set, knowledge-base coverage wording, and settings copy follow ADM-12/13/15 as described in `AGENTS.md`, but check them against `spec-admin.md` before porting.
- The doctor **board** and **list** views are not redesigned here. Restyle them with the kit (cards like the front-desk board), keeping their behavior.
