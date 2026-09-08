import { useMemo, useState } from 'react'
import { Board } from './Board'
import {
  PLACEABLE_TILES,
  assembleBoard,
  firstPlayPlacements,
  movePlacement,
  placeNewPiece,
  rotatePlacement,
  startPositions,
  type PlaceableTileId,
  type TilePlacement,
} from '../game/board'

const DIR_BUTTONS: { dir: number; label: string }[] = [
  { dir: 2, label: 'NW' },
  { dir: 1, label: 'NE' },
  { dir: 3, label: 'W' },
  { dir: 0, label: 'E' },
  { dir: 4, label: 'SW' },
  { dir: 5, label: 'SE' },
]

const TILE_NAMES: Record<PlaceableTileId, string> = {
  B: 'B — Start',
  C: 'C',
  N: 'N',
  I: 'I',
  K: 'K',
  E: 'E — El Dorado',
}

interface Props {
  aiCount: number
  onBack: () => void
  onPlay: (placements: TilePlacement[]) => void
}

export function MapBuilder({ aiCount, onBack, onPlay }: Props) {
  const [placements, setPlacements] = useState<TilePlacement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [message, setMessage] = useState(
    'Pick a lettered piece to place. Click a piece on the board to select it, then rotate or move.',
  )

  const cells = useMemo(
    () => assembleBoard(placements, { blockades: false }),
    [placements],
  )
  const selected = placements.find((p) => p.id === selectedId) ?? null
  const hasB = placements.some((p) => p.tile === 'B')
  const hasE = placements.some((p) => p.tile === 'E')
  const starts = startPositions(cells)
  const canAccept =
    placements.length > 0 &&
    hasB &&
    hasE &&
    starts.length >= Math.min(1 + aiCount, 4)

  const applyDefault = () => {
    const next = firstPlayPlacements()
    setPlacements(next)
    setSelectedId(next[next.length - 1]?.id ?? null)
    setMessage('Default first-play layout: B → C → N → I → K → E.')
  }

  const clear = () => {
    setPlacements([])
    setSelectedId(null)
    setMessage('Board cleared. Choose a piece letter to place.')
  }

  const addPiece = (tile: PlaceableTileId) => {
    const next = placeNewPiece(placements, tile)
    const added = next[next.length - 1]
    setPlacements(next)
    setSelectedId(added.id)
    setMessage(`Placed ${TILE_NAMES[tile]}. Select it to rotate or move.`)
  }

  const onCellClick = (cellId: string) => {
    const cell = cells[cellId]
    if (!cell?.pieceId) return
    setSelectedId(cell.pieceId)
    const p = placements.find((x) => x.id === cell.pieceId)
    setMessage(p ? `Selected piece ${p.tile}.` : 'Selected piece.')
  }

  const rotate = (delta: number) => {
    if (!selectedId) return
    setPlacements((prev) => rotatePlacement(prev, selectedId, delta))
    setMessage(delta > 0 ? 'Rotated 60° clockwise.' : 'Rotated 60° counter-clockwise.')
  }

  const nudge = (dir: number) => {
    if (!selectedId) return
    setPlacements((prev) => movePlacement(prev, selectedId, dir))
    setMessage(`Moved ${DIR_BUTTONS.find((d) => d.dir === dir)?.label ?? ''}.`)
  }

  const removeSelected = () => {
    if (!selectedId) return
    setPlacements((prev) => prev.filter((p) => p.id !== selectedId))
    setSelectedId(null)
    setMessage('Removed selected piece.')
  }

  return (
    <div className="app builder">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◆</span>
          <span>Build map</span>
        </div>
        <div className="status">{message}</div>
        <div className="top-actions">
          <button type="button" className="ghost" onClick={onBack}>
            Back
          </button>
        </div>
      </header>

      <main className="builder-layout">
        <section className="map-panel">
          {placements.length === 0 ? (
            <div className="builder-empty">
              <p>No pieces on the table yet.</p>
              <button type="button" className="cta" onClick={applyDefault}>
                Default first-play map
              </button>
            </div>
          ) : (
            <Board
              cells={cells}
              positions={[]}
              highlights={[]}
              onCellClick={onCellClick}
              selectedPieceId={selectedId}
              showTileLetters
            />
          )}
        </section>

        <aside className="builder-side">
          <h2>Board pieces</h2>
          <p className="builder-hint">
            Click a letter to place that piece (duplicates allowed). Then click it on the map to
            select, rotate, or move.
          </p>

          <div className="tile-tray">
            {PLACEABLE_TILES.map((tile) => (
              <button
                key={tile}
                type="button"
                className="tile-chip"
                onClick={() => addPiece(tile)}
                title={TILE_NAMES[tile]}
              >
                {tile}
              </button>
            ))}
          </div>

          <div className="builder-actions">
            <button type="button" onClick={applyDefault}>
              Default
            </button>
            <button type="button" onClick={clear} disabled={!placements.length}>
              Clear
            </button>
          </div>

          <h3>Selected {selected ? `· ${selected.tile}` : ''}</h3>
          {!selected ? (
            <p className="builder-hint">Click a piece on the board to select it.</p>
          ) : (
            <>
              <div className="builder-actions">
                <button type="button" onClick={() => rotate(-1)}>
                  ↺ Rotate
                </button>
                <button type="button" onClick={() => rotate(1)}>
                  Rotate ↻
                </button>
                <button type="button" className="ghost" onClick={removeSelected}>
                  Remove
                </button>
              </div>
              <p className="builder-hint">Move one hex:</p>
              <div className="dir-pad">
                {DIR_BUTTONS.map(({ dir, label }) => (
                  <button key={label} type="button" onClick={() => nudge(dir)}>
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="builder-lead">
            On table:{' '}
            {placements.length
              ? placements.map((p) => p.tile).join(', ')
              : '—'}
          </p>

          <button
            type="button"
            className="cta play-map"
            disabled={!canAccept}
            onClick={() => onPlay(placements)}
          >
            Accept map
          </button>
          {placements.length > 0 && !hasB && (
            <p className="builder-warn">Add starting tile B to play.</p>
          )}
          {placements.length > 0 && !hasE && (
            <p className="builder-warn">Add ending tile E (El Dorado) to play.</p>
          )}
          {hasB && starts.length < Math.min(1 + aiCount, 4) && (
            <p className="builder-warn">Not enough start spaces for this player count.</p>
          )}
        </aside>
      </main>
    </div>
  )
}
