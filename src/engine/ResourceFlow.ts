import {
  GameState, RiverEdge, RiverNode, Ship, TradeRoute,
  ResourceType, ResourceStock,
  RESOURCE_TYPES, EMPTY_STOCK, SHIP_CAPACITY, SHIP_SPEED,
  SHIP_BUILD_TICKS, CargoPriority, BuildOrder, getStockpileCap, getBerthLimit,
} from './types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findEdgeBetween(state: GameState, fromId: string, toId: string): RiverEdge | undefined {
  return Object.values(state.edges).find(e =>
    (e.fromId === fromId && e.toId === toId) ||
    (e.fromId === toId && e.toId === fromId && e.flowDirection !== 'downstream')
  )
}

let _shipCounter = 100
function nextShipId(): string { return `ship_${++_shipCounter}` }
let _buildCounter = 0
function nextBuildId(): string { return `build_${++_buildCounter}` }

// ─── Ship cargo loading ───────────────────────────────────────────────────────

// Priority → capacity weight. Higher weight = larger share of the hold.
const PRIORITY_WEIGHT: Record<CargoPriority, number> = {
  high: 2.0, medium: 1.0, low: 0.4, none: 0,
}

function loadShipCargo(ship: Ship, sourceNode: RiverNode, route: TradeRoute, state: GameState): void {
  const priorities = route.cargoPriorities

  // Sum demand per tick at OTHER stops on this route (never count the current node —
  // the ship should not treat its current port as a destination to supply).
  const upcomingDemand: ResourceStock = EMPTY_STOCK()
  const otherStops = [...new Set(route.nodePath)].filter(id => id !== sourceNode.id)
  for (const nodeId of otherStops) {
    const n = state.nodes[nodeId]
    if (n) for (const r of RESOURCE_TYPES) upcomingDemand[r] += n.demand[r]
  }

  // Compute a weighted demand score per resource.
  let totalWeight = 0
  const weights: Partial<Record<ResourceType, number>> = {}
  for (const r of RESOURCE_TYPES) {
    const p = priorities[r] ?? 'medium'
    if (p === 'none') continue
    const w = Math.max(upcomingDemand[r], 0.1) * PRIORITY_WEIGHT[p]
    weights[r] = w
    totalWeight += w
  }
  if (totalWeight === 0) return

  // Each node protects its own supply: only take goods that exceed a 40-tick buffer.
  // Origin has no demand so its full stockpile is always available.
  // This prevents ships from stripping a just-supplied outpost on the return leg.
  const surplus = (r: ResourceType) =>
    Math.max(0, sourceNode.stockpile[r] - sourceNode.demand[r] * 40)

  // First pass: allocate a proportional fair share to each resource
  let used = RESOURCE_TYPES.reduce((s, r) => s + ship.cargo[r], 0)
  for (const r of RESOURCE_TYPES) {
    const w = weights[r]
    if (!w) continue
    if (ship.recentlyUnloaded[r]) continue  // don't reload goods just delivered
    const fairShare = Math.ceil(ship.capacity * (w / totalWeight))
    const space     = ship.capacity - used
    if (space <= 0) break
    const load = Math.min(surplus(r), space, fairShare)
    if (load > 0) {
      ship.cargo[r]            += load
      sourceNode.stockpile[r]  -= load
      used                     += load
    }
  }

  // Second pass: fill leftover space with high-priority surplus goods
  for (const r of RESOURCE_TYPES) {
    const p = priorities[r] ?? 'medium'
    if (p !== 'high') continue
    if (ship.recentlyUnloaded[r]) continue  // don't reload goods just delivered
    const space = ship.capacity - used
    if (space <= 0) break
    const load = Math.min(surplus(r), space)
    if (load > 0) {
      ship.cargo[r]            += load
      sourceNode.stockpile[r]  -= load
      used                     += load
    }
  }
}

// ─── Ship state machine ───────────────────────────────────────────────────────

function tickTransit(ship: Ship, route: TradeRoute, state: GameState): void {
  // Get or acquire current edge
  if (!ship.currentEdgeId) {
    const nextNodeId = route.nodePath[ship.routeNodeIndex]
    const edge = findEdgeBetween(state, ship.locationNodeId, nextNodeId)
    if (!edge) {
      ship.state = 'stranded'
      ship.eventNote = `No navigable route to ${nextNodeId}`
      return
    }
    ship.currentEdgeId = edge.id
    ship.edgeProgress = 0
  }

  const edge = state.edges[ship.currentEdgeId]
  if (!edge) return

  // Flooded route — strand the ship
  if (edge.isFlooded) {
    ship.state = 'stranded'
    ship.eventNote = 'Route flooded'
    return
  }

  // Advance progress
  const speed = SHIP_SPEED[ship.type] / Math.max(0.5, edge.resistance)
  ship.edgeProgress += speed

  // Random ambush on unstable routes
  if (edge.instability > 70 && Math.random() < 0.015) {
    const lostFraction = 0.15 + Math.random() * 0.20
    for (const r of RESOURCE_TYPES) {
      const lost = Math.floor(ship.cargo[r] * lostFraction)
      ship.cargo[r] = Math.max(0, ship.cargo[r] - lost)
    }
    ship.eventNote = 'Ambushed — cargo stolen'
  }

  // Arrived at next node
  if (ship.edgeProgress >= 1) {
    const arrivedIndex  = ship.routeNodeIndex
    const arrivedNodeId = route.nodePath[arrivedIndex]
    ship.locationNodeId = arrivedNodeId
    ship.currentEdgeId  = undefined
    ship.edgeProgress   = 0

    // Ping-pong: flip direction at the termini (first or last node)
    const tentative = arrivedIndex + ship.routeDirection
    if (tentative < 0 || tentative >= route.nodePath.length) {
      ship.routeDirection = (ship.routeDirection * -1) as 1 | -1
    }
    ship.routeNodeIndex = arrivedIndex + ship.routeDirection

    // Check berth availability before docking
    const arrivedNode  = state.nodes[arrivedNodeId]
    const berthsInUse  = arrivedNode
      ? Object.values(state.ships).filter(
          s => s.id !== ship.id &&
               s.locationNodeId === arrivedNodeId &&
               (s.state === 'docked_loading' || s.state === 'docked_unloading' || s.state === 'waiting_berth')
        ).length
      : 0
    const berthLimit = arrivedNode ? getBerthLimit(arrivedNode.population) : 2

    if (berthsInUse >= berthLimit) {
      ship.state     = 'waiting_berth'
      ship.eventNote = `Waiting for berth at ${arrivedNode?.name ?? arrivedNodeId}`
    } else {
      ship.state                = 'docked_unloading'
      ship.dockedTicksRemaining = 1
      if (ship.eventNote !== 'Ambushed — cargo stolen') ship.eventNote = undefined
    }
  }
}

function tickUnloading(ship: Ship, route: TradeRoute, state: GameState): void {
  ship.dockedTicksRemaining--
  if (ship.dockedTicksRemaining > 0) return

  const node = state.nodes[ship.locationNodeId]
  if (node) {
    const cap = getStockpileCap(node.population)

    // Termini (origin and the far end of the route) receive everything.
    // Intermediate stops only receive what they need to maintain a ~30-tick buffer —
    // the rest stays on board for downstream delivery.
    const isTerminus =
      ship.locationNodeId === route.nodePath[0] ||
      ship.locationNodeId === route.nodePath[route.nodePath.length - 1]

    for (const r of RESOURCE_TYPES) {
      if (ship.cargo[r] <= 0) continue
      let toUnload: number
      if (isTerminus) {
        toUnload = Math.min(ship.cargo[r], cap - node.stockpile[r])
      } else {
        const bufferTarget = Math.min(cap, node.demand[r] * 30)
        const need = Math.max(0, bufferTarget - node.stockpile[r])
        toUnload = Math.min(ship.cargo[r], need)
      }
      toUnload = Math.max(0, toUnload)
      if (toUnload > 0) {
        node.stockpile[r]                  += toUnload
        ship.cargo[r]                      -= toUnload
        route.lastTickThroughput[r]        += toUnload
        ship.recentlyUnloaded[r]            = true   // block reloading same good
      }
    }
  }

  ship.state = 'docked_loading'
  ship.dockedTicksRemaining = 2
}

function tickLoading(ship: Ship, route: TradeRoute, state: GameState): void {
  ship.dockedTicksRemaining--
  if (ship.dockedTicksRemaining > 0) return

  const node = state.nodes[ship.locationNodeId]
  if (node) {
    loadShipCargo(ship, node, route, state)
  }

  // Clear the recently-unloaded guard — the ship is departing this port
  ship.recentlyUnloaded = {}

  // Find edge to next waypoint and depart
  const nextNodeId = route.nodePath[ship.routeNodeIndex]
  if (nextNodeId === ship.locationNodeId) {
    // Same node (shouldn't happen with valid routes), advance index
    ship.routeNodeIndex = (ship.routeNodeIndex + 1) % route.nodePath.length
  }
  const edge = findEdgeBetween(state, ship.locationNodeId, route.nodePath[ship.routeNodeIndex])
  if (edge) {
    ship.currentEdgeId = edge.id
    ship.edgeProgress = 0
    ship.state = 'in_transit'
  } else {
    ship.state = 'stranded'
    ship.eventNote = `No route to ${route.nodePath[ship.routeNodeIndex]}`
  }
}

// ─── Berth queue ──────────────────────────────────────────────────────────────

function tickWaitingBerths(state: GameState): void {
  // Group waiting ships by node
  const waitingByNode: Record<string, Ship[]> = {}
  for (const ship of Object.values(state.ships)) {
    if (ship.state !== 'waiting_berth') continue
    if (!waitingByNode[ship.locationNodeId]) waitingByNode[ship.locationNodeId] = []
    waitingByNode[ship.locationNodeId].push(ship)
  }

  for (const [nodeId, waiting] of Object.entries(waitingByNode)) {
    const node = state.nodes[nodeId]
    if (!node) continue
    const limit = getBerthLimit(node.population)

    const occupied = Object.values(state.ships).filter(
      s => s.locationNodeId === nodeId &&
           (s.state === 'docked_loading' || s.state === 'docked_unloading')
    ).length

    let free = limit - occupied
    for (const ship of waiting) {
      if (free <= 0) break
      ship.state                = 'docked_unloading'
      ship.dockedTicksRemaining = 1
      ship.eventNote            = undefined
      free--
    }
  }
}

// ─── Build queue ──────────────────────────────────────────────────────────────

export function tickBuildQueue(state: GameState): void {
  for (let i = state.buildQueue.length - 1; i >= 0; i--) {
    const order = state.buildQueue[i]
    order.ticksRemaining--
    if (order.ticksRemaining <= 0) {
      state.ships[order.id] = {
        id: order.id,
        name: order.shipName,
        type: order.shipType,
        state: 'unassigned',
        locationNodeId: 'origin',
        edgeProgress: 0,
        routeNodeIndex: 0,
        routeDirection: 1,
        cargo: EMPTY_STOCK(),
        capacity: SHIP_CAPACITY[order.shipType],
        dockedTicksRemaining: 0,
        recentlyUnloaded: {},
      }
      state.buildQueue.splice(i, 1)
    }
  }
}

// ─── Instability & morale ─────────────────────────────────────────────────────

function tickInstability(state: GameState): void {
  for (const edge of Object.values(state.edges)) {
    const fromNode = state.nodes[edge.fromId]
    const toNode   = state.nodes[edge.toId]

    const hasGuard = toNode?.officers.some(id => {
      const off = state.officers[id]
      return off?.role === 'military' && off.state === 'stationed'
    }) ?? false

    if (edge.control < 0.5 && !hasGuard) {
      edge.instability = Math.min(100, edge.instability + 2)
      edge.corruptionRate = Math.min(0.6, edge.corruptionRate + 0.01)
    } else {
      edge.instability = Math.max(0, edge.instability - 1)
      edge.corruptionRate = Math.max(0.02, edge.corruptionRate - 0.005)
    }

    // Control rises with the average influence of both endpoint nodes,
    // suppressed by the worst instability on either side.
    // Max gain: 0.0125/tick (75% slower than the node influence gain of 0.05/tick).
    if (fromNode && toNode) {
      const avgInfluence = (fromNode.influence + toNode.influence) / 200
      const maxInstab    = Math.max(fromNode.instability, toNode.instability) / 100
      const delta        = avgInfluence * 0.0125 - maxInstab * 0.006
      edge.control = Math.max(0, Math.min(1, edge.control + delta))
    }
  }
}

function tickMorale(state: GameState): void {
  for (const node of Object.values(state.nodes)) {
    const cap = getStockpileCap(node.population)

    // ── Factor 1: Food rations available (check BEFORE consuming) ───────────
    const foodMet = node.demand.food <= 0 || node.stockpile.food >= node.demand.food

    // ── Factor 2: Medicine available (check BEFORE consuming) ───────────────
    const medicineMet = node.demand.medicine <= 0 || node.stockpile.medicine >= node.demand.medicine

    // Consume demand
    for (const r of RESOURCE_TYPES) {
      node.stockpile[r] = Math.max(0, node.stockpile[r] - node.demand[r])
    }

    // Production fills stockpile, capped by population-level storage capacity
    for (const r of RESOURCE_TYPES) {
      node.stockpile[r] = Math.min(cap, node.stockpile[r] + node.production[r])
    }

    // ── Factor 3: Produced goods are being exported (stockpile below cap) ───
    const hasProduction = RESOURCE_TYPES.some(r => node.production[r] > 0)
    const isExporting = !hasProduction || RESOURCE_TYPES.some(
      r => node.production[r] > 0 && node.stockpile[r] < cap * 0.75
    )

    // ── Factor 4: Instability ────────────────────────────────────────────────
    const stableBonus = node.instability < 30 ? 0.1 : node.instability > 55 ? -0.2 : 0

    // ── Flat morale delta ────────────────────────────────────────────────────
    let delta = 0
    delta += foodMet     ?  0.5 : -1.5   // food is the biggest driver
    delta += medicineMet ?  0.3 : -0.8   // medicine second
    delta += isExporting ?  0.2 : -0.2   // exports (neutral if no production)
    delta += stableBonus                  // instability modifier

    node.morale = Math.max(0, Math.min(100, node.morale + delta))

    // Loyalty drifts with sustained morale — slow movement, wide neutral band
    if      (node.morale < 35) node.loyalty = Math.max(0,   node.loyalty - 0.15)
    else if (node.morale > 65) node.loyalty = Math.min(100, node.loyalty + 0.15)

    // Instability tracks loyalty, not morale directly
    if (node.loyalty < 40) node.instability = Math.min(100, node.instability + 0.5)
    else                   node.instability = Math.max(0,   node.instability - 0.3)

    // Influence ticks very slowly from loyalty — strategic timescale
    if      (node.loyalty > 70 && node.morale > 60) node.influence = Math.min(100, node.influence + 0.05)
    else if (node.loyalty < 40)                      node.influence = Math.max(0,   node.influence - 0.08)
  }
}

function tickOfficerTransit(state: GameState): void {
  for (const officer of Object.values(state.officers)) {
    if (officer.state !== 'in_transit') continue
    officer.transitTicksRemaining = (officer.transitTicksRemaining ?? 1) - 1
    if (officer.transitTicksRemaining <= 0) {
      officer.state = 'stationed'
      officer.locationId = officer.destinationId!
      delete officer.destinationId
      delete officer.transitTicksRemaining
      const dest = state.nodes[officer.locationId]
      if (dest && !dest.officers.includes(officer.id)) dest.officers.push(officer.id)
    }
  }
}

// ─── Main tick ────────────────────────────────────────────────────────────────

export function simulateTick(state: GameState): GameState {
  const next: GameState = {
    ...state,
    tick: state.tick + 1,
    nodes: structuredClone(state.nodes),
    edges: structuredClone(state.edges),
    officers: structuredClone(state.officers),
    ships: structuredClone(state.ships),
    routes: structuredClone(state.routes),
    buildQueue: structuredClone(state.buildQueue),
  }

  // Reset route throughput each tick
  for (const route of Object.values(next.routes)) {
    route.lastTickThroughput = EMPTY_STOCK()
  }

  // Tick build queue
  tickBuildQueue(next)

  // Tick each ship
  for (const ship of Object.values(next.ships)) {
    if (ship.state === 'unassigned' || ship.state === 'captured') continue
    const route = ship.assignedRouteId ? next.routes[ship.assignedRouteId] : null
    if (!route) continue

    if (ship.state === 'in_transit') tickTransit(ship, route, next)
    else if (ship.state === 'docked_unloading') tickUnloading(ship, route, next)
    else if (ship.state === 'docked_loading') tickLoading(ship, route, next)
    else if (ship.state === 'stranded') {
      // Try to recover if the blocking edge clears
      if (ship.currentEdgeId) {
        const edge = next.edges[ship.currentEdgeId]
        if (edge && !edge.isFlooded && edge.instability < 40) {
          ship.state = 'in_transit'
          ship.eventNote = undefined
        }
      }
    }
  }

  tickWaitingBerths(next)
  tickInstability(next)
  tickMorale(next)
  tickOfficerTransit(next)

  return next
}

// ─── Player actions (pure functions called by the store) ──────────────────────

export function actionAssignShip(
  state: GameState, shipId: string, routeId: string
): Partial<GameState> {
  const ships = structuredClone(state.ships)
  const routes = structuredClone(state.routes)
  const ship = ships[shipId]
  const route = routes[routeId]
  if (!ship || !route) return {}

  // Remove from old route
  if (ship.assignedRouteId && routes[ship.assignedRouteId]) {
    routes[ship.assignedRouteId].shipIds = routes[ship.assignedRouteId].shipIds.filter(id => id !== shipId)
  }

  ship.assignedRouteId  = routeId
  ship.routeNodeIndex   = 1        // first destination after origin
  ship.routeDirection   = 1        // start heading toward end of path
  ship.state            = 'docked_loading'
  ship.dockedTicksRemaining = 2
  ship.locationNodeId   = route.nodePath[0]
  ship.cargo            = EMPTY_STOCK()
  route.shipIds = [...route.shipIds, shipId]

  return { ships, routes }
}

export function actionUnassignShip(state: GameState, shipId: string): Partial<GameState> {
  const ships = structuredClone(state.ships)
  const routes = structuredClone(state.routes)
  const ship = ships[shipId]
  if (!ship) return {}

  if (ship.assignedRouteId && routes[ship.assignedRouteId]) {
    routes[ship.assignedRouteId].shipIds = routes[ship.assignedRouteId].shipIds.filter(id => id !== shipId)
  }

  ship.state = 'unassigned'
  ship.assignedRouteId = undefined
  ship.currentEdgeId = undefined
  ship.eventNote = undefined

  return { ships, routes }
}

export function actionStartBuild(
  state: GameState,
  shipType: 'canoe' | 'steamer' | 'barge',
  shipName: string
): Partial<GameState> {
  const origin = state.nodes['origin']
  if (!origin) return {}

  const costMap: Record<string, Partial<ResourceStock>> = {
    canoe:   { food: 5 },
    steamer: { food: 15, ammunition: 8 },
    barge:   { food: 25, rubber: 10 },
  }
  const cost: ResourceStock = { ...EMPTY_STOCK(), ...costMap[shipType] }

  // Check resources
  for (const r of RESOURCE_TYPES) {
    if (origin.stockpile[r] < (cost[r] ?? 0)) return {}  // not enough resources
  }

  const nodes = structuredClone(state.nodes)
  for (const r of RESOURCE_TYPES) {
    nodes['origin'].stockpile[r] -= cost[r] ?? 0
  }

  const order: BuildOrder = {
    id: nextShipId(),
    shipType,
    shipName,
    ticksRemaining: SHIP_BUILD_TICKS[shipType],
    totalTicks: SHIP_BUILD_TICKS[shipType],
  }

  return { nodes, buildQueue: [...state.buildQueue, order] }
}

export function actionCancelBuild(state: GameState, orderId: string): Partial<GameState> {
  return { buildQueue: state.buildQueue.filter(o => o.id !== orderId) }
}

export function actionSetCargoPriority(
  state: GameState,
  routeId: string,
  resource: ResourceType,
  priority: CargoPriority
): Partial<GameState> {
  const routes = structuredClone(state.routes)
  if (!routes[routeId]) return {}
  ;(routes[routeId].cargoPriorities as Record<ResourceType, CargoPriority>)[resource] = priority
  return { routes }
}

export function actionAddRoute(
  state: GameState,
  name: string,
  nodePath: string[]
): Partial<GameState> {
  if (nodePath.length < 2) return {}
  const id = `route_${Date.now()}`
  return {
    routes: {
      ...state.routes,
      [id]: {
        id,
        name,
        nodePath,
        shipIds: [],
        cargoPriorities: {
          food: 'high', medicine: 'high', rubber: 'medium',
          ivory: 'medium', ammunition: 'low',
        },
        lastTickThroughput: EMPTY_STOCK(),
      },
    },
  }
}

export function actionDeleteRoute(state: GameState, routeId: string): Partial<GameState> {
  const routes = structuredClone(state.routes)
  const ships  = structuredClone(state.ships)
  const route  = routes[routeId]
  if (!route) return {}
  // Unassign any ships on this route
  for (const shipId of route.shipIds) {
    if (ships[shipId]) {
      ships[shipId].state = 'unassigned'
      ships[shipId].assignedRouteId = undefined
      ships[shipId].currentEdgeId = undefined
    }
  }
  delete routes[routeId]
  return { routes, ships }
}

// suppress unused import warning
void nextBuildId
