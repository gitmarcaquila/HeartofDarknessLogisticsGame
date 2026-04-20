import { useGameStore } from '../store/gameStore'
import { OfficerRole, RECRUIT_OFFICER_REVENUE_COST, RECRUIT_OFFICER_ARRIVAL_TICKS } from '../engine/types'

const ROLE_COLOR: Record<OfficerRole, string> = {
  logistics:  '#10b981',
  military:   '#ef4444',
  diplomatic: '#8b5cf6',
  medical:    '#06b6d4',
}

const ROLE_DESCRIPTION: Record<OfficerRole, string> = {
  logistics:  'Cuts port corruption skim by 60% at stationed node',
  military:   'Suppresses edge instability on routes into stationed node',
  diplomatic: 'Doubles native-influence erosion at stationed node',
  medical:    'Morale +0.3/tick at stationed node',
}

const ROLE_ORDER: OfficerRole[] = ['logistics', 'military', 'diplomatic', 'medical']

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 16 }}>
      {children}
    </div>
  )
}

export function OfficersPanel({ onClose }: { onClose: () => void }) {
  const officers        = useGameStore(s => s.officers)
  const nodes           = useGameStore(s => s.nodes)
  const companyRevenue  = useGameStore(s => s.companyRevenue)
  const transferOfficer = useGameStore(s => s.transferOfficer)
  const recruitOfficer  = useGameStore(s => s.recruitOfficer)

  const all        = Object.values(officers)
  const stationed  = all.filter(o => o.state === 'stationed')
  const inTransit  = all.filter(o => o.state === 'in_transit')

  const canRecruit = companyRevenue >= RECRUIT_OFFICER_REVENUE_COST

  const otherNodes = (currentId: string) => Object.values(nodes).filter(n => n.id !== currentId)

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
        <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700 }}>👥 OFFICERS</div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#6b7280',
          cursor: 'pointer', fontSize: 16, padding: '0 4px',
        }}>✕</button>
      </div>

      {/* Summary */}
      <div style={{
        padding: '8px 12px', background: '#111827', border: '1px solid #1f2937',
        borderRadius: 6, marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11,
      }}>
        <span style={{ color: '#9ca3af' }}>Total roster</span>
        <span style={{ color: '#e5e7eb' }}>
          {stationed.length} stationed · {inTransit.length} in transit
        </span>
      </div>

      {/* Stationed roster */}
      {stationed.length > 0 && (
        <>
          <SectionLabel>Stationed</SectionLabel>
          {stationed.map(off => {
            const location = nodes[off.locationId]
            const others   = otherNodes(off.locationId)
            return (
              <div key={off.id} style={{
                marginBottom: 8, padding: '10px 12px', background: '#111827',
                border: `1px solid ${ROLE_COLOR[off.role]}33`, borderRadius: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#e5e7eb', fontWeight: 600 }}>{off.name}</span>
                  <span style={{ fontSize: 9, color: ROLE_COLOR[off.role], textTransform: 'uppercase', letterSpacing: 1 }}>
                    {off.role}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>
                  <span style={{ color: '#f59e0b' }}>●</span> Stationed at <span style={{ color: '#e5e7eb' }}>{location?.name ?? off.locationId}</span>
                </div>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 8, lineHeight: 1.4 }}>
                  {ROLE_DESCRIPTION[off.role]}
                </div>
                <select
                  value=""
                  onChange={e => { if (e.target.value) transferOfficer(off.id, e.target.value) }}
                  style={{
                    width: '100%', padding: '3px 6px',
                    background: '#0d1117', border: '1px solid #374151', borderRadius: 3,
                    color: '#9ca3af', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer',
                  }}
                >
                  <option value="">Transfer to…</option>
                  {others.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
            )
          })}
        </>
      )}

      {/* In-transit officers */}
      {inTransit.length > 0 && (
        <>
          <SectionLabel>In Transit</SectionLabel>
          {inTransit.map(off => {
            const dest       = off.destinationId ? nodes[off.destinationId] : undefined
            const fromRecruit = off.locationId === off.destinationId && off.locationId === 'origin'
            return (
              <div key={off.id} style={{
                marginBottom: 6, padding: '8px 12px', background: '#0d1117',
                border: '1px dashed #374151', borderRadius: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{off.name}</span>
                  <span style={{ fontSize: 9, color: ROLE_COLOR[off.role], textTransform: 'uppercase', letterSpacing: 1 }}>
                    {off.role}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#06b6d4', marginTop: 4 }}>
                  ● {fromRecruit ? 'Sailing from Europe' : `En route to ${dest?.name ?? off.destinationId}`} · {off.transitTicksRemaining ?? '?'}t
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* Recruitment */}
      <SectionLabel>Recruit from Europe</SectionLabel>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 8, lineHeight: 1.5 }}>
        Each recruit sails from Brussels. Arrives at Company Station in {RECRUIT_OFFICER_ARRIVAL_TICKS} ticks, then can be posted to any node.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ROLE_ORDER.map(role => (
          <button
            key={role}
            onClick={() => { if (canRecruit) recruitOfficer(role) }}
            disabled={!canRecruit}
            style={{
              padding: '8px 10px', textAlign: 'left',
              fontSize: 11, fontFamily: 'monospace',
              cursor: canRecruit ? 'pointer' : 'default',
              background: canRecruit ? '#111827' : '#0d1117',
              border: `1px solid ${canRecruit ? ROLE_COLOR[role] + '55' : '#374151'}`,
              borderRadius: 6,
              color: canRecruit ? '#e5e7eb' : '#4b5563',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: canRecruit ? ROLE_COLOR[role] : '#4b5563', textTransform: 'uppercase', letterSpacing: 1, fontSize: 10, fontWeight: 700 }}>
                {role}
              </span>
              <span style={{ color: canRecruit ? '#f59e0b' : '#4b5563' }}>
                💰 {RECRUIT_OFFICER_REVENUE_COST}
              </span>
            </div>
            <div style={{ fontSize: 9, color: canRecruit ? '#9ca3af' : '#4b5563', lineHeight: 1.4 }}>
              {ROLE_DESCRIPTION[role]}
            </div>
          </button>
        ))}
      </div>

      {!canRecruit && (
        <div style={{ marginTop: 8, fontSize: 10, color: '#7f1d1d' }}>
          Need 💰 {RECRUIT_OFFICER_REVENUE_COST} to recruit. Treasury: 💰 {Math.round(companyRevenue)}.
        </div>
      )}
    </div>
  )
}
