# AI-APT-002 — Need-Based Specialty Routing (Cami picks the specialty)

- Status: **Built** 2026-11-16 (approved 2026-11-16 by the project owner, R1–R5 at their recommended defaults); the routing eval (`npm run eval:routing`) has not been run yet
- Date: 2026-11-16
- Type: Feature / policy amendment
- Priority: High
- Module: Patient Chatbot / Booking
- Amends: [`AI-APT-001`](AI-APT-001-conversational-booking.md) business rule "Symptoms and
  medical advice", `src/lib/chat/persona.ts` boundary "Never decide which specialty a
  patient needs", `specs/plan/pln-002.md` symptom rule
- Related: [`PAY-001`](PAY-001-chat-payments-discounts-services.md) (services routing),
  `ADR-0009` (evaluation set), `spec-admin.md` ADM-03 (specialties)
- Requirements: `FR-001`, `FR-004`, `UI-001`

## Objective

Patients should not have to know which specialty they need. They describe their concern in
their own words ("my 5-year-old has had a cough for a week", "I keep getting palpitations",
"I need a follow-up for my blood pressure"), and Cami goes straight to doctors of the
right specialty. Picking a specialty from a list becomes the exception, not the default.

## What changes from AI-APT-001

| Today | After this ticket |
|---|---|
| Any symptom message gets the `medical_advice` decline | Symptoms + a wish to be seen → Cami routes to a specialty and shows doctors |
| "Book an appointment" → specialty chips | "Book an appointment" → Cami asks "What would you like the doctor to check?" |
| Cami never decides the specialty | Cami **suggests** one from the hospital's active list; the patient can change it with one tap |
| Symptoms with no booking wish → decline only | Decline medical advice, then offer: "I can book you with a doctor who can check this." [Yes, book] |

What does **not** change:

- Cami still never diagnoses, names a condition, interprets results, or recommends medicine
  or treatment.
- The urgency check (server keywords **or** LLM flag) still runs first and wins.
- Doctors, specialties, and slots still come from the database; booking still needs an
  explicit Confirm.

## Flow

```mermaid
flowchart TD
  A[Patient message] --> B{Urgent?<br/>keyword OR LLM}
  B -->|Yes| C[Emergency notice<br/>no routing, no payment]
  B -->|No| D{Wants to be seen,<br/>or describes a concern?}
  D -->|Names specialty or doctor| E[Existing Paths A/B]
  D -->|Describes a concern| F[LLM: care-need extraction<br/>specialty from hospital list only]
  F --> G[Server: validate + rules]
  G -->|Clear match| H["'A Cardiology doctor can check this.'<br/>Doctor cards + [Change specialty]"]
  G -->|Two close matches| I[Show top match's doctors<br/>+ one-tap alternative]
  G -->|Unclear / unknown| J[First-contact specialty<br/>Family Med or IM for adults, Pediatrics for children]
  D -->|Vague: 'I want to book'| K["Cami: 'What would you like the doctor to check?'"]
  K --> F
```

## How the specialty is picked

### 1. LLM extracts the care need (structured, never shown as-is)

New fields on `intentExtractionSchema` (Zod-validated, all optional):

| Field | Meaning |
|---|---|
| `concern` | Short summary in the patient's own words, ≤ 200 chars (becomes the appointment reason, editable) |
| `patientAge` | Number if stated ("my 5-year-old", "I'm 67"), else null |
| `forSomeoneElse` | true when booking for a child, parent, etc. |
| `specialtyCandidates` | Up to **2** names, ranked, chosen **only** from the active specialty list given in the prompt |
| `serviceCandidates` | Up to 3 service names from the active bookable services (PAY-001: "I need a CBC", "my doctor requested an ultrasound") |
| `routingConfidence` | `high` / `low` |

The prompt gives the model the active specialties with their **routing hints** (below), so
it chooses from the hospital's own descriptions, not general medical knowledge alone.

### 2. Server decides (deterministic, testable)

In order:

1. Urgent → emergency notice. Stop.
2. Drop any candidate that is not an active specialty with at least one active doctor
   (`resolve.ts`). The model can never invent one.
3. **Age rule:** if `patientAge < 18` and Pediatrics is active, route to Pediatrics unless
   the patient named another specialty. (Server rule, not left to the model.)
4. One valid candidate with `high` confidence → route to it.
5. Two valid candidates → route to the first; show the second as a one-tap alternative.
6. Nothing valid, or `low` confidence → **first-contact specialty** from settings
   (`chat.first_contact_specialty_adult`, default Family Medicine, then Internal Medicine;
   `chat.first_contact_specialty_child`, default Pediatrics). A general doctor refers
   onward if needed, which is how outpatient care normally works.
7. If the patient named a specialty or doctor, that always wins over routing.

### 3. Cami's reply is templated

- Routed: "Thanks for sharing. A **{Specialty}** doctor can check this for you. Here are
  doctors with open slots:" + doctor cards (soonest slot first) + [Change specialty].
- First-contact: "A **{Specialty}** doctor is a good first stop and can refer you if
  needed. Here are doctors with open slots:" + cards + [Change specialty].
- Summary card shows "Reason for visit: *{concern}*" with an edit option before Confirm.

The LLM writes none of these sentences, so it cannot slip a diagnosis into the reply.
Banned in any template: "you have", "it sounds like", "diagnosis", condition names.

### 4. Routing hints (admin-managed, ADM-03 extension)

New column `specialties.routing_hints text` (≤ 1,000 chars), edited on
`/admin/specialties/[id]`, audited like other specialty saves. Plain-language "who should
book here", reviewed by the hospital's medical staff. Synthetic seed examples:

| Specialty | Routing hints (seed) |
|---|---|
| Family Medicine | General check-ups, common illnesses like colds, fever, cough, minor injuries, health certificates, unsure where to start |
| Internal Medicine | Adults with long-term conditions like diabetes or high blood pressure, follow-ups, lab result review, ongoing body aches, stomach problems |
| Pediatrics | Patients under 18: check-ups, vaccinations, fever, cough, growth and development |
| Cardiology | Heart concerns: palpitations, high blood pressure that's hard to control, follow-up after a heart test, referred by another doctor for the heart |

Hints are context for routing only; they are never shown to the patient as medical
information.

## Safety rules

- **Urgent always wins.** Keyword or LLM urgency → emergency notice, no doctor cards, no
  payment request. (The keyword list will sometimes flag non-acute cases like "chest pain
  last month"; that is the intended conservative trade-off. The patient can still book by
  naming a specialty.)
- **Suggest, never tell.** Cami routes to who can *check* the concern. It never says what
  the concern is.
- **Always changeable.** Every routed reply has [Change specialty], which opens the existing
  specialty chips.
- **No routing from someone else's data.** Only the current conversation is used.
- **No new logging.** `concern` is health information; it is stored only as the
  appointment reason (which the doctor and front desk already see) and in
  `chat_messages`, and never written to server logs.
- **Self-harm language** keeps the existing urgent path. (Separate follow-up: add the NCMH
  crisis hotline to that notice.)

## Changes by file (for the implementing agent)

| Area | Change |
|---|---|
| `src/lib/chat/schemas.ts` | Add the extraction fields above |
| `src/lib/chat/routing.ts` *(new, pure)* | `routeToSpecialty(extraction, activeSpecialties, settings)` → `{ specialtyId, alternativeId?, reason: "matched" \| "age_rule" \| "first_contact" }` |
| `src/lib/chat/state.ts` | Draft gains `concern`; new event `change_specialty`; routed path enters `choosing_doctor` directly |
| `src/lib/chat/persona.ts` | Replace "Never decide which specialty…" with "Suggest a specialty only from the hospital's list, and never name or guess a condition" |
| `src/lib/chat/safety.ts` | New templates; `MEDICAL_ADVICE_DECLINE` gains the [Yes, book] offer |
| `src/server/chat/orchestrator.ts` | Intent prompt lists active specialties + hints; symptom + booking wish no longer forced to `medical_advice` |
| `db/migrations/0032_specialty_routing_hints.sql` | `routing_hints` column + update to the audited specialty save function |
| Admin specialties form | Routing hints textarea |
| Settings (ADM-15) | `chat.first_contact_specialty_adult`, `chat.first_contact_specialty_child` |

## Tests (write first)

- Unit, `routing.ts`: valid match; invented specialty dropped; inactive specialty dropped;
  specialty with no active doctors dropped; age < 18 → Pediatrics; named specialty beats
  routing; low confidence → first-contact; two candidates → alternative set.
- Orchestrator (LLM mocked): urgent keyword beats a `high` routing result; routed reply is
  the template and contains no model text; [Change specialty] shows chips; concern lands in
  the draft and the summary.
- Safety: every routing template is free of banned phrases.
- **Evaluation set** (ADR-0009): 40 synthetic patient messages (English, Tagalog, Taglish)
  with expected specialty or first-contact, run against the real model by
  `npm run eval:routing`. Target ≥ 90% correct or safely first-contact, and **0** urgent
  messages routed to doctors. Not a CI gate (costs tokens); run before each release.

Example eval rows:

| Message | Expected |
|---|---|
| "Ubo't sipon ng anak ko, 4 years old, 3 days na" | Pediatrics (age rule) |
| "Pa-check up po ako, mataas BP ko lagi" | Internal Medicine (alt: Cardiology) |
| "Kumakabog dibdib ko minsan kahit nakaupo" | Cardiology |
| "Masakit dibdib ko ngayon, hirap huminga" | Emergency notice, no routing |
| "I don't know, I just feel tired all the time" | First-contact (Family Medicine) |
| "Need ko magpa-CBC, may request na ako" | Lab service: CBC (PAY-001) |

## Acceptance criteria

- [x] A patient can describe a concern and get doctor cards without choosing a specialty.
- [x] Only active specialties with active doctors are ever suggested.
- [x] Patients under 18 are routed to Pediatrics unless another specialty is named.
- [x] Unclear concerns go to the first-contact specialty, never to a guess.
- [x] Urgent messages get the emergency notice and no doctor cards.
- [x] Every routed reply is templated, names no condition, and has [Change specialty].
- [x] The concern is shown as the reason for visit and can be edited before Confirm.
- [x] Admins can edit routing hints; saves are audited.
- [ ] The routing eval reaches the target with zero urgent misroutes.

## Decisions (approved 2026-11-16)

The project owner approved every recommended default below.

| # | Decision | Approved |
|---|---|---|
| R1 | Approve the policy change: Cami may suggest a specialty | Yes, with the safety rules above |
| R2 | Go straight to doctor cards, or ask "Book with Cardiology?" first | Straight to cards with [Change specialty]; one less tap, still reversible |
| R3 | First-contact specialty for adults | Family Medicine, falling back to Internal Medicine |
| R4 | Who writes the real routing hints | The hospital's medical staff; seed is synthetic |
| R5 | Should Cami ask one follow-up question when unsure ("Is this for you or a child?") before falling back? | Yes, at most one question, only for age; everything else goes to first-contact |
