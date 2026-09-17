<?php
/**
 * Konfiguration der API.
 *
 * Die Werte kommen aus config/site.json und werden beim Build nach
 * api/config.generated.php geschrieben. Diese Datei hier liest sie nur ein.
 */

declare(strict_types=1);

function biblia_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $file = __DIR__ . '/../config.generated.php';
    if (!is_file($file)) {
        http_response_code(500);
        exit('Konfiguration fehlt.');
    }

    /** @var array $loaded */
    $loaded = require $file;
    $config = $loaded;
    return $config;
}

/**
 * Verzeichnis für Laufzeitdaten.
 *
 * Bevorzugt ausserhalb des Webverzeichnisses. Ist das beim Hosting nicht
 * möglich, wird ein Unterverzeichnis verwendet, das durch eine eigene
 * .htaccess gesperrt ist. Nach jedem Hochladen wird über HTTP geprüft,
 * dass dieses Verzeichnis tatsächlich nicht erreichbar ist.
 */
function biblia_data_dir(string $kind): string
{
    $config = biblia_config();
    $base = $config['dataDir'] ?? (__DIR__ . '/../../app-data');

    $dir = $base . '/' . $kind;
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    return $dir;
}

/**
 * Geheimnis für Signaturen.
 *
 * Wird beim ersten Aufruf auf dem Server erzeugt. Dadurch gelangt es weder
 * ins Git-Repository noch über das Deployment auf den Server.
 */
function biblia_secret(): string
{
    $file = biblia_data_dir('.state') . '/secret.bin';
    if (is_file($file)) {
        $secret = file_get_contents($file);
        if ($secret !== false && strlen($secret) >= 32) {
            return $secret;
        }
    }

    $secret = random_bytes(32);
    $temporary = $file . '.tmp' . bin2hex(random_bytes(4));
    file_put_contents($temporary, $secret);
    chmod($temporary, 0600);
    rename($temporary, $file);
    return $secret;
}

/** Läuft die Website noch auf einer Testadresse? */
function biblia_is_staging(): bool
{
    return (bool) (biblia_config()['isStaging'] ?? true);
}
