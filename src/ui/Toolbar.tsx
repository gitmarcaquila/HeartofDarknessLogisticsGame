import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { GameSpeed, OverlayMode, RESOURCE_TYPES, ResourceType, EconomicEvent } from '../engine/types'

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

// ─── Hover Tooltip ────────────────────────────────────────────────────────────

function Tooltip({
  anchor, visible, children,
}: { anchor: { x: number; y: number } | null; visible: boolean; children: React.ReactNode }) {
  if (!visible || !anchor) return null
  return (
    <div style={{
      position: 'fixed',
      top: anchor.y + 20,
      left: anchor.x - 8,
      background: 'rgba(13, 17, 23, 0.98)',
      border: '1px solid #374151',
      borderRadius: 6,
      padding: '10px 12px',
      fontSize: 11,
      fontFamily: 'monospace',
      color: '#e5e7eb',
      minWidth: 220,
      maxWidth: 340,
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      zIndex: 100,
      pointerEvents: 'none',
      lineHeight: 1.5,
    }}>
      {children}
    </div>
  )
}

function HoverStat({
  tooltip, children,
}: { tooltip: React.ReactNode; children: React.ReactNode }) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  return (
    <>
      <span
        style={{ cursor: 'help' }}
        onMouseEnter={e => setAnchor({ x: e.clientX, y: e.clientY })}
        onMouseMove={e => setAnchor({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setAnchor(null)}
      >
        {children}
      </span>
      <Tooltip anchor={anchor} visible={!!anchor}>{tooltip}</Tooltip>
    </>
  )
}

// ─── Convoy Toast ─────────────────────────────────────────────────────────────

interface Toast { id: string; text: string; color: string; tickSeen: number }

function useConvoyToasts(events: EconomicEvent[]): Toast[] {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seenIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    const newToasts: Toast[] = []
    for (const ev of events) {
      if (seenIds.current.has(ev.id)) continue
      seenIds.current.add(ev.id)
      if (ev.type === 'convoy_departed') {
        const goods = [ev.rubber > 0 && `${ev.rubber} rubber`, ev.ivory > 0 && `${ev.ivory} ivory`]
          .filter(Boolean).join(' + ')
        newToasts.push({
          id: ev.id,
          text: `Trade Convoy departed with ${goods} · 💰${ev.revenue} expected`,
          color: '#a3e635',
          tickSeen: Date.now(),
        })
      } else if (ev.type === 'convoy_arrived') {
        newToasts.push({
          id: ev.id,
          text: `Convoy returned from market: +💰${ev.revenue} banked`,
          color: '#f59e0b',
          tickSeen: Date.now(),
        })
      }
    }
    if (newToasts.length > 0) {
      setToasts(t => [...t, ...newToasts])
    }
    const now = Date.now()
    setToasts(t => t.filter(x => now - x.tickSeen < 4500))
  }, [events])

  return toasts
}

// ─── Stat Tooltips ────────────────────────────────────────────────────────────

function ResourceTooltip({ resource }: { resource: ResourceType }) {
  const nodes = useGameStore(s => s.nodes)
  const rows = Object.values(nodes)
    .filter(n => n.stockpile[resource] > 0 || n.production[resource] > 0 || n.demand[resource] > 0)
    .map(n => {
      const net = n.production[resource] - n.demand[resource]
      const netStr = net === 0 ? '—' : net > 0 ? `+${net.toFixed(2)}` : net.toFixed(2)
      const netColor = net > 0 ? '#10b981' : net < 0 ? '#ef4444' : '#6b7280'
      return { name: n.name, stock: Math.round(n.stockpile[resource]), net: netStr, netColor }
    })

  const label = { food: 'Food', medicine: 'Medicine', rubber: 'Rubber', ivory: 'Ivory', ammunition: 'Ammunition' }[resource]

  return (
    <>
      <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '4px 12px' }}>
        <span style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase' }}>Port</span>
        <span style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', textAlign: 'right' }}>Stock</span>
        <span style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', textAlign: 'right' }}>Net/t</span>
        {rows.map((r, i) => (
          <span key={`r${i}`} style={{ display: 'contents' }}>
            <span style={{ color: '#9ca3af' }}>{r.name}</span>
            <span style={{ textAlign: 'right' }}>{r.stock}</span>
            <span style={{ textAlign: 'right', color: r.netColor }}>{r.net}</span>
          </span>
        ))}
      </div>
    </>
  )
}

function RevenueTooltip() {
  const companyRevenue        = useGameStore(s => s.companyRevenue)
  const lifetimeRevenueEarned = useGameStore(s => s.lifetimeRevenueEarned)
  const pendingConvoys        = useGameStore(s => s.pendingConvoys)
  const pendingRevenue        = pendingConvoys.reduce((s, c) => s + c.revenueDue, 0)

  return (
    <>
      <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700, marginBottom: 8 }}>Company Revenue</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ color: '#9ca3af' }}>Treasury</span>
        <span style={{ color: '#f59e0b' }}>💰 {Math.round(companyRevenue)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ color: '#9ca3af' }}>Lifetime earned</span>
        <span>💰 {Math.round(lifetimeRevenueEarned)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ color: '#9ca3af' }}>In transit</span>
        <span style={{ color: '#a3e635' }}>💰 {pendingRevenue}</span>
      </div>
      {pendingConvoys.length > 0 && (
        <>
          <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>Convoys en route</div>
          {pendingConvoys.slice(0, 5).map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
              <span style={{ color: '#6b7280' }}>
                {c.rubber > 0 && `🌿${c.rubber} `}{c.ivory > 0 && `🦷${c.ivory}`}
              </span>
              <span style={{ color: '#a3e635' }}>💰{c.revenueDue}</span>
              <span style={{ color: '#6b7280' }}>{c.ticksRemaining}t</span>
            </div>
          ))}
        </>
      )}
      {pendingConvoys.length === 0 && (
        <div style={{ fontSize: 10, color: '#4b5563' }}>No convoys in transit. Next departs every 60t if origin has rubber or ivory.</div>
      )}
    </>
  )
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

export function Toolbar({
  onToggleFleet, fleetOpen,
  onToggleShipyard, shipyardOpen,
}: {
  onToggleFleet: () => void; fleetOpen: boolean
  onToggleShipyard: () => void; shipyardOpen: boolean
}) {
  const tick           = useGameStore(s => s.tick)
  const speed          = useGameStore(s => s.speed)
  const overlayMode    = useGameStore(s => s.overlayMode)
  const companyRevenue = useGameStore(s => s.companyRevenue)
  const setSpeed       = useGameStore(s => s.setSpeed)
  const setOverlayMode = useGameStore(s => s.setOverlayMode)
  const ships          = useGameStore(s => s.ships)
  const buildQueue     = useGameStore(s => s.buildQueue)
  const events         = useGameStore(s => s.economicEvents)
  const unassignedCount = Object.values(ships).filter(s => s.state === 'unassigned').length
  const buildCount      = buildQueue.length

  const nodes = useGameStore(s => s.nodes)
  const totals = Object.values(nodes).reduce(
    (acc, n) => {
      for (const r of RESOURCE_TYPES) acc[r] += n.stockpile[r]
      return acc
    },
    { food: 0, medicine: 0, rubber: 0, ivory: 0, ammunition: 0 } as Record<ResourceType, number>
  )

  // Pulse revenue on arrival
  const [pulseRevenue, setPulseRevenue] = useState(false)
  const lastRevenueRef = useRef(companyRevenue)
  useEffect(() => {
    if (companyRevenue > lastRevenueRef.current) {
      setPulseRevenue(true)
      const t = setTimeout(() => setPulseRevenue(false), 1200)
      return () => clearTimeout(t)
    }
    lastRevenueRef.current = companyRevenue
  }, [companyRevenue])

  const toasts = useConvoyToasts(events)

  return (
    <>
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
        <span style={{ color: '#f59e0b', fontFamily: 'monospace', fontWeight: 700, fontSize: 14, marginRight: 8 }}>
          INTO THE CURRENT
        </span>

        <span style={{ color: '#4b5563', fontSize: 11, fontFamily: 'monospace', marginRight: 8 }}>
          Day {tick}
        </span>

        <div style={{ display: 'flex', gap: 2 }}>
          {([0, 1, 2, 3] as GameSpeed[]).map(s => (
            <Btn key={s} active={speed === s} onClick={() => setSpeed(s)}>
              {SPEED_LABELS[s]}
            </Btn>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: '#1f2937' }} />

        <div style={{ display: 'flex', gap: 2 }}>
          {(Object.keys(OVERLAY_LABELS) as OverlayMode[]).map(m => (
            <Btn key={m} active={overlayMode === m} onClick={() => setOverlayMode(m)}>
              {OVERLAY_LABELS[m]}
            </Btn>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: '#1f2937' }} />

        {/* Fleet button */}
        <div style={{ position: 'relative' }}>
          <Btn active={fleetOpen} onClick={onToggleFleet}>⛵ Fleet</Btn>
          {unassignedCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: 0,
              background: '#f59e0b', color: '#000',
              borderRadius: '50%', width: 14, height: 14,
              fontSize: 9, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>{unassignedCount}</span>
          )}
        </div>

        {/* Shipyard button */}
        <div style={{ position: 'relative' }}>
          <Btn active={shipyardOpen} onClick={onToggleShipyard}>⚒ Shipyard</Btn>
          {buildCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: 0,
              background: '#fbbf24', color: '#000',
              borderRadius: '50%', width: 14, height: 14,
              fontSize: 9, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>{buildCount}</span>
          )}
        </div>

        <div style={{ width: 1, height: 24, background: '#1f2937' }} />

        <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: 'monospace' }}>
          <HoverStat tooltip={<ResourceTooltip resource="food" />}>
            <span style={{ color: '#10b981' }}>🌾 {Math.round(totals.food)}</span>
          </HoverStat>
          <HoverStat tooltip={<ResourceTooltip resource="rubber" />}>
            <span style={{ color: '#a3e635' }}>🌿 {Math.round(totals.rubber)}</span>
          </HoverStat>
          <HoverStat tooltip={<ResourceTooltip resource="ivory" />}>
            <span style={{ color: '#fbbf24' }}>🦷 {Math.round(totals.ivory)}</span>
          </HoverStat>
        </div>

        <div style={{ width: 1, height: 24, background: '#1f2937' }} />

        <HoverStat tooltip={<RevenueTooltip />}>
          <span style={{
            fontSize: 12, fontFamily: 'monospace',
            color: pulseRevenue ? '#fde047' : '#f59e0b',
            fontWeight: 700,
            textShadow: pulseRevenue ? '0 0 8px rgba(253,224,71,0.8)' : 'none',
            transition: 'color 0.2s, text-shadow 0.2s',
          }}>
            💰 {Math.round(companyRevenue)}
            <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 400, marginLeft: 4 }}>Revenue</span>
          </span>
        </HoverStat>
      </div>

      {/* Toast overlay */}
      <div style={{
        position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', gap: 4,
        zIndex: 50, pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: 'rgba(13, 17, 23, 0.95)',
            border: `1px solid ${t.color}`,
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 11,
            fontFamily: 'monospace',
            color: t.color,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(6px)',
            animation: 'fadeInOut 4.5s ease-in-out',
          }}>
            {t.text}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(-8px); }
          10%, 85% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }
      `}</style>
    </>
  )
}
