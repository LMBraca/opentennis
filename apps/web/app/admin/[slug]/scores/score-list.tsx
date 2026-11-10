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
import { fill, type Dictionary } from '@/lib/i18n/dictionaries';
import { recordResult, clearResult, undoLastEvent, type ScoreState } from './actions';
import { ConfirmAction } from '@/components/confirm-action';
import { groupIntoDraws } from '@/lib/draw-grouping';
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
  /** RV-18: position in the bracket, for the draw view's columns. */
  readonly roundIndex: number;
  readonly slotIndex: number;
  readonly format: ScoringFormat;
  /** SCR-5: is there a live score event to step back to? */
  readonly canUndo: boolean;
  readonly sides: readonly {
    readonly position: number;
    readonly name: string | null;
    readonly isWinner: boolean;
    /* From main's batch-4 work: a side fed by a bye is filtered out of the
       scoreable list, since nobody turns up to play it. */
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

/**
 * OT-24 — games entry with thumb-sized targets.
 *
 * The design system reserves `--tap-stepper` (56px) for courtside score
 * entry and the grid used a bare text input, which on a phone means the
 * keyboard covers the half of the form you are trying to read. A tennis
 * game count is a small integer that moves by one, so −/+ is both faster
 * and far harder to mis-tap than a numeric keypad.
 *
 * The field stays typable: an experienced scorer entering 6-4 7-5 is
 * quicker with the keypad, and taking that away to satisfy a guideline
 * would make the common case worse. The buttons are an addition.
 */
function Stepper({
  name,
  value,
  onValue,
  ariaLabel,
  decrementLabel,
  incrementLabel,
}: {
  readonly name: string;
  readonly value: string;
  readonly onValue: (next: string) => void;
  readonly ariaLabel: string;
  readonly decrementLabel: string;
  readonly incrementLabel: string;
}) {
  // An empty box is "no games yet", which is not the same as zero — a set
  // that has not been entered must stay blank so the validator can tell.
  const current = value === '' ? null : Number(value);
  const step = (by: number): void => {
    const next = (current ?? 0) + by;
    // Games cannot go negative, and nothing in tennis needs three digits.
    if (next < 0 || next > 99) return;
    onValue(String(next));
  };

  return (
    <span className={styles.stepper}>
      <button
        type="button"
        className={styles.stepButton}
        onClick={() => step(-1)}
        aria-label={`${decrementLabel}: ${ariaLabel}`}
        // Nothing to take away from an empty box.
        disabled={current === null || current === 0}
      >
        −
      </button>
      <input
        className={styles.games}
        name={name}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
      />
      <button
        type="button"
        className={styles.stepButton}
        onClick={() => step(1)}
        aria-label={`${incrementLabel}: ${ariaLabel}`}
      >
        +
      </button>
    </span>
  );
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

      {/*
        OT-24. Who is playing, pinned.
        On a phone the form is taller than the screen, so the names and
        round scrolled away above it — and a scorer looking down at a
        stepper had nothing on screen telling them which match they were
        filling in. Sticky inside the form rather than a second copy of
        the row above, so there is one source for it.
      */}
      <p className={styles.identity}>
        <span className={styles.identityNames}>
          {match.sides.map((s) => s.name ?? dict.entrant).join(' / ')}
        </span>
        <span className={styles.identityRound}>{match.roundName}</span>
      </p>

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
        /*
         * OT-24. SET-MAJOR, not side-major.
         *
         * It was a row per player with a column per set, so at 390px three
         * sets did not fit and the whole grid became a horizontal
         * scroller — which slid Set 1 off the left edge as soon as you
         * reached Set 2. The scorer could not see the set they had just
         * entered while entering the next one.
         *
         * One block per set, each carrying both players, stacks naturally
         * on a phone with every set label on screen, and sits as columns
         * on a wide screen. ONE set of inputs either way: a second layout
         * swapped by media query — the trick `Bracket` uses — would mean
         * two inputs sharing a `name`, and both would submit.
         *
         * Stacked rather than a swipe pane, which the design allows as the
         * reduced-motion fallback. Choosing it for everyone means there is
         * no animation to suppress and no JS to carry the gesture.
         */
        <div className={styles.grid}>
          {Array.from({ length: rows }, (_, i) => (
            <fieldset key={i} className={styles.setBlock}>
              <legend className={styles.setHead}>
                {fill(dict.setN, { n: String(i + 1) })}
              </legend>
              {match.sides.map((side) => (
                <div key={side.position} className={styles.sideEntry}>
                  <span className={styles.who}>{side.name}</span>
                  <Stepper
                    name={`set${i}_${side.position}`}
                    value={boxes[`set${i}_${side.position}`] ?? ''}
                    onValue={(v) =>
                      setBoxes((b) => ({ ...b, [`set${i}_${side.position}`]: v }))
                    }
                    ariaLabel={fill(dict.gamesAria, {
                      name: side.name ?? dict.entrant,
                      n: String(i + 1),
                    })}
                    decrementLabel={dict.decrement}
                    incrementLabel={dict.increment}
                  />
                  <input
                    className={styles.tb}
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
                </div>
              ))}
            </fieldset>
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

function Row({ match, open, onToggle, dict }: {
  readonly match: MatchRow;
  readonly open: boolean;
  readonly onToggle: () => void;
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

  /*
   * OT-19. Close the editor once an action has actually emptied the match.
   *
   * QA undid a result and was left with a blank editor still offering
   * Undo, on a page reading "15 ready / 0 recorded" — the match had been
   * emptied but the form stayed open over it, looking like unsaved work.
   * `canUndo` was already correct (lib/score-history excludes the undo
   * rows themselves), so the stale control was the open EDITOR.
   *
   * Keyed on the ACTION reporting `emptied`, not on the match looking
   * empty. "This match has nothing in it" is equally true of one nobody
   * has scored — where the editor was just opened deliberately and must
   * stay open. An earlier version of this fix closed the editor the
   * instant an organizer opened a fresh match.
   */
  const emptied = clearState.emptied === true || undoState.emptied === true;
  useEffect(() => {
    if (open && emptied) onToggle();
  }, [open, emptied, onToggle]);

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
            {/*
              OT-19. Clearing asks first. Undo does not, and that
              asymmetry is the point: Undo steps back one event and is
              itself reversible, while Clear throws away the whole match
              and is the action that can refuse because a later round
              already depends on it.
            */}
            {done && (
              <ConfirmAction
                action={clearAction}
                label={clearing ? dict.clearing : dict.clearResult}
                confirmLabel={dict.clearResult}
                consequence={dict.clearResultConsequence}
                cancelLabel={dict.cancel}
                danger
                className={styles.cancel}
              >
                <TokenField />
                <input type="hidden" name="matchId" value={match.id} />
              </ConfirmAction>
            )}
          </div>
        )}
      </div>

      {(clearState.error !== undefined || undoState.error !== undefined) && (
        <p className={styles.error} role="alert">
          {clearState.error ?? undoState.error}
        </p>
      )}

      {open && <Entry match={match} onDone={onToggle} dict={dict} />}
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
              dict={dict}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * RV-18 — the same matches, laid out as the draw.
 *
 * The list is grouped by what you can do (ready, recorded, waiting), which
 * is right for an organizer working an order of play. This is the other
 * question: where is this match in the bracket, and who does the winner
 * meet. Rounds become columns in reading order and the slot order within a
 * column is the bracket's own.
 *
 * It reuses `Row`, so the score editor, Clear, Undo, the refusal states and
 * every rule in lib/match-result.ts are literally the same component. A
 * second entry form rendered in a bracket shape is how two ways to record a
 * result start disagreeing about what a valid one is.
 *
 * NOT the public `Bracket`. That renders connectors from engine geometry
 * and takes DrawRound data this page does not load; pulling it in to draw
 * lines between boxes would mean the admin page loading a second shape of
 * the same matches. The columns carry the structure, which is what the
 * question needs.
 */
function DrawView({ matches, dict }: {
  readonly matches: readonly MatchRow[];
  readonly dict: Dictionary;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const draws = groupIntoDraws(matches);

  if (draws.length === 0) return <p className={styles.empty}>{dict.readyToScoreEmpty}</p>;

  return (
    <>
      {draws.map((draw) => (
        <section key={draw.label} className={styles.group}>
          <h2 className={styles.groupTitle}>{draw.label}</h2>
          <div className={styles.drawScroll}>
            <div className={styles.drawColumns}>
              {draw.columns.map((column) => (
                <div key={column.roundIndex} className={styles.drawColumn}>
                  <h3 className={styles.drawRound}>{column.matches[0]?.roundName ?? ''}</h3>
                  <ul className={styles.list}>
                    {column.matches.map((m) => (
                      <Row
                        key={m.id}
                        match={m}
                        open={openId === m.id}
                        onToggle={() => setOpenId(openId === m.id ? null : m.id)}
                        dict={dict}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}

export function ScoreList({
  playable,
  waiting,
  done,
  scorekeeperToken = null,
  canScore = true,
  view = 'list',
  dict,
}: {
  readonly playable: readonly MatchRow[];
  readonly waiting: readonly MatchRow[];
  readonly done: readonly MatchRow[];
  /** Set only when rendered from a scorekeeper link. */
  readonly scorekeeperToken?: string | null;
  /** INF-2. A viewer sees the results but is not offered the buttons. */
  readonly canScore?: boolean;
  /** RV-18. `list` groups by what you can do; `draw` by where it sits. */
  readonly view?: 'list' | 'draw';
  readonly dict: Dictionary;
}) {
  if (view === 'draw') {
    return (
      <ScorekeeperTokenContext.Provider value={scorekeeperToken}>
        <CanScoreContext.Provider value={canScore}>
          {/* Every match, because the draw is only a draw with its empty
              slots in it — a bracket missing the matches nobody can play
              yet is not the shape the organizer is looking at. */}
          <DrawView matches={[...playable, ...done, ...waiting]} dict={dict} />
        </CanScoreContext.Provider>
      </ScorekeeperTokenContext.Provider>
    );
  }

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
