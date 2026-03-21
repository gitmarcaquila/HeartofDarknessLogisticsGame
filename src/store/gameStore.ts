import { create } from 'zustand'
import { GameState, GameSpeed, OverlayMode, ResourceType, CargoPriority } from '../engine/types'
import { INITIAL_STATE } from '../engine/initialState'
import {
  simulateTick,
  actionAssignShip,
  actionUnassignShip,
  actionStartBuild,
  actionCancelBuild,
  actionSetCargoPriority,
  actionAddRoute,
  actionDeleteRoute,
} from '../engine/ResourceFlow'

type ShipType = 'canoe' | 'steamer' | 'barge'

interface GameStore extends GameState {
  advanceTick:    () => void
  setSpeed:       (speed: GameSpeed) => void
  selectNode:     (id: string | null) => void
  selectEdge:     (id: string | null) => void
  selectShip:     (id: string | null) => void
  setOverlayMode: (mode: OverlayMode) => void

  // Ship actions
  assignShip:    (shipId: string, routeId: string) => void
  unassignShip:  (shipId: string) => void
  startBuild:    (shipType: ShipType, name: string) => void
  cancelBuild:   (orderId: string) => void
  setCargoPriority: (routeId: string, resource: ResourceType, priority: CargoPriority) => void
  addRoute:    (name: string, nodePath: string[]) => void
  deleteRoute: (routeId: string) => void

}

export const useGameStore = create<GameStore>((set, get) => ({
  ...INITIAL_STATE,

  advanceTick: () => set(state => simulateTick(state) as GameStore),

  setSpeed:       speed   => set({ speed }),
  selectNode:     id      => set({ selectedNodeId: id, selectedEdgeId: null, selectedShipId: null }),
  selectEdge:     id      => set({ selectedEdgeId: id, selectedNodeId: null, selectedShipId: null }),
  selectShip:     id      => set({ selectedShipId: id, selectedNodeId: null, selectedEdgeId: null }),
  setOverlayMode: mode    => set({ overlayMode: mode }),

  assignShip: (shipId, routeId) =>
    set(state => actionAssignShip(state, shipId, routeId) as GameStore),

  unassignShip: shipId =>
    set(state => actionUnassignShip(state, shipId) as GameStore),

  startBuild: (shipType, name) =>
    set(state => actionStartBuild(state, shipType, name) as GameStore),

  cancelBuild: orderId =>
    set(state => actionCancelBuild(state, orderId) as GameStore),

  setCargoPriority: (routeId, resource, priority) =>
    set(state => actionSetCargoPriority(state, routeId, resource, priority) as GameStore),

  addRoute: (name, nodePath) =>
    set(state => actionAddRoute(state, name, nodePath) as GameStore),

  deleteRoute: routeId =>
    set(state => actionDeleteRoute(state, routeId) as GameStore),
}))
