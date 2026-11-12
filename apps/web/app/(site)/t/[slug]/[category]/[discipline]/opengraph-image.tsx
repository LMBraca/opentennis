/**
 * OUT-4 — the shareable image.
 *
 * Next's `opengraph-image` file convention, so this IS the card WhatsApp
 * and Instagram render when somebody pastes a draw link — which is how the
 * club actually shares anything. A "download a share card" button would
 * produce a file nobody sends; this needs no action from the organizer at
 * all.
 *
 * Rendered with ImageResponse (Satori) rather than the SVG the draw sheet
 * uses, because a social card has to be a raster PNG at a fixed size.
 * Satori supports a subset of CSS — flexbox only, no grid, every element
 * needs an explicit display — so the layout here is deliberately plainer
 * than the rest of the product.
 */

import { ImageResponse } from 'next/og';
import { loadDraw } from '@/lib/queries';
import { drawLabel, parseDrawSegment } from '@/lib/divisions';
import { dictionary } from '@/lib/i18n/dictionaries';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Draw';

const CLAY = '#526430';
const PAPER = '#f6f6f1';
const INK = '#16180f';
const MUTED = '#64684f';

export default async function Image({
  params,
}: {
  readonly params: { slug: string; category: string; discipline: string };
}) {
  const parsed = parseDrawSegment(params.discipline);
  const dict = dictionary('es');

  const draw =
    parsed === null
      ? null
      : await loadDraw(params.slug, params.category, parsed.discipline, parsed.division);

  const title =
    draw === null || parsed === null
      ? 'Open Tennis'
      : drawLabel(draw.category.code, parsed.division, parsed.discipline, dict);

  const matches = draw?.rounds.flatMap((r) => r.matches) ?? [];
  const decided = matches.filter((m) => m.winnerEntrantId !== null).length;

  // The final's winner, when there is one: the single most shareable fact
  // about a finished draw.
  const finalRound = draw?.rounds.filter((r) => r.kind !== 'thirdPlace').at(-1);
  const finalMatch = finalRound?.matches[0];
  const champion =
    finalMatch?.winnerEntrantId == null
      ? null
      : (finalMatch.sides.find((s) => s.entrantId === finalMatch.winnerEntrantId)?.name ?? null);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: PAPER,
          padding: '64px 72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 30, color: MUTED }}>
            {draw?.tournament.name ?? 'Open Tennis'}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 86,
              fontWeight: 700,
              color: INK,
              marginTop: 12,
              lineHeight: 1.05,
            }}
          >
            {title}
          </div>
        </div>

        {champion !== null ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 28, color: MUTED }}>Campeón</div>
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, color: CLAY }}>
              {champion}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', fontSize: 34, color: MUTED }}>
            {decided} de {matches.length} partidos jugados
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* The ball mark, drawn rather than fetched: ImageResponse cannot
              read a local file without an absolute URL, and a card that
              depends on a network round trip fails silently. */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                width: 44,
                height: 44,
                borderRadius: 22,
                background: CLAY,
                marginRight: 16,
              }}
            />
            <div style={{ display: 'flex', fontSize: 28, color: INK, fontWeight: 600 }}>
              Open Tennis
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: MUTED }}>opentennis.mx</div>
        </div>
      </div>
    ),
    size,
  );
}
