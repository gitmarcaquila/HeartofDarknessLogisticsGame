import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { ResourceType, CargoPriority, RESOURCE_TYPES, Ship, TradeRoute } from '../engine/types'

const RESOURCE_LABELS: Record<ResourceType, string> = {
  food: 'Food', medicine: 'Medicine', rubber: 'Rubber',
  ivory: 'Ivory', ammunition: 'Ammunition',
}

const PRIORITY_CYCLE: CargoPriority[] = ['high', 'medium', 'low', 'none']
const PRIORITY_COLOR: Record<CargoPriority, string> = {
  high: '#10b981', medium: '#3b82f6', low: '#6b7280', none: '#374151',
}
const SHIP_STATE_COLOR: Record<string, string> = {
  unassigned: '#6b7280', docked_loading: '#fbbf24', docked_unloading: '#f59e0b',
  in_transit: '#06b6d4', stranded: '#f97316', damaged: '#ef4444', captured: '#7f1d1d',
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 16 }}>
      {children}
    </div>
  )
}

function ShipRow({ ship, onSelect, onAssign, onRecall, routes }: {
  ship: Ship
  onSelect: () => void
  onAssign?: (routeId: string) => void
  onRecall?: () => void
  routes: Record<string, TradeRoute>
}) {
  const totalCargo = RESOURCE_TYPES.reduce((s, r) => s + ship.cargo[r], 0)
  const pct = Math.round((totalCargo / ship.capacity) * 100)

  return (
    <div style={{
      padding: '8px 10px', background: '#0d1117',
      border: '1px solid #1f2937', borderRadius: 6, marginBottom: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span
          style={{ fontSize: 12, color: '#e5e7eb', cursor: 'pointer', fontWeight: 600 }}
          onClick={onSelect}
        >{ship.name}</span>
        <span style={{ fontSize: 10, color: '#6b7280' }}>{ship.type} · cap {ship.capacity}</span>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: SHIP_STATE_COLOR[ship.state] ?? '#9ca3af' }}>
          ● {ship.state.replace(/_/g, ' ')}
        </span>
        {totalCargo > 0 && (
          <span style={{ fontSize: 10, color: '#6b7280' }}>cargo {pct}%</span>
        )}
        {ship.eventNote && (
          <span style={{ fontSize: 10, color: '#fca5a5' }}>⚠ {ship.eventNote}</span>
        )}
      </div>

      {ship.state === 'unassigned' && onAssign && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {Object.values(routes).map(r => (
            <button key={r.id} onClick={() => onAssign(r.id)} style={{
              padding: '3px 8px', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer',
              borderRadius: 3, background: '#1f2937', color: '#10b981',
              border: '1px solid #374151',
            }}>
              Deploy → {r.name}
            </button>
          ))}
        </div>
      )}

      {ship.state !== 'unassigned' && onRecall && (
        <div style={{ marginTop: 6 }}>
          <button onClick={onRecall} style={{
            padding: '3px 8px', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer',
            borderRadius: 3, background: '#450a0a', color: '#fca5a5', border: '1px solid #7f1d1d',
          }}>Recall</button>
        </div>
      )}
    </div>
  )
}

function RouteSection({ route }: { route: TradeRoute }) {
  const ships       = useGameStore(s => s.ships)
  const nodes       = useGameStore(s => s.nodes)
  const assignShip   = useGameStore(s => s.assignShip)
  const unassignShip = useGameStore(s => s.unassignShip)
  const setCargo     = useGameStore(s => s.setCargoPriority)
  const selectShip   = useGameStore(s => s.selectShip)
  const deleteRoute  = useGameStore(s => s.deleteRoute)
  const routes       = useGameStore(s => s.routes)

  const routeShips   = route.shipIds.map(id => ships[id]).filter(Boolean)
  const unassigned   = Object.values(ships).filter(s => s.state === 'unassigned')
  const throughput   = RESOURCE_TYPES.reduce((s, r) => s + route.lastTickThroughput[r], 0)

  return (
    <div style={{
      padding: '12px', background: '#111827',
      border: '1px solid #1f2937', borderRadius: 8, marginBottom: 10,
    }}>
      {/* Route header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 700 }}>{route.name}</div>
          <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
            {route.nodePath.map(id => nodes[id]?.name ?? id).join(' → ')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#10b981' }}>{routeShips.length} ships</div>
          {throughput > 0 && (
            <div style={{ fontSize: 10, color: '#6b7280' }}>{Math.round(throughput)} delivered/tick</div>
          )}
        </div>
      </div>

      {/* Ships on route */}
      {routeShips.length === 0 && (
        <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 8 }}>No ships assigned — goods will not flow.</div>
      )}
      {routeShips.map(ship => (
        <ShipRow
          key={ship.id}
          ship={ship}
          routes={routes}
          onSelect={() => selectShip(ship.id)}
          onRecall={() => unassignShip(ship.id)}
        />
      ))}

      {/* Add unassigned ship */}
      {unassigned.length > 0 && (
        <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {unassigned.map(s => (
            <button key={s.id} onClick={() => assignShip(s.id, route.id)} style={{
              padding: '3px 10px', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer',
              borderRadius: 3, background: '#0d1117', color: '#10b981', border: '1px solid #374151',
            }}>
              + {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Cargo priorities */}
      <div style={{ marginTop: 12, borderTop: '1px solid #1f2937', paddingTop: 10 }}>
        <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Cargo Priorities — click to cycle
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {RESOURCE_TYPES.map(r => {
            const p: CargoPriority = route.cargoPriorities[r] ?? 'medium'
            const next = PRIORITY_CYCLE[(PRIORITY_CYCLE.indexOf(p) + 1) % PRIORITY_CYCLE.length]
            return (
              <button
                key={r}
                onClick={() => setCargo(route.id, r, next)}
                title={`${RESOURCE_LABELS[r]}: ${p} — click to change`}
                style={{
                  padding: '3px 8px', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer',
                  borderRadius: 3, border: 'none',
                  background: PRIORITY_COLOR[p],
                  color: p === 'none' ? '#6b7280' : '#fff',
                  opacity: p === 'none' ? 0.5 : 1,
                }}
              >
                {RESOURCE_LABELS[r]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Delete route */}
      <div style={{ marginTop: 10, textAlign: 'right' }}>
        <button onClick={() => deleteRoute(route.id)} style={{
          padding: '3px 8px', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer',
          borderRadius: 3, background: '#450a0a', color: '#fca5a5', border: '1px solid #7f1d1d',
        }}>Delete route</button>
      </div>
    </div>
  )
}

// ─── New Route Form ───────────────────────────────────────────────────────────

function NewRouteForm({ onClose }: { onClose: () => void }) {
  const nodes    = useGameStore(s => s.nodes)
  const edges    = useGameStore(s => s.edges)
  const addRoute = useGameStore(s => s.addRoute)

  const [name, setName]           = useState('')
  const [waypoints, setWaypoints] = useState<string[]>(['origin'])

  const connected = (a: string, b: string) =>
    Object.values(edges).some(e =>
      (e.fromId === a && e.toId === b) ||
      (e.fromId === b && e.toId === a)
    )

  const lastWaypoint  = waypoints[waypoints.length - 1]
  const reachable     = Object.keys(nodes).filter(id => connected(lastWaypoint, id))
  const canSave       = name.trim().length > 0 && waypoints.length >= 2

  const addWaypoint = (nodeId: string) => setWaypoints(w => [...w, nodeId])
  const removeWaypoint = (i: number)   => setWaypoints(w => w.filter((_, idx) => idx !== i))

  const save = () => {
    if (!canSave) return
    // Pass the one-way path — ships reverse at the terminus automatically
    addRoute(name.trim(), waypoints)
    onClose()
  }

  return (
    <div style={{ padding: '12px', background: '#0d1117', border: '1px solid #374151', borderRadius: 8, marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700, marginBottom: 10 }}>New Trade Route</div>

      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Route name…"
        style={{
          width: '100%', padding: '5px 8px', marginBottom: 10,
          background: '#1f2937', border: '1px solid #374151', borderRadius: 4,
          color: '#e5e7eb', fontSize: 11, fontFamily: 'monospace', boxSizing: 'border-box',
        }}
      />

      {/* Waypoint list */}
      <div style={{ marginBottom: 8 }}>
        {waypoints.map((wp, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#6b7280', width: 14 }}>{i + 1}.</span>
            <span style={{ fontSize: 11, color: '#e5e7eb', flex: 1 }}>{nodes[wp]?.name ?? wp}</span>
            {i > 0 && (
              <button onClick={() => removeWaypoint(i)} style={{
                background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12, padding: '0 2px',
              }}>✕</button>
            )}
          </div>
        ))}
      </div>

      {/* Add next waypoint */}
      {reachable.length > 0 ? (
        <select
          value=""
          onChange={e => { if (e.target.value) addWaypoint(e.target.value) }}
          style={{
            width: '100%', padding: '5px 8px', marginBottom: 10,
            background: '#1f2937', border: '1px solid #374151', borderRadius: 4,
            color: '#9ca3af', fontSize: 11, fontFamily: 'monospace', boxSizing: 'border-box',
          }}
        >
          <option value="">+ Add waypoint…</option>
          {reachable.map(id => (
            <option key={id} value={id}>{nodes[id]?.name}</option>
          ))}
        </select>
      ) : (
        <div style={{ fontSize: 10, color: '#4b5563', marginBottom: 10 }}>No connected nodes to add.</div>
      )}

      <div style={{ fontSize: 10, color: '#4b5563', marginBottom: 10 }}>
        Ships will travel this path and return automatically.
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={save} disabled={!canSave} style={{
          padding: '4px 12px', fontSize: 11, fontFamily: 'monospace', cursor: canSave ? 'pointer' : 'default',
          borderRadius: 3, background: canSave ? '#064e3b' : '#1f2937',
          color: canSave ? '#10b981' : '#4b5563', border: `1px solid ${canSave ? '#065f46' : '#374151'}`,
        }}>Save Route</button>
        <button onClick={onClose} style={{
          padding: '4px 12px', fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
          borderRadius: 3, background: '#1f2937', color: '#6b7280', border: '1px solid #374151',
        }}>Cancel</button>
      </div>
    </div>
  )
}

export function FleetPanel({ onClose }: { onClose: () => void }) {
  const routes       = useGameStore(s => s.routes)
  const ships        = useGameStore(s => s.ships)
  const assignShip   = useGameStore(s => s.assignShip)
  const unassignShip = useGameStore(s => s.unassignShip)
  const selectShip   = useGameStore(s => s.selectShip)

  const [showNewRoute, setShowNewRoute] = useState(false)
  const unassigned = Object.values(ships).filter(s => s.state === 'unassigned')

  return (
    <div style={{
      position: 'absolute', top: 52, left: 0, bottom: 0,
      width: 340,
      background: 'rgba(13, 17, 23, 0.97)',
      borderRight: '1px solid #1f2937',
      backdropFilter: 'blur(8px)',
      overflowY: 'auto',
      zIndex: 20,
      padding: '16px',
      fontFamily: 'monospace',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700 }}>FLEET & ROUTES</div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#6b7280',
          cursor: 'pointer', fontSize: 16, padding: '0 4px',
        }}>✕</button>
      </div>

      {/* Unassigned ships */}
      {unassigned.length > 0 && (
        <>
          <SectionLabel>Unassigned Ships ({unassigned.length})</SectionLabel>
          {unassigned.map(ship => (
            <ShipRow
              key={ship.id}
              ship={ship}
              routes={routes}
              onSelect={() => selectShip(ship.id)}
              onAssign={routeId => assignShip(ship.id, routeId)}
            />
          ))}
        </>
      )}

      {/* Routes */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>
          Trade Routes ({Object.values(routes).length})
        </div>
        <button onClick={() => setShowNewRoute(r => !r)} style={{
          padding: '3px 10px', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer',
          borderRadius: 3, background: showNewRoute ? '#1f2937' : '#064e3b',
          color: showNewRoute ? '#6b7280' : '#10b981',
          border: `1px solid ${showNewRoute ? '#374151' : '#065f46'}`,
        }}>
          {showNewRoute ? 'Cancel' : '+ New Route'}
        </button>
      </div>

      {showNewRoute && <NewRouteForm onClose={() => setShowNewRoute(false)} />}

      {Object.values(routes).map(route => (
        <RouteSection key={route.id} route={route} />
      ))}

      <div style={{ marginTop: 16, fontSize: 10, color: '#374151', lineHeight: 1.6 }}>
        Tip: click a river segment on the map to manage a specific route. Click Company Station to build new ships.
      </div>
    </div>
  )
}
