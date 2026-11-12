import { describe, expect, it } from 'vitest';
import { can, capabilitiesOf, isMemberRole, MEMBER_ROLES, type Capability } from './roles';

describe('isMemberRole', () => {
  it('accepts the four roles in the enum', () => {
    for (const role of MEMBER_ROLES) expect(isMemberRole(role)).toBe(true);
  });

  it('rejects anything else, including a plausible one', () => {
    for (const bad of ['', 'ADMIN', 'director', 'superuser', 'owner ']) {
      expect(isMemberRole(bad)).toBe(false);
    }
  });
});

describe('can', () => {
  it('lets every role see the admin side', () => {
    for (const role of MEMBER_ROLES) expect(can(role, 'admin:view')).toBe(true);
  });

  it('gives the owner everything', () => {
    const all: Capability[] = [
      'admin:view',
      'scores:write',
      'entrants:write',
      'draws:manage',
      'tournaments:manage',
      'content:manage',
      'scorekeepers:manage',
      'admins:invite',
      'players:merge',
      'destructive',
    ];
    for (const cap of all) expect(can('owner', cap)).toBe(true);
  });

  it('withholds the one irreversible action from an admin', () => {
    // Deleting a tournament takes its results with it and cannot be undone
    // anywhere in the product. That is an owner's call.
    expect(can('admin', 'destructive')).toBe(false);
    expect(can('owner', 'destructive')).toBe(true);
  });

  it('lets only owners and admins invite administrators', () => {
    expect(can('owner', 'admins:invite')).toBe(true);
    expect(can('admin', 'admins:invite')).toBe(true);
    expect(can('scorekeeper', 'admins:invite')).toBe(false);
    expect(can('viewer', 'admins:invite')).toBe(false);
    expect(can('admin', 'destructive')).toBe(false);
  });

  it('still lets an admin run the tournament', () => {
    for (const cap of ['draws:manage', 'entrants:write', 'scores:write', 'tournaments:manage'] as const) {
      expect(can('admin', cap)).toBe(true);
    }
  });

  it('confines a scorekeeper to scores', () => {
    expect(can('scorekeeper', 'scores:write')).toBe(true);
    for (const cap of [
      'entrants:write',
      'draws:manage',
      'tournaments:manage',
      'content:manage',
      'scorekeepers:manage',
      'players:merge',
      'destructive',
    ] as const) {
      expect(can('scorekeeper', cap)).toBe(false);
    }
  });

  it('gives a viewer nothing but looking', () => {
    expect(capabilitiesOf('viewer')).toEqual(['admin:view']);
    expect(can('viewer', 'scores:write')).toBe(false);
  });

  it('matches the scorekeeper LINK, so the two cannot disagree', () => {
    // A link token may record, clear and undo results and nothing else.
    // The role of the same name must mean the same thing.
    expect(capabilitiesOf('scorekeeper')).toEqual(['admin:view', 'scores:write']);
  });

  it('never grants a capability to a weaker role that a stronger one lacks', () => {
    // owner ⊇ admin ⊇ scorekeeper ⊇ viewer. A hole here is a privilege
    // inversion, which is far worse than a missing permission.
    const order = ['viewer', 'scorekeeper', 'admin', 'owner'] as const;
    for (let i = 0; i < order.length - 1; i += 1) {
      const weaker = capabilitiesOf(order[i]!);
      const stronger = capabilitiesOf(order[i + 1]!);
      for (const cap of weaker) expect(stronger).toContain(cap);
    }
  });
});
