'use client';

/**
 * The score entry surface.
 *
 * One match expanded at a time. Courtside you are entering one result, and
 * a page of simultaneously-open forms is both easier to mis-tap and slower
 * to read. Collapsed rows stay dense so the list is scannable.
 */

import { createContext, useActionState, useContext, useEffect, useRef, useState } from 'react';
import type { ScoringFormat } from '@opentennis/engine';
import { maxSets, OUTCOMES, type Outcome } from '@/lib/match-result';
import { recordResult, clearResult, undoLastEvent, type ScoreState } from './actions';
import styles from './scores.module.css';

/**
 * INF-3: the scorekeeper link, when this list is being used from /score/:token.
 *
 * Context rather than a prop threaded through ScoreList -> Group -> Row ->
 * Entry: four components would each carry a field none of them care about,
 * and the one that forgot it would fail silently with "you are not signed
 * in" at the side of a court. Null in the admin, where the session is the
 * credential.
 */
const ScorekeeperTokenContext = createContext<string | null>(null);

/** INF-2: whether this reader may write. Same reasoning as the token above. */
const CanScoreContext = createContext<boolean>(true);

function TokenField() {
  const token = useContext(ScorekeeperTokenContext);
  if (token === null) return null;
  return <input type="hidden" name="scorekeeperToken" value={token} />;
}

export interface MatchRow {
  readonly id: string;
  readonly status: string;
  readonly outcome: string | null;
  readonly roundName: string;
  readonly courtName: string | null;
  readonly drawLabel: string;
  readonly format: ScoringFormat;
  /** SCR-5: is there a live score event to step back to? */
  readonly canUndo: boolean;
  readonly sides: readonly {
    readonly position: number;
    readonly name: string | null;
    readonly isWinner: boolean;
  }[];
  readonly sets: readonly {
    readonly setIndex: number;
    readonly side0Games: number;
    readonly side1Games: number;
    readonly side0TiebreakPoints: number | null;
    readonly side1TiebreakPoints: number | null;
  }[];
}

const OUTCOME_LABEL: Record<Outcome, string> = {
  completed: 'Played',
  retirement: 'Retired',
  walkover: 'Walkover',
  default: 'Default',
};

function scoreLine(match: MatchRow): string {
  if (match.sets.length === 0) return OUTCOME_LABEL[(match.outcome as Outcome) ?? 'completed'];
  return match.sets
    .map((s) => {
      const tb =
        s.side0TiebreakPoints !== null && s.side1TiebreakPoints !== null
          ? `(${Math.min(s.side0TiebreakPoints, s.side1TiebreakPoints)})`
          : '';
      return `${s.side0Games}-${s.side1Games}${tb}`;
    })
    .join('  ');
}

function Entry({ match, onDone }: { readonly match: MatchRow; readonly onDone: () => void }) {
  const [state, action, pending] = useActionState<ScoreState, FormData>(recordResult, {});
  const [outcome, setOutcome] = useState<Outcome>((match.outcome as Outcome) ?? 'completed');
  /*
   * A FRESH id per mount, not useId().
   *
   * useId is deterministic for a given position in the tree, so reopening
   * this form produced the same "idempotency key" as a previous successful
   * save. The server saw a known key, assumed a network retry and no-opped
   * — so re-entering a result after clearing it silently did nothing, and
   * the form closed as though it had worked. randomUUID is unique per
   * attempt, which is what idempotency actually needs: it still collapses
   * a double-click or a retry of the SAME submission.
   */
  const [attemptId] = useState(() => crypto.randomUUID());

  /** Who the match was awarded to, for a retirement, walkover or default. */
  const [awardedTo, setAwardedTo] = useState('');

  /*
   * Put the RADIOS back after a refused save.
   *
   * The score boxes are controlled and React restores them, but radios are
   * not restored the same way: React resets the form when the action
   * settles, so a refused retirement came back with "Played" selected
   * while the component still thought it was a retirement. The
   * retirement-only "Who carried on?" picker therefore stayed on screen
   * next to a "Played" radio, and the organizer's second attempt was
   * submitted as a completed match — answered with "that score does not
   * finish the match", about a score they had deliberately left
   * unfinished.
   */
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const form = formRef.current;
    if (form === null) return;
    for (const radio of form.querySelectorAll<HTMLInputElement>('input[name="outcome"]')) {
      radio.checked = radio.value === outcome;
    }
    for (const radio of form.querySelectorAll<HTMLInputElement>('input[name="awardedTo"]')) {
      radio.checked = radio.value === awardedTo;
    }
  });

  /*
   * CONTROLLED, not defaultValue.
   *
   * React resets an uncontrolled form after a form action runs — including
   * when the action came back with a validation error. The effect was that
   * a half-typed score was wiped at exactly the moment the organizer was
   * told to correct it, so they had to retype the whole thing. Holding the
   * values in state makes a rejected submission a correction rather than a
   * restart.
   */
  const [boxes, setBoxes] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const set of match.sets) {
      initial[`set${set.setIndex}_0`] = String(set.side0Games);
      initial[`set${set.setIndex}_1`] = String(set.side1Games);
      if (set.side0TiebreakPoints !== null) initial[`tb${set.setIndex}_0`] = String(set.side0TiebreakPoints);
      if (set.side1TiebreakPoints !== null) initial[`tb${set.setIndex}_1`] = String(set.side1TiebreakPoints);
    }
    return initial;
  });
  const box = (name: string) => ({
    value: boxes[name] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setBoxes((b) => ({ ...b, [name]: e.target.value })),
  });
  const rows = maxSets(match.format);
  const needsAward = outcome !== 'completed';
  const scoreless = outcome === 'walkover' || outcome === 'default';

  /*
   * In an effect, not during render. Calling onDone() in the render body
   * sets state in the parent mid-render, which React may answer by
   * remounting this form — and a remounted form loses every uncontrolled
   * input. The visible symptom was a typed score vanishing the moment a
   * validation error came back, which is the worst possible moment to
   * throw away someone's typing.
   */
  useEffect(() => {
    if (state.savedMatchId === match.id) onDone();
  }, [state.savedMatchId, match.id, onDone]);

  return (
    <form ref={formRef} action={action} className={styles.entry}>
      <TokenField />
      <input type="hidden" name="matchId" value={match.id} />
      {/* Stable per mount: a retry after a dropped connection courtside
          records the result once, not twice. */}
      <input type="hidden" name="clientEventId" value={`${match.id}:${attemptId}`} />

      <fieldset className={styles.outcomes}>
        <legend className={styles.legend}>How did it end?</legend>
        {OUTCOMES.map((o) => (
          <label key={o} className={styles.radio} data-on={outcome === o ? 'true' : undefined}>
            <input
              type="radio"
              name="outcome"
              value={o}
              checked={outcome === o}
              onChange={() => setOutcome(o)}
            />
            {OUTCOME_LABEL[o]}
          </label>
        ))}
      </fieldset>

      {!scoreless && (
        <div className={styles.grid}>
          {/* A real header ROW. These were loose children of a column flex
              container, so they stacked down the left instead of sitting
              over the columns they label. */}
          <div className={styles.headRow}>
            <span className={styles.who} aria-hidden="true" />
            {Array.from({ length: rows }, (_, i) => (
              <span key={i} className={styles.setHead}>
                Set {i + 1}
              </span>
            ))}
          </div>

          {match.sides.map((side) => (
            <div key={side.position} className={styles.scoreRow}>
              <span className={styles.who}>{side.name}</span>
              {Array.from({ length: rows }, (_, i) => {
                return (
                  <span key={i} className={styles.cell}>
                    <input
                      className={styles.games}
                      name={`set${i}_${side.position}`}
                      {...box(`set${i}_${side.position}`)}
                      inputMode="numeric"
                      autoComplete="off"
                      aria-label={`${side.name ?? 'Side'} games, set ${i + 1}`}
                    />
                    <input
                      className={styles.tb}
                      name={`tb${i}_${side.position}`}
                      {...box(`tb${i}_${side.position}`)}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="tb"
                      aria-label={`${side.name ?? 'Side'} tiebreak points, set ${i + 1}`}
                    />
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {needsAward && (
        <fieldset className={styles.outcomes}>
          <legend className={styles.legend}>
            {outcome === 'retirement' ? 'Who carried on?' : 'Who was awarded the match?'}
          </legend>
          {match.sides.map((side) => (
            <label key={side.position} className={styles.radio}>
              <input
                type="radio"
                name="awardedTo"
                value={side.position}
                checked={awardedTo === String(side.position)}
                onChange={() => setAwardedTo(String(side.position))}
              />
              {side.name}
            </label>
          ))}
        </fieldset>
      )}

      {state.error !== undefined && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}

      <div className={styles.entryActions}>
        <button type="submit" className={styles.save} disabled={pending}>
          {pending ? 'Saving…' : 'Save result'}
        </button>
        <button type="button" className={styles.cancel} onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Row({ match, open, onToggle }: {
  readonly match: MatchRow;
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  const done = match.status === 'complete';
  const canScore = useContext(CanScoreContext);
  const playable = match.sides.every((s) => s.name !== null);
  /*
   * Clear and Undo are offered on ANY match that has something to take
   * back, even one whose sides are no longer named.
   *
   * `playable` gates entering a score, which is right — you cannot score a
   * match whose players are still unknown. Gating the whole action row on
   * it meant a match left with a result and an empty side had no control
   * that could fix it: no Clear, no Undo, not even visible in the list.
   * The corrupted state was unreachable from the only screen that could
   * repair it.
   */
  const recoverable = done || match.canUndo;
  /*
   * Clear and Undo can both be REFUSED now — emptying a match whose winner
   * already went on to win a later one would leave that later result
   * standing against an empty place in the draw. A plain <form action> had
   * nowhere to put the refusal, so it would have looked like the button
   * did nothing.
   */
  const [clearState, clearAction, clearing] = useActionState<ScoreState, FormData>(
    clearResult,
    {},
  );
  const [undoState, undoAction, undoing] = useActionState<ScoreState, FormData>(
    undoLastEvent,
    {},
  );

  return (
    <li className={styles.row} data-done={done ? 'true' : undefined}>
      <div className={styles.summary}>
        <div className={styles.meta}>
          <span className={styles.draw}>{match.drawLabel}</span>
          <span className={styles.round}>{match.roundName}</span>
          {match.courtName !== null && <span className={styles.court}>{match.courtName}</span>}
        </div>

        <div className={styles.names}>
          {match.sides.map((s) => (
            <span key={s.position} className={styles.name} data-winner={s.isWinner ? 'true' : undefined}>
              {s.name ?? <em className={styles.tbd}>Waiting on a result</em>}
            </span>
          ))}
        </div>

        {done && <span className={styles.score}>{scoreLine(match)}</span>}

        {(playable || recoverable) && canScore && (
          <div className={styles.rowActions}>
            {playable && (
              <button type="button" className={styles.enter} onClick={onToggle}>
                {open ? 'Close' : done ? 'Edit' : 'Enter result'}
              </button>
            )}
            {/* Undo steps back ONE event and keeps the rest of the
                history; Clear empties the match. Both are offered because
                they answer different questions — "that set was wrong" and
                "this match did not happen". */}
            {match.canUndo && (
              <form action={undoAction}>
                <TokenField />
                <input type="hidden" name="matchId" value={match.id} />
                <button type="submit" className={styles.cancel} disabled={undoing}>
                  {undoing ? 'Undoing…' : 'Undo'}
                </button>
              </form>
            )}
            {done && (
              <form action={clearAction}>
                <TokenField />
                <input type="hidden" name="matchId" value={match.id} />
                <button type="submit" className={styles.cancel} disabled={clearing}>
                  {clearing ? 'Clearing…' : 'Clear'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {(clearState.error !== undefined || undoState.error !== undefined) && (
        <p className={styles.error} role="alert">
          {clearState.error ?? undoState.error}
        </p>
      )}

      {open && <Entry match={match} onDone={onToggle} />}
    </li>
  );
}

function Group({ title, matches, empty }: {
  readonly title: string;
  readonly matches: readonly MatchRow[];
  readonly empty: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <section className={styles.group}>
      <h2 className={styles.groupTitle}>{title}</h2>
      {matches.length === 0 ? (
        <p className={styles.empty}>{empty}</p>
      ) : (
        <ul className={styles.list}>
          {matches.map((m) => (
            <Row
              key={m.id}
              match={m}
              open={openId === m.id}
              onToggle={() => setOpenId(openId === m.id ? null : m.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function ScoreList({
  playable,
  waiting,
  done,
  scorekeeperToken = null,
  canScore = true,
}: {
  readonly playable: readonly MatchRow[];
  readonly waiting: readonly MatchRow[];
  readonly done: readonly MatchRow[];
  /** Set only when rendered from a scorekeeper link. */
  readonly scorekeeperToken?: string | null;
  /** INF-2. A viewer sees the results but is not offered the buttons. */
  readonly canScore?: boolean;
}) {
  return (
    <ScorekeeperTokenContext.Provider value={scorekeeperToken}>
      <CanScoreContext.Provider value={canScore}>
      <Group
        title="Ready to score"
        matches={playable}
        empty="Nothing is waiting for a score. Generate a draw, or record a result to open the next round."
      />
      {done.length > 0 && <Group title="Recorded" matches={done} empty="" />}
      {waiting.length > 0 && (
        <Group
          title="Waiting on an earlier result"
          matches={waiting}
          empty=""
        />
      )}
      </CanScoreContext.Provider>
    </ScorekeeperTokenContext.Provider>
  );
}
