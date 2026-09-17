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

function biblia_messages(string $language): array
{
    $texts = [
        'de' => [
            'required' => 'Bitte ausfüllen.',
            'email' => 'Bitte eine gültige E-Mail-Adresse angeben.',
            'tooLong' => 'Der Text ist zu lang.',
            'items' => 'Die Auswahl konnte nicht gelesen werden.',
        ],
        'en' => [
            'required' => 'Please fill this in.',
            'email' => 'Please enter a valid email address.',
            'tooLong' => 'This text is too long.',
            'items' => 'The selection could not be read.',
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
 * Liest die ausgewählten Flyer.
 * Es werden ausschliesslich Nummer und Anzahl übernommen — Titel und
 * Adresse werden serverseitig nicht aus der Einsendung übernommen.
 *
 * @return array<int, array{id: int, quantity: int}>
 */
function biblia_parse_items(mixed $raw): array
{
    if (!is_string($raw) || $raw === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return [];
    }

    $items = [];
    foreach (array_slice($decoded, 0, BIBLIA_MAX_ITEMS) as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $id = filter_var($entry['id'] ?? null, FILTER_VALIDATE_INT);
        $quantity = filter_var($entry['quantity'] ?? 1, FILTER_VALIDATE_INT);
        if ($id === false || $id <= 0) {
            continue;
        }
        $items[] = [
            'id' => $id,
            'quantity' => ($quantity === false || $quantity < 1) ? 1 : min($quantity, 999),
        ];
    }
    return $items;
}
