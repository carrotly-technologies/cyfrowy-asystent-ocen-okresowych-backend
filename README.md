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

### Database (optional)

```bash
docker compose up -d db   # PostgreSQL 17 on localhost:5432
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

| Role         | May                                                                                                   | 403 on                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `SUPERVISOR` | `GET /api/team`, `GET /api/cases` (own only), read, PATCH, observations and the evaluator's actions of own cases; own journal about own employees | other supervisors' cases and employees, `EMPLOYEE_ACK_*` actions, `/api/hr/*`, `/api/admin/*` |
| `EMPLOYEE`   | the assessed person: `GET /api/cases` and `GET /api/cases/:id` of own cases only (read only; no observations, part II only after hand-over), actions `EMPLOYEE_ACK_PART_I` and `EMPLOYEE_ACK_ASSESSMENT` | other cases, PATCH, observations, other actions, `/api/team`, `/api/hr/*`, `/api/admin/*`, journal |
| `HR`         | `/api/hr/*`, `GET /api/cases` (all), `GET /api/cases/:id` (read only)                                 | PATCH, observations, actions, `/api/team`, `/api/admin/*`, journal |
| `ADMIN`      | `/api/admin/*`                                                                                        | cases, `/api/team`, `/api/hr/*`, journal                  |
| every role   | `/api/me`, assistant, `/api/docs`, criteria, sheets, assessments, `POST /api/demo/reset` | —                                                         |

- The role is read from the account on every request, never from the token: a role changed by an ADMIN applies to
  that user's next request (the frontend picks it up at the next sign-in).
- Passwords are scrypt hashes (`PasswordHasher` of `@nestjs/authentication`, Node's `crypto.scrypt`); a wrong
  password and an unknown login get the same 401. `node scripts/hash-password.mjs <password>` prints a hash.
- Accounts sit behind `UsersRepository` (`src/auth/users.repository.ts`); the in-memory implementation
  (`users.in-memory.repository.ts`, seed in `users.seed.ts`) is bound in `AuthModule` and can be swapped for a
  database one there. Supervisors are linked to `EVALUATORS` of the case seed by `evaluatorId`, employees to the
  assessed person (`Person.id`) by `personId`.

### Demo accounts (for the jury)

All people are fictional.

Every demo account has the password `Ocena2026!`.

| Login        | Role         | Who                                                            |
| ------------ | ------------ | -------------------------------------------------------------- |
| `j.kaminska` | `SUPERVISOR` | Joanna Kamińska, cases c-000…c-008 (team view hides archived c-000) |
| `r.sikora`   | `SUPERVISOR` | Robert Sikora, cases c-101, c-102                              |
| `a.pawlak`   | `SUPERVISOR` | Agnieszka Pawlak, cases c-103, c-104                           |
| `a.nowak`    | `EMPLOYEE`   | Anna Nowak (assessed), cases c-000 (previous cycle) and c-001  |
| `p.wojcik`   | `EMPLOYEE`   | Piotr Wójcik (assessed), case c-002 waiting for his part I confirmation |
| `a.lis`      | `HR`         | Agnieszka Lis, HR (kadry), all 14 cases                        |
| `admin`      | `ADMIN`      | Marek Zając, administrator                                     |

## API

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

### Assessment cases (in-memory demo)

Cases live in memory behind `CaseStore` (`src/cases/case-store.service.ts`, swap it for persistent storage there), seeded on startup (and on `POST /api/demo/reset`) with
fictional data relative to `DEMO_TODAY` (env, default `2026-11-21`); every deadline is computed against that date.

| Route                            | What it does                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `GET /api/cases`                 | Cases visible to the caller (`CaseSummary[]`): own for a supervisor, own („Moje oceny”) for an employee, all for HR |
| `GET /api/team`                  | The supervisor's cases (`CaseSummary[]`) and `todo` sorted by deadline                   |
| `GET /api/cases/:id`             | `CaseDetail`: stages, deadlines, sheet suggestion, part I, observations, part II, formal check |
| `PATCH /api/cases/:id`           | Partial update; 400 for invalid values, 409 for parts locked at the current stage       |
| `POST /api/cases/:id/observations` | Adds an S-D-R observation (201)                                                        |
| `POST /api/cases/:id/actions`    | State machine (`{ action }`); 403 when the caller is not the actor of the action, 409 with a Polish explanation for an illegal transition |
| `GET /api/hr/overview`           | Counters and every case in the office, with evaluator and last reminder                 |
| `POST /api/hr/reminders`         | Simulated reminders (`{ caseIds }`), logged in each case's history                       |
| `POST /api/demo/reset`           | Restores the seed (cases and the journal)                                                |

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
  `.env.example`). Without it, or when the call fails, answers are extractive (`mode: "EXTRACTIVE"`).
- Feature flag: `FEATURE_ASSISTANT=false` (Coolify env + restart) turns the chat off without a frontend rebuild.
  `GET /api/config` returns `{ "features": { "assistant": boolean } }` and the frontend reads it on start; with the
  flag off every `/api/assistant/*` route returns 404.
- `npm run eval:assistant`: hit@5 of the 72 Q&A questions against their expected sources.

## Quality

```bash
npm run lint       # oxlint (type-aware)
npm run format     # prettier
npm test           # unit tests (Vitest)
npm run test:e2e   # e2e tests (Vitest + supertest)
npm run test:cov
```

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
