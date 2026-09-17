<?php
/**
 * Benachrichtigung per E-Mail.
 *
 * Als Absender dient immer eine Adresse der eigenen Domain. Würde die
 * Adresse der anfragenden Person als Absender eingetragen, scheiterte die
 * SPF-Prüfung und die Nachricht ginge häufig stillschweigend verloren.
 * Die Adresse der Person steht deshalb in "Reply-To".
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

/** Entfernt Zeilenumbrüche aus Kopfzeilen. */
function biblia_header_safe(string $value): string
{
    return trim(str_replace(["\r", "\n", "\0"], ' ', $value));
}

/** Kodiert einen Betreff mit Umlauten korrekt. */
function biblia_encode_subject(string $subject): string
{
    $subject = biblia_header_safe($subject);
    if (preg_match('/^[\x20-\x7E]*$/', $subject) === 1) {
        return $subject;
    }
    return '=?UTF-8?B?' . base64_encode($subject) . '?=';
}

/**
 * Versendet eine Nachricht.
 *
 * @return bool true, wenn die Übergabe an den Server geklappt hat
 */
function biblia_send_mail(string $to, string $subject, string $body, ?string $replyTo = null): bool
{
    $config = biblia_config();
    $from = biblia_header_safe((string) ($config['senderEmail'] ?? ''));
    if ($from === '' || $to === '') {
        return false;
    }

    $siteName = biblia_header_safe((string) ($config['siteName'] ?? 'Biblia'));

    $headers = [
        'From: ' . biblia_encode_subject($siteName) . ' <' . $from . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'X-Mailer: Biblia',
    ];
    if ($replyTo !== null && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
        $headers[] = 'Reply-To: ' . biblia_header_safe($replyTo);
    }

    // Der fünfte Parameter setzt den Envelope-Absender. Ohne ihn verwenden
    // viele Server die Standardadresse des Webhostings, was die
    // Zustellbarkeit verschlechtert.
    return @mail(
        biblia_header_safe($to),
        biblia_encode_subject($subject),
        $body,
        implode("\r\n", $headers),
        '-f' . $from,
    );
}
