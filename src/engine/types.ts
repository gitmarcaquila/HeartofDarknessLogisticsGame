// ─── Resource Types ───────────────────────────────────────────────────────────

export type ResourceType = 'food' | 'medicine' | 'rubber' | 'ivory' | 'ammunition'

export const RESOURCE_TYPES: ResourceType[] = ['food', 'medicine', 'rubber', 'ivory', 'ammunition']

export type ResourceStock = Record<ResourceType, number>

export const EMPTY_STOCK = (): ResourceStock => ({
  food: 0, medicine: 0, rubber: 0, ivory: 0, ammunition: 0,
})

// ─── Personnel ────────────────────────────────────────────────────────────────

export type OfficerRole = 'logistics' | 'military' | 'diplomatic' | 'medical'
export type OfficerState = 'stationed' | 'in_transit' | 'sick' | 'defected'

export interface Officer {
  id: string
  name: string
  role: OfficerRole
  morale: number
  loyalty: number
  state: OfficerState
  locationId: string
  destinationId?: string
  transitTicksRemaining?: number
}

// ─── River Graph ──────────────────────────────────────────────────────────────

export type NodeType = 'outpost' | 'settlement' | 'chokepoint' | 'confluence' | 'origin'

export interface RiverNode {
  id: string
  name: string
  type: NodeType
  position: { x: number; y: number }
  production: ResourceStock
  demand: ResourceStock
  stockpile: ResourceStock
  population: number
  officers: string[]
  morale: number
  loyalty: number
  instability: number
  influence: number
  isCapital?: boolean
  // Port-level corruption: fraction of each delivery skimmed before entering stockpile.
  // Reduced by a stationed logistics officer. Boosted by nativeInfluence.
  corruptionRate: number
  // Competing local authority (0–100). Higher = more corruption drag, slower loyalty gain,
  // faster instability. Drifts toward Company influence slowly over time.
  nativeInfluence: number
  // Flavour name of the local faction (undefined = no active native presence)
  nativeFactionName?: string
}

export type FlowDirection = 'downstream' | 'upstream' | 'bidirectional'

export interface RiverEdge {
  id: string
  fromId: string
  toId: string
  capacity: number
  control: number
  resistance: number
  instability: number
  flowDirection: FlowDirection
  currentFlow: ResourceStock
  corruptionRate: number
  isChokepoint?: boolean
  isFlooded?: boolean
  floodTicksRemaining?: number
}

// ─── Ships ────────────────────────────────────────────────────────────────────

export type ShipType = 'canoe' | 'steamer' | 'barge'

export type ShipState =
  | 'unassigned'
  | 'waiting_berth'     // arrived but port is full — queued outside
  | 'docked_loading'
  | 'docked_unloading'
  | 'in_transit'
  | 'stranded'
  | 'damaged'
  | 'captured'

export const SHIP_CAPACITY: Record<ShipType, number> = {
  canoe: 20,
  steamer: 60,
  barge: 120,
}

// Progress per tick along an edge (modified by edge resistance)
// BALANCE HISTORY: barge was 0.10 before 2026-03-30 (too slow for interior run;
// 120-unit hold never compensated for the extra time over a steamer)
export const SHIP_SPEED: Record<ShipType, number> = {
  canoe: 0.25,
  steamer: 0.18,
  barge: 0.14,
}

export const SHIP_BUILD_TICKS: Record<ShipType, number> = {
  canoe: 3,
  steamer: 8,
  barge: 15,
}

export const SHIP_BUILD_COST: Record<ShipType, Partial<ResourceStock>> = {
  canoe:   { food: 5 },
  steamer: { food: 15, ammunition: 8 },
  barge:   { food: 25, rubber: 10 },
}

export type CargoPriority = 'high' | 'medium' | 'low' | 'none'

export interface Ship {
  id: string
  name: string
  type: ShipType
  state: ShipState
  // Position
  locationNodeId: string       // node the ship is at or last departed from
  currentEdgeId?: string       // edge being traversed (in_transit only)
  edgeProgress: number         // 0–1 along current edge
  // Route
  assignedRouteId?: string
  routeNodeIndex: number       // index in nodePath of current destination
  routeDirection: 1 | -1      // ping-pong: +1 = toward end, -1 = toward start
  // Cargo
  cargo: ResourceStock
  capacity: number
  // Timing
  dockedTicksRemaining: number
  // Tracks which resources were unloaded at the current stop so the ship
  // doesn't immediately reload the same goods it just delivered.
  recentlyUnloaded: Partial<Record<ResourceType, true>>
  // Events
  eventNote?: string
}

// ─── Population level helpers ─────────────────────────────────────────────────

export function getPopulationLevel(population: number): number {
  if (population < 25)  return 1
  if (population < 50)  return 2
  if (population < 100) return 3
  if (population < 150) return 4
  return 5
}

export const LEVEL_NAMES: Record<number, string> = {
  1: 'Hamlet',
  2: 'Outpost',
  3: 'Station',
  4: 'Fort',
  5: 'Company HQ',
}

// Max units storable per resource — scales with population level
export function getStockpileCap(population: number): number {
  return [0, 80, 160, 300, 480, 700][getPopulationLevel(population)]
}

// Max ships that can be loading OR unloading simultaneously at a node
export function getBerthLimit(population: number): number {
  return [0, 2, 4, 8, 14, 20][getPopulationLevel(population)]
}

// ─── Trade Routes ─────────────────────────────────────────────────────────────

export interface TradeRoute {
  id: string
  name: string
  // Explicit loop: ['origin','confluence','leopoldville','confluence'] repeats from index 0
  nodePath: string[]
  shipIds: string[]
  cargoPriorities: Partial<Record<ResourceType, CargoPriority>>
  lastTickThroughput: ResourceStock
}

// ─── Build Queue ──────────────────────────────────────────────────────────────

export interface BuildOrder {
  id: string
  shipType: ShipType
  shipName: string
  ticksRemaining: number
  totalTicks: number
}

// ─── Company Revenue & Export Convoys ─────────────────────────────────────────

// A convoy dispatched from origin carrying rubber/ivory to market.
// Revenue arrives after EXPORT_CONVOY_TRANSIT_TICKS.
export interface ConvoyOrder {
  id: string
  rubber: number
  ivory: number
  revenueDue: number
  ticksRemaining: number
}

// Revenue cost (Company Revenue currency) to commission a new ship
export const SHIP_REVENUE_COST: Record<ShipType, number> = {
  canoe:   10,
  steamer: 30,
  barge:   60,
}

// Food consumed per active (non-unassigned) ship per tick — drained from origin
export const SHIP_UPKEEP_FOOD: Record<ShipType, number> = {
  canoe:   0.05,
  steamer: 0.15,
  barge:   0.25,
}

// Base demand rates (per population per tick) — food + medicine only.
// Ammo demand is strategically set per node (not population-driven).
// Origin is excluded — it produces rather than demands.
export const DEMAND_RATE_PER_POP: Partial<Record<NodeType, Partial<ResourceStock>>> = {
  confluence: { food: 0.020 },
  outpost:    { food: 0.028, medicine: 0.011 },
  settlement: { food: 0.028, medicine: 0.011 },
  chokepoint: { food: 0.050, medicine: 0.011 }, // military post — elevated food premium
}

// Export convoy timing and values
export const EXPORT_CONVOY_INTERVAL      = 60  // ticks between convoy departures
export const EXPORT_CONVOY_TRANSIT_TICKS = 40  // ticks for a convoy to return with Revenue
export const RUBBER_REVENUE_VALUE        = 2   // Revenue per unit of rubber exported
export const IVORY_REVENUE_VALUE         = 5   // Revenue per unit of ivory exported
export const MAX_CONVOY_RUBBER           = 80  // max rubber loaded per convoy
export const MAX_CONVOY_IVORY            = 40  // max ivory loaded per convoy

// ─── Game State ───────────────────────────────────────────────────────────────

export type OverlayMode = 'trade' | 'influence' | 'instability' | 'personnel'
export type GameSpeed = 0 | 1 | 2 | 3

// ─── Economic Events ──────────────────────────────────────────────────────────

export type EconomicEventType = 'convoy_departed' | 'convoy_arrived'

export interface EconomicEvent {
  id: string
  type: EconomicEventType
  tick: number
  rubber: number
  ivory: number
  revenue: number
}

export interface GameState {
  tick: number
  speed: GameSpeed
  nodes: Record<string, RiverNode>
  edges: Record<string, RiverEdge>
  officers: Record<string, Officer>
  ships: Record<string, Ship>
  routes: Record<string, TradeRoute>
  buildQueue: BuildOrder[]
  // Company Revenue — earned from export convoys; spent on new ships
  companyRevenue: number
  // Convoys currently en route to market; arrive with Revenue after transit
  pendingConvoys: ConvoyOrder[]
  // Lifetime ledger — totals since game start (do not decay when Revenue is spent)
  totalRubberExported: number
  totalIvoryExported: number
  lifetimeRevenueEarned: number
  // Rolling event log — last ~20 economic events for HUD toasts + ledger history
  economicEvents: EconomicEvent[]
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedShipId: string | null
  overlayMode: OverlayMode
}
