import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { PixiRenderer } from '../renderer/PixiRenderer'
import { Toolbar } from './Toolbar'
import { Sidebar } from './Sidebar'
import { FleetPanel } from './FleetPanel'
import { ShipyardPanel } from './ShipyardPanel'

const TICK_INTERVALS: Record<number, number> = {
  0: 0,
  1: 2000,
  2: 800,
  3: 200,
}

export function App() {
  const [fleetOpen,    setFleetOpen]    = useState(false)
  const [shipyardOpen, setShipyardOpen] = useState(false)
  const containerRef   = useRef<HTMLDivElement>(null)
  const rendererRef    = useRef<PixiRenderer | null>(null)
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const selectNode = useGameStore(s => s.selectNode)
  const selectEdge = useGameStore(s => s.selectEdge)
  const selectShip = useGameStore(s => s.selectShip)
  const currentTick = useGameStore(s => s.tick)
  const speed = useGameStore(s => s.speed)

  // Boot PixiJS renderer once
  useEffect(() => {
    if (!containerRef.current) return

    const renderer = new PixiRenderer(containerRef.current)
    renderer.setCallbacks(selectNode, selectEdge, selectShip)
    rendererRef.current = renderer

    // Initial draw
    renderer.render(useGameStore.getState())

    return () => {
      renderer.destroy()
      rendererRef.current = null
    }
  }, []) // eslint-disable-line

  // Game tick loop
  useEffect(() => {
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current)
    const interval = TICK_INTERVALS[speed]
    if (interval > 0) {
      tickIntervalRef.current = setInterval(() => {
        useGameStore.getState().advanceTick()
      }, interval)
    }
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current)
    }
  }, [speed])

  // Force a render pass on tick change
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.render(useGameStore.getState())
    }
  }, [currentTick])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', fontFamily: 'monospace' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <Toolbar
        onToggleFleet={() => { setFleetOpen(o => !o); setShipyardOpen(false) }}
        fleetOpen={fleetOpen}
        onToggleShipyard={() => { setShipyardOpen(o => !o); setFleetOpen(false) }}
        shipyardOpen={shipyardOpen}
      />
      {fleetOpen    && <FleetPanel    onClose={() => setFleetOpen(false)} />}
      {shipyardOpen && <ShipyardPanel onClose={() => setShipyardOpen(false)} />}
      <Sidebar />
    </div>
  )
}
