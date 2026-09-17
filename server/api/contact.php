<?php
/**
 * Kontaktanfrage entgegennehmen.
 * Gleiches Vorgehen wie bei der Bestellung: prüfen, speichern, dann senden.
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
$language = biblia_clean($_POST['language'] ?? '', 5);
if (!in_array($language, $config['languages'] ?? ['de'], true)) {
    $language = (string) ($config['defaultLanguage'] ?? 'de');
}

$texts = [
    'de' => [
        'successTitle' => 'Danke!',
        'success' => 'Deine Nachricht ist angekommen. Wir melden uns per E-Mail.',
        'errorTitle' => 'Das hat nicht geklappt',
        'error' => 'Die Nachricht konnte nicht gesendet werden. Bitte versuche es später noch einmal.',
        'rateLimit' => 'Es wurden zu viele Anfragen gesendet. Bitte versuche es in einigen Minuten erneut.',
        'validation' => 'Bitte prüfe die markierten Felder.',
        'method' => 'Diese Adresse nimmt nur abgeschickte Formulare entgegen.',
    ],
    'en' => [
        'successTitle' => 'Thank you!',
        'success' => 'Your message has arrived. We will reply by email.',
        'errorTitle' => 'That did not work',
        'error' => 'The message could not be sent. Please try again later.',
        'rateLimit' => 'Too many requests were sent. Please try again in a few minutes.',
        'validation' => 'Please check the highlighted fields.',
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

if (biblia_is_bot($_POST) || biblia_too_fast($_POST)) {
    biblia_wants_json()
        ? biblia_json(200, ['ok' => true])
        : biblia_page(200, $language, $text['successTitle'], $text['success']);
}

if (!biblia_rate_limit('contact', 5, 3600)) {
    biblia_wants_json()
        ? biblia_json(429, ['ok' => false, 'error' => 'rate_limit'])
        : biblia_page(429, $language, $text['errorTitle'], $text['rateLimit']);
}

$result = biblia_validate(
    $_POST,
    [
        'name' => ['required' => true],
        'email' => ['required' => true, 'email' => true],
        'subject' => [],
        'message' => ['required' => true, 'max' => BIBLIA_MAX_MESSAGE],
    ],
    $language,
);

if ($result['errors'] !== []) {
    biblia_wants_json()
        ? biblia_json(422, ['ok' => false, 'errors' => $result['errors']])
        : biblia_page(422, $language, $text['errorTitle'], $text['validation']);
}

$stored = biblia_store('contact', [
    'type' => 'contact',
    'created_at' => gmdate('c'),
    'status' => 'new',
    'language' => $language,
    'test' => biblia_is_staging(),
    'contact' => $result['values'],
    'email_status' => 'pending',
]);

if ($stored === null) {
    biblia_wants_json()
        ? biblia_json(500, ['ok' => false, 'error' => 'storage'])
        : biblia_page(500, $language, $text['errorTitle'], $text['error']);
}

$body = implode("\n", [
    'Neue Kontaktanfrage' . (biblia_is_staging() ? ' (TESTBETRIEB)' : ''),
    'Nummer: ' . $stored['id'],
    'Sprache: ' . $language,
    '',
    'Name: ' . ($result['values']['name'] ?? ''),
    'E-Mail: ' . ($result['values']['email'] ?? ''),
    'Betreff: ' . ($result['values']['subject'] ?? ''),
    '',
    $result['values']['message'] ?? '',
]);

$sent = biblia_send_mail(
    (string) ($config['contactEmail'] ?? ''),
    'Kontaktanfrage ' . $stored['id'] . (biblia_is_staging() ? ' (Test)' : ''),
    $body,
    $result['values']['email'] ?? null,
);
biblia_store_update($stored['file'], ['email_status' => $sent ? 'sent' : 'failed']);

biblia_rate_limit_cleanup();

biblia_wants_json()
    ? biblia_json(200, ['ok' => true, 'id' => $stored['id']])
    : biblia_page(200, $language, $text['successTitle'], $text['success']);
