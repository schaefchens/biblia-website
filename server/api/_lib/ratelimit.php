<?php
/**
 * Einfache Begrenzung der Anfragen je Adresse.
 *
 * Dateibasiert mit flock, weil auf dem Webhosting weder eine Datenbank
 * noch ein Zwischenspeicher zur Verfügung steht.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/guard.php';

/**
 * @return bool true, wenn die Anfrage erlaubt ist
 */
function biblia_rate_limit(string $bucket, int $maxRequests = 5, int $windowSeconds = 3600): bool
{
    $dir = biblia_data_dir('.state/ratelimit');
    $file = $dir . '/' . $bucket . '-' . biblia_ip_key() . '.json';

    $handle = @fopen($file, 'c+');
    if ($handle === false) {
        // Lässt sich nicht schreiben: lieber durchlassen als die Bestellung
        // verlieren. Die übrigen Schutzmassnahmen greifen weiterhin.
        return true;
    }

    try {
        if (!flock($handle, LOCK_EX)) {
            return true;
        }

        $now = time();
        $contents = stream_get_contents($handle);
        $timestamps = [];
        if (is_string($contents) && $contents !== '') {
            $decoded = json_decode($contents, true);
            if (is_array($decoded)) {
                $timestamps = array_values(array_filter(
                    $decoded,
                    static fn ($time) => is_int($time) && $time > $now - $windowSeconds,
                ));
            }
        }

        if (count($timestamps) >= $maxRequests) {
            return false;
        }

        $timestamps[] = $now;
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($timestamps));
        fflush($handle);
        @chmod($file, 0600);
        return true;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

/** Entfernt abgelaufene Zähler. */
function biblia_rate_limit_cleanup(int $olderThanSeconds = 86400): void
{
    $dir = biblia_data_dir('.state/ratelimit');
    $entries = @scandir($dir);
    if ($entries === false) {
        return;
    }
    $limit = time() - $olderThanSeconds;
    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }
        $file = $dir . '/' . $entry;
        if (is_file($file) && @filemtime($file) < $limit) {
            @unlink($file);
        }
    }
}
