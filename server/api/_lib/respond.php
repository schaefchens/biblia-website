<?php
/**
 * Antworten — als JSON für den JavaScript-Weg, als Seite für den Fall
 * ohne JavaScript.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

/** Erwartet der Aufrufer JSON? */
function biblia_wants_json(): bool
{
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    if (str_contains($accept, 'application/json')) {
        return true;
    }
    return isset($_SERVER['HTTP_X_BIBLIA_REQUEST']);
}

function biblia_json(int $status, array $payload): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Einfache Seite für den Weg ohne JavaScript. */
function biblia_page(int $status, string $language, string $title, string $message, ?string $backUrl = null): never
{
    $config = biblia_config();
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');

    $escape = static fn (string $value): string => htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    $css = (string) ($config['cssUrl'] ?? '');
    $home = (string) ($config['basePath'] ?? '/');
    $back = $backUrl ?? $home;
    $siteName = (string) ($config['siteName'] ?? 'Biblia');
    $backLabel = $language === 'de' ? 'Zurück zur Website' : 'Back to the website';

    echo '<!doctype html>' . "\n";
    echo '<html lang="' . $escape($language) . '"><head><meta charset="utf-8">';
    echo '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">';
    echo '<meta name="robots" content="noindex">';
    echo '<title>' . $escape($title) . ' — ' . $escape($siteName) . '</title>';
    if ($css !== '') {
        echo '<link rel="stylesheet" href="' . $escape($css) . '">';
    }
    echo '</head><body><main id="inhalt"><div class="page page--text">';
    echo '<header class="list-header"><h1>' . $escape($title) . '</h1>';
    echo '<p class="hero__intro">' . $escape($message) . '</p></header>';
    echo '<p class="button-row"><a class="button" href="' . $escape($back) . '">' . $escape($backLabel) . '</a></p>';
    echo '</div></main></body></html>';
    exit;
}
