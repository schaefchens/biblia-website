<?php
/**
 * Prüfung der Formulareingaben.
 *
 * Die Meldungen sind in der Sprache der Seite, damit sie direkt am Feld
 * angezeigt werden können.
 */

declare(strict_types=1);

const BIBLIA_MAX_FIELD = 500;
const BIBLIA_MAX_MESSAGE = 5000;
const BIBLIA_MAX_ITEMS = 50;

/** Obergrenze über allem — auch wenn ein Flyer eine höhere Menge erlaubte. */
const BIBLIA_MAX_QUANTITY = 1000;

function biblia_messages(string $language): array
{
    $texts = [
        'de' => [
            'required' => 'Bitte ausfüllen.',
            'email' => 'Bitte eine gültige E-Mail-Adresse angeben.',
            'tooLong' => 'Der Text ist zu lang.',
            'items' => 'Die Auswahl konnte nicht gelesen werden.',
            'itemsUnavailable' => 'Ein Teil der Auswahl ist nicht mehr bestellbar. Bitte die Auswahl noch einmal öffnen.',
        ],
        'en' => [
            'required' => 'Please fill this in.',
            'email' => 'Please enter a valid email address.',
            'tooLong' => 'This text is too long.',
            'items' => 'The selection could not be read.',
            'itemsUnavailable' => 'Part of the selection is no longer available. Please open your selection again.',
        ],
    ];
    return $texts[$language] ?? $texts['en'];
}

/** Bereinigt einen Text: Steuerzeichen entfernen, Länge begrenzen. */
function biblia_clean(mixed $value, int $maxLength = BIBLIA_MAX_FIELD): string
{
    $text = is_string($value) ? $value : '';
    $text = str_replace(["\r\n", "\r"], "\n", $text);
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $text) ?? '';
    $text = trim($text);
    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $maxLength);
    }
    return substr($text, 0, $maxLength);
}

/**
 * Prüft die angegebenen Felder.
 *
 * @param array<string, array{required?: bool, email?: bool, max?: int}> $rules
 * @return array{values: array<string,string>, errors: array<string,string>}
 */
function biblia_validate(array $input, array $rules, string $language): array
{
    $messages = biblia_messages($language);
    $values = [];
    $errors = [];

    foreach ($rules as $name => $rule) {
        $max = $rule['max'] ?? BIBLIA_MAX_FIELD;
        $value = biblia_clean($input[$name] ?? '', $max);

        if (($rule['required'] ?? false) && $value === '') {
            $errors[$name] = $messages['required'];
            continue;
        }
        if ($value !== '' && ($rule['email'] ?? false) && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
            $errors[$name] = $messages['email'];
            continue;
        }
        $values[$name] = $value;
    }

    return ['values' => $values, 'errors' => $errors];
}

/**
 * Liest die ausgewählten Flyer und prüft sie gegen den Bestand.
 *
 * Aus der Einsendung werden ausschliesslich Nummer und Anzahl übernommen.
 * Titel, Preis und erlaubte Menge kommen aus catalog.generated.php — eine
 * Nummer, die dort nicht steht, wird verworfen und gemeldet. Ohne diese
 * Prüfung nähme der Endpunkt jede erfundene Nummer und jede Menge an.
 *
 * @param array<string, array> $catalog  Bestand aus biblia_catalog()
 * @return array{items: array<int, array{id:int, quantity:int, title:string}>, rejected: int}
 */
function biblia_parse_items(mixed $raw, array $catalog, string $language = 'de'): array
{
    $result = ['items' => [], 'rejected' => 0];

    if (!is_string($raw) || $raw === '') {
        return $result;
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        $result['rejected'] = 1;
        return $result;
    }

    // Erst zusammenfassen: dieselbe Nummer darf mehrfach vorkommen, soll
    // aber nur eine Zeile in der Bestellung ergeben.
    $quantities = [];
    $order = [];
    foreach ($decoded as $entry) {
        if (!is_array($entry)) {
            $result['rejected']++;
            continue;
        }
        $id = filter_var($entry['id'] ?? null, FILTER_VALIDATE_INT);
        if ($id === false || $id <= 0 || !isset($catalog[(string) $id]) || !is_array($catalog[(string) $id])) {
            $result['rejected']++;
            continue;
        }
        $key = (string) $id;
        if (!isset($quantities[$key])) {
            if (count($quantities) >= BIBLIA_MAX_ITEMS) {
                $result['rejected']++;
                continue;
            }
            $quantities[$key] = 0;
            $order[] = $key;
        }
        $quantity = filter_var($entry['quantity'] ?? 1, FILTER_VALIDATE_INT);
        if ($quantity === false || $quantity < 1) {
            $quantity = 1;
        }
        // Jeden einzelnen Wert vor dem Aufsummieren begrenzen, damit die
        // Summe nicht über den Zahlenbereich hinauslaufen kann.
        $quantities[$key] += min($quantity, BIBLIA_MAX_QUANTITY);
    }

    foreach ($order as $key) {
        $entry = $catalog[$key];
        $min = max(1, (int) ($entry['min'] ?? 1));
        $max = min(BIBLIA_MAX_QUANTITY, max($min, (int) ($entry['max'] ?? $min)));
        $titles = is_array($entry['titles'] ?? null) ? $entry['titles'] : [];

        $result['items'][] = [
            'id' => (int) $key,
            'quantity' => min(max($quantities[$key], $min), $max),
            'title' => (string) ($titles[$language] ?? $entry['title'] ?? ''),
        ];
    }

    return $result;
}
