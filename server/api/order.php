<?php
/**
 * Bestellanfrage entgegennehmen.
 *
 * Ablauf, bewusst in dieser Reihenfolge:
 *   1. Herkunft und Spamschutz prüfen
 *   2. Eingaben prüfen
 *   3. speichern
 *   4. erst danach die E-Mail versenden
 *
 * Schlägt der Versand fehl, ist die Bestellung trotzdem gespeichert und
 * wird im Datensatz entsprechend vermerkt. Eine Bestellung darf niemals
 * daran verloren gehen, dass ein Mailserver nicht erreichbar war.
 */

declare(strict_types=1);

require_once __DIR__ . '/_lib/config.php';
require_once __DIR__ . '/_lib/guard.php';
require_once __DIR__ . '/_lib/ratelimit.php';
require_once __DIR__ . '/_lib/validate.php';
require_once __DIR__ . '/_lib/store.php';
require_once __DIR__ . '/_lib/mailer.php';
require_once __DIR__ . '/_lib/respond.php';

$config = biblia_config();
$language = biblia_clean($_POST['language'] ?? $_GET['language'] ?? '', 5);
if (!in_array($language, $config['languages'] ?? ['de'], true)) {
    $language = (string) ($config['defaultLanguage'] ?? 'de');
}

$texts = [
    'de' => [
        'successTitle' => 'Danke!',
        'success' => 'Deine Bestellanfrage ist angekommen. Wir melden uns per E-Mail.',
        'errorTitle' => 'Das hat nicht geklappt',
        'error' => 'Die Anfrage konnte nicht gesendet werden. Bitte versuche es später noch einmal.',
        'rateLimit' => 'Es wurden zu viele Anfragen gesendet. Bitte versuche es in einigen Minuten erneut.',
        'validation' => 'Bitte prüfe die markierten Felder.',
        'empty' => 'Es wurden keine Flyer ausgewählt.',
        'method' => 'Diese Adresse nimmt nur abgeschickte Formulare entgegen.',
    ],
    'en' => [
        'successTitle' => 'Thank you!',
        'success' => 'Your order request has arrived. We will reply by email.',
        'errorTitle' => 'That did not work',
        'error' => 'The request could not be sent. Please try again later.',
        'rateLimit' => 'Too many requests were sent. Please try again in a few minutes.',
        'validation' => 'Please check the highlighted fields.',
        'empty' => 'No leaflets were selected.',
        'method' => 'This address only accepts submitted forms.',
    ],
];
$text = $texts[$language] ?? $texts['de'];

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    biblia_wants_json()
        ? biblia_json(405, ['ok' => false, 'error' => 'method'])
        : biblia_page(405, $language, $text['errorTitle'], $text['method']);
}

if (!biblia_check_origin()) {
    biblia_wants_json()
        ? biblia_json(403, ['ok' => false, 'error' => 'origin'])
        : biblia_page(403, $language, $text['errorTitle'], $text['error']);
}

// Als Programm erkannt: freundlich bestätigen, aber nichts speichern.
// Eine offene Fehlermeldung würde nur verraten, worauf geprüft wird.
if (biblia_is_bot($_POST) || biblia_too_fast($_POST)) {
    biblia_wants_json()
        ? biblia_json(200, ['ok' => true])
        : biblia_page(200, $language, $text['successTitle'], $text['success']);
}

if (!biblia_rate_limit('order', 5, 3600)) {
    biblia_wants_json()
        ? biblia_json(429, ['ok' => false, 'error' => 'rate_limit'])
        : biblia_page(429, $language, $text['errorTitle'], $text['rateLimit']);
}

$result = biblia_validate(
    $_POST,
    [
        'name' => ['required' => true],
        'email' => ['required' => true, 'email' => true],
        'street' => ['required' => true],
        'postal_code' => ['required' => true, 'max' => 20],
        'city' => ['required' => true],
        'country' => ['required' => true, 'max' => 80],
        'message' => ['max' => BIBLIA_MAX_MESSAGE],
    ],
    $language,
);

$items = biblia_parse_items($_POST['items'] ?? '');
if ($items === []) {
    $result['errors']['items'] = biblia_messages($language)['items'];
}

if ($result['errors'] !== []) {
    biblia_wants_json()
        ? biblia_json(422, ['ok' => false, 'errors' => $result['errors']])
        : biblia_page(422, $language, $text['errorTitle'], $text['validation']);
}

$record = [
    'type' => 'order',
    'created_at' => gmdate('c'),
    'status' => 'new',
    'language' => $language,
    // Auf einer Testadresse darf nichts als echte Bestellung gelten.
    'test' => biblia_is_staging(),
    'items' => $items,
    'contact' => $result['values'],
    'email_status' => 'pending',
];

$stored = biblia_store('orders', $record);
if ($stored === null) {
    biblia_wants_json()
        ? biblia_json(500, ['ok' => false, 'error' => 'storage'])
        : biblia_page(500, $language, $text['errorTitle'], $text['error']);
}

// Ab hier ist die Bestellung sicher abgelegt. Alles Weitere darf
// fehlschlagen, ohne dass sie verloren geht.
$lines = [];
$lines[] = 'Neue Bestellanfrage' . (biblia_is_staging() ? ' (TESTBETRIEB)' : '');
$lines[] = 'Nummer: ' . $stored['id'];
$lines[] = 'Sprache: ' . $language;
$lines[] = '';
$lines[] = 'Flyer:';
foreach ($items as $item) {
    $lines[] = sprintf('  %dx Flyer Nr. %d', $item['quantity'], $item['id']);
}
$lines[] = '';
$lines[] = 'Anschrift:';
foreach (['name', 'email', 'street', 'postal_code', 'city', 'country'] as $field) {
    if (($result['values'][$field] ?? '') !== '') {
        $lines[] = '  ' . $field . ': ' . $result['values'][$field];
    }
}
if (($result['values']['message'] ?? '') !== '') {
    $lines[] = '';
    $lines[] = 'Nachricht:';
    $lines[] = $result['values']['message'];
}

$sent = biblia_send_mail(
    (string) ($config['orderEmail'] ?? ''),
    'Bestellanfrage ' . $stored['id'] . (biblia_is_staging() ? ' (Test)' : ''),
    implode("\n", $lines),
    $result['values']['email'] ?? null,
);
biblia_store_update($stored['file'], ['email_status' => $sent ? 'sent' : 'failed']);

biblia_rate_limit_cleanup();

biblia_wants_json()
    ? biblia_json(200, ['ok' => true, 'id' => $stored['id']])
    : biblia_page(200, $language, $text['successTitle'], $text['success']);
