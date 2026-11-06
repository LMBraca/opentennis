/**
 * SCR-7 — the live score stream.
 *
 * Server-sent events rather than a websocket: the traffic is one-way and
 * tiny, EventSource reconnects by itself, and it survives the proxies a club
 * wifi network puts in the way. The payload is only a version string — the
 * client calls `router.refresh()` and Next re-renders the page it is already
 * on, so the bracket has exactly ONE renderer rather than a server one and a
 * second client-side one that has to agree with it.
 *
 * Node runtime, not Edge: Edge is deprecated on Vercel, and streaming works
 * on the default runtime with no configuration.
 *
 * Public endpoint, so it must not confirm that a draft tournament exists.
 */

import { and, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { readVersion, subscribe, type LiveMessage } from '@/lib/live-watcher';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Close the stream a little before the platform's function limit so the
 * client reconnects on a clean end-of-stream rather than a severed socket.
 */
const STREAM_MS = 240_000;
/** Comment frames to stop an idle connection being reaped in between scores. */
const HEARTBEAT_MS = 20_000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;

  const rows = await db()
    .select({ id: schema.tournaments.id, visibility: schema.tournaments.visibility })
    .from(schema.tournaments)
    .where(and(eq(schema.tournaments.organizationId, orgId()), eq(schema.tournaments.slug, slug)))
    .limit(1);

  const tournament = rows[0];
  if (tournament === undefined || tournament.visibility === 'draft') {
    return new Response('Not found', { status: 404 });
  }
  const tournamentId = tournament.id;

  const initialVersion = await readVersion(tournamentId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (frame: string): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(frame));
        } catch {
          // The client went away between the check and the write.
          closed = true;
        }
      };

      const close = (): void => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearTimeout(cutoff);
        unsubscribe();
        request.signal.removeEventListener('abort', close);
        try {
          controller.close();
        } catch {
          // Already closed by the runtime.
        }
      };

      // How long EventSource waits before reconnecting, in ms.
      send('retry: 3000\n\n');
      send(`event: hello\ndata: ${JSON.stringify({ version: initialVersion })}\n\n`);

      const unsubscribe = subscribe(tournamentId, (message: LiveMessage) => {
        send(`event: ${message.kind}\ndata: ${JSON.stringify(message)}\n\n`);
      });

      const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);
      const cutoff = setTimeout(close, STREAM_MS);

      if (request.signal.aborted) close();
      else request.signal.addEventListener('abort', close);
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      // `no-transform` matters as much as `no-cache`: a proxy that gzips or
      // buffers the body will hold frames back and the stream looks dead.
      'cache-control': 'no-cache, no-store, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
