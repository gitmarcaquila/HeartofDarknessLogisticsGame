import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { RiverNode, RiverEdge, Ship, ResourceType, CargoPriority, RESOURCE_TYPES, SHIP_BUILD_TICKS, SHIP_BUILD_COST, SHIP_CAPACITY } from '../engine/types'

// ─── Shared primitives ────────────────────────────────────────────────────────

const RESOURCE_LABELS: Record<ResourceType, string> = {
  food: 'Food', medicine: 'Medicine', rubber: 'Rubber',
  ivory: 'Ivory', ammunition: 'Ammunition',
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>
        <span>{label}</span><span style={{ color: '#e5e7eb' }}>{Math.round(value)}</span>
      </div>
      <div style={{ height: 4, background: '#1f2937', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${Math.min(100, value)}%`, background: color, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14, marginBottom: 6, fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>
      {children}
    </div>
  )
}

function PillBtn({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button onClick={onClick} style={{
      padding: '3px 8px', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer', borderRadius: 3,
      background: danger ? '#450a0a' : '#1f2937',
      color: danger ? '#fca5a5' : '#9ca3af',
      border: `1px solid ${danger ? '#7f1d1d' : '#374151'}`,
      marginRight: 4,
    }}>{children}</button>
  )
}

// ─── Ship Panel ───────────────────────────────────────────────────────────────

function ShipPanel({ ship }: { ship: Ship }) {
  const routes    = useGameStore(s => s.routes)
  const assignShip   = useGameStore(s => s.assignShip)
  const unassignShip = useGameStore(s => s.unassignShip)
  const nodes     = useGameStore(s => s.nodes)

  const currentRoute = ship.assignedRouteId ? routes[ship.assignedRouteId] : null
  const totalCargo   = RESOURCE_TYPES.reduce((sum, r) => sum + ship.cargo[r], 0)
  const pct          = Math.round((totalCargo / ship.capacity) * 100)

  const STATE_LABELS: Record<string, string> = {
    unassigned: 'Unassigned', docked_loading: 'Loading', docked_unloading: 'Unloading',
    in_transit: 'In Transit', stranded: 'STRANDED', damaged: 'Damaged', captured: 'Captured',
  }
  const STATE_COLOR: Record<string, string> = {
    unassigned: '#6b7280', docked_loading: '#fbbf24', docked_unloading: '#f59e0b',
    in_transit: '#06b6d4', stranded: '#f97316', damaged: '#ef4444', captured: '#7f1d1d',
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: '#06b6d4', fontWeight: 700, marginBottom: 2 }}>{ship.name}</div>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
        {ship.type} · cap {ship.capacity}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: STATE_COLOR[ship.state] ?? '#9ca3af' }}>
          ● {STATE_LABELS[ship.state] ?? ship.state}
        </span>
        {ship.state === 'in_transit' && (
          <span style={{ fontSize: 10, color: '#6b7280' }}>
            {Math.round(ship.edgeProgress * 100)}%
          </span>
        )}
      </div>

      {ship.eventNote && (
        <div style={{ padding: '5px 8px', background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 4, fontSize: 10, color: '#fca5a5', marginBottom: 10 }}>
          ⚠ {ship.eventNote}
        </div>
      )}

      <SectionLabel>Cargo ({pct}% full)</SectionLabel>
      {RESOURCE_TYPES.map(r => {
        const v = Math.round(ship.cargo[r])
        if (v === 0) return null
        return (
          <div key={r} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
            <span style={{ color: '#9ca3af' }}>{RESOURCE_LABELS[r]}</span>
            <span style={{ color: '#e5e7eb' }}>{v}</span>
          </div>
        )
      })}
      {totalCargo === 0 && <div style={{ fontSize: 11, color: '#4b5563' }}>Empty hold</div>}

      <SectionLabel>Route</SectionLabel>
      {currentRoute ? (
        <>
          <div style={{ fontSize: 11, color: '#e5e7eb', marginBottom: 4 }}>{currentRoute.name}</div>
          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 8 }}>
            {currentRoute.nodePath.map(id => nodes[id]?.name ?? id).join(' → ')}
          </div>
          <PillBtn onClick={() => unassignShip(ship.id)} danger>Recall ship</PillBtn>
        </>
      ) : (
        <>
          <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 8 }}>No route assigned</div>
          {Object.values(routes).map(r => (
            <PillBtn key={r.id} onClick={() => assignShip(ship.id, r.id)}>
              Assign → {r.name}
            </PillBtn>
          ))}
        </>
      )}
    </div>
  )
}

// ─── Route Panel (shown when an edge is selected) ─────────────────────────────

const PRIORITY_CYCLE: CargoPriority[] = ['high', 'medium', 'low', 'none']
const PRIORITY_COLOR: Record<CargoPriority, string> = {
  high: '#10b981', medium: '#3b82f6', low: '#6b7280', none: '#374151',
}

function RoutePanel({ edge }: { edge: RiverEdge }) {
  const routes       = useGameStore(s => s.routes)
  const ships        = useGameStore(s => s.ships)
  const nodes        = useGameStore(s => s.nodes)
  const assignShip   = useGameStore(s => s.assignShip)
  const unassignShip = useGameStore(s => s.unassignShip)
  const setCargo     = useGameStore(s => s.setCargoPriority)
  const selectShip   = useGameStore(s => s.selectShip)

  // Find routes that pass through this edge (either direction)
  const edgeRoutes = Object.values(routes).filter(route => {
    for (let i = 0; i < route.nodePath.length; i++) {
      const a = route.nodePath[i]
      const b = route.nodePath[(i + 1) % route.nodePath.length]
      if (
        (a === edge.fromId && b === edge.toId) ||
        (a === edge.toId  && b === edge.fromId)
      ) return true
    }
    return false
  })

  const unassigned = Object.values(ships).filter(s => s.state === 'unassigned')

  return (
    <div>
      <div style={{ fontSize: 13, color: '#8b5cf6', fontWeight: 700, marginBottom: 4 }}>River Segment</div>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 12 }}>
        {nodes[edge.fromId]?.name} ↔ {nodes[edge.toId]?.name}
      </div>

      <StatBar label="Instability" value={edge.instability} color="#ef4444" />
      <StatBar label="Control" value={edge.control * 100} color="#3b82f6" />

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
        <span>Corruption</span><span style={{ color: '#ef4444' }}>{Math.round(edge.corruptionRate * 100)}%</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 4, marginBottom: 12 }}>
        <span>Resistance</span><span style={{ color: '#e5e7eb' }}>{edge.resistance.toFixed(1)}×</span>
      </div>

      {edge.isChokepoint && (
        <div style={{ padding: '4px 8px', background: '#451a03', border: '1px solid #92400e', borderRadius: 4, fontSize: 10, color: '#fbbf24', marginBottom: 12 }}>
          ⚠ Strategic chokepoint
        </div>
      )}

      {edgeRoutes.length === 0 && (
        <div style={{ fontSize: 11, color: '#4b5563' }}>No trade routes use this segment.</div>
      )}

      {edgeRoutes.map(route => {
        const routeShips = route.shipIds.map(id => ships[id]).filter(Boolean)
        return (
          <div key={route.id} style={{ marginBottom: 14, padding: '8px', background: '#111827', borderRadius: 6, border: '1px solid #1f2937' }}>
            <div style={{ fontSize: 12, color: '#e5e7eb', fontWeight: 600, marginBottom: 4 }}>{route.name}</div>
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 8 }}>
              {route.nodePath.map(id => nodes[id]?.name ?? id).join(' → ')}
            </div>

            <SectionLabel>Fleet ({routeShips.length} ships)</SectionLabel>
            {routeShips.map(ship => (
              <div key={ship.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, marginBottom: 4, padding: '3px 6px', background: '#1f2937', borderRadius: 3 }}>
                <span
                  style={{ color: '#06b6d4', cursor: 'pointer' }}
                  onClick={() => selectShip(ship.id)}
                >{ship.name}</span>
                <span style={{ color: '#6b7280' }}>{ship.state.replace('_', ' ')}</span>
                <PillBtn onClick={() => unassignShip(ship.id)} danger>Recall</PillBtn>
              </div>
            ))}

            {unassigned.length > 0 && (
              <>
                <SectionLabel>Add ship</SectionLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {unassigned.map(s => (
                    <PillBtn key={s.id} onClick={() => assignShip(s.id, route.id)}>
                      + {s.name}
                    </PillBtn>
                  ))}
                </div>
              </>
            )}

            <SectionLabel>Cargo priorities</SectionLabel>
            {RESOURCE_TYPES.map(r => {
              const p: CargoPriority = route.cargoPriorities[r] ?? 'medium'
              const next = PRIORITY_CYCLE[(PRIORITY_CYCLE.indexOf(p) + 1) % PRIORITY_CYCLE.length]
              return (
                <div key={r} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: '#9ca3af' }}>{RESOURCE_LABELS[r]}</span>
                  <button
                    onClick={() => setCargo(route.id, r, next)}
                    style={{
                      padding: '2px 8px', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer',
                      borderRadius: 3, border: 'none', background: PRIORITY_COLOR[p], color: '#fff',
                    }}
                  >{p}</button>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ─── Node Panel ───────────────────────────────────────────────────────────────

const SHIP_NAMES = [
  'L\'Avenir', 'Ville de Bruges', 'En Avant', 'Archiduchesse', 'Flandre',
  'Bruxelles', 'Luebo', 'Kintambo', 'Albertville', 'Commandant',
]

function ShipyardPanel() {
  const buildQueue = useGameStore(s => s.buildQueue)
  const nodes      = useGameStore(s => s.nodes)
  const startBuild = useGameStore(s => s.startBuild)
  const cancelBuild = useGameStore(s => s.cancelBuild)
  const [nameIdx, setNameIdx] = useState(0)

  const origin = nodes['origin']
  const canAfford = (type: 'canoe' | 'steamer' | 'barge') => {
    const cost = { canoe: { food: 5 }, steamer: { food: 15, ammunition: 8 }, barge: { food: 25, rubber: 10 } }[type]
    return Object.entries(cost).every(([r, v]) => (origin?.stockpile[r as ResourceType] ?? 0) >= v)
  }

  const queue = () => {
    const name = SHIP_NAMES[nameIdx % SHIP_NAMES.length]
    setNameIdx(i => i + 1)
    return name
  }

  return (
    <>
      <SectionLabel>Shipyard</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {([['canoe', 'War Canoe', 'Cap 20 · 3 days · 5 food'],
           ['steamer', 'River Steamer', 'Cap 60 · 8 days · 15 food, 8 ammo'],
           ['barge', 'Heavy Barge', 'Cap 120 · 15 days · 25 food, 10 rubber']] as const).map(([type, label, cost]) => (
          <div key={type} style={{ padding: '6px 8px', background: '#111827', borderRadius: 4, border: '1px solid #1f2937' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: '#e5e7eb' }}>{label}</div>
                <div style={{ fontSize: 10, color: '#6b7280' }}>{cost}</div>
              </div>
              <PillBtn onClick={() => { if (canAfford(type)) startBuild(type, queue()) }}>
                {canAfford(type) ? 'Build' : 'Can\'t afford'}
              </PillBtn>
            </div>
          </div>
        ))}
      </div>

      {buildQueue.length > 0 && (
        <>
          <SectionLabel>Build Queue</SectionLabel>
          {buildQueue.map(order => (
            <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, marginBottom: 5, padding: '4px 8px', background: '#1f2937', borderRadius: 3 }}>
              <span style={{ color: '#e5e7eb' }}>{order.shipName}</span>
              <span style={{ color: '#fbbf24' }}>{order.ticksRemaining} ticks</span>
              <PillBtn onClick={() => cancelBuild(order.id)} danger>✕</PillBtn>
            </div>
          ))}
        </>
      )}
    </>
  )
}

function NodePanel({ node }: { node: RiverNode }) {
  const officers = useGameStore(s => s.officers)
  const nodeOfficers = node.officers.map(id => officers[id]).filter(Boolean)

  return (
    <div>
      <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700, marginBottom: 4 }}>{node.name}</div>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
        {node.type} · Pop. {node.population}
      </div>

      <StatBar label="Morale"      value={node.morale}      color="#10b981" />
      <StatBar label="Loyalty"     value={node.loyalty}     color="#3b82f6" />
      <StatBar label="Instability" value={node.instability} color="#ef4444" />
      <StatBar label="Influence"   value={node.influence}   color="#8b5cf6" />

      <SectionLabel>Stockpile</SectionLabel>
      {RESOURCE_TYPES.map(r => {
        const stock = Math.round(node.stockpile[r])
        const prod  = node.production[r]
        const dem   = node.demand[r]
        if (stock === 0 && prod === 0 && dem === 0) return null
        return (
          <div key={r} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
            <span style={{ color: '#9ca3af' }}>{RESOURCE_LABELS[r]}</span>
            <span style={{ color: '#e5e7eb' }}>
              {stock}
              {prod > 0 && <span style={{ color: '#10b981', marginLeft: 4 }}>+{prod}</span>}
              {dem  > 0 && <span style={{ color: '#ef4444', marginLeft: 2 }}>-{dem}</span>}
            </span>
          </div>
        )
      })}

      {nodeOfficers.length > 0 && (
        <>
          <SectionLabel>Officers</SectionLabel>
          {nodeOfficers.map(off => (
            <div key={off.id} style={{ marginBottom: 6, padding: '6px 8px', background: '#1f2937', borderRadius: 4 }}>
              <div style={{ fontSize: 11, color: '#e5e7eb' }}>{off.name}</div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>{off.role} · morale {off.morale}</div>
            </div>
          ))}
        </>
      )}

      {node.isCapital && <ShipyardPanel />}
    </div>
  )
}

// ─── Root Sidebar ─────────────────────────────────────────────────────────────

export function Sidebar() {
  const selectedNodeId = useGameStore(s => s.selectedNodeId)
  const selectedEdgeId = useGameStore(s => s.selectedEdgeId)
  const selectedShipId = useGameStore(s => s.selectedShipId)
  const nodes  = useGameStore(s => s.nodes)
  const edges  = useGameStore(s => s.edges)
  const ships  = useGameStore(s => s.ships)

  const selectedNode = selectedNodeId ? nodes[selectedNodeId] : null
  const selectedEdge = selectedEdgeId ? edges[selectedEdgeId] : null
  const selectedShip = selectedShipId ? ships[selectedShipId] : null

  const visible = !!(selectedNode || selectedEdge || selectedShip)

  return (
    <div style={{
      position: 'absolute', top: 52, right: 0,
      width: visible ? 260 : 0,
      height: 'calc(100% - 52px)',
      background: 'rgba(13, 17, 23, 0.94)',
      borderLeft: visible ? '1px solid #1f2937' : 'none',
      padding: visible ? 16 : 0,
      overflowY: 'auto',
      transition: 'width 0.2s',
      pointerEvents: visible ? 'all' : 'none',
      backdropFilter: 'blur(8px)',
    }}>
      {selectedShip && <ShipPanel ship={selectedShip} />}
      {selectedNode && <NodePanel node={selectedNode} />}
      {selectedEdge && <RoutePanel edge={selectedEdge} />}
    </div>
  )
}
