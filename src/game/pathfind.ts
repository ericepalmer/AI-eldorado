import { getDef } from './cards'
import { neighbors, terrainSymbol } from './board'
import type {
  CardInstance,
  GameState,
  HexCell,
  PlayerState,
} from './types'

export interface DeckPower {
  machete: number
  paddle: number
  coin: number
  joker: number
  /** Total cards (for rubble/camp spends). */
  cards: number
}

export interface RouteDemand {
  machete: number
  paddle: number
  coin: number
  special: number
}

export interface RoutePlan {
  /** Cell ids from current position to a finish hex (inclusive of start). */
  path: string[]
  cost: number
  demand: RouteDemand
}

const LAND = ['machete', 'paddle', 'coin'] as const

function allDeckCards(p: PlayerState): CardInstance[] {
  return [...p.hand, ...p.draw, ...p.discard]
}

/** Full expedition inventory the AI can expect to cycle through. */
export function deckPower(p: PlayerState): DeckPower {
  const out: DeckPower = { machete: 0, paddle: 0, coin: 0, joker: 0, cards: 0 }
  for (const c of allDeckCards(p)) {
    const def = getDef(c.defId)
    out.cards += 1
    if (def.kind !== 'movement') continue
    if (def.symbol === 'machete') out.machete += def.power
    else if (def.symbol === 'paddle') out.paddle += def.power
    else if (def.symbol === 'coin') out.coin += def.power
    else if (def.symbol === 'joker') out.joker += def.power
  }
  return out
}

export function handPower(cards: CardInstance[]): DeckPower {
  const out: DeckPower = { machete: 0, paddle: 0, coin: 0, joker: 0, cards: cards.length }
  for (const c of cards) {
    const def = getDef(c.defId)
    if (def.kind !== 'movement') continue
    if (def.symbol === 'machete') out.machete += def.power
    else if (def.symbol === 'paddle') out.paddle += def.power
    else if (def.symbol === 'coin') out.coin += def.power
    else if (def.symbol === 'joker') out.joker += def.power
  }
  return out
}

function occupiedSet(state: GameState, ignorePlayer: number): Set<string> {
  return new Set(
    state.players.filter((p) => !p.reached && p.id !== ignorePlayer).map((p) => p.position),
  )
}

function finishIds(cells: Record<string, HexCell>): string[] {
  return Object.values(cells)
    .filter((c) => c.type === 'finish')
    .map((c) => c.id)
}

/** Cost to enter a cell, scaled by how scarce that requirement is in the deck. */
export function enterCost(
  cell: HexCell,
  deck: DeckPower,
  occupied: Set<string>,
): number | null {
  if (cell.type === 'mountain' || cell.type === 'eldorado') return null
  if (occupied.has(cell.id)) return null

  if (cell.type === 'start') return 0.05

  // Borders: pay to clear (stay put), then pay terrain to enter — both count on the route.
  let total = 0

  if (cell.blockade) {
    if (cell.blockade.symbols === 'any') {
      const need = cell.blockade.power
      const have = Math.max(1, deck.cards)
      const scarcity = have < need * 2 ? 3.5 : have < need * 4 ? 1.8 : 1
      total += need * 2.2 * scarcity
    } else {
      const bSym = cell.blockade.symbols
      const bPow = cell.blockade.power
      if (bSym === 'machete' || bSym === 'paddle' || bSym === 'coin') {
        const have = deck[bSym] + deck.joker
        const scarcity = have < bPow ? 5 : have < bPow * 2 ? 2.4 : have < bPow * 4 ? 1.3 : 1
        total += bPow * scarcity
      }
    }
  }

  if (cell.type === 'rubble' || cell.type === 'camp') {
    const need = cell.power
    const have = Math.max(1, deck.cards)
    const scarcity = have < need * 2 ? 3.5 : have < need * 4 ? 1.8 : 1
    const camp = cell.type === 'camp' ? 1.4 : 1
    total += need * 2.2 * scarcity * camp
    return total
  }

  const sym = terrainSymbol(cell.type)
  if (!sym || (sym !== 'machete' && sym !== 'paddle' && sym !== 'coin')) {
    if (cell.type === 'finish') return total + 0.4
    return total > 0 ? total : null
  }

  const have = deck[sym] + deck.joker
  const power = cell.power
  const scarcity = have < power ? 5 : have < power * 2 ? 2.4 : have < power * 4 ? 1.3 : 1
  const finishBonus = cell.type === 'finish' ? 0.25 : 1
  total += power * scarcity * finishBonus
  return total
}

function demandForCell(cell: HexCell): Partial<RouteDemand> {
  if (cell.type === 'mountain' || cell.type === 'start' || cell.type === 'eldorado') return {}

  const out: Partial<RouteDemand> = {}

  if (cell.blockade) {
    if (cell.blockade.symbols === 'any') {
      out.special = (out.special ?? 0) + cell.blockade.power
    } else {
      const bSym = cell.blockade.symbols
      if (bSym === 'machete' || bSym === 'paddle' || bSym === 'coin') {
        out[bSym] = (out[bSym] ?? 0) + cell.blockade.power
      }
    }
  }

  if (cell.type === 'rubble' || cell.type === 'camp') {
    out.special = (out.special ?? 0) + cell.power
    return out
  }

  const sym = terrainSymbol(cell.type)
  if (sym === 'machete' || sym === 'paddle' || sym === 'coin') {
    out[sym] = (out[sym] ?? 0) + cell.power
  }
  return out
}

export function routeDemand(path: string[], cells: Record<string, HexCell>): RouteDemand {
  const d: RouteDemand = { machete: 0, paddle: 0, coin: 0, special: 0 }
  for (let i = 1; i < path.length; i++) {
    const cell = cells[path[i]]
    if (!cell) continue
    const add = demandForCell(cell)
    d.machete += add.machete ?? 0
    d.paddle += add.paddle ?? 0
    d.coin += add.coin ?? 0
    d.special += add.special ?? 0
  }
  return d
}

/**
 * Least-cost path from the player to any finish hex.
 * Costs reflect terrain power × scarcity given the player's full deck.
 */
export function planRoute(state: GameState, playerId: number): RoutePlan | null {
  const p = state.players[playerId]
  const deck = deckPower(p)
  const occupied = occupiedSet(state, playerId)
  const goals = new Set(finishIds(state.cells))
  if (goals.size === 0) return null

  const start = p.position
  if (goals.has(start) || state.cells[start]?.type === 'finish') {
    return { path: [start], cost: 0, demand: routeDemand([start], state.cells) }
  }

  const dist = new Map<string, number>()
  const prev = new Map<string, string>()
  const pq: { id: string; d: number }[] = [{ id: start, d: 0 }]
  dist.set(start, 0)

  while (pq.length) {
    pq.sort((a, b) => a.d - b.d)
    const cur = pq.shift()!
    if (cur.d !== dist.get(cur.id)) continue
    if (goals.has(cur.id)) {
      const path: string[] = []
      let walk: string | undefined = cur.id
      while (walk) {
        path.push(walk)
        walk = prev.get(walk)
      }
      path.reverse()
      return { path, cost: cur.d, demand: routeDemand(path, state.cells) }
    }

    const cell = state.cells[cur.id]
    if (!cell) continue
    for (const [nq, nr] of neighbors(cell.q, cell.r)) {
      const nid = `${nq},${nr}`
      const next = state.cells[nid]
      if (!next) continue
      // Leaving current: entry cost is paid when entering `next`
      const step = enterCost(next, deck, occupied)
      if (step == null) continue
      const nd = cur.d + step
      if (nd < (dist.get(nid) ?? Infinity)) {
        dist.set(nid, nd)
        prev.set(nid, cur.id)
        pq.push({ id: nid, d: nd })
      }
    }
  }

  return null
}

export function nextOnRoute(plan: RoutePlan | null, position: string): string | null {
  if (!plan || plan.path.length < 2) return null
  const i = plan.path.indexOf(position)
  if (i < 0) return plan.path[1] ?? null
  return plan.path[i + 1] ?? null
}

export function routeIndex(plan: RoutePlan | null, cellId: string): number {
  if (!plan) return -1
  return plan.path.indexOf(cellId)
}

/** How much buying this card reduces route deficits (higher = better hire). */
export function hireValueForRoute(
  defId: string,
  demand: RouteDemand,
  deck: DeckPower,
): number {
  const def = getDef(defId)
  if (def.cost == null) return -1

  const deficit = (sym: 'machete' | 'paddle' | 'coin') =>
    Math.max(0, demand[sym] - (deck[sym] + deck.joker * 0.35))

  const specialDeficit = Math.max(0, demand.special - deck.cards * 0.25)

  if (def.kind === 'action') {
    if (def.action === 'ignore_space') return 4 + specialDeficit * 0.5
    if (def.action === 'draw2' || def.action === 'draw3') return 1.5
    return 0.5
  }

  let gain = 0
  if (def.symbol === 'joker') {
    gain = Math.max(deficit('machete'), deficit('paddle'), deficit('coin')) * 0.85 * def.power
  } else if (def.symbol === 'machete' || def.symbol === 'paddle' || def.symbol === 'coin') {
    const d = deficit(def.symbol)
    // Prefer filling real holes; little value if already flush in that symbol.
    gain = Math.min(d, def.power) * 2 + (d > 0 ? def.power * 0.35 : def.power * 0.05)
  }

  // Cheap fillers for specials
  if (def.power <= 1) gain += specialDeficit * 0.15

  // Prefer value per coin
  const cost = Math.max(1, def.cost)
  return gain / cost - (def.isItem ? 0.15 : 0)
}

export function biggestRouteDeficit(
  demand: RouteDemand,
  deck: DeckPower,
): (typeof LAND)[number] | 'special' | null {
  const scores: { k: (typeof LAND)[number] | 'special'; v: number }[] = LAND.map((sym) => ({
    k: sym,
    v: Math.max(0, demand[sym] - (deck[sym] + deck.joker * 0.35)),
  }))
  scores.push({ k: 'special', v: Math.max(0, demand.special - deck.cards * 0.25) })
  scores.sort((a, b) => b.v - a.v)
  return scores[0] && scores[0].v > 0 ? scores[0].k : null
}
