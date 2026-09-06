import type { CardDef } from './types'

/** Official base-game expedition cards (3 copies of each market type). */
export const CARD_DEFS: Record<string, CardDef> = {
  traveler: {
    id: 'traveler',
    name: 'Traveler',
    symbol: 'coin',
    power: 1,
    cost: null,
    kind: 'movement',
    description: '1 coin — villages & hiring.',
  },
  explorer: {
    id: 'explorer',
    name: 'Explorer',
    symbol: 'machete',
    power: 1,
    cost: null,
    kind: 'movement',
    description: '1 machete — clear jungle.',
  },
  sailor: {
    id: 'sailor',
    name: 'Sailor',
    symbol: 'paddle',
    power: 1,
    cost: null,
    kind: 'movement',
    description: '1 paddle — cross rivers.',
  },
  scout: {
    id: 'scout',
    name: 'Scout',
    symbol: 'machete',
    power: 2,
    cost: 1,
    kind: 'movement',
    startMarket: true,
    description: '2 machetes.',
  },
  photographer: {
    id: 'photographer',
    name: 'Photographer',
    symbol: 'coin',
    power: 2,
    cost: 2,
    kind: 'movement',
    startMarket: true,
    description: '2 coins.',
  },
  captain: {
    id: 'captain',
    name: 'Captain',
    symbol: 'paddle',
    power: 3,
    cost: 2,
    kind: 'movement',
    startMarket: true,
    description: '3 paddles.',
  },
  jack: {
    id: 'jack',
    name: 'Jack-of-all-Trades',
    symbol: 'joker',
    power: 1,
    cost: 2,
    kind: 'movement',
    startMarket: true,
    description: 'Choose machete, paddle, or coin (1).',
  },
  trailblazer: {
    id: 'trailblazer',
    name: 'Trailblazer',
    symbol: 'machete',
    power: 3,
    cost: 3,
    kind: 'movement',
    startMarket: true,
    description: '3 machetes.',
  },
  journalist: {
    id: 'journalist',
    name: 'Journalist',
    symbol: 'coin',
    power: 3,
    cost: 3,
    kind: 'movement',
    startMarket: true,
    description: '3 coins.',
  },
  treasure: {
    id: 'treasure',
    name: 'Treasure Chest',
    symbol: 'coin',
    power: 4,
    cost: 3,
    kind: 'movement',
    isItem: true,
    description: '4 coins — remove after use.',
  },
  giant: {
    id: 'giant',
    name: 'Giant Machete',
    symbol: 'machete',
    power: 4,
    cost: 3,
    kind: 'movement',
    description: '4 machetes.',
  },
  adventurer: {
    id: 'adventurer',
    name: 'Adventurer',
    symbol: 'joker',
    power: 2,
    cost: 4,
    kind: 'movement',
    description: 'Choose symbol (2).',
  },
  propplane: {
    id: 'propplane',
    name: 'Prop Plane',
    symbol: 'joker',
    power: 4,
    cost: 4,
    kind: 'movement',
    isItem: true,
    description: 'Choose symbol (4) — remove after use.',
  },
  millionaire: {
    id: 'millionaire',
    name: 'Millionaire',
    symbol: 'coin',
    power: 4,
    cost: 5,
    kind: 'movement',
    description: '4 coins.',
  },
  pioneer: {
    id: 'pioneer',
    name: 'Pioneer',
    symbol: 'machete',
    power: 5,
    cost: 5,
    kind: 'movement',
    description: '5 machetes.',
  },
  transmitter: {
    id: 'transmitter',
    name: 'Transmitter',
    symbol: 'none',
    power: 0,
    cost: 4,
    kind: 'action',
    isItem: true,
    action: 'free_buy',
    description: 'Take any market card for free, then remove.',
  },
  cartographer: {
    id: 'cartographer',
    name: 'Cartographer',
    symbol: 'none',
    power: 0,
    cost: 4,
    kind: 'action',
    action: 'draw2',
    description: 'Draw 2 cards (playable this turn).',
  },
  compass: {
    id: 'compass',
    name: 'Compass',
    symbol: 'none',
    power: 0,
    cost: 4,
    kind: 'action',
    isItem: true,
    action: 'draw3',
    description: 'Draw 3 cards, then remove.',
  },
  scientist: {
    id: 'scientist',
    name: 'Scientist',
    symbol: 'none',
    power: 0,
    cost: 4,
    kind: 'action',
    action: 'draw1_remove1',
    description: 'Draw 1, then optionally remove 1 from hand.',
  },
  travelog: {
    id: 'travelog',
    name: 'Travel Log',
    symbol: 'none',
    power: 0,
    cost: 3,
    kind: 'action',
    isItem: true,
    action: 'draw2_remove2',
    description: 'Draw 2, remove up to 2, then remove this.',
  },
  native: {
    id: 'native',
    name: 'Native',
    symbol: 'none',
    power: 0,
    cost: 5,
    kind: 'action',
    action: 'ignore_space',
    description: 'Move onto any adjacent space (ignore requirements).',
  },
}

export const STARTING_DECK: { defId: string; count: number }[] = [
  { defId: 'traveler', count: 4 },
  { defId: 'explorer', count: 3 },
  { defId: 'sailor', count: 1 },
]

export function getDef(defId: string): CardDef {
  return CARD_DEFS[defId]
}

export function coinValue(defId: string): number {
  const def = getDef(defId)
  if (def.symbol === 'coin') return def.power
  if (def.symbol === 'joker') return def.power
  return 0.5
}

export function symbolColor(symbol: string): string {
  switch (symbol) {
    case 'machete':
      return '#2f7a3e'
    case 'paddle':
      return '#2a6f9a'
    case 'coin':
      return '#c9a227'
    case 'joker':
      return '#e8e4d9'
    default:
      return '#7b5ea7'
  }
}
