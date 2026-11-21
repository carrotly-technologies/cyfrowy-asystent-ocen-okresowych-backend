# Cyfrowy Asystent Ocen Okresowych — backend

NestJS API of **Cyfrowy Asystent Ocen Okresowych**: the whole periodic assessment of civil servants (ocena okresowa,
rozp. PRM z 4.04.2016, art. 81–83 ustawy o służbie cywilnej) on sheets A, B and C. The React frontend lives in
[cyfrowy-asystent-ocen-okresowych-frontend](https://github.com/carrotly-technologies/cyfrowy-asystent-ocen-okresowych-frontend).

## Setup

```bash
npm install
cp .env.example .env   # optional, defaults work out of the box
```

| Variable            | Default                 | Description                                                     |
| ------------------- | ----------------------- | --------------------------------------------------------------- |
| `PORT`              | `3000`                  | Port the API listens on                                         |
| `FRONTEND_URL`      | `http://localhost:5173` | Origin allowed by CORS                                          |
| `DEMO_TODAY`        | `2026-11-21`            | Demo "today" for all deadlines                                  |
| `FEATURE_ASSISTANT` | `true`                  | AI assistant chat; `false` hides it and 404s `/api/assistant/*` |
| `JWT_SECRET`        | dev-only default        | HS256 key for sign-in tokens (32+ bytes: `openssl rand -base64 32`); without it a warning is logged |
| `DATABASE_URL`      | (unset)                 | PostgreSQL URL; unset = in-memory storage (lost on restart)     |
| `OFFICE_NAME`       | `Urząd demonstracyjny (dane fikcyjne)` | „NAZWA URZĘDU” on sheets A/B/C (`GET /api/config` → `office`) |
| `OFFICE_CITY`       | `Warszawa`              | „miejscowość” next to the signatures on the sheets              |
| `OFFICE_LOGO_URL`   | (unset)                 | Optional logo URL shown on the on-screen sheet                  |
| `OBJECTION_RECIPIENT_A` | (unset)             | Sheet A „Pouczenie”: whom the objection goes to (blank = dotted line) |
| `REMINDERS_INTERVAL_MINUTES` | `60`          | Reminder scheduler interval (also runs at startup); `0` = startup and `POST /api/notifications/run` only |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | (unset) | Optional e-mail copy of notifications (nodemailer); unset `SMTP_HOST` = in-app inbox only |

### Database (optional)

```bash
docker compose up -d db   # PostgreSQL 17 on localhost:5432 (whole stack: see „Wdrożenie w urzędzie”)
DATABASE_URL=postgres://hacknation:hacknation@localhost:5432/hacknation npm run start:dev
```

`src/database` (global module) connects with Drizzle ORM and `pg` and applies the migrations from `drizzle/` at
startup, before the first request. After changing a `src/**/*.tables.ts` schema run
`npx drizzle-kit generate --name=<change>` and commit the generated folder. Without `DATABASE_URL` every module uses
in-memory storage.

## Run

```bash
npm run start:dev    # watch mode on http://localhost:3000
npm run start        # single run
npm run build && npm run start:prod
```

All routes are under the `/api` prefix:

```bash
curl localhost:3000/api/health   # {"status":"ok"}
```

## Sign-in, roles and permissions

Every `/api/*` route needs `Authorization: Bearer <token>` (401 without a valid one), except `GET /api/health`,
`GET /api/config`, `POST /api/auth/login` and the document files `GET /api/docs/<path>` (public legal texts opened
from answer links in a new tab). A route for another role answers 403.

```bash
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'content-type: application/json' \
  -d '{"login":"j.kaminska","password":"Ocena2026!"}' | jq -r .accessToken)
curl localhost:3000/api/me -H "Authorization: Bearer $TOKEN"
```

| Route                        | What it does                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `POST /api/auth/login`       | `{ login, password }` → `{ accessToken, tokenType, expiresIn, user }`; JWT HS256, 8 h |
| `POST /api/auth/logout`      | No-op (204): tokens are stateless, the client drops its token                        |
| `GET /api/me`                | The signed-in user: `{ id, login, name, role, position, unit, officeName }`          |
| `GET /api/admin/users`       | ADMIN: every account (no password hashes)                                            |
| `PATCH /api/admin/users/:id` | ADMIN: `{ role }`; 409 for removing your own ADMIN role                              |
| `GET /api/admin/cases`       | ADMIN („tryb korekty”): every case (summary, evaluator, number of corrections)        |
| `GET /api/admin/cases/:id`   | ADMIN: `{ case, fields }`: the case read-only and its correctable fields with current values |
| `POST /api/admin/cases/:id/corrections` | ADMIN: `{ field, value, reason }` (reason ≥ 10 chars) → 201 `{ correction, case, fields }`; 400 bad value/field, 409 field not locked yet |

Generic 401 / 403 answer in Polish („Musisz się zalogować…”, „Brak uprawnień do tej operacji.”,
`src/common/polish-auth-errors.filter.ts`); specific messages (e.g. a wrong password) are kept.

**Tryb korekty błędów przez administratora.** Fields lock after each confirmation (part I after the opening talk,
part II/III after the signature; `CaseDetail.locks` says why) and, as the form schema requires, can then be changed
only by an ADMIN in correction mode. Every correction is audited in `CaseDetail.corrections`
(`{ at, by, field, label, section, oldValue, newValue, reason }`) and as a line in `history`. Rules:
`src/cases/correction.rules.ts` (correctable fields, validation per kind, part III next grade = current + 1).

| Role         | May                                                                                                   | 403 on                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `SUPERVISOR` | `GET /api/team`, `GET /api/cases` (own only), read, PATCH, observations and the evaluator's actions of own cases; own journal about own employees | other supervisors' cases and employees, `EMPLOYEE_ACK_*` actions, `/api/hr/*`, `/api/admin/*` |
| `EMPLOYEE`   | the assessed person: `GET /api/cases` and `GET /api/cases/:id` of own cases only (read only; no observations, part II only after hand-over), actions `EMPLOYEE_ACK_PART_I` and `EMPLOYEE_ACK_ASSESSMENT` | other cases, PATCH, observations, other actions, `/api/team`, `/api/hr/*`, `/api/admin/*`, journal |
| `HR`         | `/api/hr/*`, `GET /api/cases` (all), `GET /api/cases/:id` (read only), HR register (kartoteka) reads and writes | PATCH, observations, actions, `/api/team`, `/api/admin/*`, journal |
| `ADMIN`      | technical role: `/api/admin/*` (accounts, „tryb korekty”), HR register and statistics read only        | register writes (employees, absences, substitutions, import, new cycle), cases, `/api/team`, `/api/hr/*`, journal |
| `DIRECTOR`   | dyrektor generalny urzędu: `GET /api/objections`, `GET /api/cases(/:id)` of cases with a sprzeciw (read only), `POST /api/cases/:id/objection/decision` | other cases, PATCH, actions, `/api/team`, `/api/hr/*`, `/api/admin/*`, journal |
| every role   | `/api/me`, assistant, `/api/docs`, criteria, sheets, assessments, `POST /api/demo/reset` | —                                                         |

- The role is read from the account on every request, never from the token: a role changed by an ADMIN applies to
  that user's next request (the frontend picks it up at the next sign-in).
- Passwords are scrypt hashes (`PasswordHasher` of `@nestjs/authentication`, Node's `crypto.scrypt`); a wrong
  password and an unknown login get the same 401. `node scripts/hash-password.mjs <password>` prints a hash.
- Accounts sit behind `UsersRepository` (`src/auth/users.repository.ts`): table `users` with `DATABASE_URL`
  (`postgres-users.repository.ts`), in memory without it (`users.in-memory.repository.ts`). The demo accounts
  (`users.seed.ts`) go into empty storage only and are restored by `POST /api/demo/reset` (role changes too). Supervisors are linked to `EVALUATORS` of the case seed by `evaluatorId`, employees to the
  assessed person (`Person.id`) by `personId`.

### Demo accounts (for the jury)

All people are fictional.

Every demo account has the password `Ocena2026!`.

| Login        | Role         | Who                                                            |
| ------------ | ------------ | -------------------------------------------------------------- |
| `j.kaminska` | `SUPERVISOR` | Joanna Kamińska, cases c-000…c-008 and c-302 (pending termin-change request; team view hides archived c-000) |
| `r.sikora`   | `SUPERVISOR` | Robert Sikora, cases c-101 (handed over, for "fikcja zapoznania"), c-102, c-301 |
| `a.pawlak`   | `SUPERVISOR` | Agnieszka Pawlak, cases c-103, c-104                           |
| `a.nowak`    | `EMPLOYEE`   | Anna Nowak (assessed), cases c-000 (previous cycle) and c-001  |
| `p.wojcik`   | `EMPLOYEE`   | Piotr Wójcik (assessed), case c-002 waiting for his part I confirmation |
| `e.dabrowska` | `EMPLOYEE`  | Ewa Dąbrowska (assessed), case c-006 in the 7-day objection period: may file a sprzeciw |
| `t.jankowski` | `EMPLOYEE`  | Tadeusz Jankowski (assessed), case c-301 with a sprzeciw waiting for the dyrektor generalny |
| `b.wisniewska` | `DIRECTOR` | Barbara Wiśniewska, dyrektor generalny urzędu: decides objections (c-301) |
| `j.mazur`    | `EMPLOYEE`   | Julia Mazur (assessed), case c-004 at the sheet selection: the whole process from step 1 (used by the frontend's Playwright tests) |
| `a.lis`      | `HR`         | Agnieszka Lis, HR (kadry), all 16 cases                        |
| `admin`      | `ADMIN`      | Marek Zając, administrator                                     |

## API

Every route is documented (OpenAPI 3, descriptions in Polish) and the documentation needs no sign-in:

| Route                   | What it does                                    |
| ----------------------- | ----------------------------------------------- |
| `GET /api/docs-api`     | Swagger UI: every route with its schemas; „Authorize” takes the token from `POST /api/auth/login` |
| `GET /api/openapi.json` | The OpenAPI document (`/api/openapi.yaml` in YAML), e.g. to generate a client |

Annotations live on the controllers (`@nestjs/swagger`); request bodies come from the same Zod schemas that validate
them, so the document can't drift from the validation. Setup: `src/openapi/openapi.ts`.

Static data and pure functions.

| Route                                 | What it does                                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `GET /api/criteria`                   | Catalogue of the 14 criteria of załącznik nr 1 (id, number, name, description bullets) and the 1–9 scale |
| `GET /api/sheets`                     | Sheets `A`, `B`, `C` (rozp. 2016): mandatory criteria, scale, max 3 additional, template texts     |
| `GET /api/civil-service-grades`       | `{ grades, legalBasis }`: the nine civil-service grades `I`…`IX` (art. 86 ust. 1 ustawy), lowest first |
| `POST /api/assessments/evaluate`      | Average, level and POSITIVE/NEGATIVE result with Polish reasons citing the regulation              |

- The criteria catalogue is data in one file, `src/criteria/data/criteria.data.ts` (verbatim from załącznik nr 1):
  edit it when the law changes. Ids are stable keys stored in cases.
- POSITIVE iff average > 4 and no score equals 1 (§11 rozp. 2016). Thresholds use the exact average.
- Validation errors answer 400 with `message` as an array of Polish strings.
- Each sheet has `template`: the fixed texts of its official template (annex, title, „Potwierdzamy” of part I,
  the assessed person's statement, „Pouczenie” of art. 83 ust. 1, the part III note, footnote and request sentence),
  so the UI never retypes them.

```bash
curl -X POST localhost:3000/api/assessments/evaluate -H 'content-type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"sheetId":"C","scores":[{"criterionId":"rzetelnosc","points":5},{"criterionId":"wykorzystywanie_wiedzy","points":5},{"criterionId":"organizacja_pracy","points":5},{"criterionId":"komunikacja","points":5},{"criterionId":"wspolpraca","points":7}]}'
```

### Assessment cases

`CaseStore` (`src/cases/case-store.service.ts`) reads the cases from memory and writes every change through
`CaseRepository`: table `cases` (the whole record, history included, as JSONB) with `DATABASE_URL`, memory only without
it. At startup it loads the stored cases; the seed goes into empty storage only (and is restored by
`POST /api/demo/reset`). Run one backend instance per database: reads are served from that instance's memory. Seed:
fictional data relative to `DEMO_TODAY` (env, default `2026-11-21`); every deadline is computed against that date.

| Route                            | What it does                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `GET /api/cases`                 | Cases visible to the caller (`CaseSummary[]`): own for a supervisor, own („Moje oceny”) for an employee, all for HR |
| `GET /api/team`                  | The supervisor's cases (`CaseSummary[]`) and `todo` sorted by deadline                   |
| `GET /api/cases/:id`             | `CaseDetail`: stages, deadlines, sheet suggestion, part I, observations, part II, formal check |
| `GET /api/cases/:id/sheet.pdf`   | Sheet A/B/C as PDF, generated on the server (pdfmake, Roboto), `ocena-<nazwisko>-<data>.pdf`; same access as the route above |
| `GET /api/cases/:id/export?format=json` | The sheet's fields (parts I, II, III) in the versioned export format (`schemaVersion`), same access as `GET /api/cases/:id`; see [Integracja z EZD](#integracja-z-ezd) |
| `PATCH /api/cases/:id`           | Partial update; 400 for invalid values, 409 for parts locked at the current stage       |
| `POST /api/cases/:id/observations` | Adds an S-D-R observation (201)                                                        |
| `POST /api/cases/:id/actions`    | State machine (`{ action }`); 403 when the caller is not the actor of the action, 409 with a Polish explanation for an illegal transition |
| `GET /api/hr/overview`           | Counters and every case in the office, with evaluator, last reminder and `remindable` |
| `POST /api/hr/reminders`         | Simulated reminders (`{ caseIds }`), logged in each case's history; 409 for a finished case or an objection under review |
| `POST /api/demo/reset`           | Restores the seed (cases, accounts, journal, pulse, HR register)                          |

### Deadlines, scheduler and notifications

Rules: `src/cases/absences.rules.ts` (continuous absences, art. 81 ust. 7; the scheduler announces the extended date), `src/cases/due-date-change.rules.ts`
(`changeDueDate`, art. 81 ust. 6–9, §8–§9 rozp. 2016), `src/cases/obligatory-grade.rules.ts` (art. 89 ust. 2),
`src/notifications/reminders.rules.ts` (what the scheduler reminds about; idempotent keys). Other modules change a
due date only through `DeadlinesService.changeDueDate(caseId, newDate, reason, by, note?)`.

| Route                                              | What it does                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `GET /api/notifications`                           | The caller's own notifications `{ items, unread }`, newest first              |
| `POST /api/notifications/:id/read`                 | Marks one as read (204; 404 for someone else's)                               |
| `POST /api/notifications/read-all`                 | Marks all as read `{ marked }`                                               |
| `POST /api/notifications/run`                      | HR, ADMIN: "Uruchom przypomnienia teraz" (one scheduler run for `DEMO_TODAY`) `{ today, created }` |
| `GET /api/deadlines/rules`                         | Reasons of a due-date change (art. 81 ust. 7–8) and reminder thresholds      |
| `POST /api/cases/:id/due-date`                     | Evaluator: `{ date, reason, note? }` (reason of art. 81 ust. 8 pkt 1–4); 409 within 6 months of the last assessment or after a negative one; records the §8 notice |
| `POST /api/cases/:id/talk-invitations`             | Evaluator: `{ kind: OPENING\|ASSESSMENT, date, time, place, note? }` (201), notifies the evaluee |
| `GET /api/cases/:id/talk-invitations/:invId/ics`   | Evaluator or evaluee: the invitation as an `.ics` calendar file               |
| `POST /api/cases/:id/remind`                      | Evaluator: reminds the evaluee to confirm part I or acknowledge the assessment (one in-app notice a day, history line); 409 when nothing waits |
| `POST /api/cases/:id/position-change`              | Evaluator or HR: `{ date }`; §9 ust. 1 (part I again in 30 days) or ust. 2 (assessment window, due date set) |
| `POST /api/cases/:id/evaluator`                    | HR: `{ evaluatorId }`; change of evaluator, criteria kept (§9 ust. 3)         |
| `GET /api/evaluators`                              | HR: evaluators to choose from                                                 |

`CaseDetail` gained `dueDateChanges`, `dueDateChangeBlocker`, `talkInvitations`, `positionChanges`, `absences`.

- Rules are pure functions with unit tests in `src/cases/*.rules.ts`: deadlines (`deadlines.rules.ts`, KC term rules
  incl. shifting from Saturdays, Sundays and holidays, each `Deadline` with `legalBasis`), stages
  (`stages.rules.ts`), actions (`actions.rules.ts`), PATCH locks (`patch.rules.ts`) and the formal check
  (`formal-check.rules.ts`). The sheet suggestion (kierownik urzędu → A, directly manages people → B, else C;
  §3 ust. 2–4) is `src/sheets/sheet-suggestion.rules.ts`, from `Person.officeHead` / `Person.managesPeople`.
- `evaluation` in `CaseDetail` is computed with the v1 `evaluate` rules once every criterion is decided.
- PATCH merges one level deep; `null` in `decisions` / `deviationNotes` removes a key.
- Part II items 10–11 and part III of sheets A/B/C (`src/cases/promotion.rules.ts`), editable on the same stages as
  `justification` / `iprz` (until the evaluator signs):
  - `previousAssessment: { result: POSITIVE|NEGATIVE|null, level, date } | null`; `level` is a scale label as the
    sheet writes it (`na poziomie oczekiwań`).
  - `promotionRequest: { attached: YES|NO|NOT_APPLICABLE|null, appointedYear, currentGrade, gradeGrantedOn,
    requestedGrade, motivation }`. A pracownik służby cywilnej is always `NOT_APPLICABLE` (YES/NO → 400); an urzędnik
    answers YES or NO; YES is refused for a negative result (§11 ust. 5 rozp. 2016). Part III fields are accepted and
    kept only with YES (NO clears them), grades come from `GET /api/civil-service-grades`, `requestedGrade` must be
    the next grade after `currentGrade` (art. 89 ust. 1), `motivation` ≤ 4000 characters.
  - The formal check item `PROMOTION_REQUEST` requires an answer and, with YES, a complete part III.
- 409 body: `{ statusCode, error, message }` (+ `formalCheck` with the failing items for `SIGN_ASSESSMENT`).
- `CaseDetail` also carries `availableActions` (actions legal right now), an addition to the contract.
- `CaseDetail` for an `EMPLOYEE` hides `observations` and `formalCheck`, and part II (decisions, justification, IPRZ,
  evaluation) until `SEND_FOR_ACK`; `availableActions` lists only what the caller may do.

Stages (`STAGES` in `src/cases/case.types.ts`) and actions (`src/cases/actions.rules.ts`, actor in `ACTION_ACTOR`):

| # | Stage             | Action that ends it                         | Actor     |
| - | ----------------- | ------------------------------------------- | --------- |
| 1 | `SHEET_SELECTION` | `ACCEPT_SHEET` (sheet A/B/C, ≤ 3 additional criteria, due date: default 24 months, 6 after a negative one) | evaluator |
| 2 | `OPENING_TALK`    | `CONFIRM_PART_I`                            | evaluator |
| 3 | `PART_I_ACK`      | `EMPLOYEE_ACK_PART_I`                       | employee  |
| 4 | `OBSERVATION`     | `START_ASSESSMENT`                          | evaluator |
| 5 | `ASSESSMENT`      | `COMPLETE_ASSESSMENT_TALK` (scores, justification, IPRZ, part III are drafted from stage 1 until the signature) | evaluator |
| 6 | `SIGNATURE`       | `SIGN_ASSESSMENT` (formal check), then `SEND_FOR_ACK` | evaluator |
| 7 | `ACKNOWLEDGEMENT` | `EMPLOYEE_ACK_ASSESSMENT` (starts the 7-day objection term) | employee  |

### After the assessment: fikcja zapoznania, sprzeciw, zmiana terminu na wniosek

Rules: `src/cases/appeals.rules.ts` (+ `objection-terms.rules.ts`) and `src/cases/due-date.rules.ts`, with tests. Who may
act is checked per case; a wrong person gets 403 with a Polish `message` ("Brak uprawnień. …"), an illegal moment 409.

| Route                                       | Who                        | What it does |
| ------------------------------------------- | -------------------------- | ------------ |
| `POST /api/cases/:id/ack-fiction`           | the case's evaluator, HR   | `{ date, reason }`: the assessed person received the assessment but could not/would not confirm. Closes the acknowledgement like `EMPLOYEE_ACK_ASSESSMENT` dated `date` (between hand-over and today) and starts the 7-day objection term |
| `POST /api/cases/:id/objection`             | the assessed person        | `{ text }`: sprzeciw (art. 83 ust. 1) within 7 days of acknowledgement (KC rules: last day on a working day); one per assessment; status `SPRZECIW_W_ROZPATRZENIU` |
| `GET /api/objections`                       | DIRECTOR, HR               | `[{ caseId, person, evaluatorName, sheetId, status, objection }]`, pending first |
| `POST /api/cases/:id/objection/decision`    | DIRECTOR                   | `{ outcome: DISMISS\|CHANGE\|REDO, reason, decisions?, justification? }` (14-day term, art. 83 ust. 3). DISMISS closes the case (14 days to the labour court, ust. 5). CHANGE keeps the old version (`assessmentVersions`, `CHANGED`), applies new scores, sends the case back to `SIGNATURE` for re-signing and re-acknowledgement. REDO cancels the assessment (`CANCELLED`) and returns to `ASSESSMENT`; the re-made one can be objected again (ust. 4) |
| `POST /api/cases/:id/due-date-request`      | the assessed person        | `{ reason, proposedDate? }` (art. 81 ust. 8 pkt 4): only if more than 6 months passed since the last assessment was made (first assessment: since the cycle start); never after a negative one (ust. 9) or after signing |
| `POST /api/cases/:id/due-date-request/decision` | the case's evaluator   | `{ approve, newDate?, note? }`: approval moves the date through `changeDueDate()`; a rejection needs `note`. Pending requests appear in `GET /api/team` `todo` |

- `changeDueDate(record, newDate, reason, by, today)` in `src/cases/due-date.rules.ts` is the one function that moves
  "termin sporządzenia oceny" (records `dueDateChanges` and a history entry).
- New `CaseDetail` fields: `ackFiction`, `objections` (with `decisionDeadline`, `courtAppealDeadline`),
  `assessmentVersions`, `dueDateRequests`, `dueDateChanges`, `dueDateRequestRule { eligible, reason, legalBasis }`,
  `legalActions` (what the caller may do: `RECORD_ACK_FICTION`, `FILE_OBJECTION`, `DECIDE_OBJECTION`,
  `REQUEST_DUE_DATE_CHANGE`, `DECIDE_DUE_DATE_REQUEST`).
- Notifications hook: history entries of these paths carry `event: { type, notify }` (`OBJECTION_FILED`,
  `OBJECTION_DISMISSED`, `OBJECTION_ASSESSMENT_CHANGE`, `OBJECTION_ASSESSMENT_REDO`, `ACK_FICTION_RECORDED`,
  `DUE_DATE_CHANGE_REQUESTED|APPROVED|REJECTED`, `DUE_DATE_CHANGED`; `notify` ⊆ EVALUATOR, EMPLOYEE, HR, DIRECTOR).

### Journal: notes and observations about an employee

A supervisor's notes and S-D-R observations about each employee, kept all year, independent of the case stage
(`src/journal`). Stored in PostgreSQL (`journal_notes`, `journal_observations`) with `DATABASE_URL`, in memory
without it; the demo seed goes into empty tables only. `SUPERVISOR` only (HR and ADMIN get 403: notes are private),
and only about people from cases the supervisor evaluates (else 403, unknown person 404); an entry is visible to its
author only (someone else's entry: 404). Lists are newest first.

| Route                                  | What it does                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `GET /api/people/:personId/notes`      | The user's notes about the person                                                         |
| `POST /api/people/:personId/notes`     | `{ text }` (1–5000 chars, trimmed) → note (201)                                           |
| `PATCH /api/notes/:id`                 | `{ text }` → note with new `updatedAt`                                                    |
| `DELETE /api/notes/:id`                | 204                                                                                       |
| `GET /api/people/:personId/observations` | The user's observations about the person, by `date`                                     |
| `POST /api/people/:personId/observations` | `{ date, criterionId, indicatorId?, kind, situation, action, result }` → observation (201; `indicatorId` is a legacy free field); 400 for an unknown criterion, a date after today, S/D/R empty or over 2000 chars |
| `PATCH /api/observations/:id`          | Any of those fields; the merged observation is validated again                            |
| `DELETE /api/observations/:id`         | 204                                                                                       |

### Virtual HR partner and pulse survey (`src/partner`)

Advisory module for people management; it never changes a case or a score ("decyzja należy do przełożonego").
**Pulse**: a voluntary check-in of the employee every 14 days (5 questions, 1–5, 5 = best: obciążenie, energia,
wsparcie, jasność priorytetów, satysfakcja; optional comment), table `pulse_responses` with `DATABASE_URL`, in memory
without it (demo seed: ~12 weeks for the demo teams). Privacy: the supervisor gets trends and flags, a comment only
when the employee shared it; team averages only for periods with ≥ 3 respondents (`MIN_GROUP_SIZE`); HR has no access.
**Signals** (`signals.rules.ts`, pure and tested): przeciążenie, spadek motywacji, ryzyko wypalenia, moment do
docenienia, from the pulse trend (`pulse.rules.ts`), case and journal observations and work data (tasks, changes of
duties, absence length only: demo seed in `src/partner/seed/`, in an office from its HR system / EZD). Each flag lists
its reasons and suggested actions (`data/partner-actions.data.ts`). **Hints** for the assessment stage
(`hints.rules.ts`): strengths / areas, SBI feedback phrasing, development forms per criterion
(`data/development.data.ts`). **Ask**: the context and question are pseudonymized (`anonymize.ts`: names in any case,
PESEL, e-mail, phone, unit names) before the optional LLM call and re-identified in the answer; without an LLM the
answer comes from the rules.

| Route                              | What it does                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET /api/pulse/questions`         | Questions, scale, interval, `minGroupSize`, privacy texts (any role)                             |
| `GET /api/pulse/me`                | EMPLOYEE: own history with comments, `nextDue`, `canSubmit`                                      |
| `POST /api/pulse`                  | EMPLOYEE: `{ answers, comment?, shareComment? }` → response (201); 409 within 7 days of the last |
| `PATCH /api/pulse/:id/share`       | EMPLOYEE: `{ shareComment }` on own response (404 otherwise)                                     |
| `GET /api/partner/team`            | SUPERVISOR: own team with pulse series, flags, team aggregate (hidden below 3 respondents)       |
| `GET /api/partner/people/:personId`| SUPERVISOR: card with pulse points (one overall `index` per response, no single answers; shared comments only), trend, flags with reasons and actions, work data. Per-question averages only in the team aggregate (≥ 3 respondents) |
| `GET /api/partner/cases/:caseId/hints` | SUPERVISOR (the case's evaluator): strengths, areas, feedback phrasing, development forms, management tips |
| `POST /api/partner/ask`            | SUPERVISOR: `{ question, personId?, caseId? }` → `{ answer, mode: LLM\|RULES, anonymizedPrompt, … }` |

### HR register (kartoteka): employees, absences, substitutions, history, statistics

`src/employees`. Stored in PostgreSQL (`employees`, `employee_absences`, `evaluator_substitutions`,
`assessment_history`) with `DATABASE_URL`, in memory without it; the demo seed (25 fictional people in 5 units,
`employees.seed.ts`) goes into empty tables only and is restored by `POST /api/demo/reset`. Writes: `HR` only
(`ADMIN` is a technical role: it reads the register and fixes locked case fields only in „tryb korekty”).
Reads: `HR`, `ADMIN` and `SUPERVISOR` (only people they assess, also as an active substitute; others 403).
Statistics (and their CSV): `HR`, `ADMIN`, `DIRECTOR`; register CSV: `HR`, `ADMIN`. Cases stay in `CaseStore`; this module starts them and keeps their
person data, evaluator and absences in step.

| Route | What it does |
| ----- | ------------ |
| `GET /api/employees` | Register: `?q=` (name, position, unit), `unit`, `employment`, `sheet`, `evaluatorId`, `sort=lastName\|unit\|position\|deadline`; each with `evaluatorName`, `effectiveEvaluator*` (substitution), `sheetId` (case or suggestion), `currentCase`, `lastAssessment`, `obligatoryPromotion` |
| `GET /api/employees/:id` | One employee (same view) plus `nextCycle` (`{ ok, reason, openingTalk }`, null with an open case): preview of a new cycle, so the UI warns when the opening-talk term already passed. `currentCase.assessmentDue` = assessment term with `baseDate` and `extended` (art. 81 ust. 7 absences; the opening-talk term is never extended). `obligatoryPromotion` has `deadline` (30 days from acknowledgement) and `nextStep` |
| `GET /api/employees/units` | Known organisational units (register + evaluators). `POST`/`PATCH` refuse (400) a new unit that duplicates one of them (other case/spaces, or only its first part such as „Wydział Legislacji”) |
| `POST /api/employees` | `{ firstName, lastName, unit, position, employment, officeHead, managesPeople, appointedYear, grade, gradeGrantedOn, indefiniteSince, evaluatorId }` (201) |
| `PATCH /api/employees/:id` | Any of those; open cases get the new person data, a new `evaluatorId` moves them (zmiana podległości, noted in the case history) |
| `DELETE /api/employees/:id` | 204; 409 while an assessment is in progress (not acknowledged). Deletes the record, absences and imported history; finished cases are anonymised ("Dane usunięte") so statistics keep them without personal data |
| `POST /api/employees/:id/cycles` | Starts a new cycle: case in `SHEET_SELECTION` anchored on the last assessment (30 days, 7 after a negative one) or on `indefiniteSince`; part II item 10 prefilled for an urzędnik; 409 with an open case or no evaluator |
| `GET /api/employees/:id/history` | `{ cases, imported }`: every system cycle (result, level) and imported assessments |
| `GET/POST /api/employees/:id/absences`, `DELETE …/absences/:absenceId` | `{ type, from, to, justified?, note? }`; GET also returns `continuous` (merged periods with `longerThanMonth`) |
| `GET /api/employees/absence-types`, `GET /api/employees/evaluators` | Absence kinds (`data/absence-types.data.ts`) and evaluators to pick from |
| `POST /api/employees/history/import` | `{ csv }`: past assessments; all-or-nothing, 400 with a Polish message per bad row, duplicates (same person and date) skipped; `{ imported, skipped, rows: [{ line, employeeId, name, assessedOn, result, level, skipped }] }`. Sample: `docs/import/oceny-historyczne-przyklad.csv` |
| `GET/POST /api/substitutions`, `DELETE /api/substitutions/:id` | Evaluator substitutions `{ evaluatorId, substituteId, from, to, note? }` |
| `GET /api/statistics?unit=` | Results, levels, negative %, signed on time vs late, open overdue, cases per stage, promotions requested / obligatory (art. 89 ust. 2), per unit |
| `GET /api/statistics/export.csv`, `GET /api/employees/export.csv` | CSV (`;`, UTF-8 BOM) of the statistics and of the register |

- Absences (`src/cases/absences.rules.ts`): `continuousAbsences` merges justified absences separated only by days off
  work (5–16.10.2026 + 19.10–6.11.2026 = one 33-day absence), `isLongerThanMonth` uses the month of art. 112 KC,
  `extendAssessmentDue` / `withAbsenceExtension` extend the assessment due date by such absences (art. 81 ust. 7);
  not after a negative assessment (ust. 9). Applied to the deadlines of stages 4–6 of every case.
- Rules: `employees.rules.ts` (cycle start, obligatory promotion, substitution), `history-import.rules.ts`,
  `statistics.rules.ts`.

### AI assistant (source-grounded)

| Route                                  | What it does                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `POST /api/assistant/ask`              | `{ question, assistant: FORMAL\|CONVERSATION, caseId?, stageId? }` → answer + sources |
| `GET /api/assistant/suggestions`       | Example questions, `?stageId=` per stage                                        |
| `GET /api/assistant/documents`         | Every source document: `{ id, title, description, url, indexed, note }`         |
| `GET /api/docs`                        | Same list, always on (also with `FEATURE_ASSISTANT=false`)                      |
| `GET /api/docs/<path>`                 | The original file from `docs/` (404 outside it: `..`, absolute paths, dotfiles) |

- Every answer source has `url`: `/api/docs/<file>` (relative to the API origin, `#page=N` for a PDF excerpt), the
  ISAP page for the civil service act, or `null` for a document without a file (`LT`, `QA`). The document registry
  is `src/assistant/documents.ts`.
- Knowledge base: `src/assistant/data/knowledge.data.ts`, generated by `npm run kb:build`
  (`scripts/build-knowledge-base.mjs`, needs `pdftotext` and `unzip`) only from `docs/`: both regulations, both KPRM
  guides and the sheets (the first-assessment sources RP/PP are excluded from case conversations). Acts are chunked by art./§/ust., guides by page, sheets by part. The act (`U`), the deadline note
  (`LT`) and the Q&A set (`QA`) are not in `docs/` yet: their chunks already in the data file are kept until the file
  is added at the path in the script (see `docs/README.md`). Don't edit the data file by hand.
- Retrieval: local BM25 (`bm25.ts`, `text-normalize.ts`: no diacritics, light Polish stemming, bigrams); below a
  score/coverage threshold the answer is "Nie znalazłem tego w bazie wiedzy" with `grounded: false`.
- Generation: optional, any OpenAI-compatible endpoint via `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` (see
  `.env.example`). Without it, or when the call fails, answers are extractive (`mode: "EXTRACTIVE"`): a short answer
  first (`summary`: the matching Q&A answer or the opening of the best excerpt), then the quoted excerpts.
- Quick answers (`quick-answers.rules.ts`): rule-based short answers where retrieval alone is weak, e.g. when the next
  assessment is due (24 months; 6 months after acknowledging a negative one, art. 81 ust. 9), using the case if given.
- Feature flag: `FEATURE_ASSISTANT=false` (Coolify env + restart) turns the chat off without a frontend rebuild.
  `GET /api/config` returns `{ "features": { "assistant": boolean } }` and the frontend reads it on start; with the
  flag off every `/api/assistant/*` route returns 404.
- `npm run eval:assistant`: hit@5 of the 72 Q&A questions against their expected sources.

## Integracja z EZD

Asystent działa samodzielnie; system EZD (elektroniczne zarządzanie dokumentacją) albo system kadrowy urzędu może
pobierać z niego gotowe oceny przez udokumentowane API. Konkretne EZD nie jest tu zintegrowane: to po stronie urzędu.

1. Załóż konto techniczne z rolą `HR` (widzi wszystkie oceny w urzędzie) albo używaj konta osoby, która przekazuje
   ocenę. Konto loguje się przez `POST /api/auth/login` i dostaje token JWT ważny 8 godzin.
2. `GET /api/cases` zwraca listę ocen ze statusem (`status`: `W_TOKU`, `DO_ZAPOZNANIA`, `OKRES_SPRZECIWU`, `SPRZECIW_W_ROZPATRZENIU`,
   `ZAKONCZONA`). Do EZD zwykle trafia ocena po zapoznaniu się ocenianego (`acknowledgedOn` w eksporcie).
3. `GET /api/cases/:id/export?format=json` zwraca komplet pól arkusza A, B albo C:
   - `schemaVersion` (teraz `1.0`) i `format` (`caoo.ocena-okresowa`): integracja sprawdza wersję przed odczytem.
     Nowe pola podnoszą część po kropce (zgodnie wstecz), usunięcie lub zmiana nazwy pola podnosi część główną;
   - `case`, `office`, `sheet` (arkusz i załącznik rozporządzenia), `assessed`, `evaluator`;
   - `partI`: kryteria (obowiązkowe i dodatkowe), termin oceny, omówione zagadnienia, oczekiwania, potwierdzenia;
   - `partII`: poprzednia ocena, data rozmowy oceniającej, oceny cząstkowe z uzasadnieniami odchyleń, wynik
     (średnia, poziom, pozytywna/negatywna), uzasadnienie, IPRZ, podpis, przekazanie, zapoznanie, termin sprzeciwu;
   - `partIII`: wniosek o przyznanie kolejnego stopnia służbowego (art. 89 ust. 1 ustawy).

   Pełny schemat (z opisem każdego pola) jest w `/api/openapi.json` jako `EksportOcenyOkresowej`, a jego źródłem jest
   `src/cases/case-export.schema.ts`.
4. Uprawnienia są takie same jak w aplikacji: oceniany eksportuje tylko swoje oceny (część II dopiero po przekazaniu
   mu oceny), przełożony oceny swojego zespołu, HR wszystkie; inaczej 403. Eksport zawiera tylko pola arkusza
   (bez notatek, obserwacji i historii), zgodnie z zasadą minimalizacji danych.

```bash
TOKEN=$(curl -s localhost:3000/api/auth/login -H 'content-type: application/json' \
  -d '{"login":"a.lis","password":"Ocena2026!"}' | jq -r .accessToken)
curl -s "localhost:3000/api/cases/c-001/export?format=json" -H "Authorization: Bearer $TOKEN"
```

## Quality

```bash
npm run lint       # oxlint (type-aware)
npm run format     # prettier
npm test           # unit tests (Vitest)
npm run test:e2e   # e2e tests (Vitest + supertest)
npm run test:cov
```

## Wdrożenie w urzędzie

Cyfrowy Asystent Ocen Okresowych działa w całości na infrastrukturze urzędu: bez płatnych licencji, bez usług
chmurowych i bez dostępu do internetu (asystent AI jest opcjonalny i może korzystać z lokalnego modelu).

### Wymagania

- Serwer lub maszyna wirtualna z Linuxem, Windowsem albo macOS: 2 vCPU, 2 GB RAM, 5 GB dysku
  (z lokalnym modelem językowym: +8 GB RAM i ok. 10 GB dysku).
- Docker z Docker Compose v2 (Docker Engine albo Docker Desktop / Podman z obsługą compose).
- Oba repozytoria obok siebie: `cyfrowy-asystent-ocen-okresowych-backend` i `cyfrowy-asystent-ocen-okresowych-frontend`.

### Instalacja w 3 krokach

```bash
# 1. Pobierz oba repozytoria do jednego katalogu
git clone <adres>/cyfrowy-asystent-ocen-okresowych-backend
git clone <adres>/cyfrowy-asystent-ocen-okresowych-frontend
cd cyfrowy-asystent-ocen-okresowych-backend

# 2. Skonfiguruj urząd (nazwa, miejscowość, hasła)
cp .env.example .env
#   ustaw: OFFICE_NAME, OFFICE_CITY, JWT_SECRET (openssl rand -base64 32), POSTGRES_PASSWORD,
#   PUBLIC_API_URL i FRONTEND_URL (adresy, pod którymi pracownicy otwierają aplikację)

# 3. Uruchom
docker compose up -d --build
```

Aplikacja: `http://<serwer>:8080`, API: `http://<serwer>:3000/api/health`. Migracje bazy uruchamiają się same przy
starcie. Lokalny model językowy (opcjonalnie): `docker compose --profile llm up -d`, potem
`docker compose exec ollama ollama pull qwen2.5:7b` i w `.env`: `LLM_BASE_URL=http://ollama:11434/v1`,
`LLM_MODEL=qwen2.5:7b`. Bez modelu asystent odpowiada cytatami z bazy wiedzy (tryb ekstraktywny).

### Konfiguracja

Cała konfiguracja to zmienne środowiskowe w `.env` (opis każdej w `.env.example` i w tabeli w sekcji „Setup”):

| Zmienna                  | Do czego służy                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `OFFICE_NAME`            | „NAZWA URZĘDU” na arkuszach A/B/C                                                   |
| `OFFICE_CITY`            | „miejscowość” przy podpisach na arkuszach                                           |
| `OFFICE_LOGO_URL`        | Logo urzędu w podglądzie arkusza (opcjonalnie)                                      |
| `OBJECTION_RECIPIENT_A`  | Arkusz A: do kogo składa się sprzeciw (wzór zostawia to pole puste)                 |
| `JWT_SECRET`             | Klucz podpisu sesji (32+ losowe bajty), obowiązkowo w produkcji                    |
| `POSTGRES_PASSWORD`      | Hasło bazy danych                                                                   |
| `FEATURE_ASSISTANT`      | `false` wyłącza asystenta AI                                                        |
| `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` | Dowolny serwer zgodny z API OpenAI (np. lokalna Ollama); bez nich tryb bez LLM |
| `FRONTEND_PORT`, `BACKEND_PORT`, `PUBLIC_API_URL`, `FRONTEND_URL` | Porty i adresy (za reverse proxy urzędu: adresy HTTPS) |

Konta demonstracyjne (`src/auth/users.seed.ts`) należy w produkcji zastąpić kontami urzędu: repozytorium kont
(`UsersRepository`) jest jednym wymiennym modułem (np. na LDAP/AD albo system kadrowy przez udokumentowane API);
na stronie logowania ukrywa je `VITE_DEMO_ACCOUNTS=false`. Role (przełożony, oceniany, kadry, administrator)
nadaje administrator w aplikacji („Użytkownicy”).

### Aktualizacja

```bash
git -C ../cyfrowy-asystent-ocen-okresowych-frontend pull
git pull
docker compose up -d --build   # nowe obrazy, migracje bazy wykonają się same
```

Aktualizacja nie wymaga ręcznych zmian na serwerze; dane w wolumenie `db-data` zostają.

### Kopie zapasowe

```bash
# kopia
docker compose exec -T db pg_dump -U hacknation hacknation > kopia-$(date +%F).sql
# odtworzenie
docker compose exec -T db psql -U hacknation hacknation < kopia-RRRR-MM-DD.sql
```

Kopię wykonuj codziennie (np. cron / Harmonogram zadań) i przechowuj zgodnie z polityką urzędu. W PostgreSQL są
teczki ocen z historią (`cases`), konta użytkowników (`users`), rejestr kadrowy, notatki i obserwacje przełożonych,
powiadomienia oraz ankiety pulsu. Dane demonstracyjne trafiają tylko do pustej bazy, więc restart niczego nie kasuje.

### Bezpieczeństwo i RODO

- Wszystko działa lokalnie; żadne dane nie opuszczają urzędu, o ile nie wskażesz zewnętrznego LLM. Z lokalnym
  modelem (profil `llm`) albo bez modelu aplikacja działa offline.
- Do modelu językowego trafia tylko pytanie i potrzebny kontekst, bez imion i nazwisk (anonimizacja w
  `src/assistant`); ankiety pulsu są anonimowe i raportowane tylko powyżej progu liczby odpowiedzi.
- Dostęp według ról: przełożony widzi wyłącznie swój zespół, oceniany tylko własne oceny (część II dopiero po
  przekazaniu), kadry monitoring, administrator konta i tryb korekty. Każda korekta pola zablokowanego po
  potwierdzeniu wymaga powodu i jest zapisywana (kto, kiedy, stara → nowa wartość) w historii teczki.
- Żadnych danych osobowych w logach. Baza nasłuchuje tylko na `127.0.0.1`. Udostępniaj aplikację przez reverse
  proxy urzędu z HTTPS; ustaw własne `JWT_SECRET` i `POSTGRES_PASSWORD`.
- AI i reguły są doradcze: ostateczną ocenę zawsze ustala oceniający.
- Licencja EUPL-1.2 (plik `LICENSE`), wszystkie zależności open source (MIT, Apache-2.0, BSD, ISC); brak płatnych
  licencji i usług. PDF arkusza powstaje na serwerze (pdfmake, czcionka Roboto), bez przeglądarki i internetu.

### Architektura

```mermaid
flowchart LR
  U[Przeglądarka: przełożony, oceniany, kadry, administrator] -->|HTTPS| F[frontend: React + nginx]
  U -->|HTTPS /api| B[backend: NestJS]
  B --> R[Reguły prawne: *.rules.ts + data/*.data.ts]
  B --> P[(PostgreSQL)]
  B --> X[PDF arkusza A/B/C: pdfmake]
  B -.->|opcjonalnie, API zgodne z OpenAI| L[LLM: lokalna Ollama lub inny]
  B -.->|opcjonalnie, udokumentowane API| E[EZD / system kadrowy]
```

### Zmiana przepisów: gdzie są reguły

Logika wynikająca z przepisów jest odizolowana w czystych funkcjach z testami (`*.rules.ts` + `*.spec.ts`) i w
plikach danych (`data/*.data.ts`); kontrolery i serwisy tylko je wywołują. Zmiana przepisu to edycja jednego pliku i
jego testu:

| Obszar                                                   | Plik                                                  |
| -------------------------------------------------------- | ----------------------------------------------------- |
| Wykaz kryteriów oceny (zał. nr 1), skala 1–9            | `src/criteria/data/criteria.data.ts`                  |
| Arkusze A/B/C: kryteria obowiązkowe, teksty wzorów (zał. nr 2–4) | `src/sheets/sheets.data.ts`                   |
| Dobór arkusza (§3)                                      | `src/sheets/sheet-suggestion.rules.ts`                |
| Średnia, poziom, wynik pozytywny/negatywny (§11)         | `src/assessments/evaluate.rules.ts`                   |
| Terminy (KC, dni wolne, 24/6 miesięcy, 7 dni na sprzeciw) | `src/cases/deadlines.rules.ts`, `src/cases/dates.ts` |
| Etapy i akcje procesu                                    | `src/cases/stages.rules.ts`, `src/cases/actions.rules.ts` |
| Blokady pól i tryb korekty administratora               | `src/cases/patch.rules.ts`, `src/cases/correction.rules.ts` |
| Kontrola formalna przed podpisem                         | `src/cases/formal-check.rules.ts`                     |
| Stopnie służbowe i wniosek (art. 86, 89)                 | `src/civil-service-grades/data/grades.data.ts`, `src/cases/promotion.rules.ts` |
| Układ PDF arkusza                                        | `src/export/sheet-pdf.ts` (teksty bierze z `sheets.data.ts`) |

Frontend nie powiela stałych prawnych: skale, progi, teksty wzorów i terminy pobiera z API, więc po zmianie
przepisu wystarczy nowy obraz backendu.

## Deploy

`main` is auto-deployed to Coolify from this repo's `Dockerfile` (one image, no manual steps on the server).

- Env: `PORT=3000`, `FRONTEND_URL=<frontend origin>`, `JWT_SECRET` (32+ random bytes), optional `DEMO_TODAY`,
  `DATABASE_URL`, `FEATURE_ASSISTANT`, `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`.
- Health: `/api/health`.

Build and run the image locally:

```bash
docker build -t cyfrowy-asystent-backend .
docker run --rm -p 3000:3000 -e FRONTEND_URL=http://localhost:5173 cyfrowy-asystent-backend
curl localhost:3000/api/health   # {"status":"ok"}
```

The container listens on `0.0.0.0:$PORT` and has a Docker `HEALTHCHECK` on
`/api/health`. The Coolify healthcheck host is set to `127.0.0.1`, not
`localhost`: on Alpine `localhost` resolves to `::1` first, and the app listens
on IPv4 only.

## Licencja

EUPL-1.2 (European Union Public Licence), plik [`LICENSE`](LICENSE).
