/**
 * INF-2 — what each role may actually do.
 *
 * The `member_role` enum has existed since the schema was written and
 * nothing ever read it: `requireUser` asked only "is anybody signed in",
 * so a viewer account and the club owner had identical power, including
 * deleting a tournament and every result in it.
 *
 * Capabilities rather than role checks at call sites. `role === 'admin'`
 * scattered through thirty actions is a rule written thirty times, and the
 * one that gets missed when a role is added is a hole. Here there is one
 * table, and adding a role means filling in a column.
 *
 * Pure: no database, no request. The mapping is the whole thing.
 */

export const MEMBER_ROLES = ['owner', 'admin', 'scorekeeper', 'viewer'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export function isMemberRole(value: string): value is MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(value);
}

/**
 * The verbs the admin side actually performs.
 *
 * Deliberately coarse. A permission per button would be unmaintainable and
 * would still not stop the thing that matters, which is somebody who should
 * only be entering scores deleting a draw.
 */
export type Capability =
  /** See the admin side at all. */
  | 'admin:view'
  /** Record, clear and undo results. */
  | 'scores:write'
  /** Add, edit, seed, withdraw entrants; import a list. */
  | 'entrants:write'
  /** Generate and replace draws, set format and scoring, schedule. */
  | 'draws:manage'
  /** Create and edit tournaments, open and close entries, publish. */
  | 'tournaments:manage'
  /** Updates, media, the category ladder. */
  | 'content:manage'
  /** Issue and revoke scorekeeper links. */
  | 'scorekeepers:manage'
  /** Merge players — it rewrites history, so it is not routine. */
  | 'players:merge'
  /** Delete a tournament and everything under it. */
  | 'destructive';

const CAPABILITIES: Record<MemberRole, readonly Capability[]> = {
  /** The club. Everything, including handing the club to somebody else. */
  owner: [
    'admin:view',
    'scores:write',
    'entrants:write',
    'draws:manage',
    'tournaments:manage',
    'content:manage',
    'scorekeepers:manage',
    'players:merge',
    'destructive',
  ],
  /**
   * The tournament director. Runs everything, but does NOT get
   * `destructive` — deleting a tournament with its results is an owner's
   * decision, and it is the one action with no undo anywhere in the
   * product.
   */
  admin: [
    'admin:view',
    'scores:write',
    'entrants:write',
    'draws:manage',
    'tournaments:manage',
    'content:manage',
    'scorekeepers:manage',
    'players:merge',
  ],
  /**
   * A volunteer with an account rather than a link. Same power as a
   * scorekeeper token, which is the point: the link and the role must not
   * disagree about what a scorekeeper is.
   */
  scorekeeper: ['admin:view', 'scores:write'],
  /** Can look. The desk helper who reads out the order of play. */
  viewer: ['admin:view'],
};

export function can(role: MemberRole, capability: Capability): boolean {
  return CAPABILITIES[role].includes(capability);
}

/** Every capability a role has, for rendering a UI that matches its powers. */
export function capabilitiesOf(role: MemberRole): readonly Capability[] {
  return CAPABILITIES[role];
}
