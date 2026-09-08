import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Board } from './components/Board'
import { Hand } from './components/Hand'
import { MapBuilder } from './components/MapBuilder'
import { Market } from './components/Market'
import { runAiTurn } from './game/ai'
import { recordGameStart } from './game/analytics'
import { assembleBoard, type TilePlacement } from './game/board'
import { getDef, symbolColor } from './game/cards'
import {
  beginBuy,
  cancelMove,
  canAfford,
  chooseJokerSymbol,
  confirmNativeMove,
  confirmRemoveCards,
  createGame,
  endPlayPhase,
  finishDiscard,
  handCoinTotal,
  legalMoveTargets,
  legalNativeTargets,
  legalSpecialTargets,
  moveSpecial,
  moveToCell,
  purchaseCard,
  selectCardForMove,
  skipRemove,
  toggleBuyCard,
} from './game/engine'
import type { CardInstance, GameState, HexCell, TerrainSymbol } from './game/types'
import './index.css'

type Screen = 'title' | 'build' | 'play'

export default function App() {
  const [screen, setScreen] = useState<Screen>('title')
  const [aiCount, setAiCount] = useState(1)
  const [state, setState] = useState<GameState | null>(null)
  const [busy, setBusy] = useState(false)
  const [keepSel, setKeepSel] = useState<string[]>([])
  const [specialSel, setSpecialSel] = useState<string[]>([])
  const [showRules, setShowRules] = useState(false)
  const [specialMode, setSpecialMode] = useState(false)

  const stateRef = useRef(state)
  stateRef.current = state
  const aiGen = useRef(0)

  const beginWithBoard = (board?: Record<string, HexCell>) => {
    aiGen.current += 1
    setBusy(false)
    setState(createGame('You', aiCount, board))
    setScreen('play')
    setKeepSel([])
    setSpecialSel([])
    setSpecialMode(false)
    recordGameStart()
  }

  const start = () => beginWithBoard()

  const playBuiltMap = (placements: TilePlacement[]) => {
    beginWithBoard(assembleBoard(placements, { blockades: false }))
  }

  const human = state?.players[0]
  const me = state ? state.players[state.currentPlayer] : null
  const isHumanTurn = Boolean(
    state && me?.isHuman && !busy && state.phase !== 'gameover',
  )

  // When entering discard: empty hand → draw immediately; otherwise keep leftovers by default.
  useEffect(() => {
    if (!state || state.phase !== 'discard') return
    const p = state.players[state.currentPlayer]
    if (!p.isHuman) return
    if (p.hand.length === 0) {
      setState(finishDiscard(state, []))
      return
    }
    setKeepSel(p.hand.map((c) => c.uid))
  }, [state?.phase, state?.currentPlayer])

  // AI only when the active seat changes — never re-enter mid-turn on phase flips.
  useEffect(() => {
    if (screen !== 'play') return
    const s0 = stateRef.current
    if (!s0 || s0.phase === 'gameover') return
    const p = s0.players[s0.currentPlayer]
    if (p.isHuman) {
      setBusy(false)
      return
    }

    const gen = ++aiGen.current
    let cancelled = false
    setBusy(true)

    ;(async () => {
      try {
        await runAiTurn(s0, (next) => {
          if (cancelled || gen !== aiGen.current) return
          stateRef.current = next
          setState(next)
        })
      } catch (err) {
        console.error('AI turn failed', err)
      } finally {
        if (!cancelled && gen === aiGen.current) setBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // Intentionally only seat changes — runAiTurn owns play→discard→draw itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.currentPlayer, screen])

  const highlights = useMemo(() => {
    if (!state || !isHumanTurn) return []
    if (state.pendingAction?.effect === 'ignore_space') return legalNativeTargets(state)
    if (specialMode && specialSel.length) {
      return legalSpecialTargets(state).filter((id) => {
        const cell = state.cells[id]
        const need = cell?.blockade?.symbols === 'any' ? cell.blockade.power : cell?.power ?? 99
        return specialSel.length >= need
      })
    }
    if (state.moveSession) {
      return legalMoveTargets(
        state,
        state.moveSession.symbol,
        state.moveSession.remainingPower,
      )
    }
    return []
  }, [state, isHumanTurn, specialMode, specialSel])

  const onCellClick = useCallback(
    (id: string) => {
      if (!state || !isHumanTurn) return
      if (state.pendingAction?.effect === 'ignore_space') {
        setState(confirmNativeMove(state, id))
        return
      }
      if (specialMode && specialSel.length) {
        setState(moveSpecial({ ...state, selectedForRemove: specialSel }, id))
        setSpecialMode(false)
        setSpecialSel([])
        return
      }
      if (state.moveSession) setState(moveToCell(state, id))
    },
    [state, isHumanTurn, specialMode, specialSel],
  )

  const onCardClick = (uid: string) => {
    if (!state) return
    // Discard/keep must work even if a prior AI left busy stuck.
    if (state.phase === 'discard' && state.players[state.currentPlayer]?.isHuman) {
      setKeepSel((prev) =>
        prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid],
      )
      return
    }
    if (!isHumanTurn) return
    if (state.playMode === 'remove_cards') {
      setState({
        ...state,
        selectedForRemove: state.selectedForRemove.includes(uid)
          ? state.selectedForRemove.filter((x) => x !== uid)
          : [...state.selectedForRemove, uid].slice(0, state.removeQuota),
      })
      return
    }
    if (state.playMode === 'buying') {
      setState(toggleBuyCard(state, uid))
      return
    }
    if (specialMode) {
      setSpecialSel((prev) =>
        prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid],
      )
      return
    }
    if (state.moveSession || state.playMode === 'choose_joker') return
    setState(selectCardForMove(state, uid))
  }

  const endHumanPlay = () => {
    if (!state) return
    const next = endPlayPhase(state)
    const hand = next.players[next.currentPlayer].hand
    // No leftovers to choose — skip the “Keep 0 & draw” prompt.
    setState(hand.length === 0 ? finishDiscard(next, []) : next)
  }

  const confirmKeepAndDraw = () => {
    if (!state || state.phase !== 'discard') return
    setState(finishDiscard(state, keepSel))
  }

  if (screen === 'title') {
    return (
      <div className="title-screen">
        <div className="title-bg" aria-hidden />
        <div className="title-content">
          <p className="eyebrow">Reiner Knizia · Digital expedition</p>
          <h1>The Quest for El Dorado</h1>
          <p className="tagline">
            Race through jungle, river, and village. Build your expedition deck — first to the
            golden city wins.
          </p>
          <div className="title-controls">
            <label>
              Rivals
              <select value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
            <button type="button" className="cta" onClick={start}>
              Begin expedition
            </button>
            <button type="button" className="ghost" onClick={() => setScreen('build')}>
              Build map
            </button>
          </div>
          <button type="button" className="linkish" onClick={() => setShowRules(true)}>
            How to play
          </button>
          <a
            className="bgg"
            href="https://boardgamegeek.com/boardgame/217372/the-quest-for-el-dorado"
            target="_blank"
            rel="noreferrer"
          >
            BoardGameGeek
          </a>
        </div>
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </div>
    )
  }

  if (screen === 'build') {
    return (
      <MapBuilder
        aiCount={aiCount}
        onBack={() => setScreen('title')}
        onPlay={playBuiltMap}
      />
    )
  }

  if (!state || !human) return null

  const coinPreview =
    state.playMode === 'buying' ? handCoinTotal(state, state.selectedForBuy) : 0

  const discardInteractive = state.phase === 'discard' && Boolean(me?.isHuman)

  const jokerCard =
    state.playMode === 'choose_joker' && state.jokerChoiceUid
      ? human.hand.find((c) => c.uid === state.jokerChoiceUid)
      : undefined
  const jokerDef = jokerCard ? getDef(jokerCard.defId) : null

  return (
    <div className="app playing">
      <main className="layout">
        <section className="map-panel">
          <Board
            cells={state.cells}
            positions={state.players
              .filter((p) => !p.reached || state.cells[p.position]?.type === 'eldorado')
              .map((p) => ({
                id: p.id,
                cellId: p.position,
                color: p.color,
                name: p.name,
              }))}
            highlights={highlights}
            currentPos={me?.position}
            onCellClick={onCellClick}
          />
        </section>

        <aside className="side-panel">
          {isHumanTurn && state.phase === 'play' && state.playMode === 'idle' && !specialMode && (
            <div className="side-panel-pin">
              <button type="button" className="cta end-turn-pin" onClick={endHumanPlay}>
                End turn
              </button>
            </div>
          )}
          <div className="side-panel-body">
          <div className="side-tools">
            <div className="status compact">
              {state.phase === 'gameover' ? (
                <strong>
                  {state.winnerIds.includes(0)
                    ? 'You win!'
                    : `${state.winnerIds.map((id) => state.players[id].name).join(', ')} wins!`}
                </strong>
              ) : (
                <>
                  <span className="turn-pip" style={{ background: me?.color }} />
                  {me?.isHuman ? 'Your turn' : `${me?.name}'s turn`}
                  {busy && ' · thinking…'}
                  {state.finalRoundTriggered && ' · final'}
                </>
              )}
            </div>
          </div>

          <div className="play-rail">
            {isHumanTurn && state.phase === 'play' && state.playMode === 'idle' && !specialMode && (
              <div className="actions actions-row">
                <button
                  type="button"
                  onClick={() => setState(beginBuy(state))}
                  disabled={state.boughtThisTurn}
                >
                  Hire
                </button>
                <button type="button" onClick={() => setSpecialMode(true)}>
                  Grey/Red
                </button>
              </div>
            )}

            {(
              (state.moveSession && isHumanTurn) ||
              (state.playMode === 'buying' && isHumanTurn) ||
              (state.playMode === 'remove_cards' && isHumanTurn) ||
              (specialMode && isHumanTurn)
            ) && (
              <div className="dock dock-above-hand">
                {state.moveSession && isHumanTurn && (
                  <div className="prompt">
                    Moving with {state.moveSession.remainingPower} {state.moveSession.symbol} left —
                    click a highlighted hex (borders: pay to remove, then cross).
                    <button type="button" className="ghost" onClick={() => setState(cancelMove(state))}>
                      {state.moveSession.hasMoved ? 'Stop here' : 'Cancel'}
                    </button>
                  </div>
                )}

                {state.playMode === 'buying' && isHumanTurn && (
                  <div className="prompt">
                    Select cards to spend ({coinPreview.toFixed(1)} coins), then click a market card.
                    <button type="button" className="ghost" onClick={() => setState(cancelMove(state))}>
                      Cancel
                    </button>
                  </div>
                )}

                {state.playMode === 'remove_cards' && isHumanTurn && (
                  <div className="prompt">
                    Optionally remove up to {state.removeQuota} card(s).
                    <button
                      type="button"
                      onClick={() => setState(confirmRemoveCards(state, state.selectedForRemove))}
                    >
                      Confirm
                    </button>
                    <button type="button" className="ghost" onClick={() => setState(skipRemove(state))}>
                      Skip
                    </button>
                  </div>
                )}

                {specialMode && isHumanTurn && (
                  <div className="prompt">
                    Select cards equal to the grey border / rubble / camp number, then click it
                    (borders clear without moving; rubble and camp move you on).
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setSpecialMode(false)
                        setSpecialSel([])
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            <Hand
              cards={human.hand}
              selected={
                state.phase === 'discard' && me?.isHuman
                  ? keepSel
                  : state.playMode === 'buying'
                    ? state.selectedForBuy
                    : state.playMode === 'remove_cards'
                      ? state.selectedForRemove
                      : specialMode
                        ? specialSel
                        : state.moveSession && me?.isHuman
                          ? [state.moveSession.cardUid]
                          : []
              }
              disabled={
                discardInteractive
                  ? true
                  : state.phase === 'discard' && me?.isHuman
                    ? false
                    : !isHumanTurn || Boolean(state.moveSession)
              }
              onToggle={onCardClick}
              accent={
                state.phase === 'discard'
                  ? 'keep'
                  : state.playMode === 'buying'
                    ? 'buy'
                    : state.playMode === 'remove_cards' || specialMode
                      ? 'remove'
                      : 'move'
              }
            />
          </div>

          <Market
            state={state}
            canBuy={
              isHumanTurn &&
              state.phase === 'play' &&
              (state.playMode === 'buying' || state.pendingAction?.effect === 'free_buy') &&
              !state.boughtThisTurn
            }
            onBuy={(defId) => {
              if (!state) return
              if (state.pendingAction?.effect === 'free_buy') {
                setState(purchaseCard(state, defId))
                return
              }
              if (!canAfford(state, defId, state.selectedForBuy)) return
              setState(purchaseCard(state, defId))
            }}
          />

          <div className="play-rail play-rail-foot">
            <div className="players">
              {state.players.map((p) => (
                <div
                  key={p.id}
                  className={`player-row ${p.id === state.currentPlayer ? 'active' : ''}`}
                >
                  <span className="pip" style={{ background: p.color }} />
                  <span>{p.name}</span>
                  <span className="meta">
                    hand {p.hand.length} · deck {p.draw.length} · blocks {p.blockades.length}
                    {p.reached ? ' · done' : ''}
                  </span>
                </div>
              ))}
            </div>

            <div className="log">
              {state.log.slice(0, 6).map((line, i) => (
                <div key={`${line}-${i}`}>{line}</div>
              ))}
            </div>

            <div className="side-foot-actions">
              <button type="button" className="ghost" onClick={() => setShowRules(true)}>
                Rules
              </button>
              <button type="button" className="ghost" onClick={() => setScreen('title')}>
                New
              </button>
            </div>
          </div>
          </div>

          {jokerDef && isHumanTurn && (
            <JokerSymbolDialog
              cardName={jokerDef.name}
              power={jokerDef.power}
              onChoose={(sym) => setState(chooseJokerSymbol(state, sym))}
              onCancel={() => setState(cancelMove(state))}
            />
          )}

          {discardInteractive && (
            <KeepDrawDialog
              cards={human.hand}
              keepSel={keepSel}
              onToggle={(uid) =>
                setKeepSel((prev) =>
                  prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid],
                )
              }
              onConfirm={confirmKeepAndDraw}
            />
          )}

          {state.phase === 'gameover' && (
            <GameOverDialog
              winners={state.winnerIds.map((id) => state.players[id])}
              humanWon={state.winnerIds.includes(0)}
              onAgain={start}
              onTitle={() => setScreen('title')}
            />
          )}

          {showRules && <RulesModal onClose={() => setShowRules(false)} />}
        </aside>
      </main>
    </div>
  )
}

const JOKER_OPTIONS: { sym: TerrainSymbol; label: string; glyph: string }[] = [
  { sym: 'machete', label: 'Machete', glyph: 'M' },
  { sym: 'paddle', label: 'Paddle', glyph: 'P' },
  { sym: 'coin', label: 'Coin', glyph: '$' },
]

function JokerSymbolDialog({
  cardName,
  power,
  onChoose,
  onCancel,
}: {
  cardName: string
  power: number
  onChoose: (sym: TerrainSymbol) => void
  onCancel: () => void
}) {
  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="modal joker-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="joker-dialog-title"
      >
        <h2 id="joker-dialog-title">Choose a color</h2>
        <p className="joker-dialog-lead">
          Play <strong>{cardName}</strong> as {power} of:
        </p>
        <div className="joker-options">
          {JOKER_OPTIONS.map(({ sym, label, glyph }) => (
            <button
              key={sym}
              type="button"
              className="joker-option"
              style={{ borderColor: symbolColor(sym), color: symbolColor(sym) }}
              onClick={() => onChoose(sym)}
            >
              <span className="joker-glyph">{glyph}</span>
              <span className="joker-label">{label}</span>
              <span className="joker-power">{power}</span>
            </button>
          ))}
        </div>
        <button type="button" className="ghost joker-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function KeepDrawDialog({
  cards,
  keepSel,
  onToggle,
  onConfirm,
}: {
  cards: CardInstance[]
  keepSel: string[]
  onToggle: (uid: string) => void
  onConfirm: () => void
}) {
  const discardCount = cards.length - keepSel.length
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal keep-dialog"
        role="dialog"
        aria-labelledby="keep-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="keep-dialog-title">Keep & draw</h2>
        <p className="joker-dialog-lead">
          Highlighted cards stay in hand. Tap a card to discard it, then draw back up to four.
        </p>
        <Hand
          cards={cards}
          selected={keepSel}
          onToggle={onToggle}
          accent="keep"
        />
        <p className="keep-dialog-meta">
          Keeping {keepSel.length} · discarding {discardCount}
        </p>
        <button type="button" className="cta keep-confirm" onClick={onConfirm}>
          Keep {keepSel.length} & draw
        </button>
      </div>
    </div>
  )
}

function GameOverDialog({
  winners,
  humanWon,
  onAgain,
  onTitle,
}: {
  winners: { id: number; name: string; color: string }[]
  humanWon: boolean
  onAgain: () => void
  onTitle: () => void
}) {
  const names = winners.map((w) => w.name).join(', ')
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className={`modal win-dialog ${humanWon ? 'win' : 'lose'}`}
        role="dialog"
        aria-labelledby="win-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="win-eyebrow">{humanWon ? 'Victory' : 'Expedition over'}</p>
        <h2 id="win-dialog-title">
          {humanWon ? 'You claim El Dorado!' : `${names} claims El Dorado`}
        </h2>
        <p className="joker-dialog-lead">
          {humanWon
            ? 'Your expedition reached the golden city first.'
            : 'A rival reached the golden city before you.'}
        </p>
        <div className="win-actions">
          <button type="button" className="cta" onClick={onAgain}>
            Play again
          </button>
          <button type="button" className="ghost" onClick={onTitle}>
            Title screen
          </button>
        </div>
      </div>
    </div>
  )
}

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <h2>How to play</h2>
        <p>
          Each turn you play cards from a hand of four to move across hexes and/or hire one new
          card from the market. Then choose which leftovers to keep, and draw back up to four.
        </p>
        <ul>
          <li>
            <strong>Jungle</strong> needs machetes, <strong>river</strong> paddles,{' '}
            <strong>village</strong> coins. One card must fully cover a space — you cannot combine
            cards for a single hex.
          </li>
          <li>Leftover power on a card can continue onto matching adjacent spaces.</li>
          <li>
            <strong>Rubble</strong> discards N cards; <strong>camp</strong> removes N cards from the
            game (great for thinning).
          </li>
          <li>
            Coin cards spend at face value; others are worth ½ coin when hiring. Only one hire per
            turn.
          </li>
          <li>
            <strong>Borders</strong> block tile joins until paid. You cannot cross while one is
            up — pay its fee to remove it (you stay put), then move onto the next tile. The first
            clearer keeps the border token; more borders win ties.
          </li>
          <li>
            Reach a water finish (paddle), then play <strong>any card</strong> to step onto the
            gold El Dorado hexes — first explorer there wins.
          </li>
        </ul>
        <p className="fine">
          Faithful digital adaptation of Reiner Knizia&apos;s race — see{' '}
          <a
            href="https://boardgamegeek.com/boardgame/217372/the-quest-for-el-dorado"
            target="_blank"
            rel="noreferrer"
          >
            BoardGameGeek
          </a>{' '}
          for the physical game. Artwork here is original UI, not Franz Vohwinkel&apos;s.
        </p>
        <button type="button" className="cta" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
