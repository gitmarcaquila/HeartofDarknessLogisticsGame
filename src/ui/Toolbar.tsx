import { useGameStore } from '../store/gameStore'
import { GameSpeed, OverlayMode } from '../engine/types'

const SPEED_LABELS: Record<GameSpeed, string> = {
  0: '⏸',
  1: '▶',
  2: '▶▶',
  3: '▶▶▶',
}

const OVERLAY_LABELS: Record<OverlayMode, string> = {
  trade: 'Trade',
  influence: 'Influence',
  instability: 'Instability',
  personnel: 'Personnel',
}

function Btn({
  active, onClick, children,
}: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px',
        background: active ? '#3b82f6' : '#1f2937',
        color: active ? '#fff' : '#9ca3af',
        border: '1px solid ' + (active ? '#3b82f6' : '#374151'),
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 12,
        fontFamily: 'monospace',
        marginRight: 4,
      }}
    >
      {children}
    </button>
  )
}

export function Toolbar({ onToggleFleet, fleetOpen }: { onToggleFleet: () => void; fleetOpen: boolean }) {
  const tick = useGameStore(s => s.tick)
  const speed = useGameStore(s => s.speed)
  const overlayMode = useGameStore(s => s.overlayMode)
  const setSpeed = useGameStore(s => s.setSpeed)
  const setOverlayMode = useGameStore(s => s.setOverlayMode)
  const ships = useGameStore(s => s.ships)
  const unassignedCount = Object.values(ships).filter(s => s.state === 'unassigned').length

  // Resource totals across all nodes
  const nodes = useGameStore(s => s.nodes)
  const totals = Object.values(nodes).reduce(
    (acc, n) => {
      acc.food += n.stockpile.food
      acc.rubber += n.stockpile.rubber
      acc.ivory += n.stockpile.ivory
      return acc
    },
    { food: 0, rubber: 0, ivory: 0 }
  )

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 52,
      background: 'rgba(13, 17, 23, 0.95)',
      borderBottom: '1px solid #1f2937',
      display: 'flex', alignItems: 'center',
      padding: '0 16px',
      gap: 16,
      backdropFilter: 'blur(8px)',
      zIndex: 10,
    }}>
      {/* Title */}
      <span style={{ color: '#f59e0b', fontFamily: 'monospace', fontWeight: 700, fontSize: 14, marginRight: 8 }}>
        INTO THE CURRENT
      </span>

      {/* Tick counter */}
      <span style={{ color: '#4b5563', fontSize: 11, fontFamily: 'monospace', marginRight: 8 }}>
        Day {tick}
      </span>

      {/* Speed controls */}
      <div style={{ display: 'flex', gap: 2 }}>
        {([0, 1, 2, 3] as GameSpeed[]).map(s => (
          <Btn key={s} active={speed === s} onClick={() => setSpeed(s)}>
            {SPEED_LABELS[s]}
          </Btn>
        ))}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: '#1f2937' }} />

      {/* Overlay toggles */}
      <div style={{ display: 'flex', gap: 2 }}>
        {(Object.keys(OVERLAY_LABELS) as OverlayMode[]).map(m => (
          <Btn key={m} active={overlayMode === m} onClick={() => setOverlayMode(m)}>
            {OVERLAY_LABELS[m]}
          </Btn>
        ))}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: '#1f2937' }} />

      {/* Fleet button */}
      <div style={{ position: 'relative' }}>
        <Btn active={fleetOpen} onClick={onToggleFleet}>
          ⛵ Fleet
        </Btn>
        {unassignedCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#f59e0b', color: '#000',
            borderRadius: '50%', width: 14, height: 14,
            fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>{unassignedCount}</span>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: '#1f2937' }} />

      {/* Global resource summary */}
      <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: 'monospace' }}>
        <span style={{ color: '#10b981' }}>🌾 {Math.round(totals.food)}</span>
        <span style={{ color: '#a3e635' }}>🌿 {Math.round(totals.rubber)}</span>
        <span style={{ color: '#fbbf24' }}>🦷 {Math.round(totals.ivory)}</span>
      </div>
    </div>
  )
}
