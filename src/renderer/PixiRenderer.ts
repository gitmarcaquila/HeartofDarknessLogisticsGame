import * as PIXI from 'pixi.js'
import { GameState, RiverEdge, RiverNode, Ship, ShipState, OverlayMode } from '../engine/types'

// ─── Color helpers ────────────────────────────────────────────────────────────

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  )
}

function stabilityColor(instability: number): number {
  if (instability < 40) return lerpColor(0x22c55e, 0xeab308, instability / 40)
  return lerpColor(0xeab308, 0xef4444, (instability - 40) / 60)
}

function influenceColor(influence: number): number {
  return lerpColor(0x4b5563, 0x3b82f6, influence / 100)
}

// Build a wide rectangle polygon along a line for reliable click detection
function lineHitPolygon(
  from: { x: number; y: number },
  to:   { x: number; y: number },
  halfWidth: number
): PIXI.Polygon {
  const dx = to.x - from.x, dy = to.y - from.y
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const px = (-dy / len) * halfWidth
  const py = ( dx / len) * halfWidth
  return new PIXI.Polygon([
    from.x + px, from.y + py,
    to.x   + px, to.y   + py,
    to.x   - px, to.y   - py,
    from.x - px, from.y - py,
  ])
}

// Draw a directional arrowhead centered at (cx, cy) pointing along (ux, uy)
function drawArrowhead(
  gfx: PIXI.Graphics,
  cx: number, cy: number,
  size: number,
  ux: number, uy: number   // unit travel vector
): void {
  const px = -uy, py = ux  // perpendicular
  gfx.drawPolygon([
    cx + ux * size,                          cy + uy * size,          // tip
    cx - ux * size * 0.6 + px * size * 0.85, cy - uy * size * 0.6 + py * size * 0.85,  // back-left
    cx - ux * size * 0.25,                   cy - uy * size * 0.25,  // back-indent
    cx - ux * size * 0.6 - px * size * 0.85, cy - uy * size * 0.6 - py * size * 0.85,  // back-right
  ])
}

// Destroy all children of a container, freeing their WebGL resources
function destroyChildren(container: PIXI.Container): void {
  for (let i = container.children.length - 1; i >= 0; i--) {
    container.children[i].destroy({ children: true, texture: false, baseTexture: false })
  }
}

const SHIP_STATE_COLOR: Record<ShipState, number> = {
  unassigned:       0x6b7280,
  waiting_berth:    0xa855f7,  // purple — queued outside the port
  docked_loading:   0xfbbf24,
  docked_unloading: 0xf59e0b,
  in_transit:       0x06b6d4,
  stranded:         0xf97316,
  damaged:          0xef4444,
  captured:         0x7f1d1d,
}

const SHIP_SIZE: Record<string, number> = {
  canoe: 4,
  steamer: 6,
  barge: 8,
}

// ─── PixiRenderer ─────────────────────────────────────────────────────────────

export class PixiRenderer {
  app: PIXI.Application
  private world:        PIXI.Container   // panned world container
  private edgeLayer:    PIXI.Container
  private nodeLayer:    PIXI.Container
  private shipLayer:    PIXI.Container

  private onNodeClick?: (id: string) => void
  private onEdgeClick?: (id: string) => void
  private onShipClick?: (id: string) => void

  constructor(container: HTMLElement) {
    this.app = new PIXI.Application({
      resizeTo: container,
      backgroundColor: 0x0d1117,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })
    container.appendChild(this.app.view as HTMLCanvasElement)

    // World container — all game layers live here so panning moves everything
    this.world      = new PIXI.Container()
    this.edgeLayer  = new PIXI.Container()
    this.shipLayer  = new PIXI.Container()
    this.nodeLayer  = new PIXI.Container()

    this.world.addChild(this.edgeLayer)
    this.world.addChild(this.shipLayer)
    this.world.addChild(this.nodeLayer)
    this.app.stage.addChild(this.world)

    this.setupPan()
  }

  private setupPan() {
    const stage = this.app.stage
    stage.eventMode = 'static'
    stage.hitArea   = new PIXI.Rectangle(-10000, -10000, 20000, 20000)

    let dragOrigin:  { x: number; y: number } | null = null
    let worldOrigin: { x: number; y: number } = { x: 0, y: 0 }
    let didDrag = false

    stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      dragOrigin  = { x: e.global.x, y: e.global.y }
      worldOrigin = { x: this.world.x, y: this.world.y }
      didDrag     = false
    })

    stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!dragOrigin) return
      const dx = e.global.x - dragOrigin.x
      const dy = e.global.y - dragOrigin.y
      if (!didDrag && Math.sqrt(dx * dx + dy * dy) > 5) didDrag = true
      if (didDrag) {
        this.world.x = worldOrigin.x + dx
        this.world.y = worldOrigin.y + dy
      }
    })

    stage.on('pointerup',        () => { dragOrigin = null; didDrag = false })
    stage.on('pointerupoutside', () => { dragOrigin = null; didDrag = false })
  }

  setCallbacks(
    onNodeClick: (id: string) => void,
    onEdgeClick: (id: string) => void,
    onShipClick: (id: string) => void,
  ) {
    this.onNodeClick = onNodeClick
    this.onEdgeClick = onEdgeClick
    this.onShipClick = onShipClick
  }

  render(state: GameState) {
    destroyChildren(this.edgeLayer)
    destroyChildren(this.nodeLayer)
    destroyChildren(this.shipLayer)
    this.drawEdges(state)
    this.drawShips(state)
    this.drawNodes(state)
  }

  // ─── Edges ─────────────────────────────────────────────────────────────────

  private drawEdges(state: GameState) {
    for (const edge of Object.values(state.edges)) {
      const from = state.nodes[edge.fromId]
      const to   = state.nodes[edge.toId]
      if (!from || !to) continue

      const color = this.edgeColor(edge, state.overlayMode)

      // Count ships on this edge to scale thickness
      const shipsOnEdge = Object.values(state.ships).filter(
        s => s.currentEdgeId === edge.id
      ).length
      const thickness = Math.max(3, Math.min(10, 3 + shipsOnEdge * 2))

      // Glow
      const glow = new PIXI.Graphics()
      glow.lineStyle(thickness + 8, color, 0.12)
      glow.moveTo(from.position.x, from.position.y)
      glow.lineTo(to.position.x, to.position.y)
      this.edgeLayer.addChild(glow)

      // Main line
      const line = new PIXI.Graphics()
      line.lineStyle(thickness, color, 0.8)
      line.moveTo(from.position.x, from.position.y)
      line.lineTo(to.position.x, to.position.y)
      // Wide invisible hit polygon so thin lines are easy to click
      line.hitArea = lineHitPolygon(from.position, to.position, 20)
      line.eventMode = 'static'
      line.cursor = 'pointer'
      line.on('pointerdown', (e) => { e.stopPropagation(); this.onEdgeClick?.(edge.id) })
      this.edgeLayer.addChild(line)

      // Chokepoint diamond marker at midpoint
      if (edge.isChokepoint) {
        const mx = (from.position.x + to.position.x) / 2
        const my = (from.position.y + to.position.y) / 2
        const m = new PIXI.Graphics()
        m.lineStyle(2, 0xfbbf24, 1)
        m.drawPolygon([mx, my - 10, mx + 8, my, mx, my + 10, mx - 8, my])
        this.edgeLayer.addChild(m)
      }

      // Flood label
      if (edge.isFlooded) {
        const mx = (from.position.x + to.position.x) / 2
        const my = (from.position.y + to.position.y) / 2
        const t = new PIXI.Text('⚠ FLOODED', { fontSize: 10, fill: 0x60a5fa, fontFamily: 'monospace' })
        t.position.set(mx - 30, my - 16)
        this.edgeLayer.addChild(t)
      }
    }
  }

  private edgeColor(edge: RiverEdge, mode: OverlayMode): number {
    if (mode === 'trade' || mode === 'instability') return stabilityColor(edge.instability)
    return 0x374151
  }

  // ─── Ships ─────────────────────────────────────────────────────────────────

  private drawShips(state: GameState) {
    // Track how many ships are docked at each node for clustering
    const dockedAtNode: Record<string, number> = {}
    const dockedIndexAt: Record<string, number> = {}

    for (const ship of Object.values(state.ships)) {
      const color = SHIP_STATE_COLOR[ship.state]
      const size  = SHIP_SIZE[ship.type] ?? 6
      const isSelected = state.selectedShipId === ship.id

      let x: number, y: number
      let travelUx = 0, travelUy = 0  // unit travel vector (set for in_transit ships)

      if (ship.state === 'in_transit' && ship.currentEdgeId) {
        // Position along edge
        const edge = state.edges[ship.currentEdgeId]
        if (!edge) continue
        const from = state.nodes[edge.fromId]
        const to   = state.nodes[edge.toId]
        if (!from || !to) continue

        // Perpendicular offset so multiple ships on same edge don't stack
        const shipsOnEdge = Object.values(state.ships).filter(
          s => s.currentEdgeId === ship.currentEdgeId && s.state === 'in_transit'
        )
        const idx = shipsOnEdge.findIndex(s => s.id === ship.id)
        const count = shipsOnEdge.length
        const offset = (idx - (count - 1) / 2) * 10

        const dx = to.position.x - from.position.x
        const dy = to.position.y - from.position.y
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        const px = -dy / len  // perpendicular x
        const py =  dx / len  // perpendicular y

        // ship.locationNodeId is the departure node. If it matches edge.fromId
        // the ship is going forward (from→to); otherwise it's returning (to→from).
        const goingForward = ship.locationNodeId === edge.fromId

        if (goingForward) {
          x = from.position.x + dx * ship.edgeProgress + px * offset
          y = from.position.y + dy * ship.edgeProgress + py * offset
        } else {
          x = to.position.x - dx * ship.edgeProgress + px * offset
          y = to.position.y - dy * ship.edgeProgress + py * offset
        }

        // Travel direction unit vector for the arrowhead
        const tdx = goingForward ? dx : -dx
        const tdy = goingForward ? dy : -dy
        const tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1
        travelUx = tdx / tlen
        travelUy = tdy / tlen

      } else {
        // Docked/unassigned — cluster around the node
        const nodeId = ship.locationNodeId
        if (!(nodeId in dockedAtNode)) dockedAtNode[nodeId] = 0
        const idx   = dockedAtNode[nodeId]++
        dockedIndexAt[ship.id] = idx

        const node = state.nodes[nodeId]
        if (!node) continue

        const total = Object.values(state.ships).filter(
          s => s.locationNodeId === nodeId && s.state !== 'in_transit'
        ).length
        const angle = (idx / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2
        const r = 28

        x = node.position.x + Math.cos(angle) * r
        y = node.position.y + Math.sin(angle) * r
      }

      // Selection glow
      if (isSelected) {
        const sel = new PIXI.Graphics()
        sel.beginFill(0xffffff, 0.25)
        sel.drawCircle(x, y, size + 5)
        sel.endFill()
        this.shipLayer.addChild(sel)
      }

      // Ship shape: arrowhead when in transit (shows direction), diamond when docked
      const gfx = new PIXI.Graphics()
      gfx.beginFill(color, 1)
      gfx.lineStyle(1.5, 0x0d1117, 0.8)
      if (ship.state === 'in_transit') {
        drawArrowhead(gfx, x, y, size, travelUx, travelUy)
      } else {
        gfx.drawPolygon([x, y - size, x + size, y, x, y + size, x - size, y])
      }
      gfx.endFill()
      gfx.eventMode = 'static'
      gfx.cursor = 'pointer'
      gfx.on('pointerdown', (e) => { e.stopPropagation(); this.onShipClick?.(ship.id) })
      this.shipLayer.addChild(gfx)

      // Event note badge
      if (ship.eventNote) {
        const dot = new PIXI.Graphics()
        dot.beginFill(0xef4444, 1)
        dot.drawCircle(x + size, y - size, 3)
        dot.endFill()
        this.shipLayer.addChild(dot)
      }

      // Name label (only when selected)
      if (isSelected) {
        const lbl = new PIXI.Text(ship.name, {
          fontSize: 9, fill: 0xe5e7eb, fontFamily: 'monospace',
        })
        lbl.anchor.set(0.5, 0)
        lbl.position.set(x, y + size + 3)
        this.shipLayer.addChild(lbl)
      }
    }
  }

  // ─── Nodes ─────────────────────────────────────────────────────────────────

  private drawNodes(state: GameState) {
    for (const node of Object.values(state.nodes)) {
      const isSelected = state.selectedNodeId === node.id
      const color  = this.nodeColor(node, state.overlayMode)
      const radius = node.type === 'origin' ? 18 : node.type === 'chokepoint' ? 12 : 14

      if (isSelected) {
        const ring = new PIXI.Graphics()
        ring.lineStyle(3, 0xffffff, 0.8)
        ring.drawCircle(node.position.x, node.position.y, radius + 6)
        this.nodeLayer.addChild(ring)
      }

      const circle = new PIXI.Graphics()
      circle.beginFill(color, 1)
      circle.lineStyle(2, 0x0d1117, 1)
      circle.drawCircle(node.position.x, node.position.y, radius)
      circle.endFill()
      circle.eventMode = 'static'
      circle.cursor = 'pointer'
      circle.on('pointerdown', (e) => { e.stopPropagation(); this.onNodeClick?.(node.id) })
      this.nodeLayer.addChild(circle)

      // Morale arc
      const arc = new PIXI.Graphics()
      arc.lineStyle(3, 0x10b981, 0.7)
      arc.arc(
        node.position.x, node.position.y, radius + 4,
        -Math.PI / 2,
        -Math.PI / 2 + (Math.PI * 2 * node.morale) / 100
      )
      this.nodeLayer.addChild(arc)

      // Label
      const label = new PIXI.Text(node.name, {
        fontSize: 10, fill: 0xe5e7eb, fontFamily: 'monospace', align: 'center',
      })
      label.anchor.set(0.5, 0)
      label.position.set(node.position.x, node.position.y + radius + 5)
      this.nodeLayer.addChild(label)

      if (node.instability > 60) {
        const warn = new PIXI.Text('!', { fontSize: 13, fill: 0xef4444, fontFamily: 'monospace' })
        warn.anchor.set(0.5, 0.5)
        warn.position.set(node.position.x + radius - 2, node.position.y - radius + 2)
        this.nodeLayer.addChild(warn)
      }
    }
  }

  private nodeColor(node: RiverNode, mode: OverlayMode): number {
    if (mode === 'influence')   return influenceColor(node.influence)
    if (mode === 'instability') return stabilityColor(node.instability)
    const colors: Record<string, number> = {
      origin: 0xf59e0b, outpost: 0x6366f1, settlement: 0x10b981,
      chokepoint: 0xef4444, confluence: 0x8b5cf6,
    }
    return colors[node.type] ?? 0x6b7280
  }

  destroy() {
    this.app.destroy(true, { children: true })
  }
}
