import { getDef } from './cards'
import { terrainSymbol } from './board'
import {
  availableMarket,
  beginBuy,
  canAfford,
  cancelMove,
  chooseJokerSymbol,
  confirmNativeMove,
  confirmRemoveCards,
  endPlayPhase,
  finishDiscard,
  legalMoveTargets,
  legalNativeTargets,
  legalSpecialTargets,
  moveSpecial,
  moveToCell,
  purchaseCard,
  selectCardForMove,
  skipRemove,
} from './engine'
import {
  deckPower,
  hireValueForRoute,
  nextOnRoute,
  planRoute,
  routeIndex,
  type RoutePlan,
} from './pathfind'
import type { GameState, TerrainSymbol } from './types'

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function turnFingerprint(s: GameState): string {
  const p = s.players[s.currentPlayer]
  return [
    s.phase,
    s.playMode,
    s.boughtThisTurn ? 1 : 0,
    s.moveSession?.cardUid ?? '',
    s.moveSession?.remainingPower ?? '',
    s.pendingAction?.cardUid ?? '',
    s.jokerChoiceUid ?? '',
    p.position,
    p.hand.map((c) => c.uid).join(','),
  ].join('|')
}

function cellNeedSymbol(state: GameState, cellId: string): TerrainSymbol | 'special' | null {
  const cell = state.cells[cellId]
  if (!cell) return null
  if (cell.blockade?.symbols === 'any' || cell.type === 'rubble' || cell.type === 'camp') {
    return 'special'
  }
  if (cell.blockade) return cell.blockade.symbols as TerrainSymbol
  return terrainSymbol(cell.type)
}

function scoreTargetOnRoute(
  state: GameState,
  cellId: string,
  plan: RoutePlan | null,
  nextId: string | null,
): number {
  const cell = state.cells[cellId]
  if (!cell) return -9999
  if (cell.type === 'finish') return 10_000
  if (nextId && cellId === nextId) return 5_000
  const idx = routeIndex(plan, cellId)
  if (idx >= 0) return 2_000 + idx * 10 - cell.power
  // Off-route: only as last resort; slight preference for finishing-direction q
  return cell.q - 500
}

function pickCardForRoute(
  state: GameState,
  plan: RoutePlan | null,
  nextId: string | null,
  unusable: Set<string>,
): { uid: string; kind: 'move' | 'native' | 'special'; pay?: string[] } | null {
  const p = state.players[state.currentPlayer]
  const hand = p.hand.filter((c) => !unusable.has(c.uid))

  // 1) Special step if the next route hex is rubble/camp/any-blockade
  if (nextId) {
    const needSym = cellNeedSymbol(state, nextId)
    if (needSym === 'special' && legalSpecialTargets(state).includes(nextId)) {
      const cell = state.cells[nextId]
      const need =
        cell.blockade?.symbols === 'any' ? cell.blockade.power : cell.power
      if (hand.length >= need) {
        const pay = [...hand]
          .sort((a, b) => getDef(a.defId).power - getDef(b.defId).power)
          .slice(0, need)
          .map((c) => c.uid)
        return { uid: pay[0], kind: 'special', pay }
      }
    }
  }

  // 2) Native if next is special/high and we hold Native
  const native = hand.find((c) => getDef(c.defId).action === 'ignore_space')
  if (native && nextId && legalNativeTargets(state).includes(nextId)) {
    const needSym = cellNeedSymbol(state, nextId)
    if (needSym === 'special' || (state.cells[nextId]?.power ?? 0) >= 3) {
      return { uid: native.uid, kind: 'native' }
    }
  }

  // 3) Best movement card that can step onto the route (prefer exact next)
  type Cand = { uid: string; score: number; waste: number }
  let best: Cand | null = null

  for (const card of hand) {
    const def = getDef(card.defId)
    if (def.kind === 'action') {
      if (def.action === 'ignore_space' && nextId && legalNativeTargets(state).includes(nextId)) {
        const score = scoreTargetOnRoute(state, nextId, plan, nextId)
        const cand = { uid: card.uid, score: score - 50, waste: 0 }
        if (!best || cand.score > best.score) best = cand
      }
      continue
    }
    if (def.symbol === 'none') continue

    const symbols: TerrainSymbol[] =
      def.symbol === 'joker' ? ['machete', 'paddle', 'coin'] : [def.symbol as TerrainSymbol]

    for (const sym of symbols) {
      const targets = legalMoveTargets(
        {
          ...state,
          moveSession: {
            cardUid: card.uid,
            symbol: sym,
            remainingPower: def.power,
            hasMoved: false,
          },
        },
        sym,
        def.power,
      )
      for (const id of targets) {
        const score = scoreTargetOnRoute(state, id, plan, nextId)
        const tCell = state.cells[id]
        const need = tCell?.blockade
          ? tCell.blockade.power
          : (tCell?.power ?? 1)
        const waste = Math.max(0, def.power - need)
        // Prefer on-route; among equals, less waste (save big cards) unless leftover continues on route
        const cand = { uid: card.uid, score: score - waste * 0.15, waste }
        if (
          !best ||
          cand.score > best.score ||
          (cand.score === best.score && cand.waste < best.waste)
        ) {
          best = cand
        }
      }
    }
  }

  if (!best || best.score < -100) return null
  const def = getDef(hand.find((c) => c.uid === best!.uid)!.defId)
  if (def.action === 'ignore_space') return { uid: best.uid, kind: 'native' }
  return { uid: best.uid, kind: 'move' }
}

function pickJokerSymbol(state: GameState, plan: RoutePlan | null, nextId: string | null): TerrainSymbol {
  const uid = state.jokerChoiceUid!
  const card = state.players[state.currentPlayer].hand.find((c) => c.uid === uid)
  const power = card ? getDef(card.defId).power : 1
  let best: TerrainSymbol = 'machete'
  let bestScore = -Infinity
  for (const sym of ['machete', 'paddle', 'coin'] as TerrainSymbol[]) {
    const targets = legalMoveTargets(
      {
        ...state,
        moveSession: { cardUid: uid, symbol: sym, remainingPower: power, hasMoved: false },
      },
      sym,
      power,
    )
    const score = targets.reduce(
      (m, id) => Math.max(m, scoreTargetOnRoute(state, id, plan, nextId)),
      -Infinity,
    )
    if (score > bestScore) {
      bestScore = score
      best = sym
    }
  }
  return best
}

function pickHire(state: GameState, plan: RoutePlan | null): { defId: string; pay: string[] } | null {
  if (state.boughtThisTurn || !plan) return null
  const p = state.players[state.currentPlayer]
  if (p.hand.length === 0) return null

  const shopping = beginBuy(state)
  const market = availableMarket(shopping)
  const payAll = p.hand.map((c) => c.uid)
  const deck = deckPower(p)

  let bestId: string | null = null
  let bestScore = 0.35 // threshold: don't hire junk
  for (const id of market) {
    if (!canAfford(shopping, id, payAll)) continue
    const v = hireValueForRoute(id, plan.demand, deck)
    if (v > bestScore) {
      bestScore = v
      bestId = id
    }
  }
  if (!bestId) return null

  const cost = getDef(bestId).cost ?? 0
  const ordered = [...p.hand].sort((a, b) => {
    // Spend weak / off-route symbols first; keep strong cards matching route deficits
    const da = getDef(a.defId)
    const db = getDef(b.defId)
    const useful = (d: typeof da) => {
      if (d.symbol === 'joker') return 3
      if (d.symbol === 'machete') return plan.demand.machete > deck.machete ? 2 : 0
      if (d.symbol === 'paddle') return plan.demand.paddle > deck.paddle ? 2 : 0
      if (d.symbol === 'coin') return plan.demand.coin > deck.coin ? 2 : 0
      return 0
    }
    return useful(da) - useful(db) || da.power - db.power
  })
  const pay: string[] = []
  let total = 0
  for (const c of ordered) {
    if (total >= cost) break
    pay.push(c.uid)
    const d = getDef(c.defId)
    total += d.symbol === 'coin' || d.symbol === 'joker' ? d.power : 0.5
  }
  return { defId: bestId, pay }
}

/** Path-following AI: least-cost route using full deck knowledge; hire for the route. */
export async function runAiTurn(
  state: GameState,
  apply: (s: GameState) => void,
  delay = 350,
): Promise<GameState> {
  let s = state

  const step = async (next: GameState) => {
    s = next
    apply(s)
    await sleep(delay)
  }

  const hand = () => s.players[s.currentPlayer].hand
  const refreshPlan = () => planRoute(s, s.currentPlayer)

  try {
    if (s.playMode === 'remove_cards') {
      const weak = [...hand()]
        .sort((a, b) => getDef(a.defId).power - getDef(b.defId).power)
        .slice(0, s.removeQuota)
        .map((c) => c.uid)
      await step(weak.length ? confirmRemoveCards(s, weak) : skipRemove(s))
    }

    let guard = 0
    let stalled = 0
    const unusable = new Set<string>()
    let plan = refreshPlan()

    while (s.phase === 'play' && guard++ < 16) {
      const before = turnFingerprint(s)
      plan = refreshPlan()
      const nextId = nextOnRoute(plan, s.players[s.currentPlayer].position)

      if (s.playMode === 'remove_cards') {
        const weak = [...hand()]
          .sort((a, b) => getDef(a.defId).power - getDef(b.defId).power)
          .slice(0, s.removeQuota)
          .map((c) => c.uid)
        await step(weak.length ? confirmRemoveCards(s, weak) : skipRemove(s))
      } else if (s.pendingAction?.effect === 'ignore_space') {
        const targets = legalNativeTargets(s)
        const best = [...targets].sort(
          (a, b) =>
            scoreTargetOnRoute(s, b, plan, nextId) - scoreTargetOnRoute(s, a, plan, nextId),
        )[0]
        if (best && scoreTargetOnRoute(s, best, plan, nextId) > -100) {
          await step(confirmNativeMove(s, best))
        } else {
          if (s.pendingAction?.cardUid) unusable.add(s.pendingAction.cardUid)
          await step(cancelMove(s))
        }
      } else if (s.moveSession) {
        const targets = legalMoveTargets(
          s,
          s.moveSession.symbol,
          s.moveSession.remainingPower,
        )
        const best = [...targets].sort(
          (a, b) =>
            scoreTargetOnRoute(s, b, plan, nextId) - scoreTargetOnRoute(s, a, plan, nextId),
        )[0]
        if (best && scoreTargetOnRoute(s, best, plan, nextId) > -100) {
          await step(moveToCell(s, best))
        } else {
          unusable.add(s.moveSession.cardUid)
          await step(cancelMove(s))
        }
      } else if (s.playMode === 'choose_joker' && s.jokerChoiceUid) {
        const sym = pickJokerSymbol(s, plan, nextId)
        const probe = legalMoveTargets(
          {
            ...s,
            moveSession: {
              cardUid: s.jokerChoiceUid,
              symbol: sym,
              remainingPower: getDef(
                hand().find((c) => c.uid === s.jokerChoiceUid)?.defId ?? 'jack',
              ).power,
              hasMoved: false,
            },
          },
          sym,
          getDef(hand().find((c) => c.uid === s.jokerChoiceUid)?.defId ?? 'jack').power,
        )
        if (!probe.length) {
          unusable.add(s.jokerChoiceUid)
          await step(cancelMove(s))
        } else {
          await step(chooseJokerSymbol(s, sym))
        }
      } else {
        const pick = pickCardForRoute(s, plan, nextId, unusable)
        if (pick?.kind === 'special' && pick.pay) {
          const beforePos = s.players[s.currentPlayer].position
          const target = nextId!
          const hadBorder = Boolean(s.cells[target]?.blockade)
          const next = moveSpecial(
            { ...s, selectedForRemove: pick.pay, playMode: 'idle' },
            target,
          )
          const moved = next.players[s.currentPlayer].position !== beforePos
          const clearedBorder = hadBorder && !next.cells[target]?.blockade
          // Grey borders clear without moving — still a successful spend.
          if (moved || clearedBorder) {
            await step(next)
          } else {
            unusable.add(pick.uid)
          }
        } else if (pick) {
          await step(selectCardForMove(s, pick.uid))
        } else {
          // No on-route (or any) move — hire something that serves the remaining route.
          const hire = pickHire(s, plan)
          if (hire) {
            const shopping = beginBuy(s)
            const prevBought = s.boughtThisTurn
            await step(
              purchaseCard({ ...shopping, selectedForBuy: hire.pay }, hire.defId),
            )
            if (s.boughtThisTurn === prevBought) break
            // After hiring, stop moving this turn if we still can't step — avoid wandering off-route.
            plan = refreshPlan()
            const still = pickCardForRoute(s, plan, nextOnRoute(plan, s.players[s.currentPlayer].position), unusable)
            if (!still) break
          } else {
            break
          }
        }
      }

      if (turnFingerprint(s) === before) {
        stalled++
        if (stalled >= 2) break
      } else {
        stalled = 0
      }
    }
  } finally {
    if (s.phase === 'play') {
      s = cancelMove(s)
      apply(s)
      await step(endPlayPhase(s))
    }
    if (s.phase === 'discard') {
      const plan = planRoute(s, s.currentPlayer)
      const demand = plan?.demand ?? { machete: 0, paddle: 0, coin: 0, special: 0 }
      const keep = [...hand()]
        .sort((a, b) => {
          const fit = (id: string) => {
            const d = getDef(id)
            if (d.action === 'ignore_space') return 20 + demand.special
            if (d.symbol === 'joker')
              return 12 + Math.max(demand.machete, demand.paddle, demand.coin) + d.power
            if (d.symbol === 'machete') return demand.machete * 3 + d.power
            if (d.symbol === 'paddle') return demand.paddle * 3 + d.power
            if (d.symbol === 'coin') return demand.coin * 3 + d.power
            return d.power
          }
          return fit(b.defId) - fit(a.defId)
        })
        .slice(0, 1)
        .map((c) => c.uid)
      await step(finishDiscard(s, keep))
    }
  }

  return s
}
