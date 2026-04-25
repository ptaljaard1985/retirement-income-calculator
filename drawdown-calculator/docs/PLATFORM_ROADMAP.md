# Planning Hub & Tools Platform — `planning.simplewealth.co.za`

> **Status: planning document.** This is a forward-looking roadmap for review and revision, not an approved implementation plan. Nothing in here has been built yet. The drawdown calculator continues to be the single live product; everything described below is prospective.

## Context

The drawdown calculator (`retirement_drawdown.html`) is today a single-file, client-side, stateless tool. `CLAUDE.md` lists "no build", "no dependencies", "no backend", "single file" as non-negotiable. That was correct when there was **one** tool, used in real meetings, edited by hand once a year for SARS updates.

Pierre is now planning **5+ planning tools** (drawdown, tax projection, IPS, estate, fee comparison, etc.) **plus** a private hub at `planning.simplewealth.co.za` that:

1. Lists clients and tools.
2. Per client, shows tool history and resumes any saved session with stored numbers.
3. Supports a "guest client" mode — ad-hoc/prospect work, savable as a draft, optionally promoted to a real client later.
4. Is private (single admin user, 2FA, no public access).

This is **distinct from** the future CRM (which will own client records, comms, scheduling). The hub is purely tools + saved sessions; CRM integration is a later read-from concern.

Year-1 target: 20–100 clients, single-user (Pierre), Supabase as backend, EU region.

## A material architectural decision

The "single HTML file" rule does not scale to 5+ tools. With 5 tools each in a single HTML file, you get 5 copies of:

- **SARS 2026/27 tax tables** — annual update becomes 5 hand-edits, 5 chances for typo, audit risk multiplied 5×.
- CGT logic, currency formatting, sliders, segmented toggles, design tokens.
- Chart helpers (the income/capital chart plugins are real code).
- Snapshot contract serialisation.

The Python audit suite catches *symptoms* of math drift; it cannot prevent the *cause* — duplicated source.

**Recommendation: break the single-file rule for new tools, migrate the calculator into the same structure carefully later.** This is a deliberate revision of CLAUDE.md's non-negotiables, prompted by the move from "one tool" to "tools platform". Constraints were correct for the original goal; the goal has changed.

**What we keep**
- Each tool has a stable public URL, prints to PDF cleanly, works offline once loaded.
- Math is auditable: independent Python reimplementation in `packages/tests-python/<tool>/`.
- Tax tables live in **one** source; both JS and Python read the same canonical numbers.
- Warm-paper editorial aesthetic, no emoji, no telemetry, no LLM in the data path.

**What we change**
- Each tool is a small Vite app, not a single hand-edited HTML file.
- Shared logic (SARS tables, design tokens, UI components, chart wrappers, snapshot contract) lives in `packages/` and is imported by every tool and the hub.
- A small build step is part of the workflow. Source is human-editable; the deployed tool is a built static bundle.

## Repo: single monorepo

```
simplewealth-planning/                     ← single new repo
├── apps/
│   ├── hub/                              hub at planning.simplewealth.co.za (Astro)
│   └── tools/
│       ├── drawdown/                     migrated retirement-drawdown calculator (Phase 3)
│       ├── tax-projection/               first "new-style" tool (Phase 2)
│       └── ...                           future
├── packages/
│   ├── design-tokens/                    :root CSS tokens, fonts, mixins
│   ├── ui/                               sliders, segmented toggles, currency input, etc.
│   ├── sars/                             tax tables, rebates, CGT, bracket creep — single source
│   ├── charts/                           Chart.js wrappers + income/capital plugins
│   ├── snapshot/                         contract types + ?session=<uuid> persistence shim
│   └── tests-python/                     Python audit suite (one folder per tool)
├── infra/
│   ├── supabase/                         schema.sql, migrations, RLS policies
│   └── runbook.md                        DNS, TLS, backup-restore drills, breach response
├── package.json                          (pnpm workspaces)
├── pnpm-workspace.yaml
└── turbo.json                            (build/test orchestration)
```

- **Hub framework**: Astro (file-based routing, near-zero JS for static pages, MDX for the privacy notice + methodology pages, easy Supabase Auth).
- **Tools**: plain **Vite + vanilla JS/TS**. No React. Preserves the calculator's character (no framework noise) but with module imports.
- **Package manager**: pnpm + Turborepo. One `pnpm install`, one `pnpm dev` for the workspace.

## Hub architecture

```
planning.simplewealth.co.za
├── /                 Sign-in (email + TOTP)
├── /clients          Client list (search, archive, new)
├── /clients/:id      Client detail: per-tool session history
├── /clients/new      Create client
├── /tools            Tool registry
├── /sessions         Drafts (guest sessions) + recent activity
└── /audit            Audit log

API: Supabase (Postgres + Auth + RLS) accessed via Supabase JS client. No bespoke server.

Tool launch: new tab with `?session=<uuid>&return=<hub-url>`. Tool reads/writes the
snapshot via the shared @sw/snapshot package (debounced 1s + sendBeacon on unload).
Without ?session, tool runs from localStorage like today.
```

### Why redirect (new tab), not iframe

iframes break Chart.js sizing, complicate `@media print`, and risk the bookmarkable-link workflow Pierre uses today. New-tab launch keeps the tool's URL clean and `Cmd+P` working. One extra tab — acceptable.

### Tool integration contract — `@sw/snapshot`

A shared package every tool imports. Three things:

1. **`loadSnapshot()`** — checks `?session=<uuid>`, fetches from Supabase if present (RLS-protected via the active session JWT). Falls back to `localStorage`. Returns typed snapshot or `null`.
2. **`saveSnapshot(snap)`** — debounced 1s; if `?session` present, PATCH to Supabase; always mirrors to `localStorage`. Registers a `beforeunload` `sendBeacon`.
3. **`SnapshotContract<T>`** — TS type with `schemaVersion: number` and a tool-specific payload `T`. Drawdown's existing schema (documented in `docs/ARCHITECTURE.md` lines ~232–258) is the canonical example.

Every future tool conforms to this contract. Adding a tool = scaffold from a template, define the snapshot type, ship.

### Data model (Supabase, EU region)

```sql
-- All tables RLS-policy `owner_id = auth.uid()` (defence in depth).

clients (id, owner_id, display_name, family_name, primary_name, notes,
         created_at, updated_at, archived_at)

tools   (id, slug unique, name, description, url, schema_version, enabled, created_at)

sessions (id, owner_id, tool_id, client_id NULL, label, snapshot jsonb,
          schema_version, created_at, updated_at)
          -- client_id NULL = guest draft

audit_log (id, actor_id, action, target_table, target_id, metadata jsonb, at)
```

`owner_id` on every row preserves a clean upgrade path to multi-adviser later.

### Auth

Supabase Auth, email + password + **mandatory TOTP** at first sign-in. Magic-link disabled. 1-day idle / 30-day max session. Recovery codes printed at enrolment, stored in 1Password + a physical safe.

Two layers: app route guard + RLS. A forged request without a valid JWT returns zero rows.

### Guest-client flow

- "Use without client" → creates a session with `client_id = NULL`.
- `/sessions` Drafts tab lists guest sessions.
- Per-draft actions: Open · Attach to client (picker) · Export JSON · Delete.

### POPIA / compliance

- Supabase **EU region**, encryption at rest, TLS in transit.
- Minimum-necessary data: first names, surnames, financial assumptions. **No** ID numbers, addresses, banking details.
- Per-client JSON export + hard-delete actions (right of access / right of erasure).
- Audit log retained 12 months.
- Supabase PITR backups; one manual restore drill before go-live.
- Privacy notice page on the hub, references FSP 50637.

## Phased rollout

**Phase 0 — Foundations (1 week)**
- New monorepo `simplewealth-planning/` with pnpm workspaces + Turbo.
- Supabase Pro project (EU region); schema + RLS via migrations in `infra/supabase/`.
- DNS: `planning.simplewealth.co.za` CNAME → Cloudflare Pages.
- Stub `apps/hub/` (Astro), stub each `packages/*` with empty exports.
- Update `CLAUDE.md` to reflect the new posture (single-file rule lifted; replaced with monorepo + shared-package rules).

**Phase 1 — Hub MVP (1–2 weeks)**
- Sign-in + TOTP enrolment.
- Clients CRUD (list / new / edit / archive).
- Tools registry list. **Drawdown registered as the existing `retirement_drawdown.html` URL** (not migrated yet).
- Per-client sessions list + guest drafts list.
- Tool launcher (new-tab `?session=<uuid>&return=<hub-url>`).
- Append a **minimal hub-mode shim** (~40 lines) to the existing `retirement_drawdown.html`, gated entirely on `?session`. Standalone behaviour byte-identical.

**Phase 2 — First "new-style" tool (1–2 weeks)** ← architecture validation
- Build a *new* tool (recommend: **tax projection** — small, well-defined, exercises every shared package).
- Implement `packages/design-tokens/`, `packages/ui/`, `packages/sars/`, `packages/charts/`, `packages/snapshot/` as the new tool needs them.
- Independent Python audit suite under `packages/tests-python/tax-projection/`.
- This is where the workspace shape is *proven*. If something is wrong, find it now in fresh code, not while migrating money-math that has 88+19 passing audit tests.

**Phase 3 — Migrate drawdown (1–2 weeks, careful)**
- Move `retirement_drawdown.html` into `apps/tools/drawdown/`, refactored against the shared packages.
- 88/88 Python + 19/19 JS must pass at every commit.
- **Visual-fidelity check** vs today's HTML (math is guarded by audit tests; UI is not):
  1. Lock 2 reference scenarios in `infra/regression-fixtures/` as `?session` snapshot JSONs:
     - **Scenario A** — typical sustainable plan (e.g. R 6m + R 6m LA, R 65k/mo, return 6.5%, CPI 5%, auto-top-up on).
     - **Scenario B** — depleting plan that triggers shortfall wash, LA-cap markers, and alerts.
  2. Capture baselines from today's HTML at 1366×768 (Pierre's 13" meeting viewport) for each tab (Info / Planning / Scenarios / Comparison Summary) plus a "Save as PDF" print baseline.
  3. After migration, regenerate the same screenshots + print PDF with the new tool.
  4. Manual expert review side-by-side. (Pixel-diff tools like Playwright `toHaveScreenshot` are overkill for a one-time migration; manual review is right-sized.) Resolve any difference before cutover — fix the migration to match, or consciously accept and note it.
- **30-day frozen reference**: original `retirement_drawdown.html` stays in place, untouched, for at least 30 days post-cutover. If a client meeting reveals a regression, instant fallback.

**Phase 4 — Polish + second new tool (ongoing)**
- Audit log writes, JSON export, hard-delete with audit entry.
- One manual backup-restore drill, documented.
- Pierre's choice for the next tool.

## Critical files

**Created (Phase 0):**
- `simplewealth-planning/` — new monorepo (location TBD with Pierre).

**Modified (Phase 1, calculator side, lightly):**
- `drawdown-calculator/retirement_drawdown.html` — append ~40-line hub-mode shim, gated on `?session`. No engine change. Standalone byte-identical.
- `drawdown-calculator/retirement_drawdown_report.html` — same shim pattern for the report's snapshot loader.
- `drawdown-calculator/CLAUDE.md` — note that the file is now hub-aware (still single-file at this point); flag the upcoming migration.

**Migrated (Phase 3, after monorepo proven):**
- The above two files refactor into `apps/tools/drawdown/` and `apps/tools/drawdown-report/`, against shared packages.

**Reuse / extract (Phase 2):**
- Snapshot contract (`docs/ARCHITECTURE.md` lines ~232–258) → `packages/snapshot/` types.
- `:root` design tokens from `retirement_drawdown.html` head + `docs/DESIGN.md` → `packages/design-tokens/`.
- `BRACKETS`, `REBATE`, `CGT`, `BRACKET_CREEP`, `incomeTaxYear`, `cgtExclusionYear` → `packages/sars/`.
- `targetBoxPlugin`, `shortfallShadingPlugin`, `buildIncomeChart`, `buildChart` → `packages/charts/`.
- `formatCurrency` and the rand-formatting blur handlers → `packages/ui/currency`.

## Verification

End-to-end before Phase 1 ships:

1. **Standalone calculator unchanged.** `file://` open, run a typical projection, `Cmd+P` produces the print-summary, `pytest` 88/88, `node run.js` 19/19.
2. **Hub-mode launch.** New tab opens with `?session=<uuid>`; calculator displays blank defaults for a new session.
3. **Hub-mode save.** Edit inputs, wait 2s, refresh tab — inputs persist.
4. **Hub-mode resume.** Close tab; reopen session from client history — state restored.
5. **Guest flow.** "Use without client" → drafts → "Attach to client" moves it to that client's history.
6. **Auth path.** Sign-out → redirect to sign-in. TOTP enforced on first login. Recovery codes printed.
7. **RLS sanity.** Forge a `supabase.from('clients').select()` without JWT — zero rows / 401.
8. **Backup restore drill.** PITR to staging; verify; document in `infra/runbook.md`.
9. **POPIA.** Export client JSON bundle; hard-delete a client; audit-log entry written.

End-to-end before Phase 3 ships (drawdown migration):

10. Visual-fidelity check on the 2 locked reference scenarios:
    - All 5 tabs at 1366×768 (Info / Planning / Scenarios / Comparison Summary / Assumptions) — side-by-side review against the today's-HTML baseline screenshots, no unintended differences.
    - Single-client mode toggle: Spouse-B collapse renders identically.
11. Print preview ("Save as PDF") matches the reference print PDF page-for-page.
12. All 88+19 audit tests pass against the refactored code.
13. The original standalone HTML still works (frozen reference for 30 days).

## Out of scope (do not build)

- Notes / files / attachments beyond a single text field per client.
- Calendar / scheduling / comms (CRM territory).
- Multi-adviser roles (data model leaves room; UI doesn't).
- Public client portals or sharing links.
- Automated PDF rendering pipeline (existing report sibling renders on demand; hub stores the snapshot).
- Stochastic / Monte Carlo features in calculators.
- Any AI / LLM integration that touches client data.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Phase 3 migration regresses the calculator | Don't migrate until Phase 2 proves the monorepo on a *new* tool. Keep 88+19 audit tests green at every commit. Visual regression vs today's HTML before swap. Frozen-reference HTML kept for 30 days. |
| Hub-mode shim breaks standalone calculator (Phase 1) | Gate every hub-mode branch on `?session`. Standalone path is byte-identical. Tests still pass. |
| TOTP loss locks Pierre out before a meeting | Recovery codes printed + 1Password + physical safe. |
| Supabase outage during a meeting | Hub-mode load fails gracefully → calculator opens blank with a banner. Pierre can still run the meeting. Saves resume when service returns. |
| Snapshot schema drift across tool versions | Every snapshot has `schemaVersion`. Tool refuses snapshots newer than its version. Backwards-compat in the tool, not the hub. |
| Solo dev / solo operator | Boring stack (Astro + Vite + Supabase + Cloudflare Pages). Managed everything. Documented runbook. |
| Design-token drift between hub and tools | Single source: `packages/design-tokens`. CI fails the build if a tool re-defines tokens locally. |
| `CLAUDE.md` says "no build, no bundler, single file" | Plan **revises** that constraint deliberately in Phase 0. Updated `CLAUDE.md` reflects new posture; future Claude sessions read the new rules. |

## Top three concerns (worth surfacing for review)

These are the real risks in the plan, ranked by what's most likely to bite. Not all are mitigated above; calling them out so future-you can decide whether to add explicit gates.

**1. Maintenance burden vs single-adviser bandwidth.**
Today's calculator has near-zero ongoing maintenance — open it, edit it, save. The platform changes that posture permanently. `packages/*` dependencies age (Vite, Astro, Supabase JS, Chart.js all ship breaking changes). Schema migrations as snapshot contracts evolve. The annual SARS update is *easier* per tool (one source) but the discipline of running the audit suite each February still sits with Pierre. The "5+ tools" math only pays off if 5+ tools actually ship; if 2 ship and 3 die, the workspace overhead is paid for nothing. Phase 2's "prove the pattern on a new tool first" gate exists for this reason — treat it as a stop/go decision before committing to tools 3+.

**2. POPIA + FSP regulatory exposure.**
Today: zero client data on a server, zero compliance surface. Tomorrow: client names and financial assumptions on Supabase EU. As FSP 50637, a breach is reportable to the Information Regulator and potentially FSCA. The plan covers technical posture (encryption, RLS, audit log, EU region, hard-delete) but **not the paperwork** that proves defensible operation: a published Privacy Policy, a signed Supabase DPA (Data Processing Agreement), a Breach Response Runbook, a Retention Schedule, recorded lawful basis per client. The cost of getting this wrong isn't a bug — it's an enforcement letter. Recommendation: a **Phase 0.5 compliance workstream** alongside Phase 0/1, with the hard rule that **no real client data goes into the DB until it's signed off**.

**3. Drawdown migration regression (Phase 3).**
The only step that touches working production money-math used in live meetings. The 88+19 audit suite guards the math; the visual-fidelity check guards the gross UI; but neither fully covers everything between (chart sizing under different viewports, print stylesheet inheritance, debounce timer races, keyboard focus on the rail). Regressions surface in real meetings under time pressure with clients watching. The 30-day frozen reference fallback mitigates but doesn't *prevent* a quiet regression going unnoticed for weeks. Could strengthen with a **2-week parallel run** — hub launches the new tool but the old standalone URL still works for live meetings — before formally cutting over.

## Open questions for Phase 0 kickoff

1. **Repo location**: a new repo `simplewealth-planning` (recommended) or grow the existing `calc-retirement-income` into the monorepo? My read: new repo, fresh start. The current repo's name describes one tool; the workspace shape is materially different.
2. **Hub framework**: Astro (recommended) or plain Vite for the hub too?
3. **Domain & DNS access**: who controls `simplewealth.co.za`? Need CNAME access for `planning.`.
4. **First "new-style" tool (Phase 2)**: tax projection (recommended), IPS, or something else?
5. **Phase 0.5 compliance workstream**: do this alongside Phase 0/1 (recommended) or defer until just before Phase 1 hub-mode integration?
6. **Phase 3 cutover gate**: simple swap once visual-fidelity check passes, or 2-week parallel run with both URLs live?
