# Remaining admin chrome after issue LMBraca/opentennis#11

## Goal

Under the Spanish (`es-MX`) admin locale, localize the blog editor alignment
tooltips and the entrants table Actions header and row-remove accessible name.
English (`en-GB`) retains the English values.

Dictionary values are plain strings. Use the existing `fill()` helper for
`{name}`.

## Required copy

| Key                  | es-MX           | en            |
| -------------------- | --------------- | ------------- |
| `editorAlignLeft`    | Izquierda       | Left          |
| `editorAlignCenter`  | Centro          | Center        |
| `editorAlignRight`   | Derecha         | Right         |
| `columnActions`      | Acciones        | Actions       |
| `removeNamedEntrant` | Quitar a {name} | Remove {name} |

The alignment glyphs may remain typographic. The Actions heading includes its
screen-reader-only text; the row-remove accessible name uses the entrant's
name.

## Scope guard

- Preserve the photographed issue LMBraca/opentennis#11 and D1–D5 copy.
- Do not restore bulk draw-replacement or per-category generation controls in
  `admin-grid.tsx`.
- Do not change Copa Otoño or Invierno data or run actions against those events.
- Keep intentional English terms as listed in the issue specification.
- Do not add speculative features or localize chrome outside this request.
