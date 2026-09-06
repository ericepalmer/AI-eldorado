export type TerrainSymbol = 'machete' | 'paddle' | 'coin' | 'joker'
export type TerrainType =
  | 'jungle'
  | 'river'
  | 'village'
  | 'rubble'
  | 'camp'
  | 'mountain'
  | 'start'
  | 'finish'
  | 'eldorado'

export type CardKind = 'movement' | 'action'
export type ActionEffect =
  | 'draw2'
  | 'draw3'
  | 'draw1_remove1'
  | 'draw2_remove2'
  | 'free_buy'
  | 'ignore_space'

export interface CardDef {
  id: string
  name: string
  symbol: TerrainSymbol | 'none'
  power: number
  cost: number | null
  kind: CardKind
  isItem?: boolean
  action?: ActionEffect
  startMarket?: boolean
  description: string
}

export interface CardInstance {
  uid: string
  defId: string
}

export interface HexCell {
  id: string
  q: number
  r: number
  type: TerrainType
  power: number
  /** Letter / kind: B | C | N | I | K | E | seam */
  tile: string
  /** Builder instance id (duplicates share a letter but different pieceId). */
  pieceId?: string
  isStart?: number
  blockade?: { symbols: TerrainSymbol | 'any'; power: number; id: number } | null
}

export interface PlayerState {
  id: number
  name: string
  color: string
  isHuman: boolean
  hand: CardInstance[]
  draw: CardInstance[]
  discard: CardInstance[]
  removed: CardInstance[]
  position: string
  blockades: number[]
  reached: boolean
}

export type Phase = 'play' | 'discard' | 'gameover'
export type PlayMode = 'idle' | 'moving' | 'buying' | 'action' | 'remove_cards' | 'choose_joker'

export interface MoveSession {
  cardUid: string
  symbol: TerrainSymbol
  remainingPower: number
  /** True once at least one hex was entered with this card. */
  hasMoved: boolean
}

export interface GameState {
  players: PlayerState[]
  currentPlayer: number
  phase: Phase
  playMode: PlayMode
  cells: Record<string, HexCell>
  marketSlots: (string | null)[]
  offMarket: string[]
  marketRemaining: Record<string, number>
  boughtThisTurn: boolean
  moveSession: MoveSession | null
  pendingAction: { cardUid: string; effect: ActionEffect } | null
  removeQuota: number
  selectedForBuy: string[]
  selectedForRemove: string[]
  jokerChoiceUid: string | null
  finalRoundTriggered: boolean
  turnsLeftInFinal: number | null
  winnerIds: number[]
  log: string[]
  uidCounter: number
}