# CamiConnect — Visual Design System and Frontend Guidelines

- **Status:** Draft v0.3 — redesign proposal, **pending owner approval** (v0.2 remains in force for the auth slice until approved). Amended 2026-10-25: white page/auth backgrounds and the doctor workspace shell were approved by the owner.
- **Date:** 2026-10-25
- **Applies to:** all frontend work in this repository
- **Direction:** "Calm Care" — clean clinical blue and white, soft surfaces, generous space
- **Related requirements:** `SPEC.md` §8 (`UI-001`–`UI-006`, §8.1), `TEST.md` §6 and §10, `AGENTS.md`
- **Implementation state:** Auth slice uses the v0.2 token names. v0.3 keeps those token names, so migration is mostly a value swap in `globals.css` plus the radius and elevation changes in §4.5.

> This document is the visual source of truth for frontend work. It does not change product requirements or authorization rules. If it conflicts with `SPEC.md`, `TEST.md`, `AGENTS.md`, or an approved ADR, stop and request a decision; do not silently choose the design document.

---

## 0. What Changed in v0.3

v0.2 borrowed its character from a developer-tools website: a technical grid, monospace labels, tight radii, deep teal accents. For a hospital product that read as cold. v0.3 keeps the structure (grid, tokens, accessibility, state patterns) and changes the feeling.

| Area | v0.2 | v0.3 |
|---|---|---|
| Inspiration | Tailwind website | Modern clinical product: calm, bright, reassuring |
| Palette | Cool off-white + deep blue + teal | Blue and white: white surfaces, pale-blue canvas, one confident blue, a sky-blue support accent |
| Grid texture | Visible square grid on most pages | Very soft blue grid that fades out; reserved for hero and header bands |
| Radii | 6 / 8 / 12px | 8 / 12 / 16px (softer) |
| Elevation | Almost none | Soft blue-tinted shadow on floating surfaces only |
| Eyebrow labels | Uppercase monospace | Sentence-case, small, primary-blue, with a small dot or icon |
| Accent | Teal | Sky blue (`accent`), used for AI and support cues |
| Decoration | No gradients | One static pale-blue "header wash" allowed on page header bands |

Token **names are unchanged**, so existing components keep working. Only values (and a few new tokens: `--wash`, `--elevation-*`) change.

---

## 1. Purpose and Scope

### 1.1 What this document defines

- The visual direction for CamiConnect.
- The layout grid and the soft background texture, implemented with the existing Tailwind CSS v4 setup.
- Semantic design tokens for color, typography, spacing, layout, borders, radii, elevation, and focus.
- Reusable patterns for buttons, fields, cards, badges, dialogs, navigation, tables, and toasts.
- Screen guidance for public pages, authentication, patient appointments, the AI chatbot, doctor and administrator dashboards, and analytics.
- Accessibility, responsive, and implementation constraints for frontend agents.

### 1.2 What this document does not define

This document does **not**:

- Add product functionality or change acceptance criteria.
- Define API contracts, authorization behavior, database schema, or business rules.
- Select a chart library, icon library, component library, or CSS framework.
- Approve a new dependency. Sonner is approved and installed (§5.9); any further dependency requires approval.
- Replace `SPEC.md` or `TEST.md`.
- Approve a hospital logo, photography, or official brand palette. Those require human input.

### 1.3 Repository state

- Next.js 16 App Router under `src/app`.
- Tailwind CSS v4 through `@tailwindcss/turbopack` in `next.config.ts`.
- Global styling in `src/app/globals.css`: `@import "tailwindcss"`, the semantic token layer, `bg-grid`, `page-container`, and `focus-ring`.
- Geist Sans and Geist Mono via `next/font/google` in `src/app/layout.tsx`.
- A stock create-next-app landing page and a working auth slice under `src/app/(auth)`, `src/app/account`, and `src/components/auth`.
- Vitest and Testing Library.
- `sonner@^2.0.8` as the single toast implementation; no icon, chart, or UI component package.

Other screens may still use one-off utility classes until their own approved migration tasks. Do not perform an unrelated visual rewrite inside a feature task.

### 1.4 Visual inspiration

CamiConnect should feel like a well-run modern clinic: bright waiting room, clear signage, unhurried staff. Reference qualities:

- Plenty of white and light blue, with one confident blue for actions.
- Soft shapes, readable type, and obvious next steps.
- Thin rules and quiet structure that never shout.
- Reassuring, plain-language copy.

Do **not** copy any third-party brand, logo, illustration set, or page layout. Do not imitate hospital stock-photo clichés.

### 1.5 Design authority and conflict order

1. Safety, security, and privacy.
2. Approved scope and acceptance criteria.
3. `SPEC.md` and `TEST.md`.
4. `AGENTS.md`.
5. This document.
6. Individual agent or developer preference.

When a requested change would alter the foundations (new accent family, type scale, grid model, dependency, or visual direction), stop and request approval first.

---

## 2. Design Direction

### 2.1 Product character

CamiConnect should feel:

- **Trustworthy:** calm hierarchy, explicit statuses, no decorative urgency.
- **Caring:** soft corners, warm clear language, gentle blue tints instead of stark grey.
- **Clean:** white surfaces, airy spacing, one main action per region.
- **Legible:** generous type, strong contrast, obvious focus states.
- **Quiet:** no neon, no glassmorphism, no heavy shadows, no entertainment motion.

The interface serves patients who may be anxious or unwell and staff who work quickly. Visual style must never reduce clarity.

### 2.2 Core principles

1. **Clarity before decoration.** Use layout, spacing, and type hierarchy before color, shadow, or animation.
2. **One layout system.** Every screen uses the same container and column model, with density adjusted per screen.
3. **Blue means "act or inform".** Primary blue marks actions, links, and selection. It is not wallpaper.
4. **Color carries meaning.** Use semantic tokens. Do not scatter raw palette classes through components.
5. **Status is never color-only.** Pair color with text and an icon.
6. **Softness without ambiguity.** Rounded shapes and tinted surfaces must still show clear control boundaries.
7. **Calm motion.** Motion confirms a state change; it does not entertain.
8. **Server truth is visible.** Never imply an appointment is confirmed, a document is published, or availability is guaranteed before the server says so.
9. **Accessible by default.** Keyboard operation, focus, contrast, reduced motion, and responsive behavior are part of "done".
10. **Smallest system that works.** Prefer CSS and existing Tailwind utilities over new abstractions or dependencies.

### 2.3 Visual signature

- A bright canvas with a faint blue tint, and white content surfaces.
- A soft, fading blue grid in hero and header bands only.
- A pale-blue "header wash" at the top of public and patient pages.
- Confident clinical blue for primary actions; sky blue as a gentle supporting accent.
- 12px-radius cards with 1px blue-grey borders and, when floating, a soft blue-tinted shadow.
- Compact, friendly headings; generous section spacing; readable line length.
- Status chips and inline messages combining text, icon, and border.

### 2.4 What to avoid

- Neon blues, glow effects, blurred glass panels, and dark "cyber" styling.
- Saturated full-page blue backgrounds. White and pale blue dominate.
- Large radii beyond 16px on structural surfaces; fully round primary buttons.
- Heavy drop shadows, or a shadow on every card.
- Red and green as the only difference between states.
- Icon-only actions without an accessible name.
- Cross symbols, heartbeat lines, or stethoscope clip-art used as decoration.
- Fake statistics, fake doctors, fake availability, or decorative patient data.
- Toasts as the only confirmation of a booking or other authoritative change.
- Animated backgrounds, parallax, or autoplay motion.

---

## 3. Layout Grid and Background Texture

### 3.1 Two layers, two jobs

1. **Structural grid:** the Tailwind column grid that governs layout and alignment. It is authoritative.
2. **Background texture:** a faint blue square pattern that fades out. It is decorative, used sparingly, and never drives spacing decisions.

Both share the 4px base unit and 8px rhythm.

### 3.2 Structural grid

| Breakpoint | Viewport | Columns | Page padding | Gutter | Typical use |
|---|---:|---:|---:|---:|---|
| Base | < 40rem (640px) | 4 | 1rem | 1rem | Single-column flows |
| `sm` | ≥ 40rem | 4 | 1.5rem | 1rem | Wider forms |
| `md` | ≥ 48rem | 8 | 1.5rem | 1.5rem | Tablet, two-column forms |
| `lg` | ≥ 64rem | 12 | 2rem | 1.5rem | Dashboards, chat split view |
| `xl` / `2xl` | ≥ 80rem | 12 | 2rem | 1.5rem | Max content width; extra space is outer whitespace |

Tailwind default breakpoints are sufficient. Do not add custom breakpoints without approval.

**Page container:** `mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8` (also available as `page-container`).

- Long patient-facing text: `max-w-prose` (65ch).
- Auth forms: `max-w-md` (28rem); compact cards may use `max-w-sm`.
- Chat thread: `max-w-3xl` inside its column.

**Layout checklist:**

- [ ] One `<main>` and one page-level container.
- [ ] Cards span whole columns, never arbitrary pixel widths.
- [ ] Headings align to the same left edge as body content.
- [ ] Navigation aligns to the page container, not the viewport edge.
- [ ] Section rules span the container; full-bleed bands keep their content inside the container.
- [ ] No negative margins used to fake alignment.
- [ ] Gaps come from the responsive gap scale.

### 3.3 Background texture (soft grid)

A repeating square pattern from two 1px linear gradients, **masked so it fades toward the bottom of its band**. This keeps the technical signature faint and keeps hospital content calm.

| Token | Base | `md` and above | Notes |
|---|---:|---:|---|
| `--grid-cell` | 3rem | 4rem | Larger cells reduce noise |
| `--grid-line` (light) | `rgb(29 78 216 / 0.06)` | same | Blue-tinted, decorative |
| `--grid-line` (dark) | `rgb(190 215 255 / 0.07)` | same | Quiet in dark mode |

Rules:

- Lines are exactly **1px**, drawn with background gradients, not borders on every cell.
- Lines are decorative, carry no meaning, and are not subject to text contrast requirements. They must never reduce text legibility.
- Apply the texture to **bands** (hero, page header), not the whole page. Use the `bg-grid-fade` utility (§3.9) so it fades out.
- Text blocks sit on an opaque `surface` or `canvas` when the texture would otherwise reduce readability.
- No `background-attachment: fixed`, no animation, no parallax, no scale change on scroll.
- Static CSS only: no dependency, image request, or JavaScript.
- Apply it once per band; do not repeat it on cards.

### 3.4 Texture and wash by surface

| Surface | Texture | Header wash | Rationale |
|---|---|---|---|
| Public landing and information pages | On, hero band, fading | On | Establishes identity; welcoming first impression |
| Authentication pages | On, behind an opaque card | Off | Keeps the shell consistent without competing with the form |
| Patient portal and appointments | Page header band only | On | Orientation without noise behind slots and forms |
| Chatbot | Page margins only; conversation panel opaque | Off | The conversation is the focus |
| Doctor dashboard | Off | Optional on header band | Dense work area |
| Administrator dashboard | Off | Optional on header band | Operational density first |
| Analytics | Off behind chart cards | Optional on shell | Charts need a quiet field |
| Dialogs, popovers, menus | Off | Off | Overlays must separate cleanly |
| Print | Off | Off | No decoration in printed material |
| Forced-colors mode | Off | Off | Let the system palette define boundaries |

### 3.5 Header wash

A single static, very pale vertical gradient from `primary-soft` to `canvas`, used behind page-header bands and the hero. It gives a clean, clinical "daylight" feel without decoration.

Rules:

- One wash per page, at the top. Never behind tables, forms, or chat.
- Static; never animated.
- Text on the wash must meet contrast against the *darker* end of the gradient.
- Removed in print and forced-colors mode.

### 3.6 Optional content frame

At `lg` and above, public and patient pages may use one thin vertical frame:

```html
<div class="mx-auto min-h-dvh w-full max-w-7xl px-4 sm:px-6 lg:border-x lg:border-line lg:px-8">
  <!-- page content -->
</div>
```

At most one frame per page. Omit it on data-dense dashboards.

### 3.7 Alignment and spacing rules

- **Base unit:** 4px. **Typographic rhythm:** 8px.
- Component heights are multiples of 4px; primary touch targets are at least 44px.
- Use `gap-*` between grid children; do not imitate gaps with margins.
- Use `flex flex-col gap-*` for vertical stacks; do not mix with `space-y-*` in one stack.
- Section boundaries use `border-t border-line`, aligned to the container.
- Card padding: `p-4` mobile, `p-6` desktop; compact data cards `p-3`.
- Page header spacing: `mb-8 lg:mb-12`.
- Avoid fractional widths and one-off pixel values unless intrinsic to an asset.
- Never offset content to line up with a decorative grid cell.

### 3.8 Responsive behavior

**Base (320–639px):** four columns; one-column cards, forms, chat, and lists; navigation collapses into an accessible disclosure; tables scroll in a labelled region or become stacked records; page padding 16px; section spacing 48px; no horizontal page scroll at 320px.

**Tablet (`md`):** eight columns; two-column card groups and forms where labels stay readable; sidebar becomes a top section or drawer; section spacing 64px.

**Desktop (`lg`):** twelve columns; chat splits into conversation and source rail; dashboards may use a persistent sidebar; analytics KPI cards may sit four across; section spacing 96px. Do not stretch reading text across 12 columns.

**Large desktop (`xl`):** content stays capped at 80rem. Do not increase font sizes just because the viewport is wider.

**Required viewport checks:** 320, 375, 768, 1024, 1440px; 200% zoom; no loss of content or function.

### 3.9 Accessibility of the texture

- Decorative CSS only; if ever implemented as a DOM overlay it must be `aria-hidden="true"` and `pointer-events-none`.
- Structural lines are never the only way to perceive a region boundary. Pair them with headings, spacing, and surface changes.
- Control boundaries use the stronger `--control-line` token (§4.3), not the decorative grid line.
- Texture must not overlap form fields, focus rings, chart labels, or message text.
- Forced-colors mode: `background-image: none`.
- `prefers-contrast: more`: grid may become slightly stronger but stays below content contrast.
- Print: texture and wash removed.

### 3.10 CSS implementation

Target for `src/app/globals.css`. Apply in a focused task; keep temporary aliases for old tokens only while a single change is in flight.

```css
@import "tailwindcss";

:root {
  color-scheme: light;

  /* Surfaces */
  --canvas: #ffffff;
  --surface: #ffffff;
  --surface-muted: #f1f5fb;

  /* Text */
  --ink: #0f2342;
  --ink-secondary: #3b5275;
  --ink-muted: #587093;

  /* Structure */
  --line: #e2e9f5;
  --line-strong: #c6d3ea;
  --control-line: #7a8fb0;
  --grid-line: rgb(29 78 216 / 0.06);
  --grid-cell: 3rem;
  --page-padding: 1rem;
  --overlay: rgb(15 35 66 / 0.45);

  /* Brand and interaction */
  --primary: #1d4ed8;
  --primary-hover: #1e40af;
  --primary-soft: #eaf2ff;
  --primary-ink: #ffffff;
  --accent: #0369a1;
  --accent-soft: #e0f2fe;
  --accent-ink: #ffffff;
  --focus: #2563eb;

  /* Status (unchanged meanings) */
  --success: #166534;
  --success-soft: #dcfce7;
  --success-soft-ink: #166534;
  --warning: #92400e;
  --warning-soft: #fef3c7;
  --warning-soft-ink: #92400e;
  --danger: #991b1b;
  --danger-hover: #7f1d1d;
  --danger-ink: #ffffff;
  --danger-soft: #fee2e2;
  --danger-soft-ink: #991b1b;

  /* Charts */
  --chart-1: #1d4ed8;
  --chart-2: #0369a1;
  --chart-3: #6d28d9;
  --chart-4: #b45309;
  --chart-5: #be123c;
  --chart-6: #475569;

  /* Header wash */
  --wash: linear-gradient(to bottom, #f7faff, #ffffff);

  /* Elevation (soft, blue-tinted) */
  --elevation-card: 0 1px 2px rgb(15 35 66 / 0.04), 0 4px 12px -4px rgb(29 78 216 / 0.08);
  --elevation-overlay: 0 24px 56px -24px rgb(15 35 66 / 0.35);
}

@media (min-width: 40rem) {
  :root { --page-padding: 1.5rem; }
}

@media (min-width: 48rem) {
  :root { --grid-cell: 4rem; }
}

@media (min-width: 64rem) {
  :root { --page-padding: 2rem; }
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;

    --canvas: #0a1628;
    --surface: #0f1f38;
    --surface-muted: #14284a;

    --ink: #e8f0fe;
    --ink-secondary: #bccbe3;
    --ink-muted: #93a7c6;

    --line: #223a5e;
    --line-strong: #33507d;
    --control-line: #6482ad;
    --grid-line: rgb(190 215 255 / 0.07);
    --overlay: rgb(0 0 0 / 0.65);

    --primary: #8ab8ff;
    --primary-hover: #b6d3ff;
    --primary-soft: #12305c;
    --primary-ink: #0a1628;
    --accent: #7dd3fc;
    --accent-soft: #0f2f47;
    --accent-ink: #0a1628;
    --focus: #8ab8ff;

    --success: #86efac;
    --success-soft: #0f2e1d;
    --success-soft-ink: #bbf7d0;
    --warning: #fcd34d;
    --warning-soft: #3a2a0a;
    --warning-soft-ink: #fde68a;
    --danger: #fca5a5;
    --danger-hover: #fecaca;
    --danger-ink: #3b1215;
    --danger-soft: #3b1215;
    --danger-soft-ink: #fecaca;

    --chart-1: #8ab8ff;
    --chart-2: #7dd3fc;
    --chart-3: #c4b5fd;
    --chart-4: #fcd34d;
    --chart-5: #fda4af;
    --chart-6: #cbd5e1;

    --wash: linear-gradient(to bottom, #0f2547, #0a1628);
    --elevation-card: 0 1px 2px rgb(0 0 0 / 0.3);
    --elevation-overlay: 0 24px 56px -24px rgb(0 0 0 / 0.7);
  }
}

@media (prefers-contrast: more) {
  :root { --grid-line: rgb(29 78 216 / 0.14); }
}

@media (prefers-color-scheme: dark) and (prefers-contrast: more) {
  :root { --grid-line: rgb(190 215 255 / 0.14); }
}

@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);

  --color-canvas: var(--canvas);
  --color-surface: var(--surface);
  --color-surface-muted: var(--surface-muted);

  --color-ink: var(--ink);
  --color-ink-secondary: var(--ink-secondary);
  --color-ink-muted: var(--ink-muted);

  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-control-line: var(--control-line);
  --color-overlay: var(--overlay);

  --color-primary: var(--primary);
  --color-primary-hover: var(--primary-hover);
  --color-primary-soft: var(--primary-soft);
  --color-primary-ink: var(--primary-ink);
  --color-accent: var(--accent);
  --color-accent-soft: var(--accent-soft);
  --color-accent-ink: var(--accent-ink);
  --color-focus: var(--focus);

  --color-success: var(--success);
  --color-success-soft: var(--success-soft);
  --color-success-soft-ink: var(--success-soft-ink);
  --color-warning: var(--warning);
  --color-warning-soft: var(--warning-soft);
  --color-warning-soft-ink: var(--warning-soft-ink);
  --color-danger: var(--danger);
  --color-danger-hover: var(--danger-hover);
  --color-danger-ink: var(--danger-ink);
  --color-danger-soft: var(--danger-soft);
  --color-danger-soft-ink: var(--danger-soft-ink);

  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-chart-6: var(--chart-6);

  --shadow-card: var(--elevation-card);
  --shadow-overlay: var(--elevation-overlay);
}

/* Full-strength grid (use only inside an opaque-card shell such as auth) */
@utility bg-grid {
  background-image:
    linear-gradient(to right, var(--grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px);
  background-size: var(--grid-cell) var(--grid-cell);
}

/* Grid that fades out toward the bottom of its band (hero, page header) */
@utility bg-grid-fade {
  background-image:
    linear-gradient(to right, var(--grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px);
  background-size: var(--grid-cell) var(--grid-cell);
  mask-image: linear-gradient(to bottom, black 30%, transparent 100%);
}

@utility bg-wash {
  background-image: var(--wash);
}

@utility page-container {
  width: 100%;
  max-width: 80rem;
  margin-inline: auto;
  padding-inline: var(--page-padding);
}

@utility focus-ring {
  &:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
}

@media (forced-colors: active) {
  .bg-grid,
  .bg-grid-fade,
  .bg-wash {
    background-image: none;
  }
}

@media print {
  .bg-grid,
  .bg-grid-fade,
  .bg-wash {
    background-image: none;
  }
}

body {
  background-color: var(--canvas);
  color: var(--ink);
  font-family: var(--font-geist-sans);
}
```

**Notes:**

- `@theme inline` maps raw values to utilities such as `bg-canvas`, `text-ink`, `border-line`, and `shadow-overlay`.
- `mask-image` on `bg-grid-fade` also masks the element's children. Apply it to a dedicated decorative layer (an absolutely positioned, `aria-hidden` sibling behind the band's content), **not** to a wrapper that contains text.
- Do not remove outlines with `outline-none` unless an equivalent visible treatment exists.
- Do not add `tailwind.config.ts` or a PostCSS config; the Turbopack loader pipeline stays authoritative.
- Replace the old `--background` and `--foreground` tokens during a dedicated migration.

### 3.11 Usage pattern

```html
<body class="min-h-full bg-canvas font-sans text-ink">
  <a class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-ink focus-ring" href="#main">
    Skip to content
  </a>

  <header class="border-b border-line bg-surface">
    <div class="page-container flex min-h-16 items-center justify-between gap-4">
      <!-- navigation -->
    </div>
  </header>

  <!-- Hero / page header band -->
  <div class="relative isolate bg-wash">
    <div aria-hidden="true" class="bg-grid-fade pointer-events-none absolute inset-0 -z-10"></div>
    <div class="page-container py-12 lg:py-20">
      <!-- eyebrow, h1, lead, actions -->
    </div>
  </div>

  <main id="main" class="page-container py-12 lg:py-24">
    <div class="grid grid-cols-4 gap-4 md:grid-cols-8 md:gap-6 lg:grid-cols-12">
      <section class="col-span-4 md:col-span-8 lg:col-span-7">
        <!-- primary content -->
      </section>
      <aside class="col-span-4 md:col-span-8 lg:col-span-4 lg:col-start-9">
        <!-- supporting content -->
      </aside>
    </div>
  </main>
</body>
```

If the hero band sits outside `<main>`, keep a single `<h1>` per page and ensure landmarks stay correct.

---

## 4. Design Tokens

### 4.1 Token architecture

1. **Raw values** in `:root` and the dark-mode media query: `--canvas`, `--ink`, `--primary`.
2. **Tailwind theme mapping** in `@theme inline`: `--color-canvas`, `--color-ink`, `--color-primary`.
3. **Component classes** using semantic utilities: `bg-canvas`, `text-ink`, `border-line`, `bg-primary`.

Rules:

- New UI uses semantic tokens, not raw palette classes such as `bg-blue-600`, `text-slate-600`, or `border-gray-200`.
- No raw hex values in components. If a value is missing, add a semantic token through an approved design-system change.
- No one-off tokens for a single component unless genuinely component-specific and documented.
- Chart colors use the `chart-*` tokens.
- Opacity modifiers such as `bg-primary/10` are allowed when no `-soft` token fits; prefer the token for repeated patterns.

### 4.2 Color palette — blue and white

White carries content. A very pale blue canvas gives the page a clean, clinical "daylight" feel. One confident blue marks actions. Sky blue supports AI and information cues. Neutrals are blue-tinted navy, never pure black or grey.

**Official hospital colors and logo assets still require approval.** This palette is a proposal and does not claim to be the hospital's brand.

| Token | Light | Dark | Role |
|---|---|---|---|
| `canvas` | `#FFFFFF` | `#0A1628` | Page background (white, owner-approved 2026-10-25) |
| `surface` | `#FFFFFF` | `#0F1F38` | Cards, tables, dialogs, header |
| `surface-muted` | `#F1F5FB` | `#14284A` | Secondary panels, kanban columns, disabled fields, user chat bubbles |
| `ink` | `#0F2342` | `#E8F0FE` | Primary text (deep navy) |
| `ink-secondary` | `#3B5275` | `#BCCBE3` | Supporting text |
| `ink-muted` | `#587093` | `#93A7C6` | Metadata, captions |
| `line` | `#E2E9F5` | `#223A5E` | Decorative and structural borders |
| `line-strong` | `#C6D3EA` | `#33507D` | Hover borders, selected containers |
| `control-line` | `#7A8FB0` | `#6482AD` | Input, select, textarea boundaries |
| `primary` | `#1D4ED8` | `#8AB8FF` | Primary action, active navigation, links |
| `primary-hover` | `#1E40AF` | `#B6D3FF` | Primary hover |
| `primary-soft` | `#EAF2FF` | `#12305C` | Selected rows, soft callouts, header wash start |
| `primary-ink` | `#FFFFFF` | `#0A1628` | Text/icon on primary |
| `accent` | `#0369A1` | `#7DD3FC` | Sky-blue support accent; AI and information cues |
| `accent-soft` | `#E0F2FE` | `#0F2F47` | Accent callouts |
| `accent-ink` | `#FFFFFF` | `#0A1628` | Text/icon on accent |
| `success` | `#166534` | `#86EFAC` | Success icon/border |
| `success-soft` | `#DCFCE7` | `#0F2E1D` | Success badge background |
| `success-soft-ink` | `#166534` | `#BBF7D0` | Success text on soft background |
| `warning` | `#92400E` | `#FCD34D` | Warning icon/border |
| `warning-soft` | `#FEF3C7` | `#3A2A0A` | Warning badge background |
| `warning-soft-ink` | `#92400E` | `#FDE68A` | Warning text on soft background |
| `danger` | `#991B1B` | `#FCA5A5` | Destructive action, error icon/border |
| `danger-hover` | `#7F1D1D` | `#FECACA` | Destructive hover |
| `danger-ink` | `#FFFFFF` | `#3B1215` | Text/icon on solid danger |
| `danger-soft` | `#FEE2E2` | `#3B1215` | Error background |
| `danger-soft-ink` | `#991B1B` | `#FECACA` | Error text on soft background |
| `focus` | `#2563EB` | `#8AB8FF` | Focus outline |
| `overlay` | `rgb(15 35 66 / 0.45)` | `rgb(0 0 0 / 0.65)` | Modal backdrop |

**Color usage ratio:** roughly 85% white and pale blue, 10% navy text, 5% primary blue and status colors. If a screen looks "very blue", reduce solid blue fills.

**Use of accent:** sky blue is a supporting color, not a second primary. Use it for AI and support cues, informational callouts, or a supporting chart series. Do not use it for destructive, warning, or critical actions. Because primary and accent are both blue, never rely on their difference alone; pair accent cues with a label or icon.

**Status colors stay conventional** (green, amber, red). Blue does not mean success.

### 4.3 Contrast requirements

Target: **WCAG 2.1 AA** for patient-facing flows (`SPEC.md` §8.1).

The ratios below are approximate design targets. **Verify each pair with a contrast tool during implementation and record results**; if a value falls short, darken the text token rather than weakening the requirement.

| Pair | Target | Requirement |
|---|---:|---|
| `ink` on `canvas` | ≥ 14:1 | AAA for normal text |
| `ink-secondary` on `surface` | ≥ 7:1 | AAA for normal text |
| `ink-muted` on `canvas` | ≥ 4.5:1 | AA; do not lighten further |
| `primary` on `surface` | ≥ 6:1 | AA for links and text |
| `primary-ink` on `primary` | ≥ 6:1 | AA for button text |
| `accent-ink` on `accent` | ≥ 5:1 | AA |
| `control-line` on `surface` | ≥ 3:1 | Non-text 3:1 for control boundaries |
| `focus` on `surface` and `canvas` | ≥ 3:1 | Visible focus ring |
| `primary` on `primary-soft` | ≥ 4.5:1 | Selected rows, chips |
| `success/warning/danger-soft-ink` on matching soft | ≥ 4.5:1 | AA |
| `ink` on dark `canvas` | ≥ 14:1 | AAA |

Rules:

- Normal text ≥ **4.5:1**; large text (≥24px regular or ≥18.66px bold) ≥ **3:1**.
- Control boundaries and focus indicators ≥ **3:1** against adjacent colors. Use `control-line`, not `line`, for inputs.
- Decorative grid lines and section rules need not meet 3:1, but must not be the only way to identify a required boundary or control.
- Never place `ink-muted` over `primary-soft`, `surface-muted`, the header wash, or a chart color without checking the actual pair.
- Never use color alone for status; add text and an icon.
- Re-check dark-mode pairs after any palette change.

### 4.4 Typography

Use the existing Geist Sans and Geist Mono from `src/app/layout.tsx`. No new font dependency without approval. If the hospital has an official typeface, review licensing, performance, and legibility before replacing Geist.

| Role | Size / line height | Weight | Suggested classes | Use |
|---|---|---|---|---|
| Display | 44–56px / 1.1 | 600 | `text-4xl sm:text-5xl tracking-tight` | Landing hero only |
| H1 | 30–36px / 1.2 | 600 | `text-3xl lg:text-4xl tracking-tight` | Page title |
| H2 | 24–30px / 1.25 | 600 | `text-2xl lg:text-3xl tracking-tight` | Section title |
| H3 | 20–24px / 1.3 | 600 | `text-xl lg:text-2xl` | Card/group title |
| H4 | 18–20px / 1.4 | 500–600 | `text-lg font-medium` | Subsection |
| Lead | 18–20px / 1.6 | 400 | `text-lg leading-8 text-ink-secondary` | Intro paragraph |
| Body | 16px / 1.65 | 400 | `text-base leading-7` | Default text |
| Small | 14px / 1.5 | 400–500 | `text-sm leading-6` | Helper text, table cells |
| Caption | 12px / 1.4 | 500 | `text-xs leading-5 text-ink-muted` | Metadata, timestamps |
| Eyebrow | 13–14px / 1.4 | 500–600 | `text-sm font-medium text-primary` | Section label above a heading, sentence case, optional small leading dot |
| Code/ID | 12–14px / 1.5 | 400 | `font-mono text-xs` / `text-sm` | Request IDs, appointment references, source references |

Rules:

- Body text is at least 16px on patient-facing pages. Use 14px for secondary UI text and table cells; 12px for metadata only, never for essential instructions.
- No more than three weights in one view (typically 400, 500, 600).
- Use `text-balance` for short headings and `text-pretty` for paragraphs where supported.
- Long-form text at `max-w-prose` (65ch). Chat messages 60–70ch.
- Use `tabular-nums` for aligned numeric columns and timestamps.
- **No uppercase eyebrows.** Use sentence case everywhere, including table headers. Monospace is reserved for IDs, references, and code.
- No letter-spacing on body text.
- Sentence case for headings, labels, buttons, and status text.
- Preserve logical heading order; do not choose a level for its visual size.

### 4.5 Spacing, containers, borders, radii, and elevation

**Spacing scale (Tailwind defaults, 4px base):**

| Token | Value | Typical use |
|---|---:|---|
| `1` | 4px | Icon gap, tight inline spacing |
| `2` | 8px | Label/input gap, badge gap |
| `3` | 12px | Compact padding |
| `4` | 16px | Default gap, mobile card padding |
| `6` | 24px | Desktop card padding, form group gap |
| `8` | 32px | Page header gap |
| `12` | 48px | Mobile section spacing |
| `16` | 64px | Tablet section spacing |
| `24` | 96px | Desktop section spacing |

- `gap-4 md:gap-6` for most card grids; `gap-6 lg:gap-8` for major sections.
- Page section padding `py-12 lg:py-24`; hero `py-16 lg:py-24`.
- Form field stack `flex flex-col gap-2`; form group stack `flex flex-col gap-6`.
- Table cell padding `px-4 py-3`; compact tables `px-3 py-2.5`.
- Do not use `space-x-*` for layout where `gap-*` is available.

**Borders:**

- Default: `border border-line` (1px).
- Hover/selected container: `border-line-strong`.
- Form controls: `border border-control-line`.
- Focus: 2px outline, 2px offset, `focus-ring`.
- Use a 2px border only for a selected-state indicator or focus; never a full double border.

**Radii (softer than v0.2):**

| Element | Class | Value |
|---|---|---:|
| Badges/status chips | `rounded-full` | Pill |
| Buttons, inputs, selects, textareas | `rounded-lg` | 8px |
| Cards, panels, tables | `rounded-xl` | 12px |
| Dialogs, large overlays | `rounded-2xl` | 16px |
| Inline code | `rounded-sm` | 4px |

No radius above 16px on structural surfaces. Pills are for badges and compact toggles, not primary buttons.

**Elevation (soft, blue-tinted):**

- Default: no shadow. Use borders and surface changes.
- Floating cards (for example the auth card or a sticky booking summary): `shadow-card`. Content cards in a flow: none.
- Sticky navigation: no shadow; `border-b border-line`.
- Dialogs, menus, popovers, toasts: `shadow-overlay`.
- Never use a shadow to compensate for low contrast or missing spacing.

**Z-index:**

| Layer | Class | Value |
|---|---|---:|
| Page content | `z-0` | 0 |
| Sticky header | `z-20` | 20 |
| Dropdown/menu | `z-30` | 30 |
| Modal backdrop | `z-40` | 40 |
| Dialog | `z-50` | 50 |
| Toast | `z-60` | 60 |

Use these named layers consistently. No arbitrary values such as `z-[9999]`. Verify Sonner's stacking against dialogs and sticky headers at implementation.

### 4.6 Chart palette

Chart tokens are proposed defaults, not a substitute for accessible chart design.

| Token | Light | Dark | Suggested series |
|---|---|---|---|
| `chart-1` | `#1D4ED8` | `#8AB8FF` | Primary volume/series |
| `chart-2` | `#0369A1` | `#7DD3FC` | Secondary series |
| `chart-3` | `#6D28D9` | `#C4B5FD` | Comparison series |
| `chart-4` | `#B45309` | `#FCD34D` | Warning/attention series |
| `chart-5` | `#BE123C` | `#FDA4AF` | Negative/cancellation series |
| `chart-6` | `#475569` | `#CBD5E1` | Neutral/reference series |

`chart-1` and `chart-2` are both blue; never distinguish them by hue alone. Use direct labels, markers, dash patterns, or a legend with labels.

Rules:

- Never rely on color alone. Use direct labels, legends, line styles, markers, or patterns.
- Every chart needs an accessible table or text summary (`UI-006`, `A11Y-09`).
- Red and green are not acceptable as the only distinction between success and failure.
- Measured values and AI-generated explanations are visually separate. AI text gets an explicit label and a distinct surface, with a divider from measurements.
- Charts do not imply causation.
- No chart library until approved and evaluated for bundle size, accessibility, and server/client boundaries.

### 4.7 Layout tokens summary

| Token | Value |
|---|---|
| Page max width | `80rem` / 1280px |
| Page padding | 16px base, 24px `sm`/`md`, 32px `lg`+ |
| Columns | 4 / 8 / 12 |
| Gutters | 16px / 24px / 24px |
| Base unit | 4px |
| Grid cell | 48px base, 64px `md`+ |
| Grid line | `rgb(29 78 216 / 0.06)` light; `rgb(190 215 255 / 0.07)` dark |
| Header height | 64px (`min-h-16`) |
| Primary touch target | ≥ 44px |
| Prose measure | 65ch |
| Auth form width | 28rem max (`max-w-md`) |
| Chat thread | 48rem max (`max-w-3xl`) |

### 4.8 Motion

- Motion explains a state change: menu open, dialog enter, toast enter/exit, loading indication.
- Durations: 150ms for color/border/opacity; 200ms for dialogs and toasts; no more than 250ms for UI transitions.
- Ease-out for entering, ease-in for exiting.
- Animate transform/opacity rather than layout properties.
- No animated grid, background, or page transitions.
- Under `prefers-reduced-motion: reduce`, remove non-essential transitions and animations, including decorative skeleton pulses. Functional loading text and status remain.
- Never animate a confirmation state in a way that implies success before the server responds.

---

## 5. Component Patterns

These are visual contracts, not a requirement to build a component library immediately. Build a reusable primitive only when used in at least two places or when it prevents a real consistency risk.

### 5.1 Buttons

| Variant | Use | Classes |
|---|---|---|
| Primary | The single main action in a region | `border-primary bg-primary text-primary-ink hover:bg-primary-hover` |
| Secondary | Alternative action | `border-line-strong bg-surface text-primary hover:bg-primary-soft` |
| Ghost | Low-emphasis action | `border-transparent bg-transparent text-ink hover:bg-surface-muted` |
| Danger | Confirmed destructive action | `border-danger bg-danger text-danger-ink hover:bg-danger-hover` |
| Link | Inline navigation/action | `text-primary underline underline-offset-4 hover:text-primary-hover` |

**Sizes:**

- `sm`: `min-h-9 px-3 text-sm` for dense toolbar actions; provide a 44px target area where practical.
- `md` (default): `min-h-11 px-4 text-sm` (44px).
- `lg`: `min-h-12 px-5 text-base` (48px) for primary patient actions.

```html
<button class="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-4 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60">
  Book appointment
</button>
```

Rules:

- `<button>` for actions, `<a>` for navigation. Never a link for a mutation or a button for navigation.
- One primary button per region.
- Pending state: disable, add `aria-busy="true"`, change the label to a specific phrase ("Booking…"). A spinner alone is not enough.
- Preserve button width during pending where practical.
- Destructive buttons appear only after a confirmation dialog, with explicit verbs ("Cancel appointment", not "Yes").
- Icon-only buttons need an accessible name via `aria-label` or visually hidden text.
- Hover is never the only affordance; define focus, active, disabled, and pending states.
- Do not disable a button without explaining why nearby.

### 5.2 Links

- Inline links use `primary` and an underline with 4px offset.
- Navigation links do not rely on color alone; the active item uses `aria-current="page"` plus a visible underline or rule.
- External links use an icon and accessible text indicating a new context where relevant.
- Never `href="#"` for an action.

### 5.3 Form controls

**Field anatomy:** visible `<label>` above the control; optional help text; control; error message tied with `aria-describedby`; optional character counter.

```html
<input class="min-h-11 w-full rounded-lg border border-control-line bg-surface px-3 text-base text-ink placeholder:text-ink-muted focus-ring aria-[invalid=true]:border-danger" />
```

Rules:

- Inputs and selects are at least 44px high.
- `text-base` on mobile inputs to avoid iOS zoom.
- No placeholders as labels.
- Required fields are marked in label text, not only with an asterisk. If an asterisk is used, explain it once.
- Error state: `aria-invalid="true"`, `aria-describedby` to the error, and a visible message with an icon or explicit "Error:" text. Never rely on red alone.
- Validation messages appear beside the field and in a summary when multiple fields fail. Focus the summary or first invalid field after submit.
- Disabled fields use `bg-surface-muted text-ink-muted`; never hide required information in a disabled field.
- Read-only fields stay legible and are not styled as disabled.
- Password fields have a correctly labelled, keyboard-operable reveal control; never log the value.
- Use native `<select>` with a visible chevron unless a custom listbox is fully accessible.
- Checkboxes and radios have a 44px target area, a visible label, and a clear focus ring; selected state is not color-only.
- File uploads show accepted types and size limits before selection, then file name, progress, and errors (`UI-005`).

**Form-level messages:**

- Error summary: `role="alert"`, focusable (`tabIndex={-1}`), at the top of the form.
- Success/status: `role="status"` or another polite live region.
- Never use a toast as the only place a field error appears.
- Preserve non-sensitive input values on failure; clear passwords as the existing auth implementation requires.

### 5.4 Cards and panels

```html
<section class="rounded-xl border border-line bg-surface p-4 sm:p-6">
  <h2 class="text-xl font-semibold text-ink">Appointment details</h2>
  <p class="mt-2 text-sm leading-6 text-ink-secondary">…</p>
</section>
```

Rules:

- Cards group content; they are not required for every section.
- Default card: 1px `line` border, `bg-surface`, 12px radius, no shadow. Floating cards add `shadow-card`.
- Interactive cards change border to `line-strong` on hover and show a clear focus-within treatment; they must not move or lift.
- No card inside a card unless the inner surface is materially different (a callout or a table).
- Callouts use `primary-soft` or `accent-soft` with a 1px matching border and an icon.
- Cards align to whole columns and share height only where comparison matters.
- Use `min-w-0` on flex/grid children containing long text or tables.
- Panels containing tables use `overflow-hidden` on the outer surface and a separately scrollable table region.

### 5.5 Badges and status

**Status vocabulary comes from the server/API.** Do not invent statuses or friendlier relabels without a documented contract.

| Tone | Background | Text | Border | Use |
|---|---|---|---|---|
| Neutral | `bg-surface-muted` | `text-ink-secondary` | `border-line` | Draft, unknown, inactive |
| Primary | `bg-primary-soft` | `text-primary` | `border-primary/30` | Selected, informational |
| Success | `bg-success-soft` | `text-success-soft-ink` | `border-success/30` | Confirmed/completed where the API says so |
| Warning | `bg-warning-soft` | `text-warning-soft-ink` | `border-warning/30` | Pending, attention required |
| Danger | `bg-danger-soft` | `text-danger-soft-ink` | `border-danger/30` | Failed, cancelled, error |

```html
<span class="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning-soft-ink">
  <svg aria-hidden="true" class="size-3.5"><!-- status icon --></svg>
  Pending
</span>
```

Rules:

- Always a text label; add an icon where helpful. A colored dot alone is not sufficient.
- Short, sentence-case labels.
- Do not use success styling for "request received" when the appointment is not confirmed. Use neutral or warning tone and the server's actual status.
- Announce status changes in tables politely if they update without a page reload.
- Badges are not buttons. If a status is actionable, use a separate button or menu with an accessible name.

### 5.6 Navigation

**Global header:**

- 64px height (`min-h-16`), `border-b border-line`, `bg-surface`, no shadow.
- Left: "CamiConnect" text wordmark and, where space allows, the hospital name.
- Center/right: primary navigation (Departments, Doctors, Appointments, Chat), only where these routes exist and access policy allows.
- Right: account/sign-in action. Role-aware navigation is cosmetic only; it never grants authorization.
- Current page: `aria-current="page"` plus a visible underline or bottom border in `primary`.
- Mobile: accessible disclosure button with `aria-expanded` and `aria-controls`; visible focus; Escape closes; never hover-only.
- Skip link is the first focusable element and targets `<main>`.

**Dashboard sidebar:**

- 240px (`w-60`) at `lg` and above; collapsible drawer below.
- Group items by task, not by database entity.
- Text labels, not icon-only navigation.
- Active item: `bg-primary-soft`, `text-primary`, and a 2px left rule; not color-only.
- The sidebar scrolls independently only when necessary.

**Footer:**

- 1px top border, `text-sm text-ink-muted`, links in a simple grid.
- Approved information only: hospital contact details, hours, privacy/terms where applicable. Do not invent policies.

### 5.7 Tables

Tables are the default for doctor/admin appointment lists, audit events, and ingestion jobs.

- Semantic `<table>`, `<caption>` (visually hidden if a heading already names it), `<thead>`, `<th scope="col">`, `<tbody>`.
- Header: `text-sm font-medium text-ink-secondary`, background `primary-soft` or `surface-muted`, bottom border. Sentence case, no uppercase.
- Rows: `border-b border-line`; hover `bg-surface-muted`; selected `bg-primary-soft`.
- Cell padding `px-4 py-3`; numeric cells `text-right tabular-nums`.
- Actions column: text button or menu with an accessible name; never an unlabeled icon.
- Wide tables: `overflow-x-auto` wrapper that is focusable with an accessible label. The page itself never overflows horizontally.
- On small screens, scroll horizontally or use a stacked record layout for low-column patient lists. Do not squash columns until text is unreadable.
- Sorting controls are buttons with `aria-sort` on the header. If sorting is not implemented, do not style headers as clickable.
- Empty tables use the empty-state pattern (§5.10), not a blank grid.
- Loading tables use skeleton rows matching final row height with `aria-busy="true"` on the region.

### 5.8 Dialogs

Use dialogs only for focused decisions that cannot be made inline: cancel/reschedule confirmation, destructive admin actions, and short blocking notices.

- Native `<dialog>` or an equivalent fully accessible primitive. No partial focus trap.
- Accessible name (`aria-labelledby`) and description (`aria-describedby`).
- Backdrop `bg-overlay`; no blur.
- Surface: `bg-surface`, `border border-line`, `rounded-2xl`, `shadow-overlay`, `p-6`.
- Focus moves into the dialog; the safe action (Cancel) gets initial focus for destructive dialogs. Escape closes unless closing would lose irreversible data; that exception must be explicit.
- Focus returns to the trigger after close.
- Background content is inert while open.
- Destructive copy names the object and effect: "Cancel appointment with Dr. Santos on 24 October?" The confirm button repeats the verb: "Cancel appointment".
- No auto-confirm on Enter. No dialogs for field validation.
- Toasts may appear above dialogs only if they do not obscure dialog controls; verify stacking and focus.

### 5.9 Toasts — Sonner

**Decision:** Sonner is the toast implementation for CamiConnect, installed as `sonner@^2.0.8` (approved 2026-10-23). The token-styled `AppToaster` is rendered once from the root layout.

**Rules:**

- Render exactly one global `<Toaster />` from a client component in the root layout.
- Do not import Sonner into server components. `src/app/layout.tsx` stays a server component; place a `"use client"` wrapper such as `src/components/ui/app-toaster.tsx` inside it.
- `theme="system"` so light/dark follows system preference.
- Default position bottom-right on desktop, 16px mobile offset. A toast must not cover a required primary action, the chat composer, or a dialog control. Use `offset`/`mobileOffset` or a route-specific position if needed.
- `closeButton`, `visibleToasts={3}`, short gap. Never stack unlimited toasts.
- Use `unstyled` plus semantic class names. Class-name keys were verified against `sonner@2.0.8`.
- Keep Sonner's default live-region behavior; do not add a second `aria-live` wrapper.
- Durations: success/info about 4–5 seconds; errors about 8 seconds with a close button. Critical errors also need a persistent inline message.
- Never the only confirmation of an authoritative state change. Update the page/row/status; the toast is supplementary.
- Never toast field validation errors.
- No sensitive data, full chat messages, passwords, tokens, or raw provider errors in a toast.
- Do not use toasts for 401/403/404 flows that need a page-level state or redirect.
- Auth credential failures may use a supplementary error toast; the inline `role="alert"` summary remains authoritative. A successful sign-in may show a one-time success toast on the redirected page.
- Deduplicate repeated messages with a stable toast `id`.
- Dismiss stale toasts on sign-out if they could reveal prior account activity (`toast.dismiss()`).
- Respect reduced motion; verify Sonner's animations under `prefers-reduced-motion`.
- Do not build a second toast system.

**Wrapper:**

```tsx
"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      theme="system"
      position="bottom-right"
      closeButton
      visibleToasts={3}
      gap={12}
      offset={24}
      mobileOffset={16}
      style={{ zIndex: 60 }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-4 text-ink shadow-overlay",
          title: "text-sm font-medium",
          description: "text-sm text-ink-secondary",
          actionButton:
            "rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-ink focus-ring",
          cancelButton:
            "rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink focus-ring",
          closeButton:
            "rounded-lg p-1 text-ink-muted hover:text-ink focus-ring",
        },
      }}
    />
  );
}
```

Render `<AppToaster />` once in the root layout after the main application content.

**Toast copy examples:**

| State | Title | Description |
|---|---|---|
| Success | "Appointment requested" | "Your request was received. Check the appointment status for confirmation." |
| Success | "Appointment updated" | "The new time is shown in your appointment details." |
| Error | "Could not update the appointment" | "Your changes were not saved. Check your connection and try again." |
| Info | "Connection restored" | "You can continue where you left off." |
| Warning | "Availability may have changed" | "Refresh the slots before choosing a time." |

Copy is short, specific, and never claims more than the server has confirmed.

### 5.10 Loading, empty, success, validation, and error primitives

**Loading:**

- Prefer skeletons that match the final layout over a centered spinner. Skeletons use `surface-muted`.
- `aria-busy="true"` on the loading region plus a visible or visually hidden status ("Loading appointments…").
- No fake content while loading. Do not disable the whole page for a local fetch. Avoid layout shift.

**Empty:**

- Bordered surface, a short heading, one sentence explaining why it is empty, and the next safe action.
- Do not imply data is missing when the user is unauthorized; use the neutral access-denied state (`UI-002`).
- Never invent sample appointments, doctors, or analytics.

**Success:**

- Inline confirmation near the affected object, not only at the top of the page.
- Use a status/live region for screen readers.
- A toast may supplement, never replace, inline confirmation for booking, cancellation, publication, or other authoritative changes.

**Validation:**

- Errors beside fields and in a summary when multiple fields fail; move focus to the summary or first invalid field.
- Keep user input; never clear a whole form because one field failed.
- `role="alert"` for the summary; `aria-describedby` for field errors.
- No toast for validation.

**Error:**

- Distinguish network, timeout, 5xx, 429, 401, 403, 404, and validation errors (`SPEC.md` §8.1).
- Copy explains what happened, whether data was saved, and what to do next.
- Retry only for safe/idempotent reads. Never auto-retry state-changing requests.
- Preserve drafts on chat and form errors where policy allows.
- No raw provider text, stack traces, database errors, or internal request details.
- A request ID may appear as a support reference, never as the primary explanation.

---

## 6. Application UI Guidelines

All screens share tokens, grid, typography, focus treatment, and state patterns. Density and texture change with the task. Requirements come from `SPEC.md`; this section adds no product behavior.

### 6.1 Public landing and information pages

**Goal:** establish trust, explain services and appointment access, and offer a clear route to the chatbot or booking without overwhelming the visitor.

- Hero band with the header wash and a fading grid layer (§3.5, §3.3), with a single outer content frame at `lg` if desired.
- Hero layout: 12 columns, headline in 6–7, supporting copy and actions in 4–5. At `md`, stack.
- One primary action ("Book an appointment" or the approved equivalent) and one secondary ("Ask CamiConnect" or "View departments"). Include only actions that exist in approved requirements.
- Small eyebrow in sentence case for context (for example "United Doctors of St. Camillus De Lellis Hospital") only if the hospital name is approved for display.
- Services/departments: bordered cards on white, 2 columns at `md`, 3 at `lg`; each has a title, one-sentence description, and a text link. Do not invent departments.
- Doctor profiles: only approved public fields. No stock photos presented as hospital staff. Initials or placeholder geometry only if approved.
- Persistent plain-language AI disclaimer where the chatbot is introduced: AI-generated information, not medical advice, not appointment confirmation. Present it in an `accent-soft` callout with an icon.
- Public pages stay navigable when the API or database is unavailable (`SPEC.md` §8.1); static information is not replaced by a generic error page.
- Footer: hospital contact/hours and approved policy links only.
- No carousel, autoplay video, animated statistics, or decorative gradients beyond the single header wash.
- The stock create-next-app landing page is not the final public design. Replacing it requires approval because `ADR-0008` records "keep the stock landing page" for the auth slice. Do not replace it inside an unrelated task.

### 6.2 Authentication pages

Applies to `/login`, `/register`, and account/session states (`UI-002`).

- Page background: plain white `canvas` (owner-approved 2026-10-25; no wash or grid on auth pages); the form sits in a bordered `surface` card.
- Card width `max-w-md`; center with enough top/bottom padding. Not a glass panel.
- Card: 1px `line` border, `rounded-xl`, `p-6 sm:p-8`, `shadow-card`.
- One `<h1>` per page; a text wordmark may link above the card.
- Form controls follow §5.3. Labels always visible; errors inline; the summary receives focus.
- Primary submit button spans the form width on mobile and may be auto-width on desktop; one primary action.
- Registration copy stays neutral and does not enumerate accounts (`UI-002`). No role picker.
- Sign-in failure copy is generic and never reveals whether an email exists. A supplementary toast may repeat the generic message; the inline summary stays authoritative.
- Pending state uses a specific label ("Signing in…", "Creating account…") and blocks double submission.
- Successful sign-in redirects; a one-time success toast may appear on the destination.
- Session-expired and access-denied states use plain page-level messages, not toasts. 403 states never reveal whether a protected resource exists.
- Keep behavior and tests unchanged when adjusting visual details.

### 6.3 Patient appointment booking

Applies to department/doctor browsing, availability, booking, and confirmation (`UI-003`).

**Desktop layout:**

- Page header: title, short description, and a step indicator if the flow has multiple steps.
- Main column (7–8 of 12): department/doctor selection, availability, booking form.
- Side column (4 of 12): selected doctor, appointment summary, policy notes, primary action. May be sticky with `shadow-card`.
- At `md`, stack the summary below selection; on mobile, one column in a clear linear order.

**Availability:**

- Slots are a grid of buttons at least 44px high with time text and an explicit selected state (2px `primary` border, `primary-soft` fill, and a check indicator).
- Unavailable slots are visibly distinct (muted text, strikethrough or "Unavailable" label); never color alone.
- Show times in the approved timezone (Asia/Manila default) and state it where confusion is possible.
- Refresh availability before final confirmation. If a slot disappears, show an inline "slot no longer available" state and let the user choose another (`UI-003`).
- Never label an appointment "confirmed" until the server response says so. Use "request received" or the exact returned status.
- Show backend field errors beside their fields.
- Disable submit while pending; prevent double submission; preserve selections on failure.
- Confirmation card: appointment reference (monospace), doctor, department, date/time, status, and next allowed actions. No fake contact details or policy text.
- Cancellation and rescheduling use a confirmation dialog naming the appointment and consequence.
- A toast may confirm a successful update, but the status card must also update.

### 6.4 Patient appointment list and status

- Page header with a primary "Book appointment" action and, where useful, a filter for upcoming/past, only as supported by the API.
- Desktop: table or list with date/time, doctor, department, status, actions. Mobile: stacked records with the same information in a readable order.
- Status chips use the actual server status and §5.5. Never infer "confirmed" from a pending row.
- Detail view: two columns at `lg` with the appointment summary and a timeline/history area only if the API returns history (`SPEC.md` FR-004).
- Cancellation/reschedule actions are separate from the primary booking flow and always confirmed.
- Empty state: explain there are no appointments and offer the booking action.
- Error state: distinguish unavailable data from an empty list.

### 6.5 AI chatbot interface

Applies to `UI-001` and `FR-001`.

**Layout:**

- Desktop: conversation column (8 of 12) and a source/context rail (4 of 12). At `lg`, the rail is a bordered panel; below `lg`, sources move below the relevant assistant message or into an accessible disclosure.
- Mobile: one column, full-height chat area with a fixed composer at the bottom, safe-area padding, and no horizontal overflow.
- Conversation panel is opaque `surface`; the canvas shows at the margins.
- Message text max-width about 65–70ch.

**Messages:**

- Assistant messages: `bg-surface`, 1px `line` border, `rounded-xl`, no speech-bubble tails; small "CamiConnect" label with an `accent` icon and a generated-content notice.
- User messages: `bg-primary-soft` with `text-ink`, right-aligned on desktop, full-width on mobile. Do not use a solid primary fill that competes with actions.
- Render text safely (no unsanitized HTML). If markdown is supported, sanitize it and style headings, lists, and code consistently.
- Keep a persistent notice: AI-generated, not medical advice, not appointment confirmation.
- Sources: render exactly as returned. Bordered list with document title, section, and an accessible link if the contract provides one. Never invent sources.
- Fallback answers: visually distinct (`warning-soft` or `surface-muted` callout with border) and offer approved links to departments, doctors, or booking. Never success styling for an unverified answer.
- Streamed text, if later approved, must not imply availability or booking confirmation. Source references come only from retrieved records.

**Composer:**

- Textarea with a visible or accessible label; placeholder is supplementary.
- Character counter matching the server maximum (`UI-001`).
- Submit button at least 44px, disabled when empty/over limit/pending, with a specific pending state.
- Preserve the draft on error and timeout. Do not clear the conversation on a transient failure.
- `aria-live="polite"` announces new assistant messages and status changes without excessive repetition.
- 429, provider-unavailable, network, and timeout messages are friendly and distinct from validation errors; retry only when safe.
- Never show raw provider errors, prompts, keys, or internal configuration.

**Empty state:**

- Explain what the assistant can help with using approved topics: hospital services/departments, doctor profiles, appointment procedures, consultation requirements, approved hours/policies.
- Suggested prompts must map to approved knowledge or be omitted.

### 6.6 Doctor dashboard

Applies to `UI-004` and `FR-005`.

**Layout:**

- Desktop: persistent sidebar (240px) and work area. The sidebar may be omitted if a doctor has a single view and a simple header is clearer.
- Page header: doctor name/scope, date context, compact filter bar. Do not expose more patient information than the API returns.
- Dense data area: texture off; tables on `surface` with clear rules.
- Main content: today's schedule, assigned appointments, status controls. Tables for lists; a timeline or grouped list only if it improves scanning.

**Visual rules:**

- Higher density than patient pages, but essential data never below 14px; 12px for metadata only.
- Status changes use an inline control with only the allowed transitions (`SPEC.md` FR-005). Show the server result; never optimistically drift to a new status.
- A success toast is allowed, but the row must update from the server response.
- Show only patient fields returned by the API (`UC-DOC-03`).
- Rejected transitions show an inline, specific message; do not silently revert.
- Avoid decorative cards. Use one bordered work surface with section rules.
- Empty schedule: empty state and next action, not fake slots.

**Amendment 2026-10-27 (owner-approved mockup):**

- Navigation is a 64px icon rail (tooltips when collapsed) that expands to 224px with labels. It pushes content at `lg`+ and overlays below `lg`. The doctor's profile and sign-out sit at the bottom of the rail; the header carries only the view title, date, and a notifications bell. No search bar, no period dropdown, no doctor/treatment/patient-queue filter panel.
- The default appointments view is a weekly time grid (Sun–Sat, Manila time) inside one white card. The card toolbar holds the week navigator, a Schedule | Kanban | List switch, and **Block time**. Blocks are tinted by status with the `--slot-*` tokens (ink text on top for contrast). The current-time line is a dashed primary rule.
- Clicking a block opens an anchored detail popover: name, Manila date and time, reason, status, duration, status history, and the existing actions. It shows no contact details. Below `sm` it becomes a bottom sheet.
- The palette is cooler and grayer, with primary #1a62f2. The workspace background is white (`--canvas`), like the page and auth backgrounds; white cards separate from it with a `line` border and the card shadow. `surface-muted` (#f4f6fa) is used only for Kanban columns, segmented controls, and hover states.
- **Amended 2026-10-29 (owner request):** the Kanban and List views are removed. The weekly time grid is the only appointments view; the card toolbar holds the week navigator and **Block time**, with the status filter below. Old `?view=board` / `?view=list` links fall back to the week grid.
- **Amended 2026-10-29 (owner request):** the palette returns to blue and white. Neutrals are blue-tinted again (`ink` #0f2342, `ink-secondary` #3b5275, `ink-muted` #587093, `line` #e3eaf6, `line-strong` #c9d6ec, `control-line` #7a8fb0, `surface-muted` #f3f7fe); primary stays #1a62f2. The app is light-only: the `prefers-color-scheme: dark` overrides are removed so every page renders on white.
- Motion uses `ease-snappy` (`cubic-bezier(0.23, 1, 0.32, 1)`). Popovers and tooltips enter in 150ms from `scale(0.97)` with opacity, using `@starting-style`. Pressables use `active:scale-[0.97]`, and hover effects are gated to `(hover: hover)`. Reduced motion drops the scale but keeps the fade.

### 6.7 Administrator dashboard

Applies to `UI-005`, `FR-002`, and `FR-006`.

**Shell:**

- Desktop: 240px sidebar, 64px top bar, content container with a 12-column grid.
- Mobile: sidebar becomes an accessible drawer; no hidden-only navigation.
- Page title, short description, and one primary action per screen. Use secondary buttons and a clearly separated danger zone for additional actions.

**Density:**

- Texture off in work areas.
- Tables are the default for departments, doctors, schedules, appointments, documents, ingestion jobs, and audit events.
- Compact rows (`py-3`), but 44px controls where they are touch targets.
- Destructive actions (deactivate/remove/reprocess) require a confirmation dialog naming the object and consequence. An undo toast is not enough protection.
- Bulk actions, if implemented, show selection count and confirm destructive effects.

**Knowledge-base workflow:**

- Upload shows accepted type/size before selection, file name, progress, and an extracted-text preview before approval.
- Use only the API's status values (for example registered, processing, ready for review, published, failed). Do not invent states.
- Approval is an explicit action, visually distinct from upload. Upload alone never shows "published".
- Ingestion status uses bounded polling and stops on terminal states; show paused/failed states with a safe reprocess action (`UC-ADM-06`, `UC-ADM-07`).
- Preview text is untrusted content; never render it as HTML.
- Audit events use a read-only table with timestamps, actor, action, and target.

### 6.8 Analytics views

Applies to `UI-006` and `FR-007`.

- Page shell: title, date range/granularity controls, and a refresh action if supported.
- Texture off behind chart cards; chart cards use opaque surfaces.
- KPI row: four cards at `lg`, two at `md`, one on mobile. Each shows a single measured value, period, and plain-language label. Do not combine measured facts and generated interpretation in one card.
- Charts use the chart palette, direct labels where possible, clear axes, units, and a legend. Provide a table or text alternative (`A11Y-09`).
- Measured facts are labelled "Measured data" (or equivalent). Where policy requires AI-generated explanations, label them "AI-generated summary" in a distinct `accent-soft` bordered callout, visually separated.
- No causal language for correlations. Use "associated with", not "caused by", unless explicitly supported and approved; per `SPEC.md`, it is not.
- Empty state explains that no data exists for the period. No zero-filled charts that imply real measurements.
- Loading: skeleton cards/charts with fixed dimensions; no layout shift.
- Error: one clear error region with retry for reads; a single chart failure does not blank the page unless the page cannot function.
- Date/time uses Asia/Manila by default and states the timezone.
- No chart library until approved.

### 6.9 State patterns by screen

| Screen | Loading | Empty | Success | Validation | Error |
|---|---|---|---|---|---|
| Public pages | Static content remains; no full-page spinner | "No information available" only if truly empty | Not applicable | Not applicable | Navigation stays usable; API failure shown in a contained notice |
| Auth | Submit pending label; no duplicate submit | Not applicable | Inline confirmation or redirect | Field errors + summary; focus summary | Generic credential/session message; no account enumeration |
| Booking | Skeleton availability; `aria-busy` | "No availability for this period" with next step | Status card reflects server; toast supplementary | Field errors beside inputs; slot conflict inline | Refresh availability; preserve selection; retry only safe reads |
| Appointments | Skeleton list/detail | "No appointments yet" + book action | Updated row/status; optional toast | Inline + summary | Distinguish 401/403/404/network/timeout; no existence leak |
| Chat | "Checking hospital information…" with live region | Approved topic guidance | Answer + real sources; fallback distinct | Counter/limit message | Friendly retry; preserve draft; 429/503/network distinct |
| Doctor | Skeleton schedule/table | "No appointments for this period" | Row updates from server; optional toast | Inline transition error | Access denied vs unavailable; no other scope |
| Admin | Skeleton table/status | "No documents/jobs/events" + safe next action | Server-confirmed status; toast supplementary | Field errors + summary | Bounded retry for reads; destructive errors inline |
| Analytics | Skeleton KPI/chart | "No data for this period" | Refreshed measured data | Range validation inline | Per-chart or page-level; retry reads only |

---

## 7. Accessibility, Responsive, and Content Requirements

### 7.1 Accessibility baseline

Target **WCAG 2.1 AA** for patient-facing flows (`SPEC.md` §8.1).

- Semantic landmarks: `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`; one `<main>` per page.
- One `<h1>` per page; heading levels follow document structure.
- Every form control has a visible, associated `<label>`.
- Every interactive element has a visible focus indicator (`focus-ring`).
- No keyboard traps. Dialogs trap focus intentionally and restore it on close.
- Skip link is the first focusable element.
- Touch targets at least 44×44px for primary actions; never below 24×24px.
- Errors are announced and associated via `aria-describedby`; `role="alert"` for immediate errors, `role="status"` for polite updates.
- Chat and status changes use `aria-live` appropriately (`UI-001`, `SPEC.md` §8.1).
- No color-only cues for status, selection, chart series, or errors.
- Charts have a table/text alternative.
- `prefers-reduced-motion` removes non-essential animation.
- 200% zoom and 320px width retain content and function.
- Focus is not obscured by sticky headers; use `scroll-margin-top` on focus targets.
- Do not duplicate visible text with `aria-label`; use visually hidden text for icon-only controls.
- Do not use `title` as the only accessible name.

### 7.2 Responsive rules

- Mobile-first CSS; the page itself never scrolls horizontally.
- At 320px: text readable; forms and chat composer do not overflow; tables scroll in a labelled region or become stacked records.
- At 768px: two-column layouts only when each column keeps a readable measure.
- At 1024px: 12-column layouts, persistent dashboards, chat rails.
- At 1440px: do not stretch prose; keep the 80rem container.
- `min-w-0` on grid/flex children containing long content.
- Test long doctor names, department names, status labels, and error messages at each breakpoint (and translated strings when i18n is approved).
- Use `dvh` for full-height chat/mobile layouts with fallbacks that do not break older browsers.

### 7.3 Content and tone

- Calm, warm, direct, and specific. State what happened, what it means, and what to do next.
- Plain language over clinical jargon, without being casual about health.
- No marketing superlatives, false urgency, or anthropomorphic claims about the AI.
- Use "AI-generated" and "not medical advice" explicitly where `UI-001` requires.
- Do not diagnose, recommend treatment, or imply clinical judgment.
- Do not claim availability, confirmation, publication, or completion before the server confirms.
- Use "request received" or the exact server status for pending appointments.
- Times use Asia/Manila by default and state the timezone when ambiguity is possible.
- Error copy never reveals whether another user's record exists (`FR-003`, `S-10`).
- No secrets, full patient messages, or sensitive identifiers in UI copy, logs, screenshots, or traces.
- Synthetic data only in fixtures, screenshots, and demos (`AGENTS.md`).

### 7.4 Imagery and iconography

- Line icons with a consistent ~1.5px stroke on a 20/24px grid, with softly rounded caps and joins to match the rounded shapes. Do not mix filled and outline styles arbitrarily.
- Icon-only buttons need accessible names. Decorative icons are `aria-hidden="true"`.
- No icon package without approval. Inline SVG is acceptable for a small, reviewed set.
- Icons sit in `primary-soft` or `accent-soft` rounded squares (`rounded-lg`) when used as feature markers.
- No stock photos of patients or staff presented as real hospital personnel. Approved hospital imagery only after brand/privacy review.
- No decorative medical clip-art (crosses, heartbeat lines, DNA strands, stethoscopes) that adds no information.
- The wordmark is text until a hospital-approved logo is supplied. Do not fabricate a logo or seal.

---

## 8. Implementation Rules

### 8.1 Stack constraints

- Use the existing Next.js App Router and React Server Components where appropriate.
- Use the existing Tailwind CSS v4 pipeline via `@tailwindcss/turbopack`.
- Do **not** add a `postcss.config.*`, replace the Tailwind loader, or introduce another CSS framework.
- Keep global tokens and cross-cutting utilities in `src/app/globals.css`.
- Use `next/font`; no external font requests at runtime.
- Client components only for browser interactivity, state, and effects. Keep data fetching and authorization on the server.
- Never import `src/server/*` into client components.
- No new dependencies (icon libraries, chart libraries, UI kits, `clsx`, `tailwind-merge`, animation libraries) without approval and a documented reason.

### 8.2 File organization

Proposed; adapt only when the first real screen needs it:

```text
src/
  app/
    layout.tsx                 # root shell, fonts, global Toaster
    globals.css                # tokens, base styles, texture/focus utilities
    (public)/                  # public information pages
    (auth)/                    # login/register
    (patient)/                 # appointments, chat
    doctor/                    # doctor dashboard
    admin/                     # admin dashboard, analytics
  components/
    ui/                        # Button, Field, Card, Badge, Dialog, AppToaster
    layout/                    # PageContainer, AppHeader, DashboardShell
    auth/                      # existing auth composition
    appointments/              # domain composition
    chat/
    admin/
  lib/
    api-client/                # typed client and error normalization (future)
```

- `components/ui` holds visual primitives with no domain or data logic.
- Domain components compose primitives and receive data through props.
- No data fetching, authorization, or server-only imports in UI primitives.
- No `components/ui` abstraction for a one-off style. Use utilities until reuse is real.
- A `PageContainer` is justified if it consistently enforces width and padding; a `Button` primitive is justified once variants are reused. Avoid a giant design-system package.

### 8.3 Styling separation

- Visual styling stays out of business logic. Do not encode status meaning in class strings generated inside server services.
- Domain components may map a known status to a visual tone in a small presentational helper covered by component tests.
- No inline styles for colors or spacing except genuinely dynamic values (such as a chart coordinate).
- No `!important`. If a third-party component requires it, scope the override in the wrapper and document it.
- No `dangerouslySetInnerHTML`. Render text safely; sanitize markdown if ever introduced.
- Do not rely on hover for essential information.
- Do not hide content with `display: none` when assistive technology needs it; use `sr-only`.

### 8.4 Reuse and abstraction

- Reuse when it improves consistency or removes a real maintenance risk; no abstractions for hypothetical screens.
- Primitives have small, explicit APIs: variant, size, state, accessible name where needed.
- Keep variants finite; check whether an existing one fits before proposing a change.
- Avoid polymorphic component APIs unless truly required.
- Keep styling props minimal; prefer semantic variants over arbitrary class overrides.
- Do not adopt a component library's default theme and then override it heavily.

### 8.5 Performance

- CSS gradients for the texture and wash; no image, canvas, or JavaScript.
- No `background-attachment: fixed` or large blurred layers.
- Apply `mask-image` only to small decorative layers, not large scrolling containers.
- Keep the initial public bundle free of dashboard/chart code (`SPEC.md` §8.1).
- `next/image` for approved raster assets with explicit dimensions.
- Avoid animating box-shadow, filter, or layout properties.
- `content-visibility` only after measuring; never on focusable or live-region content.
- No unused font weights or families.
- Inline SVG icons stay small and are reused through a component.

### 8.6 Data and safety in the UI

- Availability, appointment state, document publication, and analytics are server-authoritative. The UI displays them; it does not invent or optimistically confirm them.
- Do not use the LLM to generate availability, booking confirmation, analytics values, or citations.
- Render sources exactly as returned by the API; never fabricate sources.
- Keep measured analytics and AI-generated explanations visually separate.
- No real patient data in fixtures, screenshots, design mocks, or toasts.
- No internal error details, stack traces, secrets, or provider messages in the UI.
- Public pages stay navigable when APIs are unavailable.

---

## 9. Visual Definition of Done

A frontend change is visually complete only when all applicable checks pass:

- [ ] Uses only semantic tokens for color; no new raw hex or raw palette classes in new UI.
- [ ] Uses the page container, structural columns, and spacing scale consistently.
- [ ] Texture and header wash appear only where §3.4 specifies, and never cross text or controls.
- [ ] Radii follow §4.5 (8 / 12 / 16px); no pill-shaped primary buttons.
- [ ] Blue is used for actions and information only; the screen is predominantly white and pale blue.
- [ ] Typography follows the hierarchy; body text ≥ 16px on patient-facing pages; no uppercase eyebrows; line length controlled.
- [ ] Buttons, inputs, cards, badges, dialogs, navigation, tables, and Sonner toasts (§5.9) follow their patterns.
- [ ] Focus is visible on every interactive element; keyboard operation works without traps.
- [ ] Touch targets meet 44px for primary actions.
- [ ] Status is conveyed by text/icon as well as color; primary and accent blues are never the only distinction.
- [ ] Loading, empty, success, validation, and error states exist and are distinct.
- [ ] No optimistic confirmation of booking, appointment status, publication, or analytics values.
- [ ] No fake data, fake availability, fake doctors, or invented sources.
- [ ] Responsive at 320, 375, 768, 1024, and 1440px; no page-level horizontal overflow.
- [ ] 200% zoom and reduced-motion behavior verified.
- [ ] Contrast measured and recorded for text, large text, controls, focus, and dark mode (§4.3).
- [ ] Dialogs trap and restore focus; errors are announced and associated; chat/status live regions work.
- [ ] Charts have an accessible table/text alternative.
- [ ] Toasts supplement, not replace, inline state; no sensitive data in toast copy.
- [ ] `npm run lint` and `npm run typecheck` pass; `npm run build` passes after route/config changes.
- [ ] Applicable component, accessibility, and end-to-end tests pass; no assertions weakened to fit visuals.
- [ ] No unapproved dependency, CSS framework, PostCSS config, or design-system fork.

---

## 10. How Agents Must Use This Document

Before implementing or modifying a UI:

1. Read the relevant sections of this document, `SPEC.md` §8, and `AGENTS.md`.
2. Inspect the existing component, its tests, and nearby styles before changing anything.
3. Identify the applicable tokens, layout behavior, component patterns, and state requirements.
4. Check the screen's requirement IDs (`UI-001`–`UI-006`) and do not add unapproved functionality.
5. Implement with semantic HTML, the existing Tailwind v4 pipeline, and the established token names.
6. Check responsive behavior, keyboard operation, focus, contrast, reduced motion, and error states.
7. Run the checks required by `AGENTS.md` and report actual results.
8. If the work requires a substantial design change, stop and request approval before changing this document or the design system.

**A substantial design change includes:**

- A new primary/accent color family, or a change to semantic color meanings.
- A new typeface, type scale, or heading hierarchy.
- A different grid model, breakpoint set, or page container.
- A new dependency affecting visual primitives (UI kit, icons, charts, toasts, animation).
- A different overall visual direction.
- Changing the meaning of status colors or the toast/confirmation model.
- A dark-mode strategy change from system preference to a manual toggle.

Documentation-only changes to this file still need approval when they alter an approved design decision. Do not silently "improve" the design system inside a feature task.

---

## 11. Approval Decisions and Unresolved Choices

### 11.1 Decisions

> **v0.2 approved 2026-10-23** by the human project owner for the auth slice (palette, dark theme, Geist typography, visible grid, Sonner). **v0.3 changes the palette, radii, elevation, texture, and eyebrow style, and is therefore a substantial design change that requires fresh approval (items 1, 5, and 10 below).** The stock landing page replacement, hospital logo/brand assets, and chart library remain out of scope.

| # | Decision | Proposal | Status | Impact if not approved |
|---|---|---|---|---|
| 1 | Hospital brand palette and logo | Blue and white palette (§4.2); text wordmark until official assets exist | **Needs approval (v0.3)** | v0.2 deep-blue + teal palette stays; logo must not be invented |
| 2 | Dark theme | Light and dark via system preference; no manual toggle initially | Approved (v0.2); dark values re-tinted in v0.3 | If rejected, remove the dark block and target light only |
| 3 | Sonner toast dependency | Single toast implementation, `sonner@^2.0.8` | Approved and installed | Do not build a custom system without approval |
| 4 | Typography | Keep Geist Sans/Mono; no new font dependency | Approved | A hospital brand font may be required later |
| 5 | Texture and header wash | Soft fading grid on hero/header bands only; static pale-blue wash (§3.3–3.5) | **Needs approval (v0.3)** | Too strong competes with content; too weak loses the signature |
| 6 | Stock landing page replacement | Replace with the public design in a dedicated task | Pending | `ADR-0008` currently says keep the stock landing page |
| 7 | Auth-slice visual migration | Migrate `zinc` auth components to tokens | Done (v0.2); v0.3 re-skin is a value swap plus radius changes | Two visual systems persist longer |
| 8 | Photography/imagery | No stock patient/staff photos; line icons and approved hospital assets only | Approved | Privacy and trust risk |
| 9 | Chart library | Not selected here; separate approval | Pending | No charts with an unapproved dependency |
| 10 | Softer shape language | Radii 8 / 12 / 16px; soft blue-tinted card shadow (§4.5) | **Needs approval (v0.3)** | v0.2 radii (6 / 8 / 12px) and near-flat elevation stay |

### 11.2 Relationship to `ADR-0008`

`ADR-0008` originally recorded the auth-slice UI policy: "no new design system; utility styling only" and "keep the stock landing page". On 2026-10-23 the human owner approved v0.2 for the auth slice, superseding "no new design system" for `/login` and `/register`. The stock landing page remains unchanged.

Approval is still required before:

- Treating v0.3 as binding for any screen, including the auth slice.
- Treating this document as binding for screens outside the implemented auth slice.
- Replacing the stock landing page.
- Recording a superseding ADR or updating `ADR-0008` beyond the auth-slice note.

### 11.3 Remaining product-level open choices

Already open in `SPEC.md` §15 and not resolved here:

- Chat access for anonymous visitors vs patients only.
- English-only vs English + Filipino.
- Official hospital documents and public information sources.
- Doctor schedule and appointment policy details.
- Analytics AI-explanation policy.
- Hosting, provider, and chart-library choices.

Do not invent UI copy or states that depend on these decisions. Keep layouts flexible so content can change without rewriting the grid or component structure.

---

## 12. Adoption Sequence for v0.3

1. **Approve v0.3** and decisions 1, 5, and 10 in §11.1.
2. **Swap token values** in `src/app/globals.css` (§3.10). Add `bg-grid-fade`, `bg-wash`, and the new elevation values. Verify build, lint, typecheck, and a simple visual page.
3. **Record measured contrast** for every pair in §4.3, light and dark; darken text tokens where a pair falls short.
4. **Update the auth slice**: radii (`rounded-md` → `rounded-lg`, `rounded-lg` → `rounded-xl`), `shadow-card` on the auth card, wash and fading grid behind it. Keep behavior and tests unchanged.
5. **Build the smallest primitives** actually needed: page container, button, field, card, badge, dialog, `AppToaster`. Add component and accessibility tests.
6. **Apply the system to new screens** in requirement order: public information, patient appointments, chat, doctor dashboard, admin dashboard, analytics.
7. **Replace the stock landing page** only in an approved public-page task.
8. **Verify** responsive layouts, contrast, focus, reduced motion, state patterns, and §9.
9. **Record** any approved change here and, where architectural or cross-cutting, in an ADR.

---

## 13. Change Log

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-10-23 | Initial proposed visual design system, visible grid, tokens, component patterns, screen guidance, and Sonner direction |
| 0.2 | 2026-10-23 | Approved for the auth slice; applied tokens, grid, auth page styling, Sonner `^2.0.8`, and supplementary auth toasts |
| 0.3 | 2026-10-25 | Proposed hospital-oriented redesign: blue-and-white palette, softer radii and elevation, fading grid and header wash, sentence-case eyebrows, sky-blue accent replacing teal, contrast values marked as targets to verify; token names unchanged |