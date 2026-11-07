'use client';

/**
 * The score entry surface.
 *
 * One match expanded at a time. Courtside you are entering one result, and
 * a page of simultaneously-open forms is both easier to mis-tap and slower
 * to read. Collapsed rows stay dense so the list is scannable.
 */

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type { ScoringFormat } from '@opentennis/engine';
import { maxSets, OUTCOMES, type Outcome } from '@/lib/match-result';
import { fill, type Dictionary } from '@/lib/i18n/dictionaries';
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
    readonly isBye: boolean;
  }[];
  readonly sets: readonly {
    readonly setIndex: number;
    readonly side0Games: number;
    readonly side1Games: number;
    readonly side0TiebreakPoints: number | null;
    readonly side1TiebreakPoints: number | null;
  }[];
}

function outcomeLabel(outcome: Outcome, dict: Dictionary): string {
  switch (outcome) {
    case 'completed': return dict.outcomePlayed;
    case 'retirement': return dict.outcomeRetired;
    case 'walkover': return dict.outcomeWalkover;
    case 'default': return dict.outcomeDefault;
  }
}

function scoreLine(match: MatchRow, dict: Dictionary): string {
  if (match.sets.length === 0) {
    return outcomeLabel((match.outcome as Outcome) ?? 'completed', dict);
  }
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

function Entry({ match, onDone, dict }: {
  readonly match: MatchRow;
  readonly onDone: () => void;
  readonly dict: Dictionary;
}) {
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
  const adjustGame = (name: string, delta: number): void => {
    const current = Number(boxes[name] ?? '0');
    setBoxes((currentBoxes) => ({
      ...currentBoxes,
      [name]: String(Math.max(0, (Number.isFinite(current) ? current : 0) + delta)),
    }));
  };
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
        <legend className={styles.legend}>{dict.howDidItEnd}</legend>
        {OUTCOMES.map((o) => (
          <label key={o} className={styles.radio} data-on={outcome === o ? 'true' : undefined}>
            <input
              type="radio"
              name="outcome"
              value={o}
              checked={outcome === o}
              onChange={() => setOutcome(o)}
            />
            {outcomeLabel(o, dict)}
          </label>
        ))}
      </fieldset>

      {!scoreless && (
        <div className={styles.grid}>
          {Array.from({ length: rows }, (_, i) => (
            <section key={i} className={styles.setColumn}>
              <h3 className={styles.setHead}>{fill(dict.setN, { n: String(i + 1) })}</h3>
              {match.sides.map((side) => {
                const gameName = `set${i}_${side.position}`;
                return (
                  <div key={side.position} className={styles.scoreRow}>
                    <span className={styles.who}>{side.name}</span>
                    <span className={styles.cell}>
                      <span className={styles.gameStepper}>
                        <button
                          type="button"
                          className={styles.step}
                          aria-label={fill(dict.decreaseGame, {
                            name: side.name ?? dict.entrant,
                            n: String(i + 1),
                          })}
                          onClick={() => adjustGame(gameName, -1)}
                        >
                          −
                        </button>
                        <input
                          className={styles.games}
                          type="number"
                          min="0"
                          name={gameName}
                          {...box(gameName)}
                          inputMode="numeric"
                          autoComplete="off"
                          aria-label={fill(dict.gamesAria, {
                            name: side.name ?? dict.entrant,
                            n: String(i + 1),
                          })}
                        />
                        <button
                          type="button"
                          className={styles.step}
                          aria-label={fill(dict.increaseGame, {
                            name: side.name ?? dict.entrant,
                            n: String(i + 1),
                          })}
                          onClick={() => adjustGame(gameName, 1)}
                        >
                          +
                        </button>
                      </span>
                      <input
                        className={styles.tb}
                        type="number"
                        min="0"
                        name={`tb${i}_${side.position}`}
                        {...box(`tb${i}_${side.position}`)}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="tb"
                        aria-label={fill(dict.tiebreakAria, {
                          name: side.name ?? dict.entrant,
                          n: String(i + 1),
                        })}
                      />
                    </span>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}

      {needsAward && (
        <fieldset className={styles.outcomes}>
          <legend className={styles.legend}>
            {outcome === 'retirement' ? dict.whoCarriedOn : dict.whoAwarded}
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
          {pending ? dict.saving : dict.saveResult}
        </button>
        <button type="button" className={styles.cancel} onClick={onDone}>
          {dict.cancel}
        </button>
      </div>
    </form>
  );
}

function Row({ match, open, onToggle, onDone, dict }: {
  readonly match: MatchRow;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly onDone: () => void;
  readonly dict: Dictionary;
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
  const [confirmClear, setConfirmClear] = useState(false);
  const requestClear = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setConfirmClear(true);
  };
  useEffect(() => {
    if (clearState.savedMatchId === match.id || undoState.savedMatchId === match.id) {
      setConfirmClear(false);
      onDone();
    }
  }, [clearState.savedMatchId, undoState.savedMatchId, match.id, onDone]);

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
              {s.name ?? <em className={styles.tbd}>{dict.waitingOnResult}</em>}
            </span>
          ))}
        </div>

        {done && <span className={styles.score}>{scoreLine(match, dict)}</span>}

        {(playable || recoverable) && canScore && (
          <div className={styles.rowActions}>
            {playable && (
              <button type="button" className={styles.enter} onClick={onToggle}>
                {open ? dict.closeResult : done ? dict.editResult : dict.enterResult}
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
                  {undoing ? dict.undoing : dict.undo}
                </button>
              </form>
            )}
            {done && (
              <form action={clearAction} onSubmit={requestClear}>
                <TokenField />
                <input type="hidden" name="matchId" value={match.id} />
                <button type="submit" className={styles.cancel} disabled={clearing}>
                  {clearing ? dict.clearing : dict.clearResult}
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

      {confirmClear && (
        <div className={styles.confirmBackdrop}>
          <section className={styles.confirmDialog} role="dialog" aria-modal="true">
            <h3>{dict.confirmClearResultTitle}</h3>
            <p>{dict.confirmClearResultBody}</p>
            <div className={styles.entryActions}>
              <form action={clearAction}>
                <TokenField />
                <input type="hidden" name="matchId" value={match.id} />
                <button type="submit" className={styles.clearConfirm} disabled={clearing}>
                  {dict.clearResult}
                </button>
              </form>
              <button
                type="button"
                className={styles.cancel}
                onClick={() => setConfirmClear(false)}
              >
                {dict.cancel}
              </button>
            </div>
          </section>
        </div>
      )}

      {open && <Entry match={match} onDone={onDone} dict={dict} />}
    </li>
  );
}

function Group({ title, matches, empty, dict }: {
  readonly title: string;
  readonly matches: readonly MatchRow[];
  readonly empty: string;
  readonly dict: Dictionary;
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
              onDone={() => setOpenId((current) => (current === m.id ? null : current))}
              dict={dict}
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
  dict,
}: {
  readonly playable: readonly MatchRow[];
  readonly waiting: readonly MatchRow[];
  readonly done: readonly MatchRow[];
  /** Set only when rendered from a scorekeeper link. */
  readonly scorekeeperToken?: string | null;
  /** INF-2. A viewer sees the results but is not offered the buttons. */
  readonly canScore?: boolean;
  readonly dict: Dictionary;
}) {
  return (
    <ScorekeeperTokenContext.Provider value={scorekeeperToken}>
      <CanScoreContext.Provider value={canScore}>
      <Group
        title={dict.readyToScore}
        matches={playable}
        empty={dict.readyToScoreEmpty}
        dict={dict}
      />
      {done.length > 0 && <Group title={dict.recorded} matches={done} empty="" dict={dict} />}
      {waiting.length > 0 && (
        <Group
          title={dict.waitingEarlier}
          matches={waiting}
          empty=""
          dict={dict}
        />
      )}
      </CanScoreContext.Provider>
    </ScorekeeperTokenContext.Provider>
  );
}
