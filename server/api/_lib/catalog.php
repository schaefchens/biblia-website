<?php
/**
 * Der bestellbare Bestand.
 *
 * Die Datei catalog.generated.php entsteht beim Build aus content/flyers/
 * und ist die einzige gültige Liste. Was der Browser mitschickt, ist eine
 * Behauptung: eine erfundene Nummer, ein Entwurf, ein archivierter Flyer
 * oder eine Menge von 999. Geprüft wird ausschliesslich gegen diese Liste.
 */

declare(strict_types=1);

function biblia_catalog(): array
{
    static $catalog = null;
    if ($catalog !== null) {
        return $catalog;
    }

    $file = __DIR__ . '/../catalog.generated.php';
    if (!is_file($file)) {
        $catalog = [];
        return $catalog;
    }

    /** @var mixed $loaded */
    $loaded = require $file;
    $catalog = is_array($loaded) ? $loaded : [];
    return $catalog;
}
