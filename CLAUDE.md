# Into the Current — Project Context

> A browser-based logistics strategy game set in the Congo River Basin.
> React + PixiJS + TypeScript (Vite), Zustand state, pure-function simulation tick.
> This file orients new Claude sessions. Your auto-memory already knows the user and general conventions.

---

## Read First

Before making design or balance decisions, read:

| File | What it is |
|------|------------|
| [docs/GDD.md](docs/GDD.md) | **Source of truth** for all game systems, balance constants, and design intent. Keep this in sync with code. |
| [docs/economy-balance.md](docs/economy-balance.md) | Last `/heft` run (as of 2026-04-13, pre-Revenue-system). Re-run `/heft --verify` after any economy change to update it. |

Anything in code that contradicts `docs/GDD.md` is a bug in one of the two — figure out which and fix both.

---

## Architecture

Three layers, strict separation:

```
src/engine/     ← pure TypeScript simulation. No React, no PixiJS, no side effects.
                  simulateTick(state) → state is the contract.
src/renderer/   ← PixiJS WebGL map rendering. Reads from state, writes to canvas only.
src/ui/         ← React panels, toolbar, sidebar, tooltips, modals.
                  Reads via Zustand selectors, dispatches store actions.
src/store/      ← Zustand store that wraps engine actions.
```

**Golden rules:**
- Simulation logic goes in `src/engine/ResourceFlow.ts`, never in UI.
- All state mutations are pure: engine actions return `Partial<GameState>`, the store `set()`s the result.
- `simulateTick` must be deterministic given a state + RNG seed (currently uses `Math.random()`; swap-in seeded RNG is a planned cleanup).
- PixiJS renders are triggered by state changes via `useEffect([tick])` in `App.tsx`, never on a frame ticker.

**Key files:**
- [src/engine/types.ts](src/engine/types.ts) — every interface, constant, and balance number lives here
- [src/engine/ResourceFlow.ts](src/engine/ResourceFlow.ts) — `simulateTick` + all `action*` functions
- [src/engine/initialState.ts](src/engine/initialState.ts) — starting map, officers, ships, resources
- [src/ui/App.tsx](src/ui/App.tsx) — app shell, panel toggling, tick loop
- [src/ui/Sidebar.tsx](src/ui/Sidebar.tsx) — per-node/ship/edge detail panel
- [src/ui/Toolbar.tsx](src/ui/Toolbar.tsx) — top bar, HUD tooltips, convoy toasts
- [src/ui/FleetPanel.tsx](src/ui/FleetPanel.tsx), [ShipyardPanel.tsx](src/ui/ShipyardPanel.tsx), [OfficersPanel.tsx](src/ui/OfficersPanel.tsx) — toolbar-button side panels (mutually exclusive)

---

## FORGE Skill Usage for This Project

This game was built **outside** the canonical FORGE pipeline (no `/mold`, no `/cleave`, no `docs/system-design.md`, no `docs/balance-data.json`). `docs/GDD.md` doubles as the `/strike` output. Given that starting point:

**Skills that apply cleanly:**
- **`/heft --verify`** — re-run after any economy / balance change. Reads code values in `src/engine/` and compares to GDD claims. Updates `docs/economy-balance.md` and writes audit trail to `.forge/audit/`.
- **`/temper`** — design review / red team / coherence check. Good for end-of-pass retrospectives.
- **`/lens`** — apply Schell's design lenses to a specific system or decision.
- **`/quench`** — VPP validation if you want virtual-player feedback on a design change.
- **`/prospect`** — market research if thinking about positioning or Steam page.

**Skills that DO NOT apply (skip):**
- `/mold` — no mockups; the UI is already built in React.
- `/weld` — the game is already welded. Further changes go directly into `src/`.
- `/cleave` — no system-design doc to produce; GDD is already structured.
- `/chronicle` — no content bible needed for a logistics sim.
- `/recast` — don't engine-migrate yet; still iterating on design.

**When in doubt:** `/heft --verify` after any balance change, `/temper` before a milestone.

---

## Workflow Conventions

**Commits:**
- Short title, then 2–5 line body explaining *why*, not *what*.
- Use `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` line.
- Ask before pushing to `origin/main`. Don't force-push.
- Balance changes that alter a number: add an inline `// BALANCE: old → new on YYYY-MM-DD (reason)` comment in `types.ts` / `initialState.ts` next to the value. This is the project's archaeology record — don't strip these out.

**Editing style:**
- Prefer `Edit` over full `Write`. No aggressive refactors during feature work.
- Don't add comments that describe what the code does — only *why*.
- Don't add feature flags or backwards-compat shims. Change the code directly.
- Don't add commentary for removed code (no `// removed X` lines). Delete it cleanly.

**UI style:**
- Inline React styles (no CSS modules, no Tailwind). Matches the existing pattern.
- Icon conventions: 🌾 food, 🌿 rubber, 🦷 ivory, 💰 Revenue, ⛵ Fleet, ⚒ Shipyard, 👥 Officers, 🚨 Emergency.
- Panel layout: toolbar-button side panels (Fleet, Shipyard, Officers) are left-aligned and mutually exclusive. Node/ship/edge detail uses right-aligned Sidebar.

**Testing:**
- No automated test suite. Verify with `npm run dev` + browser interaction.
- After UI changes, confirm HMR picked them up and reload if state changes are involved (Zustand retains state across HMR).
- Type-check with `npx tsc --noEmit` before committing.

---

## Open Design Threads

Where things stand as of the last session. Check `git log` for anything more recent.

- **Personnel expansion** (some done, some deferred): officer roster, transfer UI, recruitment, medical effect — DONE. Sick state, defection, recruitment pools, officer morale as a mechanic — DEFERRED.
- **Rubber/ivory economic loop**: export convoys → Company Revenue → ship commissioning — DONE. Prestige tiers that unlock capabilities via lifetime revenue thresholds — NOT STARTED.
- **Demand scaling**: population × rate → demand — DONE. Population growth/migration as dynamic mechanic — NOT STARTED.
- **Win/loss conditions**: not defined yet. No game-end state.

---

## What Not To Do

- Don't run `/mold`, `/weld`, or `/cleave` — they'd work against the existing build.
- Don't delete or rewrite `docs/GDD.md` sections wholesale. Amend in place with `BALANCE:` markers.
- Don't add dependencies (npm install X) without explicit user approval. Stack is deliberately minimal.
- Don't add a new resource type without a consumption loop. (Rubber/ivory were dead for months before export convoys fixed them — verified via `/heft`.)
- Don't spawn emergency-response or one-off mechanics without auto-cleanup. The `emergency_*` route convention is the pattern: create, execute, delete.
