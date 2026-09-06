import { getDef, symbolColor } from '../game/cards'
import type { GameState } from '../game/types'
import { availableMarket, canAfford } from '../game/engine'
import { CardHover, SingleUseMark } from './CardHover'

interface Props {
  state: GameState
  canBuy: boolean
  onBuy: (defId: string) => void
}

export function Market({ state, canBuy, onBuy }: Props) {
  const available = new Set(availableMarket(state))
  const free = state.pendingAction?.effect === 'free_buy'
  const pay = state.selectedForBuy

  const renderCard = (id: string, key?: string) => {
    const def = getDef(id)
    const slotOpen = available.has(id) || free
    const affordable = free || canAfford(state, id, pay)
    const enabled = canBuy && slotOpen && affordable
    return (
      <CardHover key={key ?? id} defId={id} stock={state.marketRemaining[id]}>
        <button
          type="button"
          className={`market-card ${enabled ? 'affordable' : ''} ${def.isItem ? 'item' : ''}`}
          disabled={!enabled}
          onClick={() => onBuy(id)}
          style={{ borderColor: symbolColor(def.symbol === 'none' ? 'joker' : def.symbol) }}
        >
          <div className="market-card-top">
            <strong className="market-card-title">{def.name}</strong>
            {def.isItem && <SingleUseMark />}
            <span className="stock">×{state.marketRemaining[id]}</span>
          </div>
          <div className="market-card-detail">
            <span className="market-card-cost">${def.cost}</span>
            <span className="market-card-effect">{def.description}</span>
          </div>
        </button>
      </CardHover>
    )
  }

  return (
    <div className="market">
      <div className="market-section">
        <h3>Market</h3>
        <div className="market-grid">
          {state.marketSlots.map((id, i) => {
            if (!id || state.marketRemaining[id] <= 0) {
              return (
                <div key={`empty-${i}`} className="market-card empty">
                  Vacant
                </div>
              )
            }
            return renderCard(id)
          })}
        </div>
      </div>
      {(available.size > state.marketSlots.filter(Boolean).length || free) && (
        <div className="market-section">
          <h3>Reserve {free ? '(Transmitter — any card)' : '(slot open)'}</h3>
          <div className="market-grid compact">
            {state.offMarket
              .filter((id) => state.marketRemaining[id] > 0 && (available.has(id) || free))
              .map((id) => renderCard(id, id))}
          </div>
        </div>
      )}
    </div>
  )
}
