<?php
/**
 * Schutz der Formulare.
 *
 * Wichtig für das Verständnis: hier gibt es keine Anmeldung und keine
 * Sitzung, die jemand übernehmen könnte. Die tatsächliche Bedrohung ist
 * daher Spam, nicht der Missbrauch fremder Rechte.
 *
 * Ein bloss signierter Wert ("Token") würde dagegen nichts ausrichten —
 * wer ein fremdes Formular baut, holt sich den Wert einfach selbst ab.
 * Wirksam und ohne Cookies möglich sind:
 *
 *   1. die Herkunft der Anfrage streng prüfen (Sec-Fetch-Site / Origin)
 *   2. ein zusätzlicher Kopfzeilen-Eintrag auf dem JavaScript-Weg
 *   3. ein unsichtbares Feld, das nur Programme ausfüllen
 *   4. eine Mindestzeit zwischen Öffnen und Absenden
 *   5. eine Begrenzung der Anfragen je Adresse
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Die IP-Adresse des Aufrufers.
 *
 * Ausschliesslich REMOTE_ADDR. X-Forwarded-For wird vom Aufrufer gesetzt
 * und liesse sich beliebig fälschen — die Begrenzung wäre wirkungslos und
 * es würde eine erfundene personenbezogene Angabe gespeichert.
 */
function biblia_client_ip(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? '');
}

/**
 * Gesalzener Hash der IP-Adresse.
 *
 * Für die Begrenzung reicht ein Wiedererkennungswert; die Adresse selbst
 * wird nicht gespeichert. Das Salz wechselt täglich, damit sich auch aus
 * den Hashes nach kurzer Zeit nichts mehr zusammenführen lässt.
 */
function biblia_ip_key(): string
{
    $salt = biblia_secret() . gmdate('Y-m-d');
    return substr(hash_hmac('sha256', biblia_client_ip(), $salt), 0, 32);
}

/** Kommt die Anfrage von dieser Website? */
function biblia_check_origin(): bool
{
    $config = biblia_config();
    $expected = rtrim((string) ($config['origin'] ?? ''), '/');

    // Moderne Browser sagen von sich aus, woher die Anfrage stammt.
    $site = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? null;
    if ($site !== null) {
        return in_array($site, ['same-origin', 'same-site', 'none'], true);
    }

    // Ältere Browser: Origin, sonst Referer auswerten.
    $origin = $_SERVER['HTTP_ORIGIN'] ?? null;
    if ($origin !== null && $origin !== '') {
        return rtrim($origin, '/') === $expected;
    }

    $referer = $_SERVER['HTTP_REFERER'] ?? null;
    if ($referer !== null && $referer !== '') {
        return str_starts_with($referer, $expected . '/');
    }

    // Ein normal abgeschicktes Formular sendet immer einen Referer.
    // Fehlt beides, ist die Anfrage nicht zuzuordnen.
    return false;
}

/** War das unsichtbare Feld ausgefüllt? */
function biblia_is_bot(array $input): bool
{
    return trim((string) ($input['website'] ?? '')) !== '';
}

/**
 * Wurde das Formular unrealistisch schnell abgeschickt?
 * Der Wert kommt vom Aufrufer und ist damit nur ein Anhaltspunkt —
 * als alleiniger Schutz wäre er wertlos, als Ergänzung ist er nützlich.
 */
function biblia_too_fast(array $input, int $minimumSeconds = 3): bool
{
    if (!isset($input['elapsed'])) {
        return false;
    }
    $elapsed = filter_var($input['elapsed'], FILTER_VALIDATE_INT);
    return $elapsed !== false && $elapsed < $minimumSeconds;
}
