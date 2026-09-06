import type { HexCell, TerrainSymbol, TerrainType } from './types'

/** Axial hex neighbors (pointy-top). */
export const HEX_DIRS: [number, number][] = [
  [+1, 0],
  [+1, -1],
  [0, -1],
  [-1, 0],
  [-1, +1],
  [0, +1],
]

export type TileId = 'B' | 'C' | 'N' | 'I' | 'K' | 'end' | 'start' | 'seam'

export function hexKey(q: number, r: number): string {
  return `${q},${r}`
}

export function neighbors(q: number, r: number): [number, number][] {
  return HEX_DIRS.map(([dq, dr]) => [q + dq, r + dr])
}

/** Radius-3 large tile = 4 hexes along each side = 37 cells. */
export function largeHexCoords(radius = 3): [number, number][] {
  const out: [number, number][] = []
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius)
    const r2 = Math.min(radius, -q + radius)
    for (let r = r1; r <= r2; r++) out.push([q, r])
  }
  return out
}

/** 60° CW in axial coords. */
export function rotateQr(q: number, r: number, times: number): [number, number] {
  let qq = q
  let rr = r
  for (let i = 0; i < ((times % 6) + 6) % 6; i++) {
    const nq = -rr
    const nr = qq + rr
    qq = nq
    rr = nr
  }
  return [qq, rr]
}

export function hexToPixel(q: number, r: number, size: number): { x: number; y: number } {
  const x = size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r)
  const y = size * ((3 / 2) * r)
  return { x, y }
}

export function terrainSymbol(type: TerrainType): TerrainSymbol | null {
  if (type === 'jungle') return 'machete'
  if (type === 'river' || type === 'finish') return 'paddle'
  if (type === 'village') return 'coin'
  return null
}

type Terr = { type: TerrainType; power: number; isStart?: number }

function t(type: TerrainType, power = 1): Terr {
  return { type, power }
}

/**
 * Terrain for each printed tile (letter upright, pointy-top).
 * Matched from first-play reference + official space counts.
 *
 * B: 27 jungle (incl. 4 starts), 4 river, 3 village, 1 mountain, 1 camp
 * C: 6 jungle, 12 river, 9 village, 9 rubble, 1 mountain
 * N: 18 jungle, 9 river, 10 village
 * I: 17 jungle, 6 river, 6 village, 6 mountain, 1 camp, 1 rubble
 * K: 33 jungle, 1 river, 1 village, 2 camp
 */
const TILE_TERRAIN: Record<'B' | 'C' | 'N' | 'I' | 'K', Record<string, Terr>> = {
  B: {
    // Sampled from first-play reference (letter upright, pointy-top lattice).
    // Left-edge yellow was diagram label bleed — not a village.
    // 27 jungle + 4 river + 3 village + 1 mountain + 1 camp (+ 4 starts from jungle)
    '2,-3': t('river', 1),
    '0,-1': t('village', 1),
    '2,-1': t('village', 1),
    '-2,0': t('river', 1),
    '2,1': t('river', 1),
    '1,2': t('river', 1),
    '0,2': t('village', 1),
    '-1,3': t('mountain', 0),
    '0,3': t('camp', 1),
  },
  C: {
    '0,-3': t('river', 2),
    '1,-3': t('river', 1),
    '2,-3': t('river', 2),
    '3,-3': t('river', 1),
    '-1,-2': t('rubble', 2),
    '0,-2': t('rubble', 1),
    '1,-2': t('river', 2),
    '2,-2': t('river', 1),
    '3,-2': t('river', 2),
    '-2,-1': t('rubble', 1),
    '-1,-1': t('rubble', 1),
    '0,-1': t('river', 1),
    '1,-1': t('river', 1),
    '2,-1': t('village', 2),
    '3,-1': t('village', 1),
    '-3,0': t('rubble', 2),
    '-2,0': t('rubble', 2),
    '-1,0': t('rubble', 2),
    '0,0': t('mountain', 0),
    '1,0': t('village', 1),
    '2,0': t('village', 1),
    '3,0': t('village', 2),
    '-3,1': t('rubble', 2),
    '-2,1': t('rubble', 1),
    '-1,1': t('village', 1),
    '0,1': t('village', 1),
    '1,1': t('village', 1),
    '2,1': t('village', 2),
    '-3,2': t('jungle', 1),
    '-2,2': t('jungle', 1),
    '-1,2': t('jungle', 1),
    '0,2': t('jungle', 1),
    '1,2': t('jungle', 1),
    '-2,3': t('jungle', 1),
    '-1,3': t('river', 1),
    '0,3': t('river', 1),
  },
  N: {
    '0,-3': t('jungle', 1),
    '1,-3': t('jungle', 1),
    '2,-3': t('river', 1),
    '3,-3': t('river', 1),
    '-1,-2': t('jungle', 1),
    '0,-2': t('jungle', 2),
    '1,-2': t('river', 2),
    '2,-2': t('river', 2),
    '3,-2': t('river', 2),
    '-2,-1': t('jungle', 1),
    '-1,-1': t('jungle', 2),
    '0,-1': t('river', 2),
    '1,-1': t('river', 3),
    '2,-1': t('river', 2),
    '3,-1': t('river', 1),
    '-3,0': t('jungle', 1),
    '-2,0': t('jungle', 2),
    '-1,0': t('jungle', 1),
    '0,0': t('village', 2),
    '1,0': t('village', 1),
    '2,0': t('jungle', 2),
    '3,0': t('jungle', 1),
    '-3,1': t('jungle', 1),
    '-2,1': t('jungle', 1),
    '-1,1': t('village', 1),
    '0,1': t('village', 2),
    '1,1': t('village', 3),
    '2,1': t('jungle', 3),
    '-3,2': t('village', 1),
    '-2,2': t('village', 1),
    '-1,2': t('village', 2),
    '0,2': t('village', 3),
    '1,2': t('jungle', 2),
    '-2,3': t('village', 2),
    '-1,3': t('jungle', 1),
    '0,3': t('river', 1),
  },
  I: {
    '0,-3': t('jungle', 1),
    '1,-3': t('village', 1),
    '2,-3': t('village', 2),
    '3,-3': t('village', 1),
    '-1,-2': t('river', 1),
    '0,-2': t('jungle', 2),
    '1,-2': t('village', 1),
    '2,-2': t('village', 1),
    '3,-2': t('village', 2),
    '-2,-1': t('river', 2),
    '0,-1': t('mountain', 0),
    '1,-1': t('mountain', 0),
    '2,-1': t('jungle', 1),
    '3,-1': t('jungle', 1),
    '-3,0': t('river', 1),
    '-2,0': t('jungle', 1),
    '-1,0': t('mountain', 0),
    '0,0': t('mountain', 0),
    '1,0': t('mountain', 0),
    '2,0': t('jungle', 2),
    '3,0': t('jungle', 2),
    '-3,1': t('jungle', 1),
    '-2,1': t('jungle', 2),
    '-1,1': t('camp', 1),
    '0,1': t('mountain', 0),
    '1,1': t('jungle', 2),
    '2,1': t('jungle', 3),
    '-3,2': t('jungle', 1),
    '-2,2': t('jungle', 1),
    '-1,2': t('jungle', 2),
    '0,2': t('rubble', 3),
    '1,2': t('jungle', 1),
    '-2,3': t('jungle', 1),
    '-1,3': t('jungle', 2),
    '0,3': t('jungle', 1),
  },
  K: {
    '1,2': t('camp', 1),
    '0,-3': t('jungle', 1),
    '1,-3': t('river', 1),
    '2,-3': t('jungle', 1),
    '3,-3': t('jungle', 1),
    '-1,-2': t('jungle', 2),
    '0,-2': t('jungle', 2),
    '1,-2': t('jungle', 2),
    '2,-2': t('jungle', 2),
    '3,-2': t('jungle', 1),
    '-2,-1': t('jungle', 2),
    '-1,-1': t('jungle', 3),
    '0,-1': t('jungle', 3),
    '1,-1': t('jungle', 3),
    '2,-1': t('jungle', 1),
    '3,-1': t('jungle', 2),
    '-3,0': t('jungle', 1),
    '-2,0': t('jungle', 1),
    '-1,0': t('jungle', 2),
    '0,0': t('jungle', 2),
    '1,0': t('jungle', 2),
    '2,0': t('jungle', 2),
    '3,0': t('jungle', 1),
    '-3,1': t('camp', 1),
    '-2,1': t('jungle', 2),
    '-1,1': t('jungle', 1),
    '0,1': t('jungle', 3),
    '1,1': t('jungle', 1),
    '2,1': t('village', 3),
    '-3,2': t('jungle', 1),
    '-2,2': t('jungle', 1),
    '-1,2': t('jungle', 2),
    '0,2': t('jungle', 2),
    '-2,3': t('jungle', 1),
    '-1,3': t('jungle', 1),
    '0,3': t('jungle', 1),
  },
}

function completeTile(partial: Record<string, Terr>): Record<string, Terr> {
  const out = { ...partial }
  for (const [q, r] of largeHexCoords(3)) {
    const k = hexKey(q, r)
    if (!out[k]) out[k] = t('jungle', 1)
  }
  return out
}

for (const id of ['B', 'C', 'N', 'I', 'K'] as const) {
  TILE_TERRAIN[id] = completeTile(TILE_TERRAIN[id])
}

export type TerrainTileId = 'B' | 'C' | 'N' | 'I' | 'K'
export type PlaceableTileId = TerrainTileId | 'E'

export const ALL_TERRAIN_TILES: TerrainTileId[] = ['B', 'C', 'N', 'I', 'K']
export const PLACEABLE_TILES: PlaceableTileId[] = ['B', 'C', 'N', 'I', 'K', 'E']

/** Official first-play order (rulebook). */
export const FIRST_PLAY_ORDER: TerrainTileId[] = ['B', 'C', 'N', 'I', 'K']

/** Default rotations (60° steps) from BoardGameHelpers MapViewer. */
export const DEFAULT_TILE_ROT: Record<PlaceableTileId, number> = {
  B: 0,
  C: 5,
  N: 2,
  I: 2,
  K: 0,
  E: 0,
}

/**
 * Connection faces for the standard zigzag (from prior tile → next):
 * B→C ENE, C→N S, N→I S, I→K ENE, K→E ENE
 *
 * Faces index the flat sides of a radius-3 hex (0..5). Neighbor centers use
 * TILE_FACE_OFFSETS so tiles fully abut along a 4-hex edge.
 */
export const FIRST_PLAY_LINK_FACES = [0, 4, 4, 0, 0] as const

/**
 * Center offset to place a neighboring large tile flush against `face`
 * (space-bump 0). Cube distance is always 7 (= 2*radius+1).
 */
export const TILE_FACE_OFFSETS: [number, number][] = [
  [7, -3], // face 0 — ENE
  [4, -7], // face 1 — NNE
  [-4, -3], // face 2 — NW
  [-7, 3], // face 3 — WSW
  [-3, 7], // face 4 — S
  [3, 4], // face 5 — SE
]

/** @deprecated Use TILE_FACE_OFFSETS; kept for MapBuilder eastward nudges. */
export const TILE_STEP = 7

/**
 * Point-attach offsets for ending tile E from a large-tile face.
 * Local (0,0) is the middle finish; face-0 offset is [3,-1], others rotate with the face.
 */
const END_ORIGIN_FACE0: [number, number] = [3, -1]
const END_FACE_OFFSETS: [number, number][] = [0, 1, 2, 3, 4, 5].map(
  (face) => rotateQr(END_ORIGIN_FACE0[0], END_ORIGIN_FACE0[1], face),
)

export interface TilePlacement {
  /** Unique instance id (allows duplicate letters). */
  id: string
  tile: PlaceableTileId
  q: number
  r: number
  rot: number
}

let placementSeq = 1
export function newPlacementId(): string {
  return `piece-${placementSeq++}`
}

/**
 * Ending tile: 3 water finishes in an edge arc (not a 2+1 cluster), each with an
 * El Dorado hex behind it so every approach can park on gold.
 * Oriented for approach from the west; rotate with attach face when placing.
 */
const END_TERRAIN: Record<string, Terr> = {
  '1,1': t('finish', 1),
  '0,0': t('finish', 1),
  '-1,-1': t('finish', 1),
  '2,1': t('eldorado', 0),
  '1,0': t('eldorado', 0),
  '0,-1': t('eldorado', 0),
}

function terrainFor(tile: PlaceableTileId): Record<string, Terr> {
  if (tile === 'E') return END_TERRAIN
  return TILE_TERRAIN[tile]
}

function localsFor(tile: PlaceableTileId): [number, number][] {
  if (tile === 'E') {
    return Object.keys(END_TERRAIN).map((k) => {
      const [q, r] = k.split(',').map(Number)
      return [q, r] as [number, number]
    })
  }
  return largeHexCoords(3)
}

export function firstPlayPlacements(): TilePlacement[] {
  const tiles: PlaceableTileId[] = [...FIRST_PLAY_ORDER, 'E']
  const out: TilePlacement[] = [
    { id: newPlacementId(), tile: 'B', q: 0, r: 2, rot: DEFAULT_TILE_ROT.B },
  ]
  for (let i = 0; i < FIRST_PLAY_LINK_FACES.length; i++) {
    const prev = out[i]
    const face = FIRST_PLAY_LINK_FACES[i]
    const tile = tiles[i + 1]
    const [dq, dr] = tile === 'E' ? END_FACE_OFFSETS[face] : TILE_FACE_OFFSETS[face]
    out.push({
      id: newPlacementId(),
      tile,
      q: prev.q + dq,
      r: prev.r + dr,
      // Ending faces the attach direction; other tiles use printed upright defaults.
      rot: tile === 'E' ? face : DEFAULT_TILE_ROT[tile],
    })
  }
  return out
}

/** Place a new piece to the east of existing content (duplicates allowed). */
export function placeNewPiece(
  placements: TilePlacement[],
  tile: PlaceableTileId,
): TilePlacement[] {
  const rot = DEFAULT_TILE_ROT[tile]
  if (placements.length === 0) {
    return [{ id: newPlacementId(), tile, q: 0, r: 2, rot }]
  }
  const prev = placements[placements.length - 1]
  const face = 0
  const [dq, dr] = tile === 'E' ? END_FACE_OFFSETS[face] : TILE_FACE_OFFSETS[face]
  return [
    ...placements,
    {
      id: newPlacementId(),
      tile,
      q: prev.q + dq,
      r: prev.r + dr,
      rot: tile === 'E' ? face : rot,
    },
  ]
}

export function movePlacement(
  placements: TilePlacement[],
  pieceId: string,
  dirIdx: number,
): TilePlacement[] {
  const [dq, dr] = HEX_DIRS[((dirIdx % 6) + 6) % 6]
  return placements.map((p) =>
    p.id === pieceId ? { ...p, q: p.q + dq, r: p.r + dr } : p,
  )
}

export function rotatePlacement(
  placements: TilePlacement[],
  pieceId: string,
  delta = 1,
): TilePlacement[] {
  return placements.map((p) =>
    p.id === pieceId ? { ...p, rot: (((p.rot + delta) % 6) + 6) % 6 } : p,
  )
}

function cell(
  q: number,
  r: number,
  type: TerrainType,
  power: number,
  tile: string,
  extra: Partial<HexCell> = {},
): HexCell {
  return { id: hexKey(q, r), q, r, type, power, tile, ...extra }
}

const FIRST_PLAY_BLOCKADES: {
  from: TerrainTileId
  to: TerrainTileId
  symbols: TerrainSymbol | 'any'
  power: number
  id: number
}[] = [
  { from: 'B', to: 'C', symbols: 'machete', power: 1, id: 1 },
  { from: 'C', to: 'N', symbols: 'any', power: 1, id: 3 },
  { from: 'N', to: 'I', symbols: 'coin', power: 1, id: 2 },
  { from: 'I', to: 'K', symbols: 'paddle', power: 1, id: 4 },
]

export interface AssembleOptions {
  /** Place blockade hexes between consecutive matching pairs (default true). */
  blockades?: boolean
}

/**
 * Assemble a board from tile placements.
 * Starts are stamped on the first B piece when present.
 */
export function assembleBoard(
  placements: TilePlacement[],
  opts: AssembleOptions = {},
): Record<string, HexCell> {
  const withBlockades = opts.blockades !== false
  const cells: Record<string, HexCell> = {}
  const add = (c: HexCell) => {
    cells[c.id] = c
  }

  if (placements.length === 0) return cells

  for (const p of placements) {
    const terrain = terrainFor(p.tile)
    for (const [lq, lr] of localsFor(p.tile)) {
      const [rq, rr] = rotateQr(lq, lr, p.rot)
      const local = terrain[hexKey(lq, lr)] ?? t('jungle', 1)
      const wq = p.q + rq
      const wr = p.r + rr
      add(
        cell(wq, wr, local.type, local.power, p.tile, {
          isStart: local.isStart,
          pieceId: p.id,
        }),
      )
    }
  }

  if (withBlockades) {
    for (let i = 0; i < placements.length - 1; i++) {
      const a = placements[i]
      const b = placements[i + 1]
      if (a.tile === 'E' || b.tile === 'E') continue
      if (!ALL_TERRAIN_TILES.includes(a.tile as TerrainTileId)) continue
      if (!ALL_TERRAIN_TILES.includes(b.tile as TerrainTileId)) continue
      const spec =
        FIRST_PLAY_BLOCKADES.find((s) => s.from === a.tile && s.to === b.tile) ?? {
          symbols: 'any' as const,
          power: 1,
          id: i + 1,
        }
      placeBlockade(cells, a, b, spec.symbols, spec.power, spec.id)
    }
  }

  // Starts on the first B piece’s western edge
  const bPlace = placements.find((p) => p.tile === 'B')
  if (bPlace) {
    for (const c of Object.values(cells)) {
      if (c.isStart != null) {
        delete c.isStart
        if (c.type === 'start') {
          c.type = 'jungle'
          c.power = 1
        }
      }
    }
    // Four westernmost jungle hexes on B, numbered top→bottom (official starts 1–4).
    // Prefer a contiguous west column: take face-west jungles first, then fill by X.
    let bestDir = 3
    let bestX = Infinity
    for (let d = 0; d < 6; d++) {
      const edge = edgeLocals(3, d)
        .map(([lq, lr]) => {
          const [rq, rr] = rotateQr(lq, lr, bPlace.rot)
          return cells[hexKey(bPlace.q + rq, bPlace.r + rr)]
        })
        .filter((c): c is HexCell => Boolean(c && c.pieceId === bPlace.id))
      if (edge.length < 4) continue
      const avgX = edge.reduce((s, c) => s + hexToPixel(c.q, c.r, 1).x, 0) / edge.length
      if (avgX < bestX) {
        bestX = avgX
        bestDir = d
      }
    }
    const faceJungles = edgeLocals(3, bestDir)
      .map(([lq, lr]) => {
        const [rq, rr] = rotateQr(lq, lr, bPlace.rot)
        return cells[hexKey(bPlace.q + rq, bPlace.r + rr)]
      })
      .filter((c): c is HexCell => Boolean(c && c.pieceId === bPlace.id && c.type === 'jungle'))
      .sort((a, b) => hexToPixel(a.q, a.r, 1).y - hexToPixel(b.q, b.r, 1).y)

    const picked = [...faceJungles]
    if (picked.length < 4) {
      const more = Object.values(cells)
        .filter(
          (c) =>
            c.pieceId === bPlace.id &&
            c.type === 'jungle' &&
            !picked.includes(c),
        )
        .sort((a, b) => hexToPixel(a.q, a.r, 1).x - hexToPixel(b.q, b.r, 1).x)
      picked.push(...more.slice(0, 4 - picked.length))
    }
    picked
      .sort((a, b) => hexToPixel(a.q, a.r, 1).y - hexToPixel(b.q, b.r, 1).y)
      .slice(0, 4)
      .forEach((c, i) => {
        c.type = 'start'
        c.power = 0
        c.isStart = i + 1
      })
  }

  return cells
}

/** Official first-play board (with blockades). */
export function createFirstGameBoard(): Record<string, HexCell> {
  return assembleBoard(firstPlayPlacements(), { blockades: true })
}

/** Four local hexes along one flat edge of a radius-R large hex (i=0..R). */
function edgeLocals(radius: number, dirIdx: number): [number, number][] {
  const dir = HEX_DIRS[dirIdx]
  const next = HEX_DIRS[(dirIdx + 1) % 6]
  const out: [number, number][] = []
  for (let i = 0; i <= radius; i++) {
    out.push([(radius - i) * dir[0] + i * next[0], (radius - i) * dir[1] + i * next[1]])
  }
  return out
}

/** Which face of placement `a` abuts placement `b` (most edge contacts). */
function abuttingFace(
  cells: Record<string, HexCell>,
  a: TilePlacement,
  b: TilePlacement,
): number | null {
  if (a.tile === 'E' || b.tile === 'E') return null
  let bestFace = -1
  let bestHits = 0
  for (let face = 0; face < 6; face++) {
    let hits = 0
    for (const [lq, lr] of edgeLocals(3, face)) {
      const [rq, rr] = rotateQr(lq, lr, a.rot)
      const wq = a.q + rq
      const wr = a.r + rr
      const here = cells[hexKey(wq, wr)]
      if (!here || here.pieceId !== a.id) continue
      for (const [nq, nr] of neighbors(wq, wr)) {
        const o = cells[hexKey(nq, nr)]
        if (o && o.pieceId === b.id) {
          hits++
          break
        }
      }
    }
    if (hits > bestHits) {
      bestHits = hits
      bestFace = face
    }
  }
  return bestHits > 0 ? bestFace : null
}

/**
 * Four world hexes of the zigzag connector between two abutting tiles:
 * the FROM tile’s facing edge (naturally zig-zag shaped).
 */
export function connectorHexes(
  cells: Record<string, HexCell>,
  a: TilePlacement,
  b: TilePlacement,
): HexCell[] {
  const face = abuttingFace(cells, a, b)
  if (face == null) {
    // Fallback: any A cells adjacent to B (ordered by position)
    const touching = Object.values(cells).filter((c) => {
      if (c.pieceId !== a.id) return false
      return neighbors(c.q, c.r).some(([nq, nr]) => cells[hexKey(nq, nr)]?.pieceId === b.id)
    })
    return touching.sort((p, q) => p.q - q.q || p.r - q.r)
  }
  const out: HexCell[] = []
  for (const [lq, lr] of edgeLocals(3, face)) {
    const [rq, rr] = rotateQr(lq, lr, a.rot)
    const c = cells[hexKey(a.q + rq, a.r + rr)]
    if (c && c.pieceId === a.id) out.push(c)
  }
  return out
}

/**
 * Lay a single blockade on the destination tile’s facing edge (the entrance).
 * Approach hexes on the prior tile stay normal; clearing any entrance hex
 * removes the whole connector.
 */
function placeBlockade(
  cells: Record<string, HexCell>,
  a: TilePlacement,
  b: TilePlacement,
  symbols: TerrainSymbol | 'any',
  power: number,
  id: number,
) {
  // Entrance = TO tile edge facing FROM
  const hexes = connectorHexes(cells, b, a)
  if (hexes.length === 0) return
  for (const c of hexes) {
    cells[c.id] = {
      ...c,
      blockade: { symbols, power, id },
    }
  }
}

export interface BlockadeConnector {
  id: number
  symbols: TerrainSymbol | 'any'
  power: number
  /** Entrance hexes (on the destination tile). */
  hexes: HexCell[]
  /** Ordered seam midpoints for the thin zigzag strip. */
  path: { x: number; y: number }[]
}

/** Active blockade groups for rendering the thin zigzag overlay. */
export function blockadeConnectors(
  cells: Record<string, HexCell>,
  size: number,
): BlockadeConnector[] {
  const byId = new Map<
    number,
    { id: number; symbols: TerrainSymbol | 'any'; power: number; hexes: HexCell[] }
  >()
  for (const c of Object.values(cells)) {
    if (!c.blockade) continue
    const g = byId.get(c.blockade.id) ?? {
      id: c.blockade.id,
      symbols: c.blockade.symbols,
      power: c.blockade.power,
      hexes: [],
    }
    g.hexes.push(c)
    byId.set(c.blockade.id, g)
  }

  return [...byId.values()].map((g) => {
    const mids: { x: number; y: number }[] = []
    const seen = new Set<string>()
    for (const h of g.hexes) {
      const hp = hexToPixel(h.q, h.r, size)
      for (const [nq, nr] of neighbors(h.q, h.r)) {
        const o = cells[hexKey(nq, nr)]
        if (!o || o.pieceId === h.pieceId) continue
        // Seam between entrance hex and approach hex on the other tile
        const op = hexToPixel(o.q, o.r, size)
        const mx = (hp.x + op.x) / 2
        const my = (hp.y + op.y) / 2
        const key = `${mx.toFixed(1)},${my.toFixed(1)}`
        if (seen.has(key)) continue
        seen.add(key)
        mids.push({ x: mx, y: my })
      }
    }
    // Order along principal axis of the strip
    if (mids.length >= 2) {
      const cx = mids.reduce((s, p) => s + p.x, 0) / mids.length
      const cy = mids.reduce((s, p) => s + p.y, 0) / mids.length
      let best = { i: 0, j: 1, d: -1 }
      for (let i = 0; i < mids.length; i++) {
        for (let j = i + 1; j < mids.length; j++) {
          const d = (mids[i].x - mids[j].x) ** 2 + (mids[i].y - mids[j].y) ** 2
          if (d > best.d) best = { i, j, d }
        }
      }
      const ax = mids[best.j].x - mids[best.i].x
      const ay = mids[best.j].y - mids[best.i].y
      mids.sort((a, b) => {
        const da = (a.x - cx) * ax + (a.y - cy) * ay
        const db = (b.x - cx) * ax + (b.y - cy) * ay
        return da - db
      })
    }
    return { ...g, path: mids }
  })
}

export function tileBorderEdges(
  cells: Record<string, HexCell>,
  size: number,
): { x1: number; y1: number; x2: number; y2: number }[] {
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = []
  const seen = new Set<string>()
  for (const c of Object.values(cells)) {
    if (c.tile === 'seam' || c.tile === 'end' || c.tile === 'start') continue
    for (const [nq, nr] of neighbors(c.q, c.r)) {
      const o = cells[hexKey(nq, nr)]
      if (!o || o.tile === c.tile) continue
      if (o.tile === 'seam' || o.tile === 'end') continue
      const a = c.id < o.id ? c.id : o.id
      const b = c.id < o.id ? o.id : c.id
      const ek = `${a}|${b}`
      if (seen.has(ek)) continue
      seen.add(ek)
      const p1 = hexToPixel(c.q, c.r, size)
      const p2 = hexToPixel(o.q, o.r, size)
      edges.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y })
    }
  }
  return edges
}

export function tileLabelPositions(
  cells: Record<string, HexCell>,
  size: number,
): { tile: string; x: number; y: number }[] {
  const sums = new Map<string, { tile: string; x: number; y: number; n: number }>()
  for (const c of Object.values(cells)) {
    if (!['B', 'C', 'N', 'I', 'K', 'E'].includes(c.tile)) continue
    const key = c.pieceId ?? c.tile
    const p = hexToPixel(c.q, c.r, size)
    const s = sums.get(key) ?? { tile: c.tile, x: 0, y: 0, n: 0 }
    s.x += p.x
    s.y += p.y
    s.n += 1
    sums.set(key, s)
  }
  return [...sums.values()].map((s) => ({
    tile: s.tile === 'E' ? 'E' : s.tile,
    x: s.x / s.n,
    y: s.y / s.n,
  }))
}

export function startPositions(cells: Record<string, HexCell>): string[] {
  return Object.values(cells)
    .filter((c) => c.isStart)
    .sort((a, b) => (a.isStart ?? 0) - (b.isStart ?? 0))
    .map((c) => c.id)
}

/** Prefer the El Dorado hex adjacent to the finish you just claimed. */
export function eldoradoId(cells: Record<string, HexCell>, fromFinishId?: string): string {
  const golds = Object.values(cells).filter((c) => c.type === 'eldorado')
  if (golds.length === 0) return '0,0'
  if (fromFinishId) {
    const [q, r] = fromFinishId.split(',').map(Number)
    const near = golds.find((g) =>
      neighbors(q, r).some(([nq, nr]) => nq === g.q && nr === g.r),
    )
    if (near) return near.id
  }
  return golds[0].id
}

/** Pixel radius for each hex — large enough that full boards need scrolling. */
export const BOARD_HEX_SIZE = 28
