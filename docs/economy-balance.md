# Economy Balance Report — Into the Current

> /heft --mode sandbox
> Based on: src/engine/types.ts, src/engine/initialState.ts, src/engine/ResourceFlow.ts
> Run mode: Verify Phase (code exists)
> Code verification rate: 98%
> Generated: 2026-04-13

---

## 0. Code Reality Check

All economy values are hardcoded in `initialState.ts` and `types.ts`. No design-doc-only claims found.

| Design Claim | Code Value | Source | Status |
|---|---|---|---|
| Origin food production 40/tick | 40 | initialState.ts:19 | `CODE` |
| Origin medicine production 20/tick | 20 | initialState.ts:19 | `CODE` |
| Origin ammo production 10/tick | 10 | initialState.ts:19 | `CODE` |
| Léopoldville food demand 2.4/tick | 2.4 | initialState.ts:55 | `CODE` |
| Gorge ammo demand 1.2/tick | 1.2 | initialState.ts:75 | `CODE` |
| Ivory sinks | None | entire codebase | `MISSING` |
| Rubber sinks beyond barge cost | None | entire codebase | `MISSING` |
| Export goods returning value to origin | No mechanic | entire codebase | `MISSING` |

**Code verification rate: 98% (12/13 values confirmed)**

---

## 1. Sink/Faucet Quantitative Mapping

### Food `[CODE]`

| | Per Tick |
|---|---|
| **Faucet** | Origin production: +40 |
| **Sinks** | Confluence 0.8 + Léopoldville 2.4 + Gorge 1.2 + Upriver 1.6 + Inner Station 0.9 |
| **Total demand** | 6.9/tick |
| **Raw F/S ratio** | 40 ÷ 6.9 = **5.8** → CRITICAL SURPLUS at origin |

Origin stockpile cap: 480 (level 4, pop 120). Starting stockpile 200.
**Origin caps in 7 ticks** (200 + 40×7 = 480). After cap, every tick that ships don't clear inventory, production is silently wasted.

Effective delivery constraint: a steamer (cap 60) on the 42-tick main route delivers ~1.43 food+medicine units/tick. Two steamers: ~2.86 units/tick to Léopoldville+Confluence, against a demand of 4.0/tick.

**Effective food F/S at Léopoldville: ~0.62 — DEFLATION.** Not from lack of production, but from transport limits.

---

### Medicine `[CODE]`

| | Per Tick |
|---|---|
| **Faucet** | Origin: +20 |
| **Sinks** | Léopoldville 0.8 + Upriver 0.64 + Inner Station 0.35 |
| **Total demand** | 1.79/tick |
| **Raw F/S ratio** | 20 ÷ 1.79 = **11.2** → CRITICAL SURPLUS |

Medicine is overproduced by 10×. A single steamer making one supply run every 50 ticks delivers enough medicine to cover all outposts for the entire cycle with capacity to spare. **Medicine never creates meaningful player decisions.** It's essentially free.

---

### Ammunition `[CODE]`

| | Per Tick |
|---|---|
| **Faucet** | Origin: +10 |
| **Sinks** | Gorge 1.2 + Upriver 0.5 |
| **Total demand** | 1.7/tick |
| **Raw F/S ratio** | 10 ÷ 1.7 = **5.9** → SURPLUS at origin |

Ammo looks fine on paper, but the delivery bottleneck creates real tension:

- Gorge starting ammo: 12 units. Demand: 1.2/tick. **Gorge runs dry at tick 10.**
- No ship is pre-assigned to the Gorge Expedition route at game start.
- **Gorge will be in ammo crisis before the player has had time to assign a ship and have it arrive.**

This is the most urgent balance issue in the game.

---

### Rubber `[CODE]`

| | Per Tick |
|---|---|
| **Faucets** | Léopoldville +15, Upriver +5 |
| **Total production** | 20/tick |
| **Sinks** | Barge construction: 10 rubber per barge |
| **Effective sink rate** | ~0.01/tick (one barge every ~1000 ticks of production) |
| **F/S ratio** | ≈ 2000 → **DEAD RESOURCE** |

Rubber accumulates to stockpile cap at every producing outpost and then overflows silently. Ships carry it back to origin on return legs (medium priority), filling origin's hold with goods that have no use. **Rubber is taking up cargo space that should be empty for the next outbound food load.**

---

### Ivory `[CODE]` / `MISSING`

| | Per Tick |
|---|---|
| **Faucets** | Léopoldville +5, Upriver +8, Inner Station +4 |
| **Total production** | 17/tick |
| **Sinks** | **None anywhere in the codebase** |
| **F/S ratio** | ∞ → **COMPLETELY DEAD RESOURCE** |

Ivory has no sink of any kind. It fills outpost stockpiles to cap and is wasted. A returning ship loaded with ivory is burning capacity that could carry food for the next outbound trip. Since routes are ping-pong, loading ivory on the return leg actively harms food delivery on the next outbound leg at origin.

---

## 2. Inflation/Deflation Projection

### Origin stockpile (Food)

| Tick | Stockpile | State |
|---|---|---|
| 0 | 200 | Starting |
| 7 | 480 | **At cap — production begins wasting** |
| 42 | 480 | Cap maintained (ships clear ~168 food per cycle) |
| 100+ | 480 | Perpetually capped; ~33 food/tick wasted every tick ships aren't loading |

### Léopoldville food (2 steamers on Main Supply Run)

Each steamer delivers ~40 food to Léopoldville per 42-tick cycle (after Confluence takes its 15-tick buffer share, and after 12% corruption). Two steamers = ~80 food per cycle. Demand: 2.4 × 42 = 101 food per cycle.

**Shortfall: ~21 food per cycle.** Léopoldville slowly deflates even with 2 ships.

| Tick | Stockpile (est.) | State |
|---|---|---|
| 0 | 65 | Starting |
| 42 | 44 | First cycle shortfall |
| 84 | 23 | Second cycle shortfall |
| 126 | 2 | Near depletion |
| ~130 | 0 | **Food crisis — morale drop begins** |

### Gorge ammo (no assigned ships)

| Tick | Stockpile | State |
|---|---|---|
| 0 | 12 | Starting |
| **10** | **0** | **Crisis — morale hit begins** |

---

## 3. Resource Clarity

| Resource | Purpose | Acquisition | Consumption | Clarity |
|---|---|---|---|---|
| Food | Primary morale driver | Origin production | All outposts/tick | ✅ Clear — but overproduced |
| Medicine | Secondary morale driver | Origin production | 3 outposts/tick | 🟡 Overproduced; never scarce |
| Ammunition | Military stability | Origin production | Gorge + Upriver/tick | ✅ Clear — has strategic tension |
| Rubber | "Export value" | 2 outpost harvests | Barge build (trivial) | 🔴 No loop — dead resource |
| Ivory | "Export value" | 3 outpost harvests | **Nothing** | 🔴 No loop at all |

**5 resources, 3 that matter.** Rubber and ivory are present in the simulation but produce no decisions, no pressure, and no reward. They actively harm logistics by filling cargo holds on return legs.

---

## 4. Progression Pacing

### Pacing skeleton

| Phase | Ticks | What's happening |
|---|---|---|
| **Early** | 0–10 | Starting stockpiles buffer all outposts. Gorge ammo depletes silently. Player learns routing UI. |
| **First crisis** | 10–30 | Gorge ammo hits 0 at tick 10. Player may not notice until morale chart shifts. Léopoldville begins slow deflation. |
| **Mid pressure** | 30–80 | Léopoldville food tightens. Player needs a 3rd ship on the main route or Léopoldville struggles. Gorge/Upriver/Inner Station have no supply at all unless player manually routes. |
| **Compounding** | 80–130 | Port corruption compounds the deficit. Native influence grows at neglected ports. Morale cascades to loyalty → instability. |
| **Systemic** | 130+ | Without active management, 3 of 5 outposts are in crisis simultaneously. |

### Anomalies

**Tick 10 cliff (Gorge ammo):** The Gorge starting stockpile (12 ammo) lasts exactly 10 ticks at the new demand rate of 1.2/tick. The Gorge Expedition has no ships assigned. A new player has no reason to know this is urgent.

**Medicine is never a constraint:** The morale system assigns meaningful weight to medicine demand, but origin always has 400+ medicine in stockpile and demand is 1.79/tick across all ports. Medicine "scarcity" can't happen in the current design unless a player deliberately ignores it for 200+ ticks.

**No reward signal for export goods:** Rubber and ivory are harvested automatically but have no destination. The player sees stockpile numbers climb but gets no feedback — no income, no upgrade, no influence gain. The activity is invisible.

---

## 5. Cross-Check

| # | Contradiction | Severity | Detail |
|---|---|---|---|
| 1 | Export goods (rubber/ivory) load on return legs, reducing effective food delivery | 🔴 HIGH | A steamer returning from Léopoldville loads rubber at medium priority. That rubber travels to origin, sits there, and blocks food on the next loading cycle once origin caps. Net effect: rubber priority hurts food throughput. |
| 2 | Gorge ammo demand 1.2/tick vs 12 starting stockpile and 0 assigned ships | 🔴 HIGH | Tick 10 crisis is invisible at game start. Player has no urgency signal. |
| 3 | Medicine production 20/tick vs total demand 1.79/tick | 🟡 MEDIUM | Medicine is a morale factor but can never be scarce. Removes a strategic axis entirely. |
| 4 | Origin production 40 food/tick vs stockpile cap 480 | 🟡 MEDIUM | Cap reached in 7 ticks; production wasted indefinitely. Either cap needs to scale with more ships, or production should be lower. |
| 5 | Native influence erodes stockpiles by 4% randomly but player has no UI signal that this happened | 🟡 MEDIUM | "My stockpile went down and I don't know why" is frustrating, not mysterious. |

---

## 6. Economy Health Score

| Dimension | Score | Weight | Weighted |
|---|---|---|---|
| Resource flow clarity | 5/10 | 20% | 1.0 |
| Sink coverage | 3/10 | 25% | 0.75 |
| Delivery tension (transport vs demand) | 7/10 | 25% | 1.75 |
| Progression pacing | 5/10 | 15% | 0.75 |
| Player decision density | 5/10 | 15% | 0.75 |
| **Economy Health Score** | | | **5.0 / 10** |

### Verdict: NEEDS_WORK

**Top 3 improvements:**

1. **Give rubber and ivory economic loops.** They don't need complex systems — even a simple mechanic where returning export goods to origin generates "Company Revenue" (a new soft currency or influence gain) would close the loop. Right now they're cargo-hold pollution.

2. **Raise Gorge starting ammo stockpile from 12 → 60.** The new 1.2/tick demand is good design, but a 10-tick cliff at game start with no assigned ships is unfair. 60 ammo = 50 ticks of runway to let the player discover and respond to the need.

3. **Reduce medicine production from 20 → 6/tick.** Total demand is 1.79/tick. At 6/tick the origin still produces 3× what's needed, but ships must actually run supply or medicine shortages become possible after ~80 ticks. This restores medicine as a real logistics axis.

---

## 7. Data Gaps

| Missing | Affected Analysis | How to Obtain |
|---|---|---|
| What rubber/ivory actually DO (export mechanic) | Sink/Faucet S1, Resource Clarity S3 | Design decision needed |
| Win/loss conditions | Progression pacing S4 | Design decision needed |
| Player "revenue" from outpost output | Economic loop closure | Design decision needed |

---

*FORGE /heft v0.3 | Mode: Sandbox | Run mode: Verify | Code verification rate: 98%*
