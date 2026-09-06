import { getDef, symbolColor } from '../game/cards'
import type { CardInstance } from '../game/types'
import { CardHover, SingleUseMark, SymbolIcon } from './CardHover'

interface Props {
  cards: CardInstance[]
  selected: string[]
  disabled?: boolean
  onToggle: (uid: string) => void
  accent?: 'buy' | 'move' | 'remove' | 'keep'
}

export function Hand({ cards, selected, disabled, onToggle, accent = 'move' }: Props) {
  return (
    <div className={`hand accent-${accent}`}>
      {cards.map((card) => {
        const def = getDef(card.defId)
        const isSel = selected.includes(card.uid)
        return (
          <CardHover key={card.uid} defId={card.defId}>
            <button
              type="button"
              className={`expedition-card ${isSel ? 'selected' : ''} ${def.isItem ? 'item' : ''}`}
              disabled={disabled}
              onClick={() => onToggle(card.uid)}
              style={{
                borderColor: symbolColor(def.symbol === 'none' ? 'joker' : def.symbol),
              }}
            >
              {def.isItem && <SingleUseMark />}
              <div className="card-name">{def.name}</div>
              <SymbolIcon symbol={def.symbol} power={def.power} />
            </button>
          </CardHover>
        )
      })}
    </div>
  )
}
