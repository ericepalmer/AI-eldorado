import { CARD_DEFS, STARTING_DECK, coinValue, getDef } from './cards'
import { createFirstGameBoard, neighbors, startPositions, terrainSymbol } from './board'
import type {
  ActionEffect,
  CardInstance,
  GameState,
  HexCell,
  PlayerState,
  TerrainSymbol,
} from './types'

const PLAYER_COLORS = ['#c45c26', '#2f6fed', '#c9a227', '#2f7a3e']

function shuffle<T>(arr: T[], rng = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function nextUid(state: GameState): { state: GameState; uid: string } {
  const uid = `c${state.uidCounter}`
  return { state: { ...state, uidCounter: state.uidCounter + 1 }, uid }
}

function makeCard(state: GameState, defId: string): { state: GameState; card: CardInstance } {
  const { state: s2, uid } = nextUid(state)
  return { state: s2, card: { uid, defId } }
}

function log(state: GameState, msg: string): GameState {
  return { ...state, log: [msg, ...state.log].slice(0, 40) }
}

function updatePlayer(state: GameState, playerId: number, fn: (p: PlayerState) => PlayerState): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? fn(p) : p)),
  }
}

function current(state: GameState): PlayerState {
  return state.players[state.currentPlayer]
}

function drawOne(state: GameState, playerId: number): GameState {
  let s = state
  let p = s.players[playerId]
  if (p.draw.length === 0) {
    if (p.discard.length === 0) return s
    const reshuffled = shuffle(p.discard)
    s = updatePlayer(s, playerId, (pl) => ({ ...pl, draw: reshuffled, discard: [] }))
    p = s.players[playerId]
  }
  const [card, ...rest] = p.draw
  return updatePlayer(s, playerId, (pl) => ({
    ...pl,
    draw: rest,
    hand: [...pl.hand, card],
  }))
}

function drawUpTo(state: GameState, playerId: number, n: number): GameState {
  let s = state
  while (s.players[playerId].hand.length < n) {
    const before = s.players[playerId].hand.length
    s = drawOne(s, playerId)
    if (s.players[playerId].hand.length === before) break
  }
  return s
}

function occupiedPositions(state: GameState): Set<string> {
  return new Set(state.players.filter((p) => !p.reached).map((p) => p.position))
}

function clearBlockade(state: GameState, blockadeId: number, playerId: number): GameState {
  const cells = { ...state.cells }
  for (const [id, c] of Object.entries(cells)) {
    if (c.blockade?.id === blockadeId) {
      cells[id] = { ...c, blockade: null }
    }
  }
  const already = state.players[playerId].blockades.includes(blockadeId)
  return {
    ...state,
    cells,
    players: state.players.map((pl) =>
      pl.id === playerId && !already
        ? { ...pl, blockades: [...pl.blockades, blockadeId] }
        : pl,
    ),
  }
}

export function createGame(
  humanName = 'You',
  aiCount = 1,
  boardCells?: Record<string, HexCell>,
): GameState {
  const cells = boardCells ?? createFirstGameBoard()
  const starts = startPositions(cells)
  const total = Math.min(1 + aiCount, 4)

  let state: GameState = {
    players: [],
    currentPlayer: 0,
    phase: 'play',
    playMode: 'idle',
    cells,
    marketSlots: [],
    offMarket: [],
    marketRemaining: {},
    boughtThisTurn: false,
    moveSession: null,
    pendingAction: null,
    removeQuota: 0,
    selectedForBuy: [],
    selectedForRemove: [],
    jokerChoiceUid: null,
    finalRoundTriggered: false,
    turnsLeftInFinal: null,
    winnerIds: [],
    log: [],
    uidCounter: 1,
  }

  const marketIds = Object.values(CARD_DEFS)
    .filter((d) => d.cost != null)
    .map((d) => d.id)
  const remaining: Record<string, number> = {}
  for (const id of marketIds) remaining[id] = 3

  const startMarket = marketIds.filter((id) => CARD_DEFS[id].startMarket)
  const off = marketIds.filter((id) => !CARD_DEFS[id].startMarket)

  state = {
    ...state,
    marketSlots: [...startMarket],
    offMarket: off,
    marketRemaining: remaining,
  }

  const players: PlayerState[] = []
  for (let i = 0; i < total; i++) {
    let s = state
    const cards: CardInstance[] = []
    for (const { defId, count } of STARTING_DECK) {
      for (let n = 0; n < count; n++) {
        const made = makeCard(s, defId)
        s = made.state
        cards.push(made.card)
      }
    }
    state = s
    const draw = shuffle(cards)
    players.push({
      id: i,
      name: i === 0 ? humanName : `Rival ${i}`,
      color: PLAYER_COLORS[i],
      isHuman: i === 0,
      hand: [],
      draw,
      discard: [],
      removed: [],
      position: starts[i],
      blockades: [],
      reached: false,
    })
  }
  state = { ...state, players }

  for (let i = 0; i < total; i++) {
    state = drawUpTo(state, i, 4)
  }

  return log(state, 'The race to El Dorado begins!')
}

function removeFromHand(player: PlayerState, uids: string[]): {
  player: PlayerState
  removed: CardInstance[]
} {
  const set = new Set(uids)
  const removed = player.hand.filter((c) => set.has(c.uid))
  return {
    player: { ...player, hand: player.hand.filter((c) => !set.has(c.uid)) },
    removed,
  }
}

function placePlayed(
  state: GameState,
  cards: CardInstance[],
  opts: { trash?: boolean; removeItem?: boolean } = {},
): GameState {
  const pid = state.currentPlayer
  if (opts.trash || opts.removeItem) {
    return updatePlayer(state, pid, (p) => ({
      ...p,
      removed: [...p.removed, ...cards],
    }))
  }
  return updatePlayer(state, pid, (p) => ({
    ...p,
    discard: [...p.discard, ...cards],
  }))
}

export function handCoinTotal(state: GameState, uids: string[]): number {
  const p = current(state)
  return uids.reduce((sum, uid) => {
    const card = p.hand.find((c) => c.uid === uid)
    return card ? sum + coinValue(card.defId) : sum
  }, 0)
}

export function canAfford(state: GameState, defId: string, payUids: string[]): boolean {
  const def = getDef(defId)
  if (def.cost == null) return false
  return handCoinTotal(state, payUids) + 1e-9 >= def.cost
}

function isOccupied(state: GameState, cellId: string, ignorePlayer?: number): boolean {
  return state.players.some(
    (p) => !p.reached && p.position === cellId && p.id !== ignorePlayer,
  )
}

export function adjacentCells(state: GameState, fromId: string): string[] {
  const from = state.cells[fromId]
  if (!from) return []
  return neighbors(from.q, from.r)
    .map(([q, r]) => `${q},${r}`)
    .filter((id) => state.cells[id])
}

function spaceRequirement(
  state: GameState,
  cellId: string,
): { kind: 'landscape' | 'special' | 'free' | 'blocked'; symbol?: TerrainSymbol; power: number } {
  const cell = state.cells[cellId]
  if (!cell || cell.type === 'mountain') return { kind: 'blocked', power: 0 }
  if (cell.type === 'start' || cell.type === 'eldorado') return { kind: 'free', power: 0 }

  // Borders are paid separately to remove — hexes keep their printed terrain cost.
  if (cell.type === 'rubble' || cell.type === 'camp') {
    return { kind: 'special', power: cell.power }
  }

  const sym = terrainSymbol(cell.type)
  if (!sym) return { kind: 'blocked', power: 0 }
  return { kind: 'landscape', symbol: sym, power: cell.power }
}

export function legalMoveTargets(
  state: GameState,
  symbol: TerrainSymbol,
  remainingPower: number,
  fromId?: string,
): string[] {
  const p = current(state)
  const origin = fromId ?? p.position
  const adj = adjacentCells(state, origin)
  const out: string[] = []

  for (const id of adj) {
    if (isOccupied(state, id, p.id)) continue
    const cell = state.cells[id]
    if (!cell || cell.type === 'mountain') continue

    if (cell.type === 'eldorado') {
      // From a water finish, any card steps into the gold city (free).
      const from = state.cells[origin]
      if (from?.type === 'finish') out.push(id)
      continue
    }

    if (cell.blockade) {
      // Active border: can target it to pay & remove, but cannot move across yet.
      if (cell.blockade.symbols === 'any') continue
      const need = cell.blockade.power
      const bSym = cell.blockade.symbols
      if (symbol !== bSym && symbol !== 'joker') continue
      if (remainingPower >= need) out.push(id)
      continue
    }

    // Cannot enter the next tile through a neighbor that still has a border marker
    // on a shared connector (same blockade id on an adjacent seam hex).
    if (crossesActiveBorder(state, origin, id)) continue

    if (cell.type === 'rubble' || cell.type === 'camp') continue

    const req = spaceRequirement(state, id)
    if (req.kind === 'free') {
      out.push(id)
      continue
    }
    if (req.kind !== 'landscape' || !req.symbol) continue
    if (symbol !== req.symbol) continue
    if (remainingPower >= req.power) out.push(id)
  }
  return out
}

/** True if moving origin→target crosses a still-active tile border. */
function crossesActiveBorder(state: GameState, originId: string, targetId: string): boolean {
  const from = state.cells[originId]
  const to = state.cells[targetId]
  if (!from || !to) return false
  if (!from.pieceId || !to.pieceId || from.pieceId === to.pieceId) return false
  // Any remaining blockade on either hex of this cross-tile step blocks passage.
  if (from.blockade || to.blockade) return true
  // Also block if an adjacent seam hex on this join still has a blockade
  // (player aiming at a non-entrance hex of the next tile).
  for (const id of adjacentCells(state, originId)) {
    const c = state.cells[id]
    if (c?.blockade && c.pieceId === to.pieceId) return true
  }
  for (const id of adjacentCells(state, targetId)) {
    const c = state.cells[id]
    if (c?.blockade && c.pieceId === from.pieceId) return true
  }
  return false
}

export function legalSpecialTargets(state: GameState): string[] {
  const p = current(state)
  return adjacentCells(state, p.position).filter((id) => {
    if (isOccupied(state, id, p.id)) return false
    const cell = state.cells[id]
    if (!cell) return false
    if (cell.blockade?.symbols === 'any') return true
    return cell.type === 'rubble' || cell.type === 'camp'
  })
}

export function legalNativeTargets(state: GameState): string[] {
  const p = current(state)
  return adjacentCells(state, p.position).filter((id) => {
    if (isOccupied(state, id, p.id)) return false
    const cell = state.cells[id]
    if (!cell || cell.type === 'mountain') return false
    if (cell.type === 'eldorado') {
      return state.cells[p.position]?.type === 'finish'
    }
    // Native may clear+enter a border hex, but cannot jump past an active border.
    if (cell.blockade) return true
    if (crossesActiveBorder(state, p.position, id)) return false
    return true
  })
}

export function selectCardForMove(state: GameState, cardUid: string): GameState {
  if (state.phase !== 'play' || state.moveSession) return state
  const p = current(state)
  const card = p.hand.find((c) => c.uid === cardUid)
  if (!card) return state
  const def = getDef(card.defId)

  if (def.kind === 'action') {
    return playActionCard(state, cardUid)
  }

  if (def.symbol === 'joker') {
    return { ...state, playMode: 'choose_joker', jokerChoiceUid: cardUid }
  }

  if (def.symbol === 'none') return state

  return {
    ...state,
    playMode: 'moving',
    moveSession: {
      cardUid,
      symbol: def.symbol as TerrainSymbol,
      remainingPower: def.power,
      hasMoved: false,
    },
  }
}

export function chooseJokerSymbol(state: GameState, symbol: TerrainSymbol): GameState {
  if (!state.jokerChoiceUid) return state
  const p = current(state)
  const card = p.hand.find((c) => c.uid === state.jokerChoiceUid)
  if (!card) return state
  const def = getDef(card.defId)
  return {
    ...state,
    playMode: 'moving',
    jokerChoiceUid: null,
    moveSession: {
      cardUid: card.uid,
      symbol,
      remainingPower: def.power,
      hasMoved: false,
    },
  }
}

export function cancelMove(state: GameState): GameState {
  let s = state
  // Only spend the card if you already moved with it ("Stop here").
  // If you just selected it and change your mind, put it back.
  if (state.moveSession?.hasMoved) {
    const uid = state.moveSession.cardUid
    const p = current(state)
    const card = p.hand.find((c) => c.uid === uid)
    if (card) {
      const def = getDef(card.defId)
      s = updatePlayer(s, p.id, (pl) => ({
        ...pl,
        hand: pl.hand.filter((c) => c.uid !== uid),
        ...(def.isItem
          ? { removed: [...pl.removed, card] }
          : { discard: [...pl.discard, card] }),
      }))
    }
  }
  return {
    ...s,
    playMode: 'idle',
    moveSession: null,
    jokerChoiceUid: null,
    pendingAction: null,
    selectedForBuy: [],
    selectedForRemove: [],
    removeQuota: 0,
  }
}

function finishCardUse(
  state: GameState,
  card: CardInstance,
  asItemUsed: boolean,
): GameState {
  const def = getDef(card.defId)
  const remove = Boolean(def.isItem && asItemUsed)
  let s = updatePlayer(state, state.currentPlayer, (p) => ({
    ...p,
    hand: p.hand.filter((c) => c.uid !== card.uid),
  }))
  s = placePlayed(s, [card], { removeItem: remove })
  return {
    ...s,
    playMode: 'idle',
    moveSession: null,
  }
}

export function moveToCell(state: GameState, targetId: string): GameState {
  if (!state.moveSession) return state
  const { cardUid, symbol, remainingPower } = state.moveSession
  const p = current(state)
  const card = p.hand.find((c) => c.uid === cardUid)
  if (!card) return state

  const legal = legalMoveTargets(state, symbol, remainingPower)
  if (!legal.includes(targetId)) return state

  const cell = state.cells[targetId]

  // Pay to remove a border — stay put; only then can anyone cross.
  if (cell.blockade) {
    const bid = cell.blockade.id
    const cost = cell.blockade.power
    let s = clearBlockade(state, bid, p.id)
    s = log(s, `${p.name} removed border #${bid} (keeps it for ties).`)
    const left = remainingPower - cost
    if (left > 0) {
      const more = legalMoveTargets(
        { ...s, moveSession: { cardUid, symbol, remainingPower: left, hasMoved: true } },
        symbol,
        left,
        p.position,
      )
      if (more.length > 0) {
        return {
          ...s,
          moveSession: { cardUid, symbol, remainingPower: left, hasMoved: true },
          playMode: 'moving',
        }
      }
    }
    return finishCardUse(s, card, true)
  }

  const req = spaceRequirement(state, targetId)
  const cost = req.power

  let s = updatePlayer(state, p.id, (pl) => ({ ...pl, position: targetId }))
  s = log(s, `${p.name} moved to ${cell.type} (${cost}).`)

  // Stepped into the gold city — claim El Dorado (visible on the gold hex).
  if (cell.type === 'eldorado') {
    s = finishCardUse(s, card, true)
    s = updatePlayer(s, p.id, (pl) => ({ ...pl, reached: true }))
    s = log(s, `${p.name} reached El Dorado!`)
    return endGame({
      ...s,
      finalRoundTriggered: true,
      turnsLeftInFinal: 0,
    })
  }

  const left = remainingPower - cost
  if (left > 0) {
    const more = legalMoveTargets(
      { ...s, moveSession: { cardUid, symbol, remainingPower: left, hasMoved: true } },
      symbol,
      left,
      targetId,
    )
    if (more.length > 0) {
      return {
        ...s,
        moveSession: { cardUid, symbol, remainingPower: left, hasMoved: true },
        playMode: 'moving',
      }
    }
  }

  return finishCardUse(s, card, true)
}

export function startSpecialMove(state: GameState, cardUids: string[]): GameState {
  if (cardUids.length === 0) return state
  const targets = legalSpecialTargets(state).filter((id) => {
    const cell = state.cells[id]
    if (!cell) return false
    const need = cell.blockade?.symbols === 'any' ? cell.blockade.power : cell.power
    return cardUids.length >= need
  })
  if (targets.length === 0) return state

  return {
    ...state,
    playMode: 'moving',
    selectedForRemove: cardUids,
    moveSession: {
      cardUid: cardUids[0],
      symbol: 'machete',
      remainingPower: 0,
      hasMoved: false,
    },
  }
}

export function moveSpecial(state: GameState, targetId: string): GameState {
  const uids = state.selectedForRemove
  if (uids.length === 0) return state
  const cell = state.cells[targetId]
  if (!cell) return state
  const isAnyBlockade = cell.blockade?.symbols === 'any'
  if (!isAnyBlockade && cell.type !== 'rubble' && cell.type !== 'camp') return state
  const need = isAnyBlockade ? cell.blockade!.power : cell.power
  if (uids.length < need) return state
  if (isOccupied(state, targetId, state.currentPlayer)) return state

  const p = current(state)
  const using = uids.slice(0, need)
  const { player: p2, removed } = removeFromHand(p, using)

  // Grey border: pay to remove, stay on your hex — then you may cross later.
  if (isAnyBlockade && cell.blockade) {
    const bid = cell.blockade.id
    let s: GameState = {
      ...state,
      players: state.players.map((pl) => (pl.id === p.id ? p2 : pl)),
      selectedForRemove: [],
      moveSession: null,
      playMode: 'idle',
    }
    s = clearBlockade(s, bid, p.id)
    s = updatePlayer(s, p.id, (pl) => ({
      ...pl,
      discard: [...pl.discard, ...removed],
    }))
    return log(s, `${p.name} removed grey border #${bid} (keeps it for ties).`)
  }

  let s: GameState = {
    ...state,
    players: state.players.map((pl) => (pl.id === p.id ? { ...p2, position: targetId } : pl)),
    selectedForRemove: [],
    moveSession: null,
    playMode: 'idle',
  }

  if (cell.type === 'camp') {
    s = updatePlayer(s, p.id, (pl) => ({
      ...pl,
      removed: [...pl.removed, ...removed],
    }))
    s = log(s, `${p.name} camped and removed ${removed.length} card(s).`)
  } else {
    s = updatePlayer(s, p.id, (pl) => ({
      ...pl,
      discard: [...pl.discard, ...removed],
    }))
    s = log(s, `${p.name} crossed rubble.`)
  }
  return s
}

function playActionCard(state: GameState, cardUid: string): GameState {
  const p = current(state)
  const card = p.hand.find((c) => c.uid === cardUid)
  if (!card) return state
  const def = getDef(card.defId)
  if (!def.action) return state

  const effect = def.action
  let s = state

  if (effect === 'ignore_space') {
    return {
      ...s,
      playMode: 'moving',
      pendingAction: { cardUid, effect },
      moveSession: null,
    }
  }

  if (effect === 'free_buy') {
    return {
      ...s,
      playMode: 'buying',
      pendingAction: { cardUid, effect },
      boughtThisTurn: false,
    }
  }

  // Draw effects
  const drawN =
    effect === 'draw2' || effect === 'draw2_remove2' ? 2 : effect === 'draw3' ? 3 : 1
  for (let i = 0; i < drawN; i++) s = drawOne(s, s.currentPlayer)

  const removeN =
    effect === 'draw1_remove1' ? 1 : effect === 'draw2_remove2' ? 2 : 0

  // Consume action card
  const fresh = s.players[s.currentPlayer].hand.find((c) => c.uid === cardUid)
  if (fresh) {
    s = updatePlayer(s, s.currentPlayer, (pl) => ({
      ...pl,
      hand: pl.hand.filter((c) => c.uid !== cardUid),
    }))
    s = placePlayed(s, [fresh], { removeItem: Boolean(def.isItem) })
  }

  s = log(s, `${p.name} played ${def.name}.`)

  if (removeN > 0) {
    return {
      ...s,
      playMode: 'remove_cards',
      removeQuota: removeN,
      selectedForRemove: [],
      pendingAction: null,
    }
  }

  return { ...s, playMode: 'idle', pendingAction: null }
}

export function confirmNativeMove(state: GameState, targetId: string): GameState {
  if (!state.pendingAction || state.pendingAction.effect !== 'ignore_space') return state
  if (!legalNativeTargets(state).includes(targetId)) {
    return cancelMove(state)
  }
  const cardUid = state.pendingAction.cardUid
  const p = current(state)
  const card = p.hand.find((c) => c.uid === cardUid)
  if (!card) return cancelMove(state)

  let s = updatePlayer(state, p.id, (pl) => ({ ...pl, position: targetId }))
  const cell = s.cells[targetId]
  if (cell?.blockade) {
    const bid = cell.blockade.id
    s = clearBlockade(s, bid, p.id)
    s = log(s, `${p.name} removed border #${bid} with Native guidance.`)
  }
  s = finishCardUse(s, card, true)
  s = { ...s, pendingAction: null }

  if (cell?.type === 'eldorado') {
    s = updatePlayer(s, p.id, (pl) => ({ ...pl, reached: true }))
    s = log(s, `${p.name} reached El Dorado!`)
    return endGame({
      ...s,
      finalRoundTriggered: true,
      turnsLeftInFinal: 0,
    })
  }
  return log(s, `${p.name} used Native guidance.`)
}

export function confirmRemoveCards(state: GameState, uids: string[]): GameState {
  if (state.playMode !== 'remove_cards') return state
  const take = uids.slice(0, state.removeQuota)
  const p = current(state)
  const { player: p2, removed } = removeFromHand(p, take)
  let s: GameState = {
    ...state,
    players: state.players.map((pl) =>
      pl.id === p.id ? { ...p2, removed: [...p2.removed, ...removed] } : pl,
    ),
    playMode: 'idle',
    removeQuota: 0,
    selectedForRemove: [],
  }
  return log(s, `${p.name} removed ${removed.length} card(s).`)
}

export function skipRemove(state: GameState): GameState {
  if (state.playMode !== 'remove_cards') return state
  return { ...state, playMode: 'idle', removeQuota: 0, selectedForRemove: [] }
}

export function availableMarket(state: GameState): string[] {
  const vacant = state.marketSlots.some((s) => s == null || (s && state.marketRemaining[s] <= 0))
  const onBoard = state.marketSlots.filter(
    (s): s is string => Boolean(s) && state.marketRemaining[s!] > 0,
  )
  if (vacant || state.marketSlots.some((s) => s != null && state.marketRemaining[s] <= 0)) {
    const off = state.offMarket.filter((id) => state.marketRemaining[id] > 0)
    return [...new Set([...onBoard, ...off])]
  }
  // Also treat empty stacks as vacant for access
  const hasEmpty = state.marketSlots.some((s) => s != null && state.marketRemaining[s] === 0)
  if (hasEmpty) {
    const off = state.offMarket.filter((id) => state.marketRemaining[id] > 0)
    return [...new Set([...onBoard, ...off])]
  }
  return onBoard
}

export function beginBuy(state: GameState): GameState {
  if (state.boughtThisTurn || state.phase !== 'play') return state
  return {
    ...state,
    playMode: 'buying',
    selectedForBuy: [],
    moveSession: null,
  }
}

export function toggleBuyCard(state: GameState, uid: string): GameState {
  if (state.playMode !== 'buying') return state
  const set = new Set(state.selectedForBuy)
  if (set.has(uid)) set.delete(uid)
  else set.add(uid)
  return { ...state, selectedForBuy: [...set] }
}

export function purchaseCard(state: GameState, defId: string): GameState {
  if (state.playMode !== 'buying' || state.boughtThisTurn) return state
  const free = state.pendingAction?.effect === 'free_buy'
  const available = availableMarket(state)
  if (!available.includes(defId) && !free) return state
  if (state.marketRemaining[defId] <= 0) return state

  const cost = getDef(defId).cost ?? 0
  if (!free && !canAfford(state, defId, state.selectedForBuy)) return state

  const p = current(state)
  let s = state

  if (!free) {
    const { player: p2, removed } = removeFromHand(p, state.selectedForBuy)
    s = {
      ...s,
      players: s.players.map((pl) =>
        pl.id === p.id ? { ...p2, discard: [...p2.discard, ...removed] } : pl,
      ),
    }
  } else {
    // consume transmitter
    const tx = state.pendingAction!.cardUid
    const card = p.hand.find((c) => c.uid === tx)
    if (card) {
      s = updatePlayer(s, p.id, (pl) => ({
        ...pl,
        hand: pl.hand.filter((c) => c.uid !== tx),
        removed: [...pl.removed, card],
      }))
    }
  }

  const made = makeCard(s, defId)
  s = made.state
  s = updatePlayer(s, p.id, (pl) => ({
    ...pl,
    discard: [...pl.discard, made.card],
  }))

  const remaining = { ...s.marketRemaining, [defId]: s.marketRemaining[defId] - 1 }
  let slots = [...s.marketSlots]
  let off = [...s.offMarket]

  // If bought from off-market, place pile into vacant slot
  const onSlot = slots.includes(defId)
  if (!onSlot) {
    const vacantIdx = slots.findIndex((x) => x == null || (x != null && remaining[x] <= 0))
    if (vacantIdx >= 0) {
      slots[vacantIdx] = defId
      off = off.filter((id) => id !== defId)
    }
  }

  // Clear emptied slots
  slots = slots.map((x) => (x && remaining[x] <= 0 ? null : x))

  s = {
    ...s,
    marketRemaining: remaining,
    marketSlots: slots,
    offMarket: off,
    boughtThisTurn: true,
    playMode: 'idle',
    selectedForBuy: [],
    pendingAction: null,
  }
  return log(s, `${p.name} hired ${getDef(defId).name} (${free ? 'free' : `$${cost}`}).`)
}

export function endPlayPhase(state: GameState): GameState {
  if (state.phase !== 'play') return state
  return {
    ...state,
    phase: 'discard',
    playMode: 'idle',
    moveSession: null,
    selectedForBuy: [],
    jokerChoiceUid: null,
  }
}

export function finishDiscard(state: GameState, keepUids: string[]): GameState {
  if (state.phase !== 'discard') return state
  const p = current(state)
  const keep = new Set(keepUids)
  const toDiscard = p.hand.filter((c) => !keep.has(c.uid))
  const kept = p.hand.filter((c) => keep.has(c.uid))
  let s = updatePlayer(state, p.id, (pl) => ({
    ...pl,
    hand: kept,
    discard: [...pl.discard, ...toDiscard],
  }))
  s = drawUpTo(s, p.id, 4)
  return advanceTurn(s)
}

function endGame(state: GameState): GameState {
  const finishers = state.players.filter((p) => p.reached)
  finishers.sort((a, b) => {
    if (b.blockades.length !== a.blockades.length) return b.blockades.length - a.blockades.length
    const aMax = Math.max(0, ...a.blockades)
    const bMax = Math.max(0, ...b.blockades)
    return bMax - aMax
  })
  const winners = finishers.length ? [finishers[0].id] : []
  const winner = winners.length ? state.players[winners[0]] : null
  const claim =
    winner == null
      ? 'The expedition ends.'
      : winner.isHuman
        ? 'You claim El Dorado!'
        : `${winner.name} claims El Dorado!`
  return log(
    { ...state, phase: 'gameover', winnerIds: winners, playMode: 'idle' },
    claim,
  )
}

function advanceTurn(state: GameState): GameState {
  if (state.finalRoundTriggered && state.turnsLeftInFinal != null) {
    if (state.turnsLeftInFinal <= 0) return endGame(state)
  }

  let next = (state.currentPlayer + 1) % state.players.length
  let guard = 0
  while (state.players[next].reached && guard < state.players.length) {
    next = (next + 1) % state.players.length
    guard++
  }

  let s: GameState = {
    ...state,
    currentPlayer: next,
    phase: 'play',
    playMode: 'idle',
    boughtThisTurn: false,
    moveSession: null,
    selectedForBuy: [],
    selectedForRemove: [],
  }

  if (state.finalRoundTriggered && state.turnsLeftInFinal != null) {
    s = { ...s, turnsLeftInFinal: state.turnsLeftInFinal - 1 }
    if (s.turnsLeftInFinal! < 0) return endGame(s)
  }

  // If everyone remaining already reached, end
  if (s.players.every((p) => p.reached)) return endGame(s)

  return log(s, `${s.players[next].name}'s turn.`)
}

export function progressTowardGoal(state: GameState, playerId: number): number {
  const pos = state.players[playerId].position
  const cell = state.cells[pos]
  return cell?.q ?? 0
}

export { occupiedPositions, drawOne, drawUpTo, current, getDef }
export type { ActionEffect }
