/**
 * Ping DreamHost PHP counter when a new game starts.
 * Fails silently in local Vite (no PHP) or if the network blocks it.
 */
export function recordGameStart(): void {
  const url = new URL(`${import.meta.env.BASE_URL}hit.php`, window.location.origin)
  url.searchParams.set('_', `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  void fetch(url.toString(), {
    method: 'POST',
    cache: 'no-store',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    body: 'event=game_start',
  }).catch(() => {
    /* ignore — local / offline */
  })
}
