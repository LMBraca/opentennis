# Entry Fees — Deferred Design

**Status:** 🅿️ **Parked. Not in v1.**
**Last updated:** 2026-11-01
**Parent:** [`../PRD.md`](../PRD.md) — listed under non-goals in §2

This document exists so fee handling can be picked up later without re-deriving it. Nothing here is built. If you're implementing v1, you can skip this file entirely.

---

## 1. The principle, if this is ever built

**No card data touches OpenTennis.** Not stored, not transmitted, not seen. The site is a **ledger**, not a payment processor.

This is a security position, not a convenience one. Accepting payments directly would pull in:

- PCI DSS scope and its audit obligations
- Chargeback and dispute handling
- Refund flows and partial refunds
- Custody of other people's money, with the regulatory surface that implies
- A permanent high-value attack target

None of that is worth it for a club tournament tool. And the actual pain point for a tournament director isn't *collecting* fees — the front desk has handled that fine for decades. It's **remembering who paid.** That's a record-keeping problem, and record-keeping is free.

---

## 2. Data model

Two additions, both small.

### Fee configuration — on `Event`

Fees vary per cell of the category grid, because they genuinely do in practice: doubles is often priced per team, the Open draw sometimes costs more, and juniors are usually cheaper.

```ts
interface EventFeeConfig {
  entryFee: number | null;            // minor units (cents). null = free
  currency: string;                   // ISO 4217, org default
  feeBasis: 'perPlayer' | 'perTeam';  // doubles: split or whole-team
  memberFee: number | null;           // optional club-member rate
}
```

`feeBasis` matters for doubles and is the detail most likely to be gotten wrong: a $40 team fee and a $20-per-player fee produce the same total but a completely different ledger, and the admin needs to know which one a given partner owes.

### Payment record — on `Entrant`

```ts
interface EntrantPayment {
  status: 'unpaid' | 'paid' | 'partial' | 'waived' | 'refunded';
  amountDue: number;                  // resolved from EventFeeConfig at accept time
  amountPaid: number;
  method: 'cash' | 'transfer' | 'cardInPerson' | 'cheque' | 'online' | 'other' | null;
  paidAt: Date | null;
  recordedBy: UserId | null;          // which admin marked it
  note: string | null;                // "paid at desk, Saturday", "comped — volunteer"
}
```

`amountDue` is **snapshotted when the entrant is accepted**, not computed live from the event config. Otherwise an admin editing a fee mid-tournament silently rewrites what forty people already owed.

`waived` is separate from `paid` on purpose. Clubs comp volunteers, juniors, and board members constantly, and a director needs the real collected total, not a number inflated by comps.

---

## 3. Collection, if a handoff is wanted

The recommended shape was **ledger plus an outbound link**:

- `Tournament.paymentUrl` — a single external URL. A Stripe Payment Link, a PayPal.me, a Venmo handle, or the club's existing payment portal.
- The public entry confirmation screen and the entrant's status page show a **Pay entry fee** button that simply navigates there.
- Checkout happens entirely on the provider's hosted page. OpenTennis sees no card data and holds no money. PCI scope remains zero.
- An admin reconciles manually: the provider's dashboard says who paid, the admin marks them paid here.

### Optional later upgrade

A webhook from the provider could auto-mark entrants as paid, removing the manual reconciliation step. This is still security-equivalent — the checkout page is still hosted by the provider, still no card data on our side — and costs one endpoint plus one signing secret.

The catch is **matching**: a Stripe payment carries whatever name and email the payer typed, which may not match the entrant record. Needs a fuzzy match on email first, then name, and an unmatched-payments queue for an admin to resolve by hand. Worth it only once manual reconciliation actually hurts.

---

## 4. What an admin actually needs

The reporting is the deliverable here, more than the data model.

- **Payments view per tournament**: every entrant, what they owe, what they've paid, method, who recorded it. Filterable to unpaid, sortable, searchable.
- **Totals**: expected, collected, outstanding, waived — broken out per category cell, because the treasurer wants to know whether the D draw paid for itself.
- **CSV export** for the club's actual bookkeeping. This will be the most-used feature in the whole section; nobody does real accounting in a tournament app.
- **Unpaid list at the point of use**: an admin generating a draw should see "3 of 16 entrants unpaid" as an advisory. Never a block — directors routinely let someone play and settle up after.
- **Per-cell fee display** on the public category grid, so entrants know the cost before submitting the entry form.

---

## 5. Known gaps this design does not solve

State these plainly if the feature is ever scoped, because each one will otherwise arrive as a surprise:

- **Refunds are entirely manual.** When a category goes `notRun` for insufficient entries, the site can mark those entrants `refunded` and export their contact list, but somebody has to actually send the money back through the provider. This compounds with the no-outbound-email decision: the admin also has to tell them.
- **No payment gating.** Nothing prevents an unpaid entrant from being drawn, scheduled, or crowned champion. Deliberate — directors need that latitude — but it means the ledger can drift from reality if nobody maintains it.
- **Partial payments are recorded, not reconciled.** `partial` exists because deposits happen, but there is no instalment schedule or balance-due tracking.
- **No multi-event discount logic.** Someone entering B Singles and C+ Doubles owes both fees independently. "Second event half price" is a common club promotion and would need real pricing rules — a much larger feature than this document describes.
- **Currency is per-organization, not per-tournament.** Fine until somebody runs an event abroad.

---

## 6. Rough effort estimate

Were this picked up as specced — ledger plus outbound link, no webhook:

| Piece | Scale |
|---|---|
| Fee config on the category grid | Small — one more panel in an existing per-cell editor |
| Payment fields + snapshot-on-accept | Small |
| Mark-paid interactions across admin views | Medium — appears in several places |
| Payments report + CSV export | Medium |
| Public fee display + pay-link button | Small |
| Webhook auto-matching | **Medium-large** — this is where the complexity actually lives, and it's the one piece worth deferring hardest |
