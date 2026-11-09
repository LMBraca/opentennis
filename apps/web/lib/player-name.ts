/**
 * Comparing player names well enough to spot the same person twice.
 *
 * Extracted from the entry queue (ENT-8), which needed exactly this to sort
 * "Hernández" next to "Hernandez", and is now shared with the player
 * directory (ADM-14) so the two screens cannot disagree about who looks like
 * a duplicate of whom.
 *
 * Pure. No database, no React.
 */

/**
 * Strip accents and case.
 *
 * NFKD splits a letter from its diacritic, then the combining marks are
 * removed, so "Hernández" and "Hernandez" collapse to the same key. Without
 * this they sort into different parts of the alphabet and the duplicate the
 * organizer needs to see is nowhere near its twin.
 */
export function fold(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/** Surname first: the directory is browsed and sorted by surname (PRD §4.1). */
export function nameSortKey(lastName: string, firstName: string): string {
  return `${fold(lastName)} ${fold(firstName)}`.trim();
}

/**
 * Full names are used on public draws so entrants with the same surname are
 * distinguishable.
 */
export function fullPlayerName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
}

/** Collapse runs of whitespace too, so "De  La Cruz" matches "De La Cruz". */
export function nameKey(firstName: string, lastName: string): string {
  return `${fold(firstName)} ${fold(lastName)}`.replace(/\s+/g, ' ').trim();
}

export interface ComparablePlayer {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string | null;
}

/**
 * Does the search box match this player?
 *
 * Folded on both sides, so typing "hernandez" finds "Hernández" — which is
 * the whole point of a search box in a club where most surnames carry an
 * accent and most keyboards do not.
 */
export function matchesQuery(player: ComparablePlayer, query: string): boolean {
  const q = fold(query).replace(/\s+/g, ' ');
  if (q === '') return true;
  const haystack = [
    nameKey(player.firstName, player.lastName),
    nameKey(player.lastName, player.firstName),
    fold(player.email ?? ''),
  ].join(' ');
  // Every word has to appear somewhere, so "ana her" finds Ana Hernández.
  return q.split(' ').every((term) => haystack.includes(term));
}

/**
 * Groups of players that are probably one person.
 *
 * Two signals, and one piece of counter-evidence that outranks a name match:
 *
 *   - Same email  → the same person. Strongest signal there is.
 *   - Same name   → the same person, UNLESS they have different emails.
 *
 * That last clause matters more than it looks. A club of 110 has plenty of
 * genuinely distinct people sharing a name, and flagging every "Luca Rossi"
 * pair as a duplicate when their emails plainly differ turns the marking
 * into noise — on the club's own data it flagged 97 of 110. Two different
 * addresses is the person telling you they are two people.
 *
 * DELIBERATELY CONSERVATIVE otherwise: no initials, no edit distance. The
 * entry queue settled this — a duplicate flag that is wrong is worse than no
 * flag, because an organizer shown two wrong ones stops reading the third.
 * Near-misses are caught by sorting the list so they sit adjacent, where a
 * human decides.
 *
 * Returned as id groups of two or more, in the order the players were given.
 */
export function duplicateGroups(
  players: readonly ComparablePlayer[],
): ReadonlyArray<readonly string[]> {
  const byName = new Map<string, string[]>();
  const byEmail = new Map<string, string[]>();

  for (const player of players) {
    const name = nameKey(player.firstName, player.lastName);
    if (name !== '') {
      const bucket = byName.get(name);
      if (bucket === undefined) byName.set(name, [player.id]);
      else bucket.push(player.id);
    }
    const email = fold(player.email ?? '');
    if (email !== '') {
      const bucket = byEmail.get(email);
      if (bucket === undefined) byEmail.set(email, [player.id]);
      else bucket.push(player.id);
    }
  }

  // Union the two signals: same name OR same email puts people in one group,
  // and a chain of either joins all of them (A shares a name with B, B shares
  // an email with C — it is one person three times).
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = parent.get(id) ?? id;
    while (root !== (parent.get(root) ?? root)) root = parent.get(root) ?? root;
    return root;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const emailOf = new Map(players.map((p) => [p.id, fold(p.email ?? '')]));

  // Same email is unconditional: it is the same person however they spelled
  // their name.
  for (const bucket of byEmail.values()) {
    for (let i = 1; i < bucket.length; i += 1) union(bucket[0]!, bucket[i]!);
  }

  // Same name only joins a pair when their emails do not contradict it.
  // Compared PAIRWISE rather than across the whole bucket, so three people
  // called Luca Rossi with three different addresses stay three people,
  // while the one of them with no address still joins whoever matches.
  for (const bucket of byName.values()) {
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const a = emailOf.get(bucket[i]!) ?? '';
        const b = emailOf.get(bucket[j]!) ?? '';
        if (a !== '' && b !== '' && a !== b) continue; // they say they differ
        union(bucket[i]!, bucket[j]!);
      }
    }
  }

  const groups = new Map<string, string[]>();
  for (const player of players) {
    const root = find(player.id);
    const bucket = groups.get(root);
    if (bucket === undefined) groups.set(root, [player.id]);
    else bucket.push(player.id);
  }

  return [...groups.values()].filter((g) => g.length > 1);
}
