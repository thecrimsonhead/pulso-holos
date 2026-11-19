<?php
/* HOLOS · control remoto de la presentación (notas en el celular)
   Lee la clave y la carpeta de datos de api.php, así no hay que duplicar la clave.
   GET  ?a=get&deck=s5             -> posición actual {i, t0, n} y último comando
   POST a=pos  deck,i,t0,n         -> la laptop avisa en qué diapositiva va
   POST a=cmd  deck,c(next|prev|go),i -> el celular manda un comando
   Todo con header X-Key. */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function out($a, $code = 200) { http_response_code($code); echo json_encode($a); exit; }

$src = @file_get_contents(__DIR__ . '/api.php');
if (!$src || !preg_match("/const\s+ADMIN_KEY\s*=\s*'([^']*)'/", $src, $mk) || !preg_match("/const\s+DATA_DIR\s*=\s*'([^']*)'/", $src, $md)) out(['ok' => false, 'error' => 'No encuentro la configuración'], 500);
$KEY = $mk[1]; $DIR = $md[1] . '/live';
$k = $_SERVER['HTTP_X_KEY'] ?? '';
if ($KEY === 'CAMBIA-ESTA-CLAVE' || !is_string($k) || !hash_equals($KEY, $k)) out(['ok' => false, 'error' => 'Clave incorrecta'], 401);
if (!is_dir($DIR) && !@mkdir($DIR, 0750, true)) out(['ok' => false, 'error' => 'Sin carpeta de datos'], 500);

$a = $_POST['a'] ?? $_GET['a'] ?? 'get';
$deck = $_POST['deck'] ?? $_GET['deck'] ?? '';
if (!preg_match('/^[a-z0-9_-]{1,20}$/', $deck)) out(['ok' => false, 'error' => 'Sesión no válida'], 400);
$fp = "$DIR/remote_pos_$deck.json"; $fc = "$DIR/remote_cmd_$deck.json";
$read = function($f){ return is_file($f) ? (json_decode(file_get_contents($f), true) ?: null) : null; };

if ($a === 'pos') {
    $p = ['i' => max(0, (int)($_POST['i'] ?? 0)), 'n' => (int)($_POST['n'] ?? 0), 't0' => (float)($_POST['t0'] ?? 0), 'v' => microtime(true)];
    file_put_contents($fp, json_encode($p), LOCK_EX);
    out(['ok' => true]);
}
if ($a === 'cmd') {
    $c = $_POST['c'] ?? '';
    if (!in_array($c, ['next', 'prev', 'go'], true)) out(['ok' => false, 'error' => 'Comando no válido'], 400);
    $cmd = ['c' => $c, 'i' => (int)($_POST['i'] ?? 0), 'id' => bin2hex(random_bytes(6)), 't' => microtime(true)];
    file_put_contents($fc, json_encode($cmd), LOCK_EX);
    out(['ok' => true, 'cmd' => $cmd]);
}
out(['ok' => true, 'pos' => $read($fp), 'cmd' => $read($fc), 'now' => microtime(true)]);
