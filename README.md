# Asaase Ani

**Report. Monitor. Protect our land.**

A platform for reporting, documenting and monitoring suspected illegal mining (galamsey) in Ghana.
CPEN 421 (Mobile and Web Software Design and Architecture), University of Ghana.

The Milestone 1 proposal sets the split, and it matters for every feature:

| Client | Who uses it | Where |
| --- | --- | --- |
| **Website** | Community members reporting what they saw. Anonymous, no install, cheap phones, weak networks | `apps/web` |
| **Mobile app** | Environmental officers and system administrators: review, verify, follow up, manage users | `apps/mobile` |
| **API** | Both clients | `apps/api` |

## What is where

```
apps/api         Express + TypeScript API, PostgreSQL (or in-memory for quick runs)
  src/domain       Report, Location, ReferenceCode, statuses: the business rules, no framework code
  src/application  Use cases (submit, track, review, answer...), access rules, audit log
  src/http         Routes. They only translate HTTP <-> use cases
  src/infrastructure  PostgreSQL, JWT, password hashing, photo storage, metadata stripping
  src/seed         200 labelled synthetic sample reports
  migrations       SQL migrations, applied in name order on start-up and by `npm run migrate`
                   (tables, relationships and privacy rules: docs/database-schema.md)
apps/web         Reporter website: React 19 + plain CSS (no Tailwind), Vite
apps/mobile      Officer/admin app: Expo SDK 58, React Native 0.88
packages/shared  Code both clients use: API clients, review rules, status wording,
                 the 16 regions / 261 districts, error messages, date formatting
docs/brand       Logo, SVG mark and icon, colours
.21st            Design decisions (chosen direction, palette, rules)
```

## Getting started

You need **Node.js 24** (npm 11) and **PostgreSQL**. For the mobile app, also **Expo Go** on an Android phone.

```bash
git clone <this repository>
cd asaase-ani
npm install
```

### 1. Database

Create a database user and two databases, one for development and one for tests (the tests empty theirs every run):

```sql
CREATE ROLE asaase_app LOGIN PASSWORD 'choose-a-password';
CREATE DATABASE asaase_ani OWNER asaase_app;
CREATE DATABASE asaase_ani_test OWNER asaase_app;
```

Copy `.env.example` to `.env` in the project root and put your password in both lines.
**Never commit `.env`** (it is in `.gitignore`).

```bash
npm run migrate        # creates the tables
npm run seed:samples   # optional: 200 labelled "[SAMPLE]" reports to work with
```

No PostgreSQL yet? Leave `DATABASE_URL` out and the API keeps everything in memory (gone on restart).
`SEED_SAMPLES=1` then loads the sample reports into memory.

### 2. Run it

```bash
npm run dev:api       # API on http://localhost:3000
npm run dev:web       # reporter website on http://localhost:5173 (talks to the API through a proxy)
npm run dev:mobile    # officer app (Expo): scan the QR code with Expo Go
```

**Logging in as an officer (development only):** when the API starts it creates
`officer@example.com` with a **new random password every start**, printed in the API terminal:

```
Dev officer ready. Email: officer@example.com  Password: ...
```

That officer works the districts in `DEV_AREAS` (default: `Tarkwa-Nsuaem Municipal;District not known, Western Region`,
separated by `;`). About 27 of the sample reports are in those areas.

### Running the mobile app on your phone

The phone cannot reach `localhost` on your computer. Put both on the same Wi-Fi, find your computer's address
(`ipconfig` on Windows, `ifconfig` / `ip a` elsewhere) and start Expo with it:

```bash
# Windows (cmd)
set EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 && npm run dev:mobile
# macOS / Linux
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 npm run dev:mobile
```

Allow Node.js through the firewall on private networks if asked. The Android emulator reaches the computer at
`http://10.0.2.2:3000` (the default when `EXPO_PUBLIC_API_URL` is not set).

**Browser preview of the mobile app** (`press w` in Expo, or `npx expo start --web` in `apps/mobile`): a browser
blocks calls from `localhost:8081` to the API unless the API allows it, so start the API with
`CORS_ORIGINS=http://localhost:8081`. The real phone app does not need this.

## Checks

```bash
npm test          # all tests: API (including PostgreSQL), shared, web
npm run typecheck # all four packages
```

Please keep both green before pushing. The PostgreSQL tests need `TEST_DATABASE_URL`; without it they are skipped.

## How things work (the parts that are easy to get wrong)

- **Areas route reports.** An officer only sees reports whose `area` matches one of their districts. Areas come from
  the district list in `packages/shared/src/ghana-districts.ts`, plus one "District not known, &lt;Region&gt; Region"
  per region. Assign officer areas from that same list.
- **The tracking code is the reporter's only key.** Never put it in a URL or store it on a shared device.
- **Public vs officer views.** The public tracking page shows status, category, district and the officer's open
  question, never contact details, coordinates, landmarks or the reporter's answers. The test in
  `apps/api/src/seed/sample-reports.test.ts` checks this across all 200 sample reports.
- **Status changes** go through `ReviewWorkflow`: access check, audit log entry, domain rules (`domain/status.ts`),
  and an "only if nobody changed it" save. A 409 means another officer got there first: reload and show it.
- **Reasons:** verify, reject, request information and refer for action need a written reason (5+ characters).
- **The mobile app** uses `HttpOfficerApi` and the review rules from `packages/shared`, so both clients agree.

## Mobile app: what is done and what is left

Done (`apps/mobile`): officer login (token in the phone's encrypted storage), report list with status filters and
pull-to-refresh, report detail (decision first, place and landmark, "open in map", photos with the officer token,
reporter contact or "anonymous", reporter's answers, history), every review action, Android back button, logo and
app icons.

Left, from the proposal (sections 3.2 and 3.3, Table 2):

1. **Show who is logged in.** Needs a small `GET /api/officer/me` endpoint (name, role, areas); the history shows
   officer IDs today.
2. **Administrator screens:** create and disable officer accounts, assign roles and areas, manage report categories,
   summary counts, activity log. Needs API endpoints too; administrators must not decide reports or see reporter
   identities (Table 2).
3. **Push notifications for new reports.** Expo Go cannot receive remote push on Android, so this needs a
   development build (EAS, free Expo account) and an API endpoint to register device tokens.
   `notifyNewReport` / `notifyReporterAnswered` in the API are the hooks (`infrastructure/console-notifier.ts`).
4. **Notes after a field visit** (proposal 3.2 "add notes").
5. **Test on a real Android phone**, including photo loading and "open in map".

## Proposal and design

- Milestone 1 proposal: kept by the team outside this repository. Read it before planning a feature; the
  role and client table (Table 2) decides who gets what.
- Quality requirements (proposal section 5): usability, performance on 3G, no lost or duplicate reports,
  access control and privacy, data use (first visit 300 KB or less).
- Database tables, relationships and who may see what: [`docs/database-schema.md`](docs/database-schema.md).
- Design decisions and the brand palette: `.21st/design.json` and `docs/brand/`.
