import type { ReactNode } from 'react';
import { SiteShell } from '@/components/site-shell';

/**
 * The public site's shell.
 *
 * The footer used to be rendered by each page — twelve call sites, each
 * inside whatever container that page happened to use. Two bugs came out
 * of that, and they are the two that were reported.
 *
 * It never sat at the bottom, because it was ordinary content inside
 * `PageBody`: on a short page it stopped wherever the text did. And it
 * drew at a different width per page, because it escaped its container
 * with `margin-inline: calc(50% - 50vw)` — a trick whose result depends
 * entirely on the padding of whatever it happens to be inside.
 *
 * One footer, in a layout, outside the content. Exactly the rule
 * `page-header.tsx` already states for the masthead: twelve of a thing is
 * how the thing drifts.
 *
 * `admin`, `score` and `style-guide` sit outside this group deliberately.
 * They are tools, and a sponsor credit is not part of a tool.
 */
export default function SiteLayout({ children }: { readonly children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
