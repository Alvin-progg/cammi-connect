# CamiConnect — Visual Design System and Frontend Guidelines

- **Status:** Approved — 2026-10-23
- **Date:** 2026-10-23
- **Applies to:** all frontend work in this repository
- **Inspiration:** [tailwindcss.com](https://tailwindcss.com/) — visual principles only, not branding or page composition
- **Related requirements:** `SPEC.md` §8 (`UI-001`–`UI-006`, §8.1), `TEST.md` §6 and §10, `AGENTS.md`
- **Implementation state:** Auth slice migrated to the token and grid system; other screens remain unimplemented.

> This document is the visual source of truth for the implemented auth slice. It does not change product requirements or authorization rules. If this document conflicts with `SPEC.md`, `TEST.md`, `AGENTS.md`, or an approved ADR, stop and request a decision; do not silently choose the design document.

---

## 1. Purpose and Scope

### 1.1 What this document defines

This document defines:

- The visual direction for CamiConnect.
- The visible grid system and its CSS implementation using the existing Tailwind CSS v4 setup.
- Semantic design tokens for color, typography, spacing, layout, borders, radii, elevation, and focus.
- Reusable visual patterns for buttons, fields, cards, badges, dialogs, navigation, tables, and toasts.
- Screen-level guidance for public pages, authentication, patient appointments, the AI chatbot, doctor and administrator dashboards, and analytics.
- Accessibility, responsive, and implementation constraints for frontend agents.

### 1.2 What this document does not define

This document does **not**:

- Add product functionality or change acceptance criteria.
- Define API contracts, authorization behavior, database schema, or business rules.
- Select a chart library, icon library, component library, or CSS framework.
- Approve a new dependency. Sonner was approved on 2026-10-23; any further dependency still requires approval (see §5.9 and §11).
- Replace `SPEC.md` or `TEST.md`.
- Approve a hospital logo, photography style, or official brand palette. Those require human input.

### 1.3 Repository state at authoring

The repository currently contains:

- Next.js 16 App Router under `src/app`.
- Tailwind CSS v4 through `@tailwindcss/turbopack` in `next.config.ts`.
- Global styling in `src/app/globals.css` with `@import "tailwindcss"`, the approved semantic token layer, `bg-grid`, `page-container`, and `focus-ring` utilities.
- Geist Sans and Geist Mono loaded with `next/font/google` in `src/app/layout.tsx`.
- A stock create-next-app landing page and a working authentication slice under `src/app/(auth)`, `src/app/account`, and `src/components/auth`.
- Vitest and Testing Library tooling in `package.json`.
- `sonner@^2.0.8` installed as the single toast implementation; no icon package, chart package, or UI component library.

The authentication components now use the semantic token and grid system. Other screens may still use one-off utility classes until their own approved migration tasks. Do not perform an unrelated visual rewrite as part of an auth or feature task.

### 1.4 Visual inspiration, not imitation

The Tailwind CSS website is the reference for:

- A visible but quiet grid-line background.
- Thin rules and deliberate alignment.
- A restrained neutral base with a small number of functional accents.
- Strong typographic hierarchy and generous whitespace.
- Small monospace labels for technical metadata.
- Minimal shadows; structure comes from borders, spacing, and typography.

Do **not** copy Tailwind's logo, wordmark, exact palette, page layouts, marketing copy, illustrations, or brand assets. CamiConnect must read as a calm hospital product, not a developer-tools landing page.

### 1.5 Design authority and conflict order

Follow the repository conflict order:

1. Safety, security, and privacy.
2. Approved scope and acceptance criteria.
3. `SPEC.md` and `TEST.md`.
4. `AGENTS.md`.
5. This document.
6. Individual agent or developer preference.

When a requested visual change would alter the design system's foundations, stop and request approval before implementing it. Examples: a new accent color family, a new typography scale, a new grid model, a new dependency, or replacing the visible-grid aesthetic.

---

## 2. Design Direction

### 2.1 Product character

CamiConnect should feel:

- **Trustworthy:** calm hierarchy, explicit statuses, no decorative urgency.
- **Clinical but not cold:** clean surfaces, humane typography, restrained color.
- **Technical:** visible grid, thin rules, precise alignment, small monospace metadata.
- **Legible:** generous type sizes, clear focus states, strong contrast, obvious next actions.
- **Quiet:** no gradients as decoration, no glassmorphism, no floating cards, no excessive animation.

The interface serves patients under stress and staff working quickly. Visual novelty must never reduce clarity.

### 2.2 Core principles

1. **Structure before decoration.** Use layout, spacing, borders, and type hierarchy before shadows, color, or animation.
2. **One grid, consistently applied.** Every screen uses the same container and column model, with density adjusted per screen.
3. **Borders are functional.** Thin rules separate regions and reinforce the grid. They are not a substitute for spacing or headings.
4. **Color carries meaning, not mood alone.** Use semantic tokens. Do not scatter raw palette classes through components.
5. **Status is never color-only.** Pair color with text, icons, and, where relevant, patterns.
6. **The grid supports reading.** Grid lines stay low contrast and never sit between a reader and the content.
7. **Calm motion.** Motion confirms a state change; it does not entertain.
8. **Server truth is visible.** Never visually imply that an appointment is confirmed, a document is published, or availability is guaranteed before the server says so.
9. **Accessible by default.** Keyboard operation, focus visibility, contrast, reduced motion, and responsive behavior are part of the visual definition of done.
10. **Use the smallest system that works.** Prefer CSS and existing Tailwind utilities over new abstractions or dependencies.

### 2.3 Visual signature

The recognisable CamiConnect signature is:

- A faint square grid on a cool off-white canvas.
- A centered content frame with thin vertical rules where appropriate.
- Monospace eyebrow labels and small metadata.
- Deep clinical blue for primary actions; teal as a restrained supporting accent.
- White or near-white content surfaces with 1px borders and minimal radius.
- Strong, compact headings; generous section spacing; readable body measure.
- Status chips and inline messages that combine text, icon, and border.

### 2.4 What to avoid

- Copying the Tailwind homepage or its branding.
- Neon colors, dark-mode "cyber" styling, gradients, glow effects, or blurred glass panels.
- Large border radii (for example `rounded-3xl`) on cards, inputs, or buttons.
- Drop shadows on every card or table.
- Decorative grid lines that intersect text or form controls.
- Pure black backgrounds or pure white text in dark mode.
- Icon-only actions without an accessible name.
- Color-only status, severity, or chart series.
- Animated grid backgrounds, parallax, or autoplay motion.
- Fake statistics, fake doctors, fake availability, or decorative patient data.
- Toast messages as the only confirmation of a booking or other authoritative state change.

---

## 3. Visible Grid System

### 3.1 Two grids, two jobs

CamiConnect uses two related but distinct grids:

1. **Structural grid** — the Tailwind column grid that governs layout. It determines where navigation, content, cards, and controls sit.
2. **Grid texture** — the faint square line pattern in the page background. It is decorative and reinforces the technical aesthetic.

The structural grid is authoritative for alignment. The texture must never be used to justify a spacing or alignment decision. Both share the same 4px base unit and 8px rhythm.

### 3.2 Structural grid

| Breakpoint | Viewport | Columns | Page padding | Gutter | Typical use |
|---|---:|---:|---:|---:|---|
| Base | < 40rem (640px) | 4 | 1rem (16px) | 1rem (16px) | Single-column flows, stacked cards |
| `sm` | ≥ 40rem (640px) | 4 | 1.5rem (24px) | 1rem (16px) | Wider forms, two compact cards |
| `md` | ≥ 48rem (768px) | 8 | 1.5rem (24px) | 1.5rem (24px) | Tablet layouts, two-column forms |
| `lg` | ≥ 64rem (1024px) | 12 | 2rem (32px) | 1.5rem (24px) | Dashboards, chat split view |
| `xl` | ≥ 80rem (1280px) | 12 | 2rem (32px) | 1.5rem (24px) | Maximum content width |
| `2xl` | ≥ 96rem (1536px) | 12 | 2rem (32px) | 1.5rem (24px) | Same content width; more outer whitespace |

Tailwind default breakpoints are sufficient. Do not add custom breakpoints unless a concrete layout requirement cannot be met with the existing set and the change is approved.

**Page container:** `mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8`

- `max-w-7xl` = 80rem = 1280px.
- The content area inside 32px padding is 1216px at maximum width.
- Prose is narrower than the container: use `max-w-prose` (65ch) for long patient-facing text.
- Authentication forms use `max-w-md` (28rem, 448px); compact auth cards may use `max-w-sm` (24rem, 384px).
- The chat thread uses `max-w-3xl` (48rem) inside its column; source metadata may use a narrower rail.

**Column usage checklist:**

- [ ] The page has one `<main>` and one page-level container.
- [ ] Cards span whole columns, never arbitrary pixel widths.
- [ ] Section headings align to the same left edge as body content.
- [ ] Navigation items and actions align to the page container, not the viewport edge.
- [ ] Section rules span the content container; full-bleed bands may span the viewport but their content stays inside the container.
- [ ] No negative margins are used to fake alignment.
- [ ] Grid gaps come from the responsive gap scale, not hand-tuned margins.

### 3.3 Grid texture

The texture is a repeating square pattern made from two 1px CSS linear gradients: one vertical and one horizontal. Defaults:

| Token | Base | `md` and above | Notes |
|---|---:|---:|---|
| `--grid-cell` | 3rem (48px) | 4rem (64px) | Smaller cells on mobile would create visual noise |
| `--grid-line` (light) | `rgb(11 31 42 / 0.07)` | same | Low-contrast, decorative |
| `--grid-line` (dark) | `rgb(230 240 245 / 0.07)` | same | Slightly luminous, still quiet |

Rules:

- The line is exactly **1px** and uses a background gradient, not borders on every cell.
- Lines are **decorative**. They do not carry meaning and are not subject to text-contrast requirements. They must never reduce the contrast of text placed over them.
- Text blocks sit on an opaque surface (`bg-canvas` or `bg-surface`) when the background behind them would otherwise reduce readability.
- Do not use `background-attachment: fixed`; it causes repaint and mobile rendering problems. The pattern scrolls with the page.
- Do not animate the grid, parallax it, or change its scale on scroll.
- The pattern is static CSS; it adds no dependency, image request, or JavaScript.
- Apply the grid once at the page shell or body level. Do not repeat a grid on every card.

### 3.4 Grid visibility by surface

| Surface | Grid texture | Rationale |
|---|---|---|
| Public landing and information pages | **On**, full page | Establishes the visual identity and supports generous whitespace |
| Authentication pages | **On**, behind an opaque card | Keeps the shell consistent without competing with form focus |
| Patient portal and appointment pages | **On** in the page shell; opaque panels over it | Helps orientation while keeping forms and slots readable |
| Chatbot | **On** in page margins; conversation panel opaque | The conversation must remain the visual focus |
| Doctor dashboard | **Off** in dense work areas; optional on the page header band | Reduces noise behind tables and controls |
| Administrator dashboard | **Off** behind tables, forms, and upload status; optional on the shell | Operational density takes priority |
| Analytics | **Off** behind chart cards; optional on the page shell | Charts need a quiet field and accessible alternatives |
| Dialogs, popovers, menus | **Off** | Overlays must separate cleanly from the page |
| Print | **Off** | No background decoration in printed material |
| Forced-colors mode | **Off** | Let the user's system palette define boundaries |

Implementation: the page shell may use `bg-grid`; a quiet region uses `bg-canvas` or `bg-surface` to cover the texture. Do not use opacity on the whole content wrapper to hide the grid.

### 3.5 Optional content frame

A single thin vertical frame can reinforce the grid on public and patient pages at `lg` and above:

```html
<div class="mx-auto min-h-dvh w-full max-w-7xl px-4 sm:px-6 lg:border-x lg:border-line lg:px-8">
  <!-- page content -->
</div>
```

Use at most one outer frame per page. Do not add frames around every section, card, or table. On data-dense dashboards, omit the frame when it would compete with table borders.

### 3.6 Alignment and spacing rules

- **Base unit:** 4px. **Typographic rhythm:** 8px.
- Component heights are multiples of 4px; primary touch targets are at least 44px.
- Borders are included in heights through `box-sizing: border-box` (Tailwind preflight).
- Use `gap-*` for spacing between grid children; do not use margins on individual children to imitate a gap.
- Use `space-y-*` or `flex flex-col gap-*` for vertical stacks. Do not combine both patterns in one stack.
- Section boundaries use `border-t border-line`, aligned to the container.
- Card internal padding: `p-4` mobile, `p-6` desktop; compact data cards may use `p-3`.
- Page header spacing: `mb-8 lg:mb-12`.
- Avoid fractional widths, arbitrary percentages, and one-off pixel values unless the value is intrinsic to an asset.
- Content boundaries, not every decorative texture line, align to the page container. Never offset content to "line up" with a decorative cell. If a page uses an outer frame, the frame and content share the same container edge; the texture may be clipped to that frame when stronger alignment is desired.

### 3.7 Responsive behavior

**Base (320px–639px):**

- Four structural columns; most content spans all four.
- One-column cards, forms, chat, and appointment lists.
- Primary navigation collapses into an accessible disclosure.
- Tables either become compact stacked records or sit inside a labelled horizontal scroll region.
- Page padding 16px; section spacing 48px.
- Grid cell 48px; never apply a desktop 12-column layout.
- No horizontal page scroll at 320px.

**Tablet (`md`, 768px–1023px):**

- Eight columns.
- Two-column card groups, two-column form arrangements where labels remain readable.
- Doctor/admin sidebar may become a top section or drawer.
- Page padding 24px; section spacing 64px.
- Grid cell 64px.

**Desktop (`lg`, ≥1024px):**

- Twelve columns.
- Chat splits into conversation and source/context rail.
- Doctor and admin dashboards may use a persistent sidebar.
- Analytics KPI cards may sit four across.
- Page padding 32px; section spacing 96px.
- Do not stretch reading text across the full 12 columns.

**Large desktop (`xl`, ≥1280px):**

- Content remains capped at 80rem. Additional space becomes outer whitespace.
- Do not increase font sizes merely because the viewport is wider.

**Required viewport checks:** 320, 375, 768, 1024, 1440px; 200% zoom; no loss of content or function.

### 3.8 Accessibility of the grid

- The texture is decorative CSS; if implemented as a DOM overlay, it must be `aria-hidden="true"` and `pointer-events-none`.
- Structural lines are not the only way to perceive a region boundary. Pair them with headings, spacing, and surface changes.
- Interactive control boundaries use the stronger `--control-line` token, not the decorative grid line. See §4.3.
- Grid lines must not overlap form fields, focus rings, chart labels, or message text in a way that reduces legibility.
- In forced-colors mode, remove the grid (`background-image: none`).
- Under `prefers-contrast: more`, the grid may become slightly stronger, but it stays below content contrast and remains decorative.
- Under `prefers-reduced-motion`, nothing changes because the grid is static; all other motion must follow §4.8.
- Print styles remove the grid; content remains readable without relying on background decoration.

### 3.9 Proposed CSS implementation

This is the target implementation for `src/app/globals.css`. It is a proposal; do not apply it as part of this documentation task.

```css
@import "tailwindcss";

:root {
  color-scheme: light;

  /* Surfaces */
  --canvas: #f7f9fb;
  --surface: #ffffff;
  --surface-muted: #f1f5f9;

  /* Text */
  --ink: #0b1f2a;
  --ink-secondary: #3f5563;
  --ink-muted: #5f7480;

  /* Structure */
  --line: #d7e0e7;
  --line-strong: #b9c8d2;
  --control-line: #7c91a0;
  --grid-line: rgb(11 31 42 / 0.07);
  --grid-cell: 3rem;
  --page-padding: 1rem;
  --overlay: rgb(11 31 42 / 0.45);

  /* Brand and interaction */
  --primary: #075985;
  --primary-hover: #0c4a6e;
  --primary-soft: #e0f2fe;
  --primary-ink: #ffffff;
  --accent: #0f766e;
  --accent-soft: #ccfbf1;
  --accent-ink: #ffffff;
  --focus: #0284c7;

  /* Status */
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
  --chart-1: #075985;
  --chart-2: #0f766e;
  --chart-3: #6d28d9;
  --chart-4: #b45309;
  --chart-5: #be123c;
  --chart-6: #475569;

  /* Elevation */
  --elevation-card: 0 1px 2px rgb(11 31 42 / 0.05);
  --elevation-overlay: 0 20px 50px -20px rgb(11 31 42 / 0.35);
}

@media (min-width: 40rem) {
  :root {
    --page-padding: 1.5rem;
  }
}

@media (min-width: 48rem) {
  :root {
    --grid-cell: 4rem;
  }
}

@media (min-width: 64rem) {
  :root {
    --page-padding: 2rem;
  }
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;

    --canvas: #07131a;
    --surface: #0c1c25;
    --surface-muted: #102731;

    --ink: #e6f0f5;
    --ink-secondary: #b8cbd5;
    --ink-muted: #8fa6b2;

    --line: #23404c;
    --line-strong: #355865;
    --control-line: #5e7d8c;
    --grid-line: rgb(230 240 245 / 0.07);
    --overlay: rgb(0 0 0 / 0.65);

    --primary: #7dd3fc;
    --primary-hover: #bae6fd;
    --primary-soft: #0c2f3d;
    --primary-ink: #07131a;
    --accent: #5eead4;
    --accent-soft: #103b3a;
    --accent-ink: #07131a;
    --focus: #7dd3fc;

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

    --chart-1: #7dd3fc;
    --chart-2: #5eead4;
    --chart-3: #c4b5fd;
    --chart-4: #fcd34d;
    --chart-5: #fda4af;
    --chart-6: #cbd5e1;

    --elevation-card: 0 1px 2px rgb(0 0 0 / 0.25);
    --elevation-overlay: 0 20px 50px -20px rgb(0 0 0 / 0.65);
  }
}

@media (prefers-contrast: more) {
  :root {
    --grid-line: rgb(11 31 42 / 0.14);
  }
}

@media (prefers-color-scheme: dark) and (prefers-contrast: more) {
  :root {
    --grid-line: rgb(230 240 245 / 0.14);
  }
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

@utility bg-grid {
  background-image:
    linear-gradient(to right, var(--grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px);
  background-size: var(--grid-cell) var(--grid-cell);
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
  .bg-grid {
    background-image: none;
  }
}

@media print {
  .bg-grid {
    background-image: none;
  }
}

body {
  background-color: var(--canvas);
  color: var(--ink);
  font-family: var(--font-geist-sans);
}
```

**Notes on the implementation:**

- `@theme inline` maps raw theme values to Tailwind utilities such as `bg-canvas`, `text-ink`, `border-line`, and `shadow-overlay`.
- `--color-focus` is used by the `focus-ring` utility; do not remove outlines with `outline-none` unless an equivalent visible treatment is provided.
- Do not add a `tailwind.config.ts` or a PostCSS config. The existing Turbopack loader pipeline remains authoritative.
- `bg-grid` is a custom utility, not a background image asset. No dependency is introduced.
- The existing `--background` and `--foreground` tokens should be replaced during a dedicated migration; keep temporary aliases only while a single change is in flight.

### 3.10 Usage pattern

```html
<body class="min-h-full bg-canvas bg-grid font-sans text-ink">
  <a class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-ink focus-ring" href="#main">
    Skip to content
  </a>

  <header class="border-b border-line">
    <div class="page-container flex min-h-16 items-center justify-between gap-4">
      <!-- navigation -->
    </div>
  </header>

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

For dense dashboards, omit `bg-grid` from the main shell and use it only on a page header band, or omit it entirely. The structural grid remains.

---

## 4. Design Tokens

### 4.1 Token architecture

Use three layers:

1. **Raw values** in `:root` / dark-mode media query: `--canvas`, `--ink`, `--primary`.
2. **Tailwind theme mapping** in `@theme inline`: `--color-canvas`, `--color-ink`, `--color-primary`.
3. **Component classes** using semantic utilities: `bg-canvas`, `text-ink`, `border-line`, `bg-primary`.

Rules:

- New UI uses semantic tokens, not raw Tailwind palette classes such as `bg-zinc-100`, `text-slate-600`, or `border-gray-200`.
- Do not use raw hex values in components. If a value is missing, add a semantic token through an approved design-system change.
- Do not create one-off tokens for a single component unless the value is genuinely component-specific and documented.
- The default Tailwind palette remains available for exceptional data-visualisation needs, but chart colors should use the `chart-*` tokens.
- Opacity modifiers such as `bg-primary/10` are allowed when a predefined `-soft` token does not fit; prefer the token for repeated patterns.

### 4.2 Color palette

The proposed palette uses a cool, clinical blue as the primary action color and a deep teal as a restrained supporting accent. It is intentionally close to common hospital wayfinding colors without claiming to be the hospital's official brand palette. **Official hospital colors and logo assets still require approval.**

| Token | Light | Dark | Role |
|---|---|---|---|
| `canvas` | `#F7F9FB` | `#07131A` | Page background |
| `surface` | `#FFFFFF` | `#0C1C25` | Cards, tables, dialogs |
| `surface-muted` | `#F1F5F9` | `#102731` | Secondary panels, disabled fields, code blocks |
| `ink` | `#0B1F2A` | `#E6F0F5` | Primary text |
| `ink-secondary` | `#3F5563` | `#B8CBD5` | Supporting text |
| `ink-muted` | `#5F7480` | `#8FA6B2` | Metadata, captions |
| `line` | `#D7E0E7` | `#23404C` | Decorative and structural borders |
| `line-strong` | `#B9C8D2` | `#355865` | Hover borders, selected containers |
| `control-line` | `#7C91A0` | `#5E7D8C` | Input, select, textarea boundaries |
| `primary` | `#075985` | `#7DD3FC` | Primary action, active navigation, links |
| `primary-hover` | `#0C4A6E` | `#BAE6FD` | Primary hover |
| `primary-soft` | `#E0F2FE` | `#0C2F3D` | Selected rows, soft callouts |
| `primary-ink` | `#FFFFFF` | `#07131A` | Text/icon on primary |
| `accent` | `#0F766E` | `#5EEAD4` | Supporting accent, AI/support cues |
| `accent-soft` | `#CCFBF1` | `#103B3A` | Accent callouts |
| `accent-ink` | `#FFFFFF` | `#07131A` | Text/icon on accent |
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
| `focus` | `#0284C7` | `#7DD3FC` | Focus outline |
| `overlay` | `rgb(11 31 42 / 0.45)` | `rgb(0 0 0 / 0.65)` | Modal backdrop |

**Use of accent:** teal is not a second primary color. Use it for AI/support cues, one secondary callout per view, or a supporting chart series. Do not use it for destructive, warning, or critical actions.

### 4.3 Contrast requirements

Target: **WCAG 2.1 AA** for patient-facing flows, as proposed in `SPEC.md` §8.1.

| Pair | Approx. contrast | Requirement |
|---|---:|---|
| `ink` on `canvas` | 16.0:1 | Passes AAA for normal text |
| `ink-secondary` on `canvas` | 7.4:1 | Passes AAA for normal text |
| `ink-muted` on `canvas` | 4.6:1 | Passes AA for normal text; do not reduce further |
| `primary` on white | 7.6:1 | Passes AAA |
| white on `primary` | 7.6:1 | Passes AAA |
| white on `accent` | 5.5:1 | Passes AA |
| `focus` on white | 4.1:1 | Passes non-text 3:1; visible focus ring |
| `control-line` on white | 3.3:1 | Passes non-text 3:1 for control boundaries |
| `success-soft-ink` on `success-soft` | 6.5:1 | Passes AA |
| `warning-soft-ink` on `warning-soft` | 6.4:1 | Passes AA |
| `danger-soft-ink` on `danger-soft` | 6.8:1 | Passes AA |
| `ink` on dark `canvas` | 16.2:1 | Passes AAA |

Rules:

- Text must meet at least **4.5:1** for normal text and **3:1** for large text (≥24px regular or ≥18.66px bold).
- Interactive control boundaries and focus indicators must meet **3:1** against adjacent colors. Use `control-line`, not `line`, for inputs.
- Decorative grid lines and section rules do not need to meet 3:1, but they must not be the only way to identify a required boundary or control.
- Never place `ink-muted` over `primary-soft`, `surface-muted`, or a chart color without checking the actual pair.
- Do not use color alone for status. Add text and an icon.
- Re-check dark-mode pairs after any palette change; the dark values above are not automatically safe for arbitrary opacity combinations.

### 4.4 Typography

Use the existing Geist Sans and Geist Mono loaded in `src/app/layout.tsx`. Do not add a font dependency without approval. If the hospital has an official typeface, it must be reviewed for licensing, performance, and legibility before replacing Geist.

| Role | Size / line height | Weight | Suggested classes | Use |
|---|---|---|---|---|
| Display | 48–60px / 1.05 | 600 | `text-4xl sm:text-5xl lg:text-6xl tracking-tight` | Landing hero only |
| H1 | 30–36px / 1.15 | 600 | `text-3xl lg:text-4xl tracking-tight` | Page title |
| H2 | 24–30px / 1.2 | 600 | `text-2xl lg:text-3xl tracking-tight` | Section title |
| H3 | 20–24px / 1.3 | 600 | `text-xl lg:text-2xl` | Card/group title |
| H4 | 18–20px / 1.4 | 500–600 | `text-lg font-medium` | Subsection |
| Lead | 18–20px / 1.6 | 400 | `text-lg leading-8 text-ink-secondary` | Intro paragraph |
| Body | 16px / 1.65 | 400 | `text-base leading-7` | Default text |
| Small | 14px / 1.5 | 400–500 | `text-sm leading-6` | Helper text, table cells |
| Caption | 12px / 1.4 | 500 | `text-xs leading-5 text-ink-muted` | Metadata, timestamps |
| Eyebrow | 12px / 1.4 | 500 | `font-mono text-xs uppercase tracking-[0.14em] text-ink-muted` | Section labels, technical metadata |
| Code/ID | 12–14px / 1.5 | 400 | `font-mono text-xs` / `text-sm` | Request IDs, source references, code |

Rules:

- Body text is never smaller than 16px on patient-facing pages. Use 14px only for secondary UI text and table cells; 12px for metadata, never for essential instructions.
- Use no more than three weights in one view (typically 400, 500, 600).
- Use `text-balance` for short headings and `text-pretty` where supported for paragraphs.
- Keep long-form text at `max-w-prose` (65ch). Chat messages may use 60–70ch.
- Use `tabular-nums` for aligned numeric table columns and timestamps.
- Do not use uppercase for long labels or body copy. Uppercase is reserved for short eyebrow labels and metadata.
- Do not use letter-spacing on body text.
- Use sentence case for headings, labels, buttons, and status text.
- Preserve a logical heading order; do not choose a heading level for its visual size.

### 4.5 Spacing, containers, borders, radii, and elevation

**Spacing scale (Tailwind defaults, 4px base):**

| Token | Value | Typical use |
|---|---:|---|
| `1` | 4px | Icon gap, tight inline spacing |
| `2` | 8px | Label/input gap, badge gap |
| `3` | 12px | Compact padding, table cell vertical rhythm |
| `4` | 16px | Default gap, mobile card padding |
| `6` | 24px | Desktop card padding, form group gap |
| `8` | 32px | Page header gap, card grid gap |
| `12` | 48px | Mobile section spacing |
| `16` | 64px | Tablet section spacing |
| `24` | 96px | Desktop section spacing |

- Use `gap-4 md:gap-6` for most card grids.
- Use `gap-6 lg:gap-8` for major page sections.
- Do not use `space-x-*` for layout where `gap-*` is available; gap handles wrapping more predictably.
- Page section padding: `py-12 lg:py-24`. Hero: `py-16 lg:py-28`.
- Form field stack: `flex flex-col gap-2`; form group stack: `flex flex-col gap-6`.
- Table cell padding: `px-4 py-3`; compact tables may use `px-3 py-2.5`.
- Avoid vertical centering by arbitrary `mt-*`; use flex/grid alignment.

**Borders:**

- Default border: `border border-line` (1px).
- Stronger hover/selected border: `border-line-strong`.
- Form controls: `border border-control-line`.
- Focus outline: 2px, 2px offset, `focus-ring`.
- Do not use 2px borders except for selected states or focus. Use one 2px indicator, not a full double border.

**Radii:**

| Element | Class | Value |
|---|---|---:|
| Badges/status chips | `rounded-full` | Pill |
| Buttons, inputs, selects, textareas | `rounded-md` | 6px |
| Cards, panels, tables | `rounded-lg` | 8px |
| Dialogs, large overlays | `rounded-xl` | 12px |
| Inline code | `rounded-sm` | 4px |

Do not use radii larger than 12px for structural surfaces. Pills are reserved for badges and compact toggles, not primary buttons.

**Elevation:**

- Base: no shadow. Use borders and surface changes.
- Cards: `shadow-card` only when the card floats above the page; otherwise `shadow-none`.
- Sticky navigation: no shadow; use `border-b border-line`.
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

Use these named layers consistently. Do not use arbitrary values such as `z-[9999]`. Sonner's internal stacking must be verified against dialogs and sticky headers at implementation.

### 4.6 Chart palette

Use chart tokens for all data visualisations. They are proposed defaults, not a substitute for accessible chart design.

| Token | Light | Dark | Suggested series |
|---|---|---|---|
| `chart-1` | `#075985` | `#7DD3FC` | Primary volume/series |
| `chart-2` | `#0F766E` | `#5EEAD4` | Secondary series |
| `chart-3` | `#6D28D9` | `#C4B5FD` | Comparison series |
| `chart-4` | `#B45309` | `#FCD34D` | Warning/attention series |
| `chart-5` | `#BE123C` | `#FDA4AF` | Negative/cancellation series |
| `chart-6` | `#475569` | `#CBD5E1` | Neutral/reference series |

Rules:

- Never rely on color alone. Use direct labels, legends with labels, line styles, markers, or patterns.
- Every chart needs an accessible table or text summary (`UI-006`, `A11Y-09`).
- Red/green pairs are not acceptable as the only distinction between success and failure.
- Measured values and AI-generated explanations must be visually separate. AI text gets an explicit label and a distinct surface; it never shares a card with measurements without a divider and label.
- Charts do not imply causation. Copy must not convert correlation into a causal claim.
- Do not add a chart library until it is approved and evaluated for bundle size, accessibility, and server/client boundaries.

### 4.7 Grid and layout tokens summary

| Token | Value |
|---|---|
| Page max width | `80rem` / 1280px |
| Page padding | 16px base, 24px `sm`/`md`, 32px `lg`+ |
| Columns | 4 / 8 / 12 |
| Gutters | 16px / 24px / 24px |
| Base unit | 4px |
| Grid cell | 48px base, 64px `md`+ |
| Grid line | `rgb(11 31 42 / 0.07)` light; `rgb(230 240 245 / 0.07)` dark |
| Header height | 64px (`min-h-16`) |
| Page padding token | `--page-padding`: 16px / 24px / 32px |
| Primary touch target | ≥44px |
| Prose measure | 65ch |
| Auth form width | 28rem max (`max-w-md`) |
| Chat thread | 48rem max (`max-w-3xl`) |

### 4.8 Motion

- Use motion only to explain a state change: menu open, dialog enter, toast enter/exit, loading indication.
- Typical durations: 150ms for color/border/opacity; 200ms for dialogs and toasts; no more than 250ms for UI transitions.
- Use ease-out for entering elements and ease-in for exiting elements.
- Do not animate layout properties when transform/opacity can communicate the change.
- Do not animate the grid, background, or page transitions.
- Under `prefers-reduced-motion: reduce`, remove non-essential transitions and animations, including decorative skeleton pulses. Functional loading text/status must remain.
- Never animate a confirmation state in a way that implies success before the server response.

---

## 5. Component Patterns

These are visual contracts, not a requirement to build a component library immediately. Build a reusable primitive only when it is used in at least two places or when it prevents a genuine consistency risk.

### 5.1 Buttons

**Variants:**

| Variant | Use | Classes |
|---|---|---|
| Primary | The single main action in a region | `border-primary bg-primary text-primary-ink hover:bg-primary-hover` |
| Secondary | Alternative action | `border-line bg-surface text-ink hover:bg-surface-muted` |
| Ghost | Low-emphasis action | `border-transparent bg-transparent text-ink hover:bg-surface-muted` |
| Danger | Confirmed destructive action | `border-danger bg-danger text-danger-ink hover:bg-danger-hover` |
| Link | Inline navigation/action | `text-primary underline underline-offset-4 hover:text-primary-hover` |

**Sizes:**

- `sm`: `min-h-9 px-3 text-sm` for dense table/toolbar actions; still provide a 44px target area where practical.
- `md` (default): `min-h-11 px-4 text-sm` (44px).
- `lg`: `min-h-12 px-5 text-base` (48px) for primary patient actions.

**Required classes:**

```html
<button class="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-primary bg-primary px-4 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60">
  Book appointment
</button>
```

Rules:

- Use `<button>` for actions and `<a>` for navigation. Do not use a link for a mutation or a button for navigation.
- One primary button per region. Competing primary buttons dilute the next action.
- Pending state: disable the button, add `aria-busy="true"`, and change the label to a specific pending phrase ("Booking…"). Do not rely on a spinner alone.
- Preserve the button width during pending to avoid layout shift where practical.
- Destructive buttons appear only after a confirmation dialog and use explicit verbs ("Cancel appointment", not "Yes").
- Icon-only buttons need an accessible name via `aria-label` or visually hidden text. Do not use an icon alone for an ambiguous action.
- Hover is not the only affordance. Ensure focus, active, disabled, and pending states exist.
- Do not disable a button without explaining why nearby.

### 5.2 Links

- Inline links use primary color and an underline; underline offset 4px.
- Navigation links do not rely on color alone; active state uses `aria-current="page"` plus an underline or left/right rule.
- External links use an icon and accessible text indicating a new context where relevant.
- Never use `href="#"` for an action.
- Visited links are not visually distinguished in application navigation unless needed; avoid confusing visited-state styling for primary actions.

### 5.3 Form controls

**Field anatomy:**

1. Visible `<label>` above the control.
2. Optional help text below the label or control.
3. Control.
4. Error message below the control, tied with `aria-describedby`.
5. Optional character counter for bounded inputs.

**Input classes:**

```html
<input class="min-h-11 w-full rounded-md border border-control-line bg-surface px-3 text-base text-ink placeholder:text-ink-muted focus-ring aria-[invalid=true]:border-danger" />
```

Rules:

- Inputs and selects are at least 44px high.
- Use `text-base` on mobile inputs to avoid iOS zoom; 14px may be used on desktop table controls only.
- Do not use placeholders as labels.
- Required fields are marked in the label text, not only with an asterisk. If an asterisk is used, explain it once.
- Error state: `aria-invalid="true"`, `aria-describedby` pointing to the error, and a visible error message with an icon or explicit "Error:" text. Never rely on red alone.
- Validation messages appear beside the field and in a summary when multiple fields fail. Focus the summary or first invalid field after submit.
- Disabled fields use `bg-surface-muted text-ink-muted`; do not use a disabled field to hide required information.
- Read-only fields remain legible and are not styled like disabled controls.
- Password fields include a correctly labelled reveal control; the control must be keyboard operable and must not expose the value in logs.
- Selects use a visible chevron and a native `<select>` unless a custom listbox is fully accessible. Do not build a custom select without a compelling reason.
- Checkboxes/radios have a 44px target area, a visible label, and a clear focus ring. Do not use color alone for selected state.
- File uploads show accepted types and size limits before selection, then the selected file name, progress, and errors (`UI-005`).

**Form-level messages:**

- Error summary: `role="alert"`, focusable (`tabIndex={-1}`), placed at the top of the form.
- Success/status messages: `role="status"` or an appropriate polite live region.
- Do not use a toast as the only place a field error appears.
- Preserve non-sensitive input values on failure; clear passwords as required by the existing auth implementation.

### 5.4 Cards and panels

```html
<section class="rounded-lg border border-line bg-surface p-4 sm:p-6">
  <h2 class="text-xl font-semibold text-ink">Appointment details</h2>
  <p class="mt-2 text-sm leading-6 text-ink-secondary">…</p>
</section>
```

Rules:

- Cards are for grouped content, not for every section of a page.
- Default card: 1px `line` border, `bg-surface`, 8px radius, no shadow.
- Interactive cards use a clear focus-within treatment and hover border change, but must not move or lift.
- Do not put a card inside a card unless the inner surface is materially different (for example a callout or a table).
- Cards align to whole columns and share a consistent height where comparison matters; avoid forcing equal heights when content differs substantially.
- Use `min-w-0` on flex/grid children containing long text or tables to prevent overflow.
- Panels that contain tables use `overflow-hidden` on the outer surface and a separately scrollable table region.

### 5.5 Badges and status

**Status vocabulary must come from the server/API.** Do not invent statuses or map them to friendlier labels without a documented contract.

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

- Include a text label and, where helpful, an icon. A colored dot alone is not sufficient.
- Keep badge labels short and in sentence case.
- Do not use success styling for "request submitted" if the appointment is not yet confirmed. Use a neutral or warning tone and the server's actual status.
- Status changes in tables must be announced politely if the update happens without a page reload.
- Do not use badges as buttons. If a status is actionable, use a separate button or menu with an accessible name.

### 5.6 Navigation

**Global header:**

- Height 64px (`min-h-16`), `border-b border-line`, surface/canvas background, no shadow.
- Left: wordmark/text "CamiConnect" and, where space allows, the hospital name.
- Center/right: primary navigation: Departments, Doctors, Appointments, Chat (only where these routes exist and access policy allows).
- Right: account/sign-in action. Role-aware navigation is cosmetic only; it never grants authorization.
- Current page: `aria-current="page"` plus a visible underline or border.
- Mobile: accessible disclosure button with `aria-expanded` and `aria-controls`; focus remains visible; Escape closes; the menu is not hover-only.
- Skip link is the first focusable element and targets `<main>`.

**Dashboard sidebar:**

- Width 240px (`w-60`) at `lg` and above; collapsible drawer below.
- Group items by task, not by database entity.
- Use text labels, not icon-only navigation.
- Active item uses a left rule and `primary` text/background; do not rely on color alone.
- The sidebar scrolls independently only when necessary; the page itself remains scrollable.

**Footer:**

- 1px top border, `text-sm text-ink-muted`, links arranged in a simple grid.
- Include only approved information: hospital contact details, hours, privacy/terms where applicable. Do not invent policies.

### 5.7 Tables

Tables are the default for doctor/admin appointment lists, audit events, and ingestion jobs.

- Use semantic `<table>`, `<caption>` (visually hidden if the heading already names it), `<thead>`, `<th scope="col">`, and `<tbody>`.
- Header: `text-xs font-medium uppercase tracking-wide text-ink-muted`, background `surface-muted`, border bottom.
- Rows: `border-b border-line`; hover `bg-surface-muted`; selected row `bg-primary-soft`.
- Cell padding: `px-4 py-3`; numeric cells `text-right tabular-nums`.
- Actions column: text button or menu with an accessible name; never an unlabeled icon.
- Wide tables: wrap in `overflow-x-auto` with a focusable region and an accessible label. Do not let the page itself overflow horizontally.
- On small screens, either allow horizontal scrolling or use a stacked record layout for low-column patient lists. Do not squash columns until text becomes unreadable.
- Sorting controls must be buttons with `aria-sort` on the header. If sorting is not implemented, do not style headers as clickable.
- Empty tables use the empty-state pattern in §6.9, not a blank grid.
- Loading tables use skeleton rows that match final row height, with `aria-busy="true"` on the region.

### 5.8 Dialogs

Use dialogs only for focused decisions that cannot be made inline: cancel/reschedule confirmation, destructive admin actions, and short blocking notices.

- Use a native `<dialog>` or an equivalent fully accessible primitive. Do not build a partial focus trap.
- The dialog has an accessible name (`aria-labelledby`) and description (`aria-describedby`).
- Backdrop: `bg-overlay`; no blur.
- Surface: `bg-surface`, `border border-line`, `rounded-xl`, `shadow-overlay`, `p-6`.
- Focus moves into the dialog; the safe action (Cancel) receives initial focus for destructive dialogs. Escape closes unless the action is irreversible and closing would lose data; that exception must be explicit.
- Focus returns to the triggering element after close.
- Background content is inert while the dialog is open.
- Destructive action copy names the object and effect: "Cancel appointment with Dr. Santos on 24 October?" The confirm button repeats the verb: "Cancel appointment".
- Do not auto-confirm on Enter. Do not use a dialog for field validation.
- Toasts may appear above dialogs only if they do not obscure dialog controls; verify stacking and focus.

### 5.9 Toasts — Sonner

**Decision:** Sonner is the toast implementation for CamiConnect. It is installed as `sonner@^2.0.8`; the dependency was approved on 2026-10-23. The token-styled `AppToaster` is rendered once from the root layout.

Why Sonner:

- Small, focused toast API for React.
- Supports success, error, warning, info, loading, and promise states.
- Supports accessible dismissal, close buttons, and keyboard interaction.
- Avoids building and maintaining a custom toast system.

**Rules:**

- Render exactly one global `<Toaster />` from a client component in the root layout.
- Do not import Sonner into server components. `src/app/layout.tsx` remains a server component; place a `"use client"` wrapper such as `src/components/ui/app-toaster.tsx` inside it.
- Use `theme="system"` so light/dark preference follows the app's system-preference theme.
- Default position: bottom-right desktop, with a 16px mobile offset. Do not let a toast cover a required primary action, chat composer, or dialog control. Use `offset`/`mobileOffset` or a route-specific position if needed.
- Use `closeButton`, `visibleToasts={3}`, and a short gap. Do not stack unlimited toasts.
- Use `unstyled` plus semantic class names so the toast matches this design system. Class-name keys were verified against `sonner@2.0.8`.
- Keep the default Sonner live-region behavior. Do not wrap toasts in a second `aria-live` region.
- Success/info duration: about 4–5 seconds. Error duration: about 8 seconds, with a close button. Critical errors also need an inline message that persists.
- Never use a toast as the only confirmation of an authoritative state change. Update the page/row/status and use a toast as supplementary feedback.
- Do not toast field validation errors. Use inline field errors and an error summary.
- Do not put sensitive data, full chat messages, passwords, tokens, or raw provider errors in a toast.
- Do not use toasts for 401/403/404 flows that require a page-level state or redirect.
- Auth credential failures may use a supplementary error toast; the inline `role="alert"` summary remains the authoritative message. Successful sign-in may show a one-time success toast on the redirected page; the redirect and authenticated content remain authoritative.
- Deduplicate repeated messages with a stable toast `id` when the same failure can fire more than once.
- Dismiss or clear stale toasts on sign-out if they could reveal prior account activity. Sonner's `toast.dismiss()` can be used for this.
- Respect reduced motion; verify Sonner's enter/exit animations are acceptable under `prefers-reduced-motion`.
- Do not build a second toast system in parallel.

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
            "flex w-full items-start gap-3 rounded-lg border border-line bg-surface p-4 text-ink shadow-overlay",
          title: "text-sm font-medium",
          description: "text-sm text-ink-secondary",
          actionButton:
            "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-ink focus-ring",
          cancelButton:
            "rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink focus-ring",
          closeButton:
            "rounded-md p-1 text-ink-muted hover:text-ink focus-ring",
        },
      }}
    />
  );
}
```

Then render `<AppToaster />` once in the root layout after the main application content. The wrapper above matches the installed `sonner@2.0.8`.

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

These patterns are used across screens; screen-specific details follow in §6.9.

**Loading:**

- Prefer skeletons that match the final layout over a centered spinner.
- Use `aria-busy="true"` on the loading region and a visually hidden or visible status such as "Loading appointments…".
- Do not show fake content while loading.
- Do not disable navigation or the entire page for a local data fetch.
- Avoid layout shift when the data arrives.

**Empty:**

- Use a bordered surface, a short heading, one sentence explaining why the area is empty, and the next safe action.
- Do not imply that data is missing when the user is unauthorized; use the neutral access-denied state (`UI-002`).
- Do not invent sample appointments, doctors, or analytics to fill space.

**Success:**

- Show inline confirmation near the affected object, not only at the top of the page.
- Use a status/live region for screen readers.
- A toast may supplement the inline confirmation, but never replace it for booking, cancellation, publication, or other authoritative changes.

**Validation:**

- Show errors beside fields and in a summary when multiple fields fail.
- Move focus to the summary or first invalid field.
- Keep the user's input; never clear a whole form because one field failed.
- Use `role="alert"` for an error summary and `aria-describedby` for field-level errors.
- Do not use a toast for validation.

**Error:**

- Distinguish network, timeout, 5xx, 429, 401, 403, 404, and validation errors (`SPEC.md` §8.1).
- Copy explains what happened, whether data was saved, and what the user can do next.
- Provide retry only for safe/idempotent reads. Never auto-retry state-changing requests.
- Preserve drafts on chat and form errors where policy allows.
- Do not show raw provider text, stack traces, database errors, or internal request details.
- A request ID may be shown as a support reference, never as the primary explanation.

---

## 6. Application UI Guidelines

All screens use the same tokens, grid, typography, focus treatment, and state patterns. Density and grid visibility change with the task. Requirements come from `SPEC.md`; this section does not add product behavior.

### 6.1 Public landing and information pages

**Goal:** establish trust, explain the hospital's services and appointment access, and offer a clear route to the chatbot or booking without overwhelming the visitor.

- Use the full visible grid and a single outer content frame at `lg`.
- Hero: 12-column layout with the headline spanning 6–7 columns and supporting copy/actions in 4–5 columns. At `md`, stack rather than squeeze.
- One primary action ("Book an appointment" or the approved equivalent) and one secondary action ("Ask CamiConnect" or "View departments"). Only include actions that exist in the approved requirements.
- Use a small monospace eyebrow for context (for example "UNITED DOCTORS OF ST. CAMILLUS DE LELLIS HOSPITAL") only if the hospital name is approved for display.
- Services/departments: simple bordered grid of cards, 2 columns at `md`, 3 at `lg`; each card has a title, one-sentence description, and a text link. Do not invent departments.
- Doctor profiles: only approved public fields. Do not use stock photos of people as if they were hospital staff. Use initials/placeholder geometry only if approved; never imply a real person.
- Add a persistent, plain-language AI disclaimer where the chatbot is introduced: AI-generated information, not medical advice, not appointment confirmation.
- Public pages remain navigable when the API or database is unavailable (`SPEC.md` §8.1); static information should not be replaced by a generic error page.
- Footer: hospital contact/hours and approved policy links only. Do not invent legal copy.
- No carousel, autoplay video, animated statistics, or decorative gradients.
- The stock create-next-app landing page is not the final public design. Replacing it requires approval because `ADR-0008` currently records "keep the stock landing page" for the auth slice. Do not replace it inside an unrelated task.

### 6.2 Authentication pages

Applies to `/login`, `/register`, and the account/session states (`UI-002`).

- Page background: grid on; the form sits in an opaque `surface` card.
- Card width: `max-w-md` (28rem); center vertically with enough top/bottom padding. Do not make the card a floating glass panel.
- Card: 1px `line` border, `rounded-lg`, `p-6 sm:p-8`, no heavy shadow.
- One `<h1>` per page; the hospital/product wordmark may be a text link above the card.
- Form controls follow §5.3. Labels are always visible; errors are inline; the summary receives focus.
- Primary submit button spans the form width on mobile and may be auto-width on desktop; one primary action.
- Registration copy must remain neutral and must not enumerate accounts (`UI-002`). Do not add a role picker.
- Sign-in failure copy is generic. Do not expose whether an email exists. A supplementary Sonner toast may repeat the generic credential message; the inline summary remains authoritative.
- Pending state uses a specific label ("Signing in…", "Creating account…") and blocks double submission.
- Successful sign-in redirects; a one-time Sonner success toast may appear on the destination. The redirect and authenticated page remain authoritative.
- Session-expired and access-denied states use plain page-level messages, not toasts. 403 states must not reveal whether a protected resource exists.
- Auth pages use the semantic token, grid, and focus system. Keep behavior and tests unchanged when adjusting visual details.

### 6.3 Patient appointment booking

Applies to department/doctor browsing, availability, booking, and confirmation (`UI-003`).

**Desktop layout:**

- Page header: title, short description, and step indicator if the flow has multiple steps.
- Main column (7–8 of 12): department/doctor selection, availability, and booking form.
- Side column (4 of 12): selected doctor, appointment summary, policy notes, and the primary action.
- At `md`, stack the summary below the selection; at mobile, use one column and a clear linear order.

**Availability:**

- Render slots as a grid of buttons, each at least 44px high, with time text and an explicit selected state (border + check/indicator).
- Disabled/unavailable slots are visibly distinct and have accessible text explaining unavailability where useful. Never use color alone.
- Display times in the approved timezone (Asia/Manila default) and make the timezone explicit where confusion is possible.
- Always refresh availability before final confirmation. If a slot disappears, show an inline "slot no longer available" state and let the user choose another (`UI-003`).
- Do not label an appointment "confirmed" until the server response says so. Use "request received" or the exact returned status.
- Show backend field errors beside the corresponding fields.
- Disable submit while pending; prevent double submission; preserve selected data if the request fails.
- Confirmation page/card: appointment reference, doctor, department, date/time, status, and next allowed actions. Do not show fake contact details or policy text.
- Cancellation/rescheduling uses a confirmation dialog naming the appointment and consequence. Destructive confirm action is explicit.
- A toast may confirm a successful update, but the appointment status card must also update.

### 6.4 Patient appointment list and status

- Page header with a primary "Book appointment" action and, where useful, a filter for upcoming/past. Only include filters supported by the API.
- Desktop: a table or list with columns for date/time, doctor, department, status, and actions. On mobile: stacked records with the same information in a readable order.
- Status chips use the actual server status and the badge rules in §5.5. Never infer "confirmed" from a pending row.
- Detail view: a two-column layout at `lg` with the appointment summary and a timeline/history area only if the API returns history (`SPEC.md` FR-004).
- Cancellation/reschedule actions are separated from the primary "book" flow and always confirmed.
- Empty state: explain that there are no appointments and offer the booking action.
- Error state: distinguish unavailable data from an empty list.

### 6.5 AI chatbot interface

Applies to `UI-001` and `FR-001`.

**Layout:**

- Desktop: conversation column (8 of 12) and a source/context rail (4 of 12). At `lg`, the rail may be a bordered panel; below `lg`, sources move below the relevant assistant message or into an accessible disclosure.
- Mobile: one column, full-height chat area with a fixed composer at the bottom, safe-area padding, and no horizontal overflow.
- The conversation panel is opaque `surface`; the grid remains visible in the page margins.
- Use a max-width of ~65–70ch for message text. Do not stretch assistant answers across the full viewport.

**Messages:**

- Assistant messages: `bg-surface`, 1px `line` border, `rounded-lg`, no speech-bubble tails; include a small "CamiConnect" label and generated-content notice.
- User messages: `bg-surface-muted`, right-aligned on desktop, full-width on mobile; no strong primary fill that competes with actions.
- Message text must be rendered safely (no unsanitized HTML). If markdown is supported, sanitize it and style headings/lists/code consistently.
- Keep a persistent notice that answers are AI-generated, not medical advice, and not appointment confirmation.
- Sources: render exactly as returned. Use a bordered list with document title, section, and an accessible link if the contract provides one. Never invent sources or citations.
- Fallback answers: visually distinct (for example a `warning-soft` or `surface-muted` callout with a border) and offer approved links to departments, doctors, or booking. Do not use success styling for an unverified answer.
- Streamed text, if later approved, must not imply availability or booking confirmation. Source references still come only from retrieved records.

**Composer:**

- Label the textarea visibly or with an accessible name; placeholder is supplementary.
- Show a character counter matching the server maximum (`UI-001`).
- Submit button is at least 44px, disabled when empty/over limit/pending, with a specific pending state.
- Preserve the draft on error and after a timeout. Do not clear the conversation on a transient failure.
- `aria-live="polite"` announces new assistant messages/status changes; loading announcements are not repeated excessively.
- 429, provider unavailable, network, and timeout messages are friendly and distinct from validation errors; retry only when safe.
- Never show raw provider errors, prompts, keys, or internal configuration.

**Empty state:**

- Explain what the assistant can help with using approved topics: hospital services/departments, doctor profiles, appointment procedures, consultation requirements, approved hours/policies.
- Do not invent suggested questions that imply unavailable data. Suggested prompts must map to approved knowledge or be omitted.

### 6.6 Doctor dashboard

Applies to `UI-004` and `FR-005`.

**Layout:**

- Desktop: persistent sidebar (3 of 12 or 240px) and work area (9–10 of 12). The sidebar may be omitted if the doctor only has one view and a simple header is clearer.
- Page header: doctor name/scope, date context, and a compact filter bar. Do not expose more patient information than the API returns.
- Dense data area: grid texture off; tables/cards sit on `surface` with clear rules.
- Main content: today's schedule, assigned appointments, and status controls. Use a table for appointment lists; use a timeline or grouped list for the schedule only if it improves scanning.

**Visual rules:**

- Density is higher than patient pages, but type does not fall below 14px for essential data; 12px for metadata only.
- Status changes: use an inline control with the allowed transitions only (`SPEC.md` FR-005). Show the server result; never optimistically drift to a new status.
- A status update success may use a toast, but the row must update from the server response.
- Show only the patient fields returned by the API (`UC-DOC-03`). Do not add fields from assumptions.
- Rejected transitions show an inline, specific message; do not silently revert without explanation.
- Avoid decorative cards. Use one bordered work surface with section rules.
- If the schedule is empty, show the empty state and the next available action, not fake slots.

### 6.7 Administrator dashboard

Applies to `UI-005`, `FR-002`, and `FR-006`.

**Shell:**

- Desktop: sidebar 240px, top bar 64px, content container with 12-column grid.
- Mobile: sidebar becomes an accessible drawer; no hidden-only navigation.
- Use a page title, short description, and one primary action per screen. Admin screens often need multiple actions; use secondary buttons and a clearly separated danger zone.

**Density:**

- Grid texture off in work areas.
- Tables are the default for departments, doctors, schedules, appointments, documents, ingestion jobs, and audit events.
- Use compact rows (`py-3`) but keep controls at 44px where they are touch targets.
- Destructive actions (deactivate/remove/reprocess) require a confirmation dialog that names the object and consequence. Do not use an undo toast as the only protection.
- Bulk actions, if implemented, must show selection count and a confirmation for destructive effects.

**Knowledge-base workflow:**

- Upload: show accepted type/size before selection, file name, progress, and extracted-text preview before approval.
- Use the status values returned by the API (for example registered, processing, ready for review, published, failed). Do not invent states outside the contract.
- Approval is an explicit action, visually distinct from upload. Upload alone never shows "published".
- Ingestion status uses bounded polling and stops on terminal states; show paused/failed states with a safe reprocess action (`UC-ADM-06`, `UC-ADM-07`).
- Preview text is presented as untrusted content; never render it as HTML.
- Audit events use a read-only table with timestamps, actor, action, and target; no decorative timeline unless it genuinely improves scanning.

### 6.8 Analytics views

Applies to `UI-006` and `FR-007`.

- Page shell: title, date range/granularity controls, and a measurable refresh/update action if supported.
- Grid texture off behind chart cards. The page may keep the grid in the shell; chart cards use opaque surfaces.
- KPI row: four cards at `lg`, two at `md`, one at mobile. Each card shows a single measured value, period, and a plain-language label. Do not combine measured facts and generated interpretation in one card.
- Charts: use the chart palette, direct labels where possible, clear axes, units, and a legend. Provide a table or text summary alternative (`A11Y-09`).
- Measured facts: label "Measured data" (or equivalent) and keep a consistent surface. Where the approved analytics policy requires AI-generated explanations, label them "AI-generated summary", use a distinct bordered callout, and keep them visually separated.
- No causal language for correlations. Use "associated with" rather than "caused by" unless a causal claim is explicitly supported and approved; per `SPEC.md`, it is not.
- Empty state: explain that no data exists for the selected period. Do not show zero-filled charts that imply real measurements.
- Loading: skeleton cards/charts with fixed dimensions; no layout shift.
- Error: one clear error region with retry for reads; individual chart failures should not blank the entire page unless the page cannot function.
- Date/time display uses Asia/Manila by default and states the timezone.
- Do not add a chart library until approved; the visual rules apply regardless of implementation.

### 6.9 State patterns by screen

| Screen | Loading | Empty | Success | Validation | Error |
|---|---|---|---|---|---|
| Public pages | Static content remains; no full-page spinner | "No information available" only if truly empty | Not applicable | Not applicable | Public navigation remains usable; API failure shown in a contained notice |
| Auth | Submit pending label; no duplicate submit | Not applicable | Inline confirmation or redirect | Field errors + summary; focus summary | Generic credential/session message; no account enumeration |
| Booking | Skeleton availability; `aria-busy` | "No availability for this period" with next step | Status card reflects server; toast supplementary | Field errors beside inputs; slot conflict inline | Refresh availability; preserve selection; retry only safe reads |
| Appointments | Skeleton list/detail | "No appointments yet" + book action | Updated row/status; optional toast | Inline + summary | Distinguish 401/403/404/network/timeout; no existence leak |
| Chat | "Checking hospital information…" with live region | Approved topic guidance | Answer + real sources; fallback distinct | Counter/limit message | Friendly retry; preserve draft; 429/503/network distinct |
| Doctor | Skeleton schedule/table | "No appointments for this period" | Row updates from server; optional toast | Inline transition error | Access denied vs unavailable; do not show other scope |
| Admin | Skeleton table/status | "No documents/jobs/events" + safe next action | Server-confirmed status; toast supplementary | Field errors + summary | Bounded retry for reads; destructive action errors inline |
| Analytics | Skeleton KPI/chart | "No data for this period" | Refreshed measured data | Range validation inline | Per-chart or page-level; retry reads only |

---

## 7. Accessibility, Responsive, and Content Requirements

### 7.1 Accessibility baseline

Target **WCAG 2.1 AA** for patient-facing flows, as proposed in `SPEC.md` §8.1.

- Use semantic landmarks: `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`, with one `<main>` per page.
- One `<h1>` per page; heading levels follow document structure.
- Every form control has a visible, associated `<label>`.
- Every interactive element has a visible focus indicator using `focus-ring`.
- Keyboard operation has no traps. Dialogs trap focus intentionally and restore it on close.
- Skip link is the first focusable element.
- Touch targets are at least 44×44px for primary actions; never below 24×24px.
- Error messages are announced and associated via `aria-describedby`; use `role="alert"` for immediate errors and `role="status"` for polite updates.
- Chat and status changes use `aria-live` appropriately (`UI-001`, `SPEC.md` §8.1).
- No color-only cues for status, selection, chart series, or errors.
- Charts have a table/text alternative.
- `prefers-reduced-motion` removes non-essential animation.
- 200% zoom and 320px width retain content and function.
- Focus is not obscured by sticky headers; use `scroll-margin-top` on focus targets.
- Do not use `aria-label` to duplicate visible text when visible text already names the control. Use visually hidden text for icon-only controls.
- Do not use `title` as the only accessible name.

### 7.2 Responsive rules

- Mobile-first CSS; no layout that requires horizontal scrolling for the page itself.
- At 320px: all text remains readable; forms and chat composer do not overflow; tables either scroll in a labelled region or become stacked records.
- At 768px: two-column layouts only when each column retains a readable measure; avoid cramped sidebars.
- At 1024px: introduce 12-column layouts, persistent dashboards, and chat rails.
- At 1440px: do not stretch prose; keep the 80rem container and add whitespace.
- Use `min-w-0` on grid/flex children containing long content.
- Test long doctor names, department names, status labels, error messages, and translated strings (when i18n is approved) at each breakpoint.
- Use `dvh` for full-height chat/mobile layouts where appropriate, with fallbacks that do not break older browsers.

### 7.3 Content and tone

- Calm, direct, and specific. State what happened, what it means, and what to do next.
- Avoid marketing superlatives, false urgency, and anthropomorphic claims about the AI.
- Use "AI-generated" and "not medical advice" explicitly where required by `UI-001`.
- Do not diagnose, recommend treatment, or imply clinical judgment.
- Do not claim availability, confirmation, publication, or completion before the server confirms it.
- Use "request received" or the exact server status for pending appointments.
- Times use Asia/Manila by default and state the timezone when ambiguity is possible.
- Error copy does not reveal whether another user's record exists (`FR-003`, `S-10`).
- Never include secrets, full patient messages, or sensitive identifiers in UI copy, logs, screenshots, or traces.
- Synthetic data only in fixtures, screenshots, and demos (`AGENTS.md`).

### 7.4 Imagery and iconography

- Use line icons with a consistent stroke (about 1.5px) and a 20/24px grid. Do not mix filled and outline styles arbitrarily.
- Icon-only buttons require accessible names. Decorative icons are `aria-hidden="true"`.
- Do not add an icon package without approval. Inline SVG is acceptable for a small, reviewed set.
- No stock photos of patients or staff presented as real hospital personnel. Use approved hospital imagery only after brand/privacy review.
- No decorative medical imagery (DNA strands, stethoscope illustrations) that adds no information.
- The wordmark may be text until a hospital-approved logo is supplied. Do not fabricate a logo or official seal.

---

## 8. Implementation Rules

### 8.1 Stack constraints

- Use the existing Next.js App Router and React Server Components where appropriate.
- Use the existing Tailwind CSS v4 pipeline via `@tailwindcss/turbopack` in `next.config.ts`.
- Do **not** add a `postcss.config.*`, replace the Tailwind loader, or introduce another CSS framework.
- Keep global tokens and cross-cutting utilities in `src/app/globals.css`.
- Use `next/font` for fonts; no external font requests at runtime.
- Client components only for browser interactivity, state, and effects. Keep data fetching and authorization on the server.
- Never import `src/server/*` into client components.
- Do not add dependencies (including Sonner, icon libraries, chart libraries, UI kits, `clsx`, `tailwind-merge`, or animation libraries) without approval and a documented reason.

### 8.2 File organization

Proposed frontend organization; adapt only when the first real screen needs it:

```text
src/
  app/
    layout.tsx                 # root shell, fonts, global Toaster
    globals.css                # tokens, base styles, grid/focus utilities
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

Rules:

- `components/ui` contains visual primitives with no domain/data logic.
- Domain components may compose primitives and receive data through props.
- Do not put data fetching, authorization, or server-only imports in UI primitives.
- Do not create a `components/ui` abstraction for a one-off visual style. Use utilities until reuse is real.
- A `PageContainer` component is justified if it consistently enforces max width and padding; a `Button` primitive is justified once variants are reused. Avoid a giant design-system package.

### 8.3 Styling separation

- Visual styling stays out of business logic. Do not encode status meaning in class-name strings generated inside server services.
- Domain components may map a known status to a visual tone; the mapping belongs in a small presentational helper and must be covered by component tests.
- Do not use inline styles for colors or spacing except for genuinely dynamic values (for example a chart coordinate). Use tokens and utilities.
- Do not use `!important` to override component styles. If a third-party component requires it (for example a toast library), scope the override in the wrapper and document it.
- Do not use `dangerouslySetInnerHTML`. Render text safely; sanitize markdown if it is ever introduced.
- Do not rely on hover for essential information.
- Do not hide content with `display: none` when it is needed by assistive technology; use `sr-only`.

### 8.4 Reuse and abstraction

- Reuse when it improves consistency or removes a real maintenance risk. Do not create abstractions for hypothetical screens.
- A primitive should have a small, explicit API: variant, size, state, and accessible name where needed.
- Keep component variants finite. If a new variant is needed, check whether an existing one can be used or whether the design system needs an approved change.
- Avoid polymorphic component APIs unless they are genuinely required; they make accessibility and type safety harder to reason about.
- Keep styling props minimal; prefer semantic variants over arbitrary class overrides.
- Do not use a component library's default theme and then override it heavily; that creates two competing design systems.

### 8.5 Performance

- Prefer CSS gradients for the grid; no image, canvas, or JavaScript.
- Do not use `background-attachment: fixed` or large blurred layers.
- Keep the initial public bundle free of dashboard/chart code (`SPEC.md` §8.1).
- Use `next/image` for approved raster assets with explicit dimensions; do not use unoptimized large images.
- Avoid animating box-shadow, filter, or layout properties.
- Use `content-visibility` only after measuring; do not apply it to focusable or live-region content.
- Do not add font weights or families that are not used.
- Keep icon SVGs small and inline only when reused through a component.

### 8.6 Data and safety in the UI

- Availability, appointment state, document publication, and analytics are server-authoritative. The UI displays them; it does not invent or optimistically confirm them.
- Do not use the LLM to generate availability, booking confirmation, analytics values, or citations.
- Render sources exactly as returned by the API; never fabricate missing sources.
- Keep measured analytics and AI-generated explanations visually separate.
- Do not put real patient data in fixtures, screenshots, design mocks, or toasts.
- Do not expose internal error details, stack traces, secrets, or provider messages in the UI.
- Public pages must remain navigable when APIs are unavailable.

---

## 9. Visual Definition of Done

A frontend change is visually complete only when all applicable checks pass:

- [ ] Uses only semantic tokens for color; no new raw hex or `zinc`/`slate` palette classes in new UI.
- [ ] Uses the page container, structural columns, and spacing scale consistently.
- [ ] Grid texture is present where specified and absent where specified; it does not cross text or controls.
- [ ] Typography follows the hierarchy; body text is at least 16px on patient-facing pages; line length is controlled.
- [ ] Buttons, inputs, cards, badges, dialogs, navigation, tables, and Sonner toasts (§5.9) follow their patterns.
- [ ] Focus is visible on every interactive element; keyboard operation works without traps.
- [ ] Touch targets meet the 44px target for primary actions.
- [ ] Status is conveyed by text/icon as well as color.
- [ ] Loading, empty, success, validation, and error states exist and are distinct.
- [ ] No optimistic confirmation of booking, appointment status, publication, or analytics values.
- [ ] No fake data, fake availability, fake doctors, or invented sources.
- [ ] Responsive at 320, 375, 768, 1024, and 1440px; no page-level horizontal overflow.
- [ ] 200% zoom and reduced-motion behavior verified.
- [ ] Contrast checked for normal text, large text, controls, focus, and dark mode.
- [ ] Dialogs trap/restore focus; errors are announced and associated; chat/status live regions work.
- [ ] Charts have an accessible table/text alternative.
- [ ] Toasts supplement, not replace, inline state; no sensitive data in toast copy.
- [ ] `npm run lint` and `npm run typecheck` pass; `npm run build` passes after route/config changes.
- [ ] Applicable component, accessibility, and end-to-end tests pass; no assertions weakened to fit visuals.
- [ ] The change does not introduce an unapproved dependency, CSS framework, PostCSS config, or design-system fork.

---

## 10. How Agents Must Use This Document

Before implementing or modifying a UI:

1. Read the relevant sections of this document, `SPEC.md` §8, and `AGENTS.md`.
2. Inspect the existing component, its tests, and nearby styles before changing anything.
3. Identify the applicable tokens, grid behavior, component patterns, and state requirements.
4. Check the screen's requirement IDs (`UI-001`–`UI-006`) and do not add unapproved functionality.
5. Implement with semantic HTML, the existing Tailwind v4 pipeline, and the established token names.
6. Check responsive behavior at the required viewports, keyboard operation, focus, contrast, reduced motion, and error states.
7. Run the checks required by `AGENTS.md` and report actual results.
8. If the implementation requires a substantial design change, stop and request approval before changing this document or the design system.

**A substantial design change includes:**

- A new primary/accent color family or a change to semantic color meanings.
- A new typeface, type scale, or heading hierarchy.
- A different grid model, breakpoint set, or page container.
- A new dependency that affects visual primitives (UI kit, icons, charts, toasts, animation).
- Replacing the visible-grid aesthetic with a different visual direction.
- Changing the meaning of status colors or the toast/confirmation model.
- A dark-mode strategy change from system preference to a manual theme toggle.

Documentation-only changes to this file still require approval when they alter an approved design decision. Do not silently "improve" the design system inside a feature task.

---

## 11. Approval Decisions and Unresolved Choices

### 11.1 Proposed decisions requiring approval

> **Approved 2026-10-23:** the human project owner approved this document for the auth slice, including the palette, dark theme, Geist typography, visible grid, and Sonner. The stock landing page replacement, hospital logo/brand assets, and chart library remain out of scope.

| # | Decision | Proposal | Impact if not approved |
|---|---|---|---|
| 1 | Hospital brand palette and logo | Deep clinical blue primary, teal accent, cool neutrals; text wordmark until official assets exist | Palette may conflict with hospital identity; logo must not be invented |
| 2 | Dark theme | Support light and dark via system preference; no manual toggle initially | Additional token/testing work; if rejected, remove dark block and target light only |
| 3 | Sonner toast dependency | Use Sonner as the single toast implementation; approved and installed as `sonner@^2.0.8` | Toasts remain unspecified; do not build a custom system without approval |
| 4 | Typography | Keep Geist Sans/Mono already loaded; no new font dependency | A hospital brand font may be required later |
| 5 | Visible grid intensity | 7% line alpha, 48/64px cells, full grid on public/patient pages, off in dense work areas | Too strong competes with content; too weak loses the signature |
| 6 | Stock landing page replacement | Replace the create-next-app page with the public design in a dedicated task | `ADR-0008` currently says keep the stock landing page for the auth slice |
| 7 | Auth-slice visual migration | Migrate existing `zinc` auth components to tokens in a focused task; approved and implemented | Two visual systems persist longer |
| 8 | Photography/imagery | No stock patient/staff photos; line icons and approved hospital assets only | Privacy and trust risk if generic people are presented as staff |
| 9 | Chart library | Not selected in this document; require separate approval | No charts should be implemented with an unapproved dependency |

### 11.2 Relationship to `ADR-0008`

`ADR-0008` originally recorded the auth-slice UI policy: "no new design system; utility styling only" and "keep the stock landing page." On 2026-10-23 the human owner approved this document for the auth slice, superseding the "no new design system" policy for `/login` and `/register` with the semantic token and utility system. The stock landing page remains unchanged.

Approval is still required before:

- Treating this document as binding for screens outside the implemented auth slice.
- Replacing the stock landing page.
- Recording a superseding ADR or updating `ADR-0008` beyond the auth-slice note.

### 11.3 Remaining product-level open choices

These are already open in `SPEC.md` §15 and are not resolved by this document:

- Chat access for anonymous visitors vs patients only.
- English-only vs English + Filipino.
- Official hospital documents and public information sources.
- Doctor schedule and appointment policy details.
- Analytics AI-explanation policy.
- Hosting, provider, and chart-library choices.

Do not invent UI copy or states that depend on these decisions. Design the layout so content can change without rewriting the grid or component structure.

---

## 12. Proposed Adoption Sequence

> **Status 2026-10-23:** steps 1–4 are complete for the auth slice. The stock landing page and later screens remain pending.

1. **Approve this document** and the decisions in §11.1, especially the palette, dark-mode scope, Sonner dependency, and the relationship to `ADR-0008`.
2. **Add tokens and grid utilities** to `src/app/globals.css` in a focused implementation task; verify build, lint, typecheck, and a simple visual page.
3. **Build the smallest primitives** actually needed: page container, button, field, card, badge, dialog, and `AppToaster` (after Sonner approval). Add component and accessibility tests.
4. **Migrate the auth slice** to the tokens without changing behavior or weakening existing tests.
5. **Apply the system to new screens** in requirement order: public information, patient appointments, chat, doctor dashboard, admin dashboard, analytics.
6. **Replace the stock landing page** only in an approved public-page task.
7. **Verify** responsive layouts, contrast, focus, reduced motion, empty/loading/error states, and the visual definition of done in §9.
8. **Record** any approved design-system change in this document and, where the decision is architectural or cross-cutting, in an ADR.

---

## 13. Change Log

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-10-23 | Initial proposed visual design system, visible grid, tokens, component patterns, screen guidance, and Sonner direction |
| 0.2 | 2026-10-23 | Approved for the auth slice; applied tokens, grid, auth page styling, Sonner `^2.0.8`, and supplementary auth toasts |
