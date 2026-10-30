# AI-APT-001 — AI-Assisted Conversational Appointment Booking

- Status: Approved (scope decisions recorded 2026-10-30)
- Type: Feature
- Priority: High
- Module: Patient Chatbot / Appointment Booking
- Plan: [`PLN-002`](../plan/pln-002.md)
- ADRs: [`ADR-0003`](../decisions/ADR-0003-database-connections-and-rls.md) (note
  2026-10-30), [`ADR-0004`](../decisions/ADR-0004-ingestion-job-execution.md) (interim
  decision 2026-10-30), [`ADR-0006`](../decisions/ADR-0006-external-provider-contracts.md),
  [`ADR-0007`](../decisions/ADR-0007-appointment-and-doctor-policy.md),
  [`ADR-0008`](../decisions/ADR-0008-chat-analytics-i18n-ui-policy.md) (chat access
  2026-10-30), [`ADR-0009`](../decisions/ADR-0009-corpus-and-evaluation.md) (corpus
  2026-10-30)
- Requirements: `FR-001`, `FR-004`, `UI-001`, `UI-003`

## Objective

Make a chat assistant the signed-in patient's main screen at `/chat`. Through the chat a
patient can ask hospital questions (answered by RAG over a synthetic corpus), book an
appointment by specialty or by a named doctor, and view and cancel their own
appointments. The booking backend from DOC-SCH-001 (`getAvailableSlots`,
`listBookableDoctors`, `bookAppointment`, `cammi_connect_book_appointment`) is reused.

## Approved scope decisions (2026-10-30)

1. **Server-owned state machine.** The server runs the booking flow. The LLM only
   extracts intent and details into Zod-validated JSON and writes grounded RAG answers.
   All booking-step text is templated by the server. Doctors and slots are cards built
   from database rows. A booking happens only from an explicit Confirm event.
2. **No new dependencies.** Gemini and OpenCode Zen adapters use plain `fetch` with Zod
   validation (ADR-0006 deviation from SPEC §2.2).
3. **Conversations are stored in Supabase**, scoped to the patient, together with their
   booking state.
4. **View and cancel only.** Patients can view and cancel their appointments.
   Rescheduling gets a "not available yet — you can cancel and rebook" reply because
   ADR-0007 defers the reschedule policy.

## Slices

Each slice uses TDD and stops for review at its "Done when" (see PLN-002).

| Slice | Goal |
|---|---|
| S0 | This ticket, ADR decisions, provider adapters, and the provider smoke test |
| S1 | `/chat` shell end to end: persisted conversations, intent extraction, safe declines |
| S2 | Hospital information: RAG answers with sources, directory questions from the database |
| S3 | Booking by specialty (Path A) and by doctor (Path B) |
| S4 | View and cancel appointments |
| S5 | Hardening, full hosted smoke test, and closeout |

## Database

| Table / function | Slice | Purpose |
|---|---|---|
| `chat_conversations` | S1 | `id`, `patient_id`, `title`, `booking_state jsonb`, timestamps |
| `chat_messages` | S1 | `id`, `conversation_id`, `role` (`user`/`assistant`), `content`, `payload jsonb`, `created_at` |
| `knowledge_documents` | S2 | `slug`, `title`, `content_hash`, `version`, `is_published` |
| `knowledge_chunks` | S2 | chunk text, section title, hash, `embedding vector(768)`, `is_published` |
| `cammi_connect_match_knowledge_chunks` | S2 | Similarity search over published chunks |
| `cammi_connect_replace_document_chunks` | S2 | Atomic swap of a document's chunks |

All tables follow ADR-0003: RLS enabled with no permissive policies, `anon` and
`authenticated` privileges revoked, and functions executable by `service_role` only.

## Business rules

- **Symptoms and medical advice.** A message describing symptoms or asking for medical
  advice gets the `medical_advice` intent. The reply is a templated safe decline that
  never diagnoses or recommends a service. When the symptoms sound urgent (chest pain,
  difficulty breathing, severe bleeding, loss of consciousness, and the like), the
  decline adds an emergency notice telling the patient to go to the nearest emergency
  room or call emergency services. Urgency is flagged by the LLM **or** a server-side
  keyword check, so it never relies on the LLM alone.
- **Booking only on Confirm.** An appointment is created only from an explicit Confirm
  event in the `awaiting_confirmation` state. A guarded state update stops a double
  Confirm from booking twice; the `appointments_no_active_overlap` constraint is the
  backstop.
- **Database is the source of truth.** Doctors, specialties, departments, and slots
  shown in chat come from the database, never from the LLM or RAG. Availability is
  re-checked when a slot is selected and again on Confirm.
- **Booking horizon.** Preferred dates in the past or more than **60 days** ahead (in
  `Asia/Manila`) are rejected with a templated message.
- **Corrections.** Changing the specialty clears the doctor and slot; changing the
  doctor clears the slot; changing the date or time clears the slot.
- **Cancellation.** Patients may cancel their own `requested` or `confirmed`
  appointments (ADR-0007). Another patient's appointment is reported as not found.
- **RAG.** Answers use retrieved context only and cite real sources. When nothing
  relevant is found, the assistant says the information could not be verified.
- **Chat access.** Signed-in patients only; 10 user messages per minute per patient;
  provider outages return a friendly 503 (ADR-0008).
- **Retention.** `chat_messages` are kept for 90 days and purged by a documented manual
  SQL step (ADR-0008).
- All dates and times use `Asia/Manila`.

## Permissions (this ticket)

| Role | Permissions |
|---|---|
| Patient | Chat; view own conversations; book; view and cancel own appointments |
| Doctor | No chat access; sees chat bookings on the existing `/doctor` board |
| Admin | No chat access in this ticket |
| Anonymous | No chat access (401 / redirect to `/login`) |

## Acceptance criteria

- [ ] A patient who registers or signs in lands on `/chat`.
- [ ] Conversations and messages persist and are visible only to their owner.
- [ ] Symptom messages get the safe decline, with the emergency notice when urgent.
- [ ] Hospital-information questions are answered from the corpus with real sources.
- [ ] Off-corpus questions get the "could not be verified" fallback.
- [ ] Directory questions are answered from the database, active entries only.
- [ ] A patient can book by specialty (Path A).
- [ ] A patient can book by a named doctor (Path B), including doctors with several
      specialties.
- [ ] Only database doctors and currently available slots are offered.
- [ ] No appointment is created without an explicit Confirm.
- [ ] A double Confirm or a two-tab race creates exactly one appointment.
- [ ] A failed booking never shows a confirmation.
- [ ] A patient can view their appointments and cancel a `requested` or `confirmed` one.
- [ ] Reschedule requests get the "not available yet" reply.
- [ ] Unauthenticated, non-patient, over-limit, and provider-down requests get
      401/403, 429, and 503 responses without chat content in logs.
- [ ] Provider adapters enforce timeouts and bounded retries and never expose keys or
      raw provider responses.

## Out of scope

Admin knowledge-base management (FR-002) and job-based ingestion, rescheduling,
streaming, the formal evaluation set, a shared-store rate limiter (ADR-0005), doctor
notifications on patient cancellation, and automated chat-message purging.

## Verification

Automated unit and component tests cover the domain logic, orchestrator, adapters (with
`fetch` mocked), route handler, and UI. Under ADR-0003 the migrations, RPCs, grants,
and concurrent booking are verified only by the manual hosted smoke test in
`db/README.md`. Provider contracts are verified by `npm run smoke:providers`.
