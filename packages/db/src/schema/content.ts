/**
 * Editorial content: club updates, and the photos attached to them.
 *
 * ONE table drives both the updates page and the media page. The alternative
 * -- a `posts` table and a separate `gallery` table -- means a photo from
 * finals day exists twice, once as an album and once as an article, and the
 * two drift the first time someone edits a caption. Here a media item belongs
 * to an update; the media page is the same rows read along a different axis.
 *
 * Bodies are stored as Markdown rather than HTML. An admin textarea that
 * accepts HTML is a stored-XSS hole on a public page, and the renderer here
 * (lib/markdown.ts) emits a fixed set of elements and escapes everything
 * else, so there is no path from the editor to raw markup.
 */

import { relations } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { id, timestamps } from './columns';
import { visibilityEnum } from './enums';
import { organizations, tournaments } from './core';

export const updates = pgTable(
  'updates',
  {
    id: id(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    /**
     * Globally unique, for the same reason tournament slugs are (DB-4): the
     * public URL is /updates/:slug, and scoping it per organization would
     * force a prefix into the path later and break shared links.
     */
    slug: text('slug').notNull(),
    title: text('title').notNull(),

    /** Teaser for the list and the home page. Plain text, never Markdown. */
    excerpt: text('excerpt'),
    body: text('body').notNull().default(''),

    coverUrl: text('cover_url'),
    coverAlt: text('cover_alt'),

    /**
     * Optional link back to what the post is about, so a tournament report
     * can offer "see the draws" without the author pasting a URL that goes
     * stale when the tournament is renamed.
     */
    tournamentId: text('tournament_id').references(() => tournaments.id, {
      onDelete: 'set null',
    }),

    visibility: visibilityEnum('visibility').notNull().default('draft'),

    /**
     * Nullable on purpose, and separate from createdAt. A draft written three
     * weeks early must not sort as three weeks old once it goes live, and
     * "has this been published" is then one column rather than a join against
     * an audit trail.
     */
    publishedAt: timestamp('published_at', { withTimezone: true }),

    ...timestamps(),
  },
  (t) => [
    uniqueIndex('updates_slug_unique').on(t.slug),
    index('updates_org_published_idx').on(t.organizationId, t.publishedAt),
  ],
);

/**
 * Photos and videos belonging to an update.
 *
 * `url` rather than a blob column: images live on a CDN, and Postgres is a
 * poor and expensive filesystem. Whatever uploads them later only has to
 * produce a URL.
 */
export const mediaItems = pgTable(
  'media_items',
  {
    id: id(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    updateId: text('update_id')
      .notNull()
      .references(() => updates.id, { onDelete: 'cascade' }),

    url: text('url').notNull(),
    /** Required by the form. A gallery of unlabelled images is unusable to
     *  anyone on a screen reader, and alt text is the cheapest fix there is. */
    alt: text('alt').notNull().default(''),
    caption: text('caption'),

    /** Explicit, because upload order is not display order. */
    position: integer('position').notNull().default(0),

    ...timestamps(),
  },
  (t) => [index('media_items_update_idx').on(t.updateId, t.position)],
);

export const updatesRelations = relations(updates, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [updates.organizationId],
    references: [organizations.id],
  }),
  tournament: one(tournaments, {
    fields: [updates.tournamentId],
    references: [tournaments.id],
  }),
  media: many(mediaItems),
}));

export const mediaItemsRelations = relations(mediaItems, ({ one }) => ({
  update: one(updates, { fields: [mediaItems.updateId], references: [updates.id] }),
  organization: one(organizations, {
    fields: [mediaItems.organizationId],
    references: [organizations.id],
  }),
}));
