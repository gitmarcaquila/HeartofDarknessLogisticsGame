import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { ResourceType, SHIP_REVENUE_COST, SHIP_UPKEEP_FOOD } from '../engine/types'

const SHIP_NAMES = [
  'L\'Avenir', 'Ville de Bruges', 'En Avant', 'Archiduchesse', 'Flandre',
  'Bruxelles', 'Luebo', 'Kintambo', 'Albertville', 'Commandant',
]

type ShipDef = {
  type:   'canoe' | 'steamer' | 'barge'
  label:  string
  detail: string
  cost:   Partial<Record<ResourceType, number>>
}

const SHIP_DEFS: ShipDef[] = [
  { type: 'canoe',   label: 'War Canoe',     detail: 'Cap 20 · 3 days build',  cost: { food: 5 } },
  { type: 'steamer', label: 'River Steamer', detail: 'Cap 60 · 8 days build',  cost: { food: 15, ammunition: 8 } },
  { type: 'barge',   label: 'Heavy Barge',   detail: 'Cap 120 · 15 days build', cost: { food: 25, rubber: 10 } },
]

const COST_LABEL: Record<string, string> = {
  food: 'Food', medicine: 'Med', rubber: 'Rubber', ivory: 'Ivory', ammunition: 'Ammo',
}

export function ShipyardPanel({ onClose }: { onClose: () => void }) {
  const nodes           = useGameStore(s => s.nodes)
  const ships           = useGameStore(s => s.ships)
  const buildQueue      = useGameStore(s => s.buildQueue)
  const companyRevenue  = useGameStore(s => s.companyRevenue)
  const pendingConvoys  = useGameStore(s => s.pendingConvoys)
  const startBuild      = useGameStore(s => s.startBuild)
  const cancelBuild     = useGameStore(s => s.cancelBuild)

  const [nameIdx, setNameIdx] = useState(0)
  const origin = nodes['origin']

  const canAfford = (type: 'canoe' | 'steamer' | 'barge') => {
    const cost = SHIP_DEFS.find(d => d.type === type)!.cost
    return companyRevenue >= SHIP_REVENUE_COST[type] &&
      Object.entries(cost).every(([r, v]) => (origin?.stockpile[r as ResourceType] ?? 0) >= (v ?? 0))
  }

  const pickName = () => {
    const name = SHIP_NAMES[nameIdx % SHIP_NAMES.length]
    setNameIdx(i => i + 1)
    return name
  }

  // Fleet upkeep summary
  const activeShips = Object.values(ships).filter(s =>
    s.state !== 'unassigned' && s.state !== 'captured'
  )
  const upkeepPerTick = activeShips.reduce(
    (sum, s) => sum + SHIP_UPKEEP_FOOD[s.type], 0
  )

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
        <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700 }}>⚒ SHIPYARD</div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#6b7280',
          cursor: 'pointer', fontSize: 16, padding: '0 4px',
        }}>✕</button>
      </div>

      {/* Revenue + upkeep summary */}
      <div style={{
        padding: '10px 12px', background: '#111827', border: '1px solid #1f2937',
        borderRadius: 6, marginBottom: 14, display: 'flex', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
            Treasury
          </div>
          <div style={{ fontSize: 18, color: '#f59e0b', fontWeight: 700 }}>
            ₪ {Math.round(companyRevenue)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
            Fleet Upkeep
          </div>
          <div style={{ fontSize: 12, color: '#a3e635' }}>
            {activeShips.length} active · {upkeepPerTick.toFixed(2)} food/t
          </div>
        </div>
      </div>

      {/* Commission ships */}
      <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        Commission Ships
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {SHIP_DEFS.map(({ type, label, detail, cost }) => {
          const affordable = canAfford(type)
          const revCost    = SHIP_REVENUE_COST[type]
          const costLabel  = Object.entries(cost)
            .map(([r, v]) => `${v} ${COST_LABEL[r]}`)
            .join(' + ')
          return (
            <div key={type} style={{
              padding: '10px 12px', background: '#111827',
              border: '1px solid #1f2937', borderRadius: 6,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#e5e7eb', fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>{detail}</div>
                </div>
                <button
                  onClick={() => { if (affordable) startBuild(type, pickName()) }}
                  disabled={!affordable}
                  style={{
                    padding: '4px 12px', fontSize: 11, fontFamily: 'monospace',
                    cursor: affordable ? 'pointer' : 'default',
                    borderRadius: 3,
                    background: affordable ? '#064e3b' : '#1f2937',
                    color:      affordable ? '#10b981' : '#4b5563',
                    border: `1px solid ${affordable ? '#065f46' : '#374151'}`,
                  }}>
                  {affordable ? 'Commission' : 'Insufficient'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 10 }}>
                <span style={{ color: companyRevenue >= revCost ? '#f59e0b' : '#7f1d1d' }}>
                  ₪ {revCost}
                </span>
                <span style={{ color: '#6b7280' }}>+ {costLabel}</span>
                <span style={{ color: '#4b5563' }}>· upkeep {SHIP_UPKEEP_FOOD[type]} food/t</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Build queue */}
      {buildQueue.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Build Queue ({buildQueue.length})
          </div>
          {buildQueue.map(order => {
            const pct = Math.round((1 - order.ticksRemaining / order.totalTicks) * 100)
            return (
              <div key={order.id} style={{
                marginBottom: 6, padding: '8px 10px', background: '#111827',
                border: '1px solid #1f2937', borderRadius: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#e5e7eb' }}>{order.shipName}</span>
                  <span style={{ fontSize: 10, color: '#fbbf24' }}>{order.ticksRemaining}t left</span>
                  <button onClick={() => cancelBuild(order.id)} style={{
                    padding: '2px 8px', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer',
                    borderRadius: 3, background: '#450a0a', color: '#fca5a5', border: '1px solid #7f1d1d',
                  }}>✕</button>
                </div>
                <div style={{ height: 3, background: '#1f2937', borderRadius: 2 }}>
                  <div style={{
                    height: '100%', width: `${pct}%`, background: '#fbbf24',
                    borderRadius: 2, transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            )
          })}
          <div style={{ marginBottom: 16 }} />
        </>
      )}

      {/* Pending export convoys */}
      {pendingConvoys.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Export Convoys En Route ({pendingConvoys.length})
          </div>
          {pendingConvoys.map(convoy => (
            <div key={convoy.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 11, marginBottom: 5, padding: '6px 10px',
              background: '#111827', border: '1px solid #1f2937', borderRadius: 6,
            }}>
              <span style={{ color: '#9ca3af' }}>
                {convoy.rubber > 0 && `🌿 ${convoy.rubber} `}
                {convoy.ivory  > 0 && `🦷 ${convoy.ivory}`}
              </span>
              <span style={{ color: '#f59e0b' }}>+₪ {convoy.revenueDue}</span>
              <span style={{ color: '#6b7280' }}>{convoy.ticksRemaining}t</span>
            </div>
          ))}
        </>
      )}

      <div style={{ marginTop: 20, fontSize: 10, color: '#374151', lineHeight: 1.6 }}>
        Commission new ships here. Assign them from the Fleet panel. Revenue accrues when export convoys return from market.
      </div>
    </div>
  )
}
