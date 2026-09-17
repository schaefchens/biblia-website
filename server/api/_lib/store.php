<?php
/**
 * Speichern der Anfragen.
 *
 * Eine Datei je Anfrage, mit eingeschränkten Rechten. Gespeichert wird
 * zuerst — der E-Mail-Versand kommt danach und darf nie dazu führen, dass
 * eine Bestellung verloren geht.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Legt einen Datensatz ab.
 *
 * @return array{id: string, file: string}|null
 */
function biblia_store(string $kind, array $record): ?array
{
    $dir = biblia_data_dir($kind);
    $id = gmdate('Ymd-His') . '-' . bin2hex(random_bytes(5));
    $file = $dir . '/' . $id . '.json';

    $record = ['id' => $id] + $record;
    $json = json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return null;
    }

    // Erst in eine Nebendatei schreiben, dann umbenennen: ein Abbruch
    // hinterlässt so keine halbe Datei.
    $temporary = $file . '.tmp' . bin2hex(random_bytes(4));
    if (@file_put_contents($temporary, $json, LOCK_EX) === false) {
        return null;
    }
    @chmod($temporary, 0600);
    if (!@rename($temporary, $file)) {
        @unlink($temporary);
        return null;
    }

    return ['id' => $id, 'file' => $file];
}

/** Ergänzt einen abgelegten Datensatz, z. B. um den Zustand des Versands. */
function biblia_store_update(string $file, array $changes): void
{
    if (!is_file($file)) {
        return;
    }
    $contents = @file_get_contents($file);
    if ($contents === false) {
        return;
    }
    $record = json_decode($contents, true);
    if (!is_array($record)) {
        return;
    }
    $record = array_merge($record, $changes);
    $json = json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json !== false) {
        @file_put_contents($file, $json, LOCK_EX);
    }
}
