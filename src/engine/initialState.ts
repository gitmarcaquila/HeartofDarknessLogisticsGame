import { GameState, EMPTY_STOCK, SHIP_CAPACITY, ConvoyOrder } from './types'

export const INITIAL_STATE: GameState = {
  tick: 0,
  speed: 1,
  selectedNodeId: null,
  selectedEdgeId: null,
  selectedShipId: null,
  overlayMode: 'trade',
  buildQueue: [],
  companyRevenue: 0,
  pendingConvoys: [] as ConvoyOrder[],
  totalRubberExported: 0,
  totalIvoryExported: 0,
  lifetimeRevenueEarned: 0,
  economicEvents: [],

  // ─── Nodes ──────────────────────────────────────────────────────────────────
  nodes: {
    'origin': {
      id: 'origin',
      name: 'Company Station',
      type: 'origin',
      position: { x: 600, y: 80 },
      // BALANCE: medicine reduced 20→6 on 2026-04-13 (/heft: 11.2× surplus, never scarce)
      production: { ...EMPTY_STOCK(), food: 40, medicine: 6, ammunition: 10 },
      demand: EMPTY_STOCK(),
      stockpile: { food: 200, medicine: 100, rubber: 0, ivory: 0, ammunition: 60 },
      population: 120,
      officers: [],
      morale: 75,
      loyalty: 90,
      instability: 5,
      influence: 95,
      isCapital: true,
      corruptionRate: 0.02,
      nativeInfluence: 0,
    },
    'confluence': {
      id: 'confluence',
      name: 'Stanley Falls',
      type: 'confluence',
      position: { x: 600, y: 280 },
      production: EMPTY_STOCK(),
      demand: { ...EMPTY_STOCK(), food: 0.8 },
      stockpile: { ...EMPTY_STOCK(), food: 25 },
      population: 40,
      officers: [],
      morale: 60,
      loyalty: 70,
      instability: 20,
      influence: 60,
      corruptionRate: 0.06,
      nativeInfluence: 10,
    },
    'leopoldville': {
      id: 'leopoldville',
      name: 'Léopoldville Station',
      type: 'outpost',
      position: { x: 350, y: 510 },
      production: { ...EMPTY_STOCK(), rubber: 15, ivory: 5 },
      demand: { ...EMPTY_STOCK(), food: 2.4, medicine: 0.8 },
      stockpile: { ...EMPTY_STOCK(), food: 65, medicine: 22 },
      population: 85,
      officers: [],
      morale: 50,
      loyalty: 60,
      instability: 35,
      influence: 45,
      corruptionRate: 0.12,
      nativeInfluence: 25,
      nativeFactionName: 'Kongo Traders',
    },
    'gorge': {
      id: 'gorge',
      name: 'Gorge Pass',
      type: 'chokepoint',
      position: { x: 790, y: 460 },
      production: EMPTY_STOCK(),
      // BALANCE: ammo demand raised from 0.4 → 1.2 on 2026-03-30 (military post
      // in hostile territory; ammo was never a constraint before this change)
      demand: { ...EMPTY_STOCK(), food: 1.2, ammunition: 1.2 },
      // BALANCE: ammo stockpile raised 12→60 on 2026-04-13 (/heft: tick-10 crisis with no
      // assigned ships; 60 units = 50 ticks runway for player to respond)
      stockpile: { ...EMPTY_STOCK(), food: 32, ammunition: 60 },
      population: 20,
      officers: [],
      morale: 55,
      loyalty: 65,
      instability: 40,
      influence: 40,
      corruptionRate: 0.18,
      nativeInfluence: 42,
      nativeFactionName: 'Bangala Traders',
    },
    'upriver': {
      id: 'upriver',
      name: 'Upriver Camp',
      type: 'settlement',
      position: { x: 830, y: 640 },
      production: { ...EMPTY_STOCK(), ivory: 8, rubber: 5 },
      // BALANCE: ammo demand added at 0.5 on 2026-03-30 (was 0; remote camp
      // now requires ammunition supply to maintain security)
      demand: { ...EMPTY_STOCK(), food: 1.6, medicine: 0.64, ammunition: 0.5 },
      stockpile: { ...EMPTY_STOCK(), food: 45, medicine: 18 },
      population: 55,
      officers: [],
      morale: 40,
      loyalty: 45,
      instability: 55,
      influence: 25,
      corruptionRate: 0.24,
      nativeInfluence: 58,
      nativeFactionName: 'Mongo Elders',
    },
    'innerstation': {
      id: 'innerstation',
      name: 'Inner Station',
      type: 'outpost',
      position: { x: 1020, y: 755 },
      production: { ...EMPTY_STOCK(), ivory: 4 },
      demand: { ...EMPTY_STOCK(), food: 0.9, medicine: 0.35 },
      stockpile: { ...EMPTY_STOCK(), food: 18, medicine: 7 },
      population: 30,
      officers: [],
      morale: 30,
      loyalty: 35,
      instability: 70,
      influence: 15,
      corruptionRate: 0.35,
      nativeInfluence: 68,
      nativeFactionName: 'Forest Confederation',
    },
  },

  // ─── Edges ──────────────────────────────────────────────────────────────────
  edges: {
    'e_origin_confluence': {
      id: 'e_origin_confluence',
      fromId: 'origin', toId: 'confluence',
      capacity: 80, control: 0.85, resistance: 1.0,
      instability: 10, flowDirection: 'bidirectional',
      currentFlow: EMPTY_STOCK(), corruptionRate: 0.05,
    },
    'e_confluence_leopoldville': {
      id: 'e_confluence_leopoldville',
      fromId: 'confluence', toId: 'leopoldville',
      capacity: 50, control: 0.55, resistance: 1.4,
      instability: 35, flowDirection: 'bidirectional',
      currentFlow: EMPTY_STOCK(), corruptionRate: 0.18,
    },
    'e_confluence_gorge': {
      id: 'e_confluence_gorge',
      fromId: 'confluence', toId: 'gorge',
      capacity: 40, control: 0.50, resistance: 1.8,
      instability: 45, flowDirection: 'bidirectional',
      currentFlow: EMPTY_STOCK(), corruptionRate: 0.22,
      isChokepoint: true,
    },
    'e_gorge_upriver': {
      id: 'e_gorge_upriver',
      fromId: 'gorge', toId: 'upriver',
      capacity: 30, control: 0.40, resistance: 1.6,
      instability: 55, flowDirection: 'bidirectional',
      currentFlow: EMPTY_STOCK(), corruptionRate: 0.28,
    },
    // resistance 2.52 → steamer traverses in exactly 14 ticks
    'e_upriver_innerstation': {
      id: 'e_upriver_innerstation',
      fromId: 'upriver', toId: 'innerstation',
      capacity: 20, control: 0.25, resistance: 2.52,
      instability: 70, flowDirection: 'bidirectional',
      currentFlow: EMPTY_STOCK(), corruptionRate: 0.38,
    },
  },

  // ─── Officers ────────────────────────────────────────────────────────────────
  officers: {
    'off_1': {
      id: 'off_1', name: 'Cmdr. Beaumont', role: 'logistics',
      morale: 70, loyalty: 85, state: 'stationed', locationId: 'origin',
    },
    'off_2': {
      id: 'off_2', name: 'Lt. Adaeze', role: 'military',
      morale: 65, loyalty: 75, state: 'stationed', locationId: 'leopoldville',
    },
    'off_3': {
      id: 'off_3', name: 'Dr. Mbeki', role: 'medical',
      morale: 60, loyalty: 70, state: 'stationed', locationId: 'gorge',
    },
  },

  // ─── Ships ──────────────────────────────────────────────────────────────────
  // One steamer pre-assigned to the supply route so the player sees flow immediately.
  // Two ships unassigned at Company Station ready to be deployed.
  ships: {
    'ship_1': {
      id: 'ship_1', name: 'Roi des Belges', type: 'steamer',
      state: 'docked_loading',
      locationNodeId: 'origin',
      edgeProgress: 0,
      assignedRouteId: 'route_supply',
      routeNodeIndex: 1,
      routeDirection: 1,
      cargo: EMPTY_STOCK(),
      capacity: SHIP_CAPACITY.steamer,
      dockedTicksRemaining: 1,
      recentlyUnloaded: {},
    },
    // BALANCE: ship_2 pre-assigned to route_supply on 2026-03-30 (was unassigned;
    // one ship could not cover Léopoldville's demand over a 42-tick cycle)
    'ship_2': {
      id: 'ship_2', name: 'Le Pionnier', type: 'steamer',
      state: 'docked_loading',
      locationNodeId: 'origin',
      edgeProgress: 0,
      assignedRouteId: 'route_supply',
      routeNodeIndex: 1,
      routeDirection: 1,
      cargo: EMPTY_STOCK(),
      capacity: SHIP_CAPACITY.steamer,
      dockedTicksRemaining: 2,
      recentlyUnloaded: {},
    },
    'ship_3': {
      id: 'ship_3', name: 'Adaeze II', type: 'canoe',
      state: 'unassigned',
      locationNodeId: 'origin',
      edgeProgress: 0,
      routeNodeIndex: 0,
      routeDirection: 1,
      cargo: EMPTY_STOCK(),
      capacity: SHIP_CAPACITY.canoe,
      dockedTicksRemaining: 0,
      recentlyUnloaded: {},
    },
  },

  // ─── Trade Routes ────────────────────────────────────────────────────────────
  // Routes are pre-defined loops. Player assigns ships and sets priorities.
  routes: {
    'route_supply': {
      id: 'route_supply',
      name: 'Main Supply Run',
      // One-way path — ships reverse automatically at Léopoldville
      nodePath: ['origin', 'confluence', 'leopoldville'],
      shipIds: ['ship_1', 'ship_2'],
      cargoPriorities: {
        food: 'high',
        medicine: 'high',
        rubber: 'medium',
        ivory: 'medium',
        ammunition: 'low',
      },
      lastTickThroughput: EMPTY_STOCK(),
    },
    'route_gorge': {
      id: 'route_gorge',
      name: 'Gorge Expedition',
      // One-way path — ships reverse automatically at Upriver Camp
      nodePath: ['origin', 'confluence', 'gorge', 'upriver'],
      shipIds: [],
      cargoPriorities: {
        food: 'high',
        ammunition: 'high',
        medicine: 'medium',
        ivory: 'medium',
        rubber: 'low',
      },
      lastTickThroughput: EMPTY_STOCK(),
    },
    'route_interior': {
      id: 'route_interior',
      name: 'Interior Run',
      // Full deep-river route to the Inner Station
      nodePath: ['origin', 'confluence', 'gorge', 'upriver', 'innerstation'],
      shipIds: [],
      cargoPriorities: {
        food: 'high',
        medicine: 'high',
        ammunition: 'medium',
        ivory: 'medium',
        rubber: 'low',
      },
      lastTickThroughput: EMPTY_STOCK(),
    },
  },
}
