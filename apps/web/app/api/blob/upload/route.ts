/**
 * RV-16 — image uploads for the blog, on Vercel Blob.
 *
 * The browser uploads straight to Blob storage; this route only issues the
 * short-lived token that lets it. The file never passes through the server,
 * which is what keeps a 4MB photo off the serverless function's request
 * body limit.
 *
 * THE SECURITY IS ENTIRELY IN `onBeforeGenerateToken`. That callback is the
 * only gate between the public internet and the club's blob store: without
 * the capability check below, anyone who finds this URL can upload anything
 * and have it served from the club's own domain. It runs before a token
 * exists, so a refusal costs nothing.
 *
 * `onUploadCompleted` is deliberately not used to write the database. Vercel
 * calls it from its own infrastructure, so it cannot see our session, and it
 * does not fire at all on localhost. The URL comes back to the browser from
 * `upload()` and is submitted with the form like any other field — the admin
 * action that saves the post is where it gets persisted, under the session
 * that is already authenticated there.
 */

import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { currentUser } from '@/lib/auth';
import { mayUpload } from '@/lib/upload-policy';

export const runtime = 'nodejs';

/** What a club posts: photographs from a tournament. Not a file host. */
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        /*
         * Checked here rather than in middleware. A token is a capability:
         * once issued the browser can upload without touching this route
         * again, so the check has to be on the thing that issues it.
         */
        const user = await currentUser();
        if (!mayUpload(user?.role ?? null)) {
          throw new Error('Not allowed to upload.');
        }
        return {
          allowedContentTypes: [...ALLOWED],
          maximumSizeInBytes: MAX_BYTES,
          // Two uploads of "IMG_1234.jpg" must not overwrite each other.
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // Intentionally empty — see the note at the top of this file.
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    // 400, not 500: every failure here is a rejected request — wrong
    // content type, too large, or not signed in — not a broken server.
    const message = error instanceof Error ? error.message : 'Upload failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
