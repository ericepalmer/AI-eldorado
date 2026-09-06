<?php
/**
 * Per-game start logger + stats page (DreamHost, no DB).
 *
 * Configure these two lines per game folder copy:
 */
$GAME_NAME = 'El Dorado';
$GAME_HOME = '/eldorado/';

/**
 * On each request:
 *   1. Append one line to game-starts.log  (UTC ISO date, IP, event)
 *   2. Rebuild count.html from the full log
 *
 * Log line format:
 *   2026-08-13T03:10:00+00:00    1.2.3.4    game_start
 *
 * View:
 *   {GAME_HOME}count.html
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

$rawEvent = $_POST['event'] ?? $_GET['event'] ?? 'game_start';
$event = preg_replace('/[^a-z0-9_-]/i', '', (string) $rawEvent);
if ($event === '') {
  $event = 'game_start';
}

$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
if (strpos($ip, ',') !== false) {
  $ip = trim(explode(',', $ip)[0]);
}

$line = gmdate('c') . "\t" . $ip . "\t" . $event . "\n";
$logFile = __DIR__ . '/game-starts.log';
$htmlFile = __DIR__ . '/count.html';

$ok = @file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX) !== false;

$entries = read_log($logFile);
$report = build_report($entries);
$htmlOk = @file_put_contents($htmlFile, render_html($report, $GAME_NAME, $GAME_HOME)) !== false;

echo json_encode([
  'ok' => $ok && $htmlOk,
  'game' => $GAME_NAME,
  'event' => $event,
  'gameStarts' => count($entries),
  'countPage' => 'count.html',
]);

// ---------------------------------------------------------------------------

function read_log(string $logFile): array
{
  $entries = [];
  if (!is_readable($logFile)) {
    return $entries;
  }
  $fh = fopen($logFile, 'r');
  if (!$fh) {
    return $entries;
  }
  while (($row = fgets($fh)) !== false) {
    $row = trim($row);
    if ($row === '') {
      continue;
    }
    $parts = preg_split("/\t+/", $row);
    if (count($parts) < 2) {
      continue;
    }
    $ts = strtotime($parts[0]);
    if ($ts === false) {
      continue;
    }
    $entries[] = [
      'ts' => $ts,
      'ip' => $parts[1],
      'event' => $parts[2] ?? 'game_start',
      'day' => gmdate('Y-m-d', $ts),
      'week' => gmdate('o-\WW', $ts),
    ];
  }
  fclose($fh);
  return $entries;
}

function build_report(array $entries): array
{
  $byDay = [];
  $byWeek = [];

  foreach ($entries as $e) {
    $day = $e['day'];
    $week = $e['week'];
    $ip = $e['ip'];

    if (!isset($byDay[$day])) {
      $byDay[$day] = [];
    }
    if (!isset($byDay[$day][$ip])) {
      $byDay[$day][$ip] = 0;
    }
    $byDay[$day][$ip]++;

    if (!isset($byWeek[$week])) {
      $byWeek[$week] = [];
    }
    if (!isset($byWeek[$week][$ip])) {
      $byWeek[$week][$ip] = 0;
    }
    $byWeek[$week][$ip]++;
  }

  krsort($byDay);
  foreach ($byDay as $day => $ips) {
    arsort($byDay[$day]);
  }

  krsort($byWeek);
  $weekTops = [];
  $n = 0;
  foreach ($byWeek as $week => $ips) {
    arsort($ips);
    $weekTops[$week] = array_slice($ips, 0, 5, true);
    if (++$n >= 8) {
      break;
    }
  }

  return [
    'generatedAt' => gmdate('c'),
    'totalGames' => count($entries),
    'uniqueIps' => count(array_unique(array_column($entries, 'ip'))),
    'byDay' => $byDay,
    'weekTops' => $weekTops,
    'currentWeek' => gmdate('o-\WW'),
  ];
}

function h(string $s): string
{
  return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function week_label(string $isoWeek): string
{
  if (!preg_match('/^(\d{4})-W(\d{2})$/', $isoWeek, $m)) {
    return $isoWeek;
  }
  $dto = new DateTime();
  $dto->setISODate((int) $m[1], (int) $m[2]);
  $start = $dto->format('M j');
  $dto->modify('+6 days');
  $end = $dto->format('M j, Y');
  return $isoWeek . ' (' . $start . ' – ' . $end . ' UTC)';
}

function render_html(array $report, string $gameName, string $gameHome): string
{
  $generated = h($report['generatedAt']);
  $total = (int) $report['totalGames'];
  $unique = (int) $report['uniqueIps'];
  $currentWeek = $report['currentWeek'];
  $title = h($gameName . ' play counts');
  $home = h($gameHome);

  $html = '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>' . $title . '</title>
  <style>
    :root { font-family: system-ui, sans-serif; color: #14241c; background: #eef5ef; }
    body { max-width: 44rem; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; line-height: 1.45; }
    h1 { font-size: 1.75rem; margin: 0 0 0.35rem; }
    h2 { font-size: 1.2rem; margin: 1.75rem 0 0.6rem; color: #0f3d2a; }
    h3 { font-size: 1.05rem; margin: 1.1rem 0 0.35rem; }
    .meta { color: #3a5347; font-size: 0.92rem; }
    .nav { display: flex; gap: 1rem; flex-wrap: wrap; margin: 0 0 1rem; }
    .nav a { color: #1f6b4a; font-weight: 700; text-decoration: none; }
    .stats { display: flex; gap: 1rem; flex-wrap: wrap; margin: 1rem 0 0; }
    .stat { background: #fff; border: 1px solid #d5e3d8; border-radius: 0.75rem; padding: 0.75rem 1rem; min-width: 7rem; }
    .stat strong { display: block; font-size: 1.4rem; color: #1f6b4a; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 0.75rem; overflow: hidden; border: 1px solid #d5e3d8; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #e4efe6; font-size: 0.95rem; }
    th { background: #e4efe6; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; }
    tr:last-child td { border-bottom: 0; }
    .rank { width: 2.5rem; color: #3a5347; }
    .count { text-align: right; font-weight: 700; color: #1f6b4a; }
    .day-total { margin: 0.25rem 0 0.75rem; color: #3a5347; font-size: 0.9rem; }
    .badge { display: inline-block; background: #e8b84a; color: #14241c; font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 999px; margin-left: 0.35rem; vertical-align: middle; }
    code { font-size: 0.85em; }
  </style>
</head>
<body>
  <p class="nav meta">
    <a href="/">← All games</a>
    <a href="' . $home . '">Play ' . h($gameName) . '</a>
  </p>
  <h1>' . $title . '</h1>
  <p class="meta">Auto-updated on each new game start · Generated <time datetime="' . $generated . '">' . $generated . '</time></p>
  <div class="stats">
    <div class="stat"><strong>' . $total . '</strong> total games</div>
    <div class="stat"><strong>' . $unique . '</strong> unique IPs</div>
  </div>
';

  $html .= "<h2>Top 5 players by week</h2>\n";
  if (empty($report['weekTops'])) {
    $html .= "<p class=\"meta\">No games logged yet.</p>\n";
  } else {
    foreach ($report['weekTops'] as $week => $tops) {
      $label = h(week_label($week));
      $isCurrent = ($week === $currentWeek);
      $html .= '<h3>' . $label . ($isCurrent ? ' <span class="badge">this week</span>' : '') . "</h3>\n";
      if (empty($tops)) {
        $html .= "<p class=\"meta\">No plays.</p>\n";
        continue;
      }
      $html .= "<table><thead><tr><th class=\"rank\">#</th><th>IP</th><th class=\"count\">Games</th></tr></thead><tbody>\n";
      $rank = 1;
      foreach ($tops as $ipAddr => $games) {
        $html .= '<tr><td class="rank">' . $rank . '</td><td><code>' . h((string) $ipAddr) . '</code></td><td class="count">' . (int) $games . "</td></tr>\n";
        $rank++;
      }
      $html .= "</tbody></table>\n";
    }
  }

  $html .= "<h2>Games per day (by IP)</h2>\n";
  if (empty($report['byDay'])) {
    $html .= "<p class=\"meta\">No games logged yet.</p>\n";
  } else {
    foreach ($report['byDay'] as $day => $ips) {
      $dayTotal = array_sum($ips);
      $html .= '<h3>' . h($day) . "</h3>\n";
      $html .= '<p class="day-total">' . (int) $dayTotal . ' game' . ($dayTotal === 1 ? '' : 's') . " total</p>\n";
      $html .= "<table><thead><tr><th>IP</th><th class=\"count\">Games</th></tr></thead><tbody>\n";
      foreach ($ips as $ipAddr => $games) {
        $html .= '<tr><td><code>' . h((string) $ipAddr) . '</code></td><td class="count">' . (int) $games . "</td></tr>\n";
      }
      $html .= "</tbody></table>\n";
    }
  }

  $html .= '</body></html>';
  return $html;
}
