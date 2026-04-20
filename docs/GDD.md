# Into the Current — Design Document

> A browser-based logistics strategy game set in the Congo River Basin during the colonial era.
> Built with React + PixiJS + TypeScript (Vite).

---

## Table of Contents

1. [Core Design Philosophy](#core-design-philosophy)
2. [Architecture Decisions](#architecture-decisions)
3. [Game Systems](#game-systems)
4. [Map & Nodes](#map--nodes)
5. [Balance Constants](#balance-constants)
6. [Implemented Features](#implemented-features)
7. [Game Glossary](#game-glossary)

---

## Core Design Philosophy

The game is structured around a single central tension: **you control the flow of goods, and the flow of goods controls everything else.** Morale, loyalty, instability, and influence all downstream from whether your ships are running and your outposts are fed.

Design pillars:
- **Routes as intent, ships as execution** — the player manages strategy at the route level but ships are real individual agents that can be clicked, targeted by events, and recalled
- **Emergent crises over scripted events** — instability, supply shortages, and route disruptions compound naturally rather than being triggered at fixed times
- **Visible cause and effect** — every stat change traces back to something the player did or failed to do

---

## Architecture Decisions

### Engine: React + PixiJS + TypeScript (Vite)

**Why not a game engine (Godot, Phaser, Unity)?**
This game is a simulation-heavy strategy title, not an action game. The UI is as important as the canvas. React handles complex interactive panels (sidebars, tooltips, fleet management, cargo priorities) natively. PixiJS handles the WebGL canvas map. Keeping them separate means each does what it's best at.

**Architecture layers:**
```
GameEngine (pure TS)    ← simulation logic, graph model, resource flow, ship state machine
    ↓ state (Zustand)
PixiRenderer            ← map, routes, ship icons, overlays (WebGL canvas)
    ↓ events
React UI                ← sidebar panels, fleet management, toolbar, tooltips
```

**Why Zustand over Redux?**
Lightweight, no boilerplate, works cleanly with `getState()` calls from outside React (used by the simulation tick and the renderer).

### Rendering

**Why destroy-and-redraw instead of dirty-flagging?**
The map is small (5–15 nodes, 4–8 edges, <20 ships). Recreating graphics objects on each state change is simpler to maintain and avoids stale-state bugs. GPU buffers are explicitly freed before every redraw via the `destroyChildren()` helper.

**Why remove the 60fps ticker render?**
The game is pausable and tick-driven, not real-time. Redrawing 60 times per second while creating new Graphics objects each frame caused WebGL buffer exhaustion around day 110. Renders are now driven only by state changes via React's `useEffect`.

**Ship directional rendering:**
In-transit ships render as a directional arrowhead pointing toward their next destination. The renderer determines travel direction by comparing `ship.locationNodeId` (the departure node) against `edge.fromId`. If they match the ship is going forward along the edge; if not, it is returning. This ensures the ship's visual position interpolates from the actual departure node and the arrowhead faces the correct direction on both outbound and return legs.

### State Management

All game state lives in a single Zustand store. The simulation tick is a pure function (`simulateTick`) that takes the current state and returns a new state — no side effects. This makes the simulation testable in isolation and avoids mutation bugs.

---

## Game Systems

### 1. River Network (Graph Model)

The map is a **weighted directed graph**:
- **Nodes** = settlements, outposts, chokepoints, confluences, and the origin Company Station
- **Edges** = river segments with capacity, resistance, control, instability, and flood state

Edges are bidirectional by default. Ship movement traverses edges in either direction, with `resistance` scaling travel time. Transit time for a steamer = `resistance / 0.18` ticks.

### 2. Trade Routes

A **Trade Route** is a named, ordered list of nodes (one-way path). Ships assigned to the route travel the path forward to the terminus, then **automatically reverse course** (ping-pong), repeating indefinitely.

- Routes define **cargo priorities** per resource type (High / Medium / Low / None)
- Ships load cargo at each stop based on these priorities and downstream demand
- Routes can be created, deleted, and modified in the Fleet panel
- Ships are assigned/unassigned from the Fleet panel or the Ship panel

**Why ping-pong instead of explicit loops?**
Ping-pong is how real river logistics works — a boat goes upriver and comes back. Requiring the player to manually define the return path was redundant. The route path is the canonical one-way definition; reversal is automatic.

### 3. Ship System

Ships are **individual agents** that follow their assigned route autonomously. Each ship has:
- Its own cargo hold (filled on departure, emptied on arrival)
- A state machine: `unassigned → docked_loading → in_transit → docked_unloading → ...`
- Individual event notes (ambush, flood, stranded)
- A clickable, directionally-rendered position on the map

**Ship state machine:**
```
unassigned          ← not assigned to any route, docked at Company Station
  ↓ (assign)
docked_loading      ← filling cargo hold from current node's stockpile (2 ticks)
  ↓
in_transit          ← travelling along an edge (speed / resistance ticks)
  ↓ (arrives)
waiting_berth       ← arrived but port is full; queued until a berth frees up
  ↓ (berth opens)
docked_unloading    ← emptying cargo into destination node stockpile (1 tick)
  ↓
docked_loading      ← reloading for next leg (2 ticks)
  ↓ ...
stranded            ← blocked by flood or missing edge; recovers when route clears
captured            ← lost to hostile event (terminal)
```

**Cargo loading logic:**
Ships load using proportional fair-share allocation weighted by downstream demand and cargo priority. A ship skips any resource it just unloaded at the current stop (`recentlyUnloaded` guard) — this prevents ships from immediately reloading goods they just delivered. Each node also protects a 40-tick buffer of its own supply before allowing ships to take goods.

**Partial unloading at intermediate stops:**
A ship drops only the quantity needed to top up a node's 30-tick demand buffer. The remainder stays on board for downstream delivery. At termini, all cargo is unloaded.

**Ship types:**

| Type | Capacity | Speed | Build cost | Build time |
|------|----------|-------|------------|------------|
| War Canoe | 20 | 0.25/tick | 5 food | 3 ticks |
| River Steamer | 60 | 0.18/tick | 15 food + 8 ammo | 8 ticks |
| Heavy Barge | 120 | 0.10/tick | 25 food + 10 rubber | 15 ticks |

**Berth limits:**
Port capacity limits how many ships can load or unload simultaneously. Ships that arrive at a full port enter `waiting_berth` state (rendered in purple) until a berth opens.

| Level | Name | Population | Berth limit |
|-------|------|------------|-------------|
| 1 | Hamlet | < 25 | 2 |
| 2 | Outpost | 25–49 | 4 |
| 3 | Station | 50–99 | 8 |
| 4 | Fort | 100–149 | 14 |
| 5 | Company HQ | 150+ | 20 |

### 4. Resource System

Five resource types:

| Resource | Primary source | Primary use |
|----------|---------------|-------------|
| Food | Company Station (produced) | Consumed by all outposts; primary morale driver |
| Medicine | Company Station (produced) | Consumed by outposts; second morale driver |
| Rubber | Outposts (extracted) | Export good; returned to Company Station |
| Ivory | Outposts (extracted) | Export good; high value |
| Ammunition | Company Station | Required by military officers; reduces instability |

**Why no Morale Goods resource?**
Morale is now driven by concrete logistics outcomes — food supply, medicine supply, export activity, and instability — not by a separate abstract "feel-good" commodity. This makes morale a legible consequence of your supply chain decisions rather than just another good to transport.

Resources sit in each node's **stockpile** until consumed by demand or loaded by a ship.

### 5. Morale → Loyalty → Instability → Influence Chain

Every tick, for each node:

**Step 1 — Check supply status (before consuming):**
- Is `stockpile[food] >= demand[food]`? → `foodMet`
- Is `stockpile[medicine] >= demand[medicine]`? → `medicineMet`

**Step 2 — Consume demand and add production:**
- `stockpile[r] -= demand[r]` (capped at 0)
- `stockpile[r] += production[r]` (capped at stockpile cap)

**Step 3 — Check export status (after production):**
- If the node produces any resource AND its stockpile for that resource is below 75% of cap: `isExporting = true` (goods are being picked up by ships)
- Nodes with no production are always neutral on this factor

**Step 4 — Compute morale delta:**

| Factor | Met / good | Not met / bad |
|--------|-----------|---------------|
| Food demand met | +0.5 / tick | −1.5 / tick |
| Medicine demand met | +0.3 / tick | −0.8 / tick |
| Produced goods being exported | +0.2 / tick | −0.2 / tick |
| Instability < 30 | +0.1 / tick | — |
| Instability > 55 | — | −0.2 / tick |

- Best case (all factors met): **+1.1 / tick** → ~50 ticks from 50 to 100
- Food supply breaks: net ~**−1.0 / tick** → morale from 70 to crisis (30) in ~40 ticks
- Full collapse (food + medicine fail): **−2.3 / tick** → 80 to 0 in ~35 ticks

**Step 5 — Loyalty cascade (slow):**
- `morale < 35`: `loyalty -= 0.15/tick`
- `morale > 65`: `loyalty += 0.15/tick`
- 35–65 range: loyalty holds steady

**Step 6 — Instability tracks loyalty:**
- `loyalty < 40`: `instability += 0.5/tick`
- `loyalty ≥ 40`: `instability -= 0.3/tick`

**Step 7 — Influence tracks loyalty + morale (very slow):**
- `loyalty > 70` AND `morale > 60`: `influence += 0.05/tick`
- `loyalty < 40`: `influence -= 0.08/tick`
- Influence operates on a strategic timescale (~2000 ticks full range)

**Key design decisions:**
- Supply status is checked *before* consumption so a ship delivery this tick counts immediately
- No morale goods resource — morale is purely a logistics outcome
- Three distinct time constants: morale (fast), loyalty (slow), influence (very slow)

### 6. Population Level System

Each node's population determines its **level**, which governs display title, stockpile cap, and berth limit:

| Level | Name | Population | Stockpile cap | Berth limit |
|-------|------|------------|---------------|-------------|
| 1 | Hamlet | < 25 | 80 | 2 |
| 2 | Outpost | 25–49 | 160 | 4 |
| 3 | Station | 50–99 | 300 | 8 |
| 4 | Fort | 100–149 | 480 | 14 |
| 5 | Company HQ | 150+ | 700 | 20 |

Population growth, migration, and disease mechanics are planned for a future iteration.

### 7. Officers

Officers are personnel stationed at nodes or in transit between them.

| Role | Effect |
|------|--------|
| Logistics | Improves loading/unloading efficiency (planned) |
| Military | Reduces edge instability when stationed at destination node |
| Diplomatic | Improves influence projection (planned) |
| Medical | Reduces morale damage from disease events (planned) |

Officers can be transferred between nodes and spend ticks in transit.

### 8. Instability, Control & Route Disruption

Edge instability grows when:
- `control < 0.5` and no military officer is at the destination node
- Adjacent nodes have low loyalty

At `instability > 70`, ships on the edge have a 1.5% chance per tick of being **ambushed** (15–35% cargo stolen). At `isFlooded = true`, ships are **stranded** until the flood clears.

**Edge control** rises as the influence of both endpoint nodes grows and falls when instability at either end is high:

```
delta = (avgInfluence × 0.0125) − (maxInstability / 100 × 0.006)
edge.control = clamp(0, 1, edge.control + delta)
```

- `avgInfluence` = average of both endpoint node influence values, normalised to 0–1
- `maxInstability` = the worse of the two endpoint instability values, normalised to 0–1
- Max gain: **+0.0125/tick** (75% slower than the max node influence gain of +0.05/tick) — roughly 80 ticks to consolidate a fully calm, high-influence corridor from scratch
- Control decays when `maxInstability / avgInfluence > ~2.08` — a disrupted route actively loses control even while influence is growing elsewhere, forcing the player to address both problems

**Why this design?**
Control is not just a counter — it reflects whether the Company actually has a presence on the water. Influence on the riverbanks is a necessary but not sufficient condition; local instability can still undermine a route the player thought was secure.

### 9. Map Navigation

The canvas is panned by **click-and-drag** on any empty area. Clicks on nodes, ships, or edges open their detail panel — these clicks do not trigger panning (handled via `stopPropagation`).

### 10. HUD & Information Design

The HUD at the top of the screen is the player's economic dashboard. It must communicate state at a glance and expose detail on hover — the player should never have to click into a panel just to answer a routine question like "how much food is where?" or "when is the next convoy due?"

**Toolbar layout (left to right):**

```
INTO THE CURRENT | Day N | ⏸▶▶▶ | Trade/Influence/Instability/Personnel |
⛵ Fleet [badge]  ⚒ Shipyard [badge] |
🌾 Food total   🌿 Rubber total   🦷 Ivory total |
₪ Company Revenue
```

**Separation of Fleet and Shipyard:**
Fleet and Shipyard are distinct mental modes and distinct buttons:
- **Fleet** = tactical — where are my ships, what are they carrying, where should they go
- **Shipyard** = strategic — can I afford to grow the fleet, what's the upkeep cost

The Shipyard lives in its own side panel (opened from the toolbar), not as a section inside the Company Station node panel. Commissioning a ship is a frequent, deliberate action that deserves top-level discoverability. Opening Shipyard closes Fleet and vice versa — one panel at a time.

**Badges on Fleet / Shipyard buttons:**
- Fleet badge: number of unassigned ships (amber)
- Shipyard badge: number of ships currently in the build queue (yellow)

**HUD tooltips (hover to reveal):**

| Stat | Tooltip content |
|------|-----------------|
| 🌾 Food | Per-port rows: Name, Stockpile, Net/tick (green positive / red negative). Only ports with nonzero data are listed. |
| 🌿 Rubber | Same format — production/stockpile per port. Quickly reveals where extraction is happening vs. where stockpiles are sitting. |
| 🦷 Ivory | Same as Rubber. |
| ₪ Revenue | Treasury, lifetime earned, revenue in transit, and a mini-list of up to 5 convoys en route (goods + revenue + ticks remaining). |

Tooltips follow the cursor and dismiss on mouse-leave. Minimum width 220 px; never block more than 340 px of the screen. They are read-only — they do not contain interactive elements. For anything clickable, route the player to Fleet, Shipyard, or the Sidebar.

**Convoy event signaling:**
Trade convoys departing and arriving are important story beats — they're the moment the extraction economy pays off. Two redundant signals, one kinesthetic and one narrative:

1. **Revenue pulse** — when a convoy arrives, the ₪ counter briefly flashes bright yellow with a glow for ~1.2 seconds. Gives immediate feedback on a numerical change that might otherwise be easy to miss.
2. **Toast notification** — top-center of the screen, 3–4 seconds, colour-coded:
   - `convoy_departed` (lime): "Trade Convoy departed with 80 rubber + 40 ivory · ₪360 expected"
   - `convoy_arrived` (amber): "Convoy returned from market: +₪360 banked"

Events are logged to a rolling 20-item `economicEvents` array in GameState. The toast system watches this array and shows any event it hasn't rendered yet, purging toasts older than 4.5 seconds.

**Company Ledger (Company Station node panel):**
When the player clicks Company Station, the sidebar shows a "Company Ledger" section with the lifetime import/export record:

| Metric | Meaning |
|--------|---------|
| **Treasury** | Current spendable Company Revenue |
| **Revenue earned** | Lifetime ₪ from completed convoys (does not decay when ships are built) |
| **Rubber exported** | Lifetime rubber sent out via convoys + rolling rate per 100 ticks |
| **Ivory exported** | Lifetime ivory sent out via convoys + rolling rate per 100 ticks |

These metrics answer the strategic question *"Is my extraction pipeline profitable relative to what it costs to run?"* Export rate is calculated as `lifetimeTotal / tick × 100` — a game-wide average. Later iterations may move to a rolling-window calculation for a more immediate signal.

**Why information on hover, not on a permanent dashboard?**
The map + overlay layers are the primary visual channel. A permanent stats dashboard would eat canvas real estate and train the player to read numbers instead of watching ship icons. Tooltips give access on demand without displacing the game view.

---

## Map & Nodes

### Current Node Layout

| ID | Name | Type | Population | Notes |
|----|------|------|------------|-------|
| origin | Company Station | origin | 120 | Capital; produces food/medicine/ammo |
| confluence | Stanley Falls | confluence | 40 | River junction; hub for both branches |
| leopoldville | Léopoldville Station | outpost | 85 | Rubber + ivory production |
| gorge | Gorge Pass | chokepoint | 20 | Strategic chokepoint; high resistance |
| upriver | Upriver Camp | settlement | 55 | Ivory + rubber; ~9 ticks from Gorge |
| innerstation | Inner Station | outpost | 30 | Remotest post; 14 ticks from Upriver |

### Edges & Transit Times (steamer)

| Edge | From → To | Resistance | Steamer ticks |
|------|-----------|------------|---------------|
| e_origin_confluence | Company Station → Stanley Falls | 1.0 | ~6 |
| e_confluence_leopoldville | Stanley Falls → Léopoldville | 1.4 | ~8 |
| e_confluence_gorge | Stanley Falls → Gorge Pass | 1.8 | ~10 |
| e_gorge_upriver | Gorge Pass → Upriver Camp | 1.6 | ~9 |
| e_upriver_innerstation | Upriver Camp → Inner Station | 2.52 | **14** |

### Pre-defined Routes

| Route | Path | Purpose |
|-------|------|---------|
| Main Supply Run | Origin → Confluence → Léopoldville | Primary food/medicine delivery |
| Gorge Expedition | Origin → Confluence → Gorge → Upriver | Interior supply + ivory extraction |
| Interior Run | Origin → Confluence → Gorge → Upriver → Inner Station | Deep river; food/medicine critical |

---

## Balance Constants

Key numbers governing game feel:

```
// Ship speeds (progress per tick, before resistance modifier)
canoe:                  0.25    (~4 ticks on a resistance-1.0 edge)
steamer:                0.18    (~6 ticks; 14 ticks on Inner Station edge)
barge:                  0.14    (~7 ticks) [was 0.10 before 2026-03-30]

// Ship build cost (resources + Company Revenue)
canoe:   5 food                     + ₪10 Revenue
steamer: 15 food, 8 ammo            + ₪30 Revenue
barge:   25 food, 10 rubber         + ₪60 Revenue

// Ship upkeep (food/tick drained from origin per active assigned ship)
canoe: 0.05    steamer: 0.15    barge: 0.25

// Morale deltas (per tick, flat)
foodMet:               +0.5    foodNotMet:     -1.5
medicineMet:           +0.3    medicineNotMet: -0.8
isExporting:           +0.2    notExporting:   -0.2
lowInstability(<30):   +0.1    highInstab(>55):-0.2

// Loyalty cascade
loyaltyDropThresh:      35      morale below this → loyalty -0.15/tick
loyaltyGainThresh:      65      morale above this → loyalty +0.15/tick

// Instability
instabilityRise:        0.5     when loyalty < 40
instabilityFall:        0.3     when loyalty ≥ 40

// Influence
influenceGain:          0.05    when loyalty > 70 AND morale > 60
influenceDrop:          0.08    when loyalty < 40

// Cargo loading
protectionBuffer:       40      ticks of own demand protected at source node
intermediateBuffer:     15      ticks of demand shipped to intermediate stops
                                (terminus receives everything) [was 30 before 2026-03-30]

// Edge control (per tick)
controlGainRate:        0.0125  max gain (75% slower than influence +0.05)
controlLossRate:        0.006   loss per unit of normalised maxInstability
breakEvenRatio:         ~2.08   maxInstability / avgInfluence above which control decays

// Demand rates — population-scaled, recalculated each tick (food + medicine only)
// Ammo is strategic — set per node, not population-driven
confluence:   food = pop × 0.020
outpost:      food = pop × 0.028    medicine = pop × 0.011
settlement:   food = pop × 0.028    medicine = pop × 0.011
chokepoint:   food = pop × 0.050    medicine = pop × 0.011  (military post premium)

// Gorge starting ammo: 60 [was 12 before 2026-04-13; /heft tick-10 cliff fix]
// Ammo demand: gorge 1.2/tick [raised from 0.4 on 2026-03-30], upriver 0.5/tick [added 2026-03-30]

// Origin production (per tick)
food: 40    medicine: 6    ammunition: 10
// medicine reduced 20→6 on 2026-04-13 (/heft: 11.2× surplus, was never scarce)

// Export convoy (rubber/ivory → Company Revenue)
convoyInterval:    60 ticks between departures from origin
convoyTransit:     40 ticks for revenue to arrive (ocean voyage + sale)
rubberValue:       ₪2 per unit     maxConvoyRubber: 80
ivoryValue:        ₪5 per unit     maxConvoyIvory:  40
```

---

## Implemented Features

- [x] River network graph with nodes and weighted edges
- [x] PixiJS WebGL renderer — edge glow, node circles, morale arcs
- [x] Click-and-drag map panning (world container, stopPropagation on clickables)
- [x] Overlay modes: Trade, Influence, Instability, Personnel
- [x] Ship system with full state machine (including waiting_berth)
- [x] Ping-pong route reversal (ships automatically reverse at terminus)
- [x] Proportional fair-share cargo loading weighted by downstream demand and priority
- [x] Partial unloading at intermediate stops (15-tick buffer); full unload at termini
- [x] recentlyUnloaded guard — ships do not reload goods they just delivered
- [x] Node supply buffer — ships cannot strip a node below its own 40-tick demand
- [x] Berth limits by population level; waiting_berth queue with purple ship icons
- [x] Trade route creation UI with one-way path builder and waypoint validation
- [x] Fleet panel: route management, ship assignment, cargo priorities, delete route
- [x] Ship building queue at Company Station
- [x] Population level system with stockpile caps and berth limits
- [x] 4-factor morale system (food, medicine, exports, instability) with flat deltas
- [x] Morale → Loyalty → Instability → Influence cascade
- [x] Officer stationing with military instability suppression
- [x] Edge control driven by endpoint node influence and instability (Option C formula)
- [x] Edge chokepoint markers
- [x] Flood state on edges (strands ships)
- [x] Ambush events on high-instability routes (0.5%/tick, 5–15% cargo loss)
- [x] Port corruption tax (skims delivery before stockpile; logistics officer reduces by 60%)
- [x] Native influence drift and random stockpile drain events
- [x] Days-of-supply readout in port panel (color-coded: red <10d, amber <25d, green)
- [x] WebGL memory management (destroyChildren before redraw, no ticker render)
- [x] Directional ship arrowheads — in-transit ships point toward their destination
- [x] Correct ship position on return legs (departure-node-anchored interpolation)
- [x] Inner Station node — remotest outpost, 14 ticks from Upriver Camp
- [x] Interior Run pre-defined route to Inner Station
- [x] Population-scaled demand (food + medicine recalculated from pop × rate each tick)
- [x] Ship upkeep — active ships consume food from origin per tick
- [x] Export convoy system — rubber/ivory at origin dispatched every 60 ticks; Revenue arrives 40 ticks later
- [x] Company Revenue — earned from export convoys; required (+ resources) to build new ships
- [x] Shipyard as standalone side panel (toolbar button), separated from Company Station click
- [x] HUD tooltips on resource totals and Revenue (per-port stockpile/net, convoys en route)
- [x] Convoy event toasts (departed/arrived) + Revenue counter pulse on arrival
- [x] Company Ledger on Company Station panel: treasury, lifetime earned, lifetime exports, export rate per 100t

### Planned

- [ ] Population growth, migration, and disease mechanics
- [ ] Win/loss conditions (extraction quota, collapse cascade)
- [ ] Full officer transfer UI
- [ ] Diplomatic influence propagation and rival factions
- [ ] Black market events on unprotected routes
- [ ] Weather system affecting resistance and flood chance
- [ ] Fog of war on uncontrolled routes
- [ ] Ceremonial events for morale/influence boosts

---

## Game Glossary

**Ambush**
A random event on river edges with instability > 70. An in-transit ship loses 15–35% of its cargo. Shown as an event note on the ship icon. Prevented by stationing military officers at destination nodes.

**Berth**
A loading/unloading slot at a port. The number of berths is determined by population level (2 at level 1 up to 20 at level 5). Ships that arrive at a full port enter the waiting_berth queue.

**Cargo Hold**
The internal storage of an individual ship. Loaded on departure, emptied on arrival. Capacity: Canoe 20, Steamer 60, Barge 120.

**Cargo Priority**
A per-resource setting on each Trade Route: High / Medium / Low / None. Controls the weighting used when loading cargo. Higher priority means a larger proportional share of the hold.

**Chokepoint**
A strategically critical river segment marked with a yellow diamond. High resistance, easy to defend. Losing control cuts supply to interior outposts.

**Company HQ**
The highest population level (150+). Refers to a fully developed settlement. The starting Company Station is the player's origin and is treated as a Company HQ.

**Company Station**
The player's headquarters node. Produces food, medicine, and ammunition each tick. The only node where ships can be built. All pre-defined routes begin here.

**Confluence**
A node where two or more river branches meet. Acts as a logistics hub — ships stop here, unload partial cargo, reload, and continue.

**Control**
An edge property (0.0–1.0) representing security and patrol coverage. Low control allows instability to grow. Rises slowly as the average influence of both endpoint nodes increases; decays when either endpoint has high instability. Max gain is +0.0125/tick — 75% slower than the node influence gain rate. A military officer at the destination node also suppresses instability, indirectly protecting control.

**Corruption Rate**
An edge property tracking the fraction of goods lost to theft and mismanagement. Rises with instability, falls with control. Tracked per edge; individual ship corruption events are planned.

**Demand**
The amount of each resource a node consumes per tick. Unmet food or medicine demand causes morale loss. Demand values are proportional to population size.

**Docked (Loading)**
Ship state. The ship is at a node filling its cargo hold. Takes 2 ticks. The ship will not reload any resource it just unloaded at this stop (recentlyUnloaded guard).

**Docked (Unloading)**
Ship state. The ship is transferring cargo into the node's stockpile. Takes 1 tick. Intermediate stops receive only a 30-tick demand buffer; termini receive all remaining cargo.

**Edge**
A river segment connecting two nodes. Has capacity, control, resistance, instability, corruption rate, and optional flood/chokepoint flags. Traversable in both directions.

**Event Note**
A brief text label on a ship icon indicating a notable event: ambush, stranding, flood blockage, or missing route connection.

**Exporting**
A node condition where its produced resources are being picked up by ships — stockpile for at least one produced resource is below 75% of cap. Contributes +0.2 morale/tick. Nodes without production are always neutral on this factor.

**Fleet**
All ships owned by the player. Managed in the Fleet panel. New ships are built at Company Station.

**Fleet Panel**
The UI panel (opened via the toolbar) for managing all trade routes and ships. Shows cargo priorities, ship assignments, throughput per route, and the build queue.

**Flood**
A temporary edge state that strands any ship currently traversing that segment. Ships recover when the flood clears. Displayed as ⚠ FLOODED on the edge.

**Fort**
Population level 4 (100–149 population). Higher stockpile cap and berth limit than a Station.

**Hamlet**
Population level 1 (< 25 people). Smallest settlement type; minimal storage capacity and berths.

**In Transit**
Ship state. The ship is moving along a river edge toward its next destination. Rendered as a directional arrowhead pointing toward the destination. Progress is 0.0–1.0; speed = `SHIP_SPEED[type] / edge.resistance`. Position is anchored to the actual departure node so the ship correctly moves in both outbound and return directions.

**Influence**
A per-node stat (0–100) representing Company authority. Rises very slowly when loyalty is high and morale is healthy (+0.05/tick). Falls when loyalty is low (−0.08/tick). Operates on a strategic timescale. Distinct from military control.

**Inner Station**
The remotest outpost on the map. Population 30. Located 14 steamer-ticks past Upriver Camp via a high-resistance, low-control passage (resistance 2.52). Produces ivory. Served by the Interior Run route.

**Instability**
A per-node and per-edge stat (0–100). High node instability suppresses morale (−0.2/tick above 55). High edge instability increases ambush risk. Driven by low loyalty and insufficient military presence.

**Level**
A 1–5 classification of a node based on its population. Determines stockpile cap, berth limit, and display name. See Population Level System.

**Loyalty**
A per-node stat (0–100). Erodes slowly when morale is below 35; recovers slowly when morale is above 65. When loyalty drops below 40, instability begins rising. Represents the workforce's allegiance to the Company.

**Morale**
A per-node stat (0–100) driven by four concrete logistics factors: food supply met, medicine supply met, produced goods being exported, and low instability. Checked as flat per-tick deltas. Drives loyalty over time. There is no separate Morale Goods resource — morale is a direct outcome of your supply chain.

**Node**
Any named location on the river map. Has population, stockpile, production, demand, morale, loyalty, instability, and influence.

**Officer**
A named personnel unit with a role (Logistics, Military, Diplomatic, Medical). Stationed at nodes or in transit. Military officers stationed at a node reduce instability on its incoming edges.

**Origin**
See Company Station.

**Outpost**
Population level 2 (25–49 people), or the generic term for any remote Company settlement on the map.

**Overlay Mode**
A map view toggle in the toolbar. Options: Trade, Influence, Instability, Personnel. Recolors edges and nodes to highlight different aspects of the logistics network.

**Partial Unloading**
The rule that ships at intermediate stops (not termini) unload only enough cargo to bring a node's stockpile up to a 30-tick demand buffer. Remaining cargo is kept for downstream delivery. This ensures goods reach remote posts like Upriver Camp and Inner Station.

**Ping-Pong Route**
The automatic behavior of ships at a route terminus — they reverse direction and begin the return journey. The player defines only the one-way path; reversal is handled by the ship's `routeDirection` property (+1 or −1).

**Production**
The amount of each resource a node generates per tick, added to its stockpile. Company Station produces food, medicine, and ammunition. Outposts produce rubber and ivory.

**recentlyUnloaded**
An internal ship flag set for each resource unloaded at a port stop. Prevents the ship from immediately reloading goods it just delivered at the same stop. Cleared when the ship departs.

**Resistance**
An edge property (≥ 1.0). Divides ship speed, extending travel time. Formula: `ticks = resistance / SHIP_SPEED[type]`. For example, the Inner Station edge (resistance 2.52) takes exactly 14 ticks for a steamer.

**Route**
See Trade Route.

**Route Direction**
An internal ship property (+1 or −1). Tracks whether the ship is heading toward the route terminus (+1) or back toward the origin (−1). Flips automatically at either end of the path.

**Ship**
An individual vessel assigned to a Trade Route. A real agent on the map with its own position, cargo, state, and event history. Rendered as a directional arrowhead when in transit, a diamond when docked. Clickable to open the Ship panel.

**Shipyard**
The ship-building interface shown when Company Station is selected. Allows commissioning new ships at a resource cost and build time.

**Station**
Population level 3 (50–99 people). Mid-tier settlement.

**Stockpile**
A node's current inventory of resources. Ships deposit cargo here; demand consumes from it each tick; production replenishes it. Capped at the population-level storage limit.

**Stockpile Cap**
The maximum units of any single resource a node can store, based on population level. Prevents over-accumulation and ensures larger settlements can buffer more supply.

**Stranded**
Ship state. The ship cannot proceed due to flood or a missing edge connection. Recovers automatically when the blocking condition resolves.

**Supply Buffer**
Each node retains a protected reserve equal to 40 ticks of its own demand. Ships cannot take goods below this threshold, preventing them from stripping a just-resupplied outpost on the return leg.

**Terminus**
The last node in a trade route's one-way path. Ships arriving here receive all remaining cargo (not partial unloading) and then reverse direction for the return journey.

**Throughput**
Total goods delivered by a route in the last tick. Displayed in the Fleet panel. Indicates whether a route is actively contributing to the supply network.

**Trade Route**
A named, ordered sequence of nodes. Defines cargo priorities and fleet assignments. Ships travel the path forward then reverse at the terminus (ping-pong). Created and managed in the Fleet panel.

**Unassigned**
Ship state. The ship is idle at Company Station. Assign it to a route from the Fleet or Ship panel.

**Unmet Demand**
When a node's stockpile of food or medicine is below its demand for that tick. Causes morale damage (food: −1.5/tick, medicine: −0.8/tick). The primary signal that a route is understaffed or disrupted.

**Waiting Berth**
Ship state. The ship has arrived at a port but all berths are occupied. Rendered in purple. The ship queues and is admitted as soon as a berth frees up.

**Waypoint**
A node in a trade route's path. Added one at a time in the route creation form — only nodes reachable from the last waypoint are selectable.
