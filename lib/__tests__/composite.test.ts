import { describe, it, expect } from 'vitest';
import {
  evaluateGroupStatus,
  compositeTransition,
  channelSetFor,
  countableMembers,
  downMemberNames,
  compositeReason,
} from '../composite';

const up = (name: string) => ({ name, status: 'up', currentStatus: 'up' });
const down = (name: string) => ({ name, status: 'up', currentStatus: 'down' });
const paused = (name: string) => ({ name, status: 'paused', currentStatus: 'up' });
const maint = (name: string) => ({ name, status: 'up', currentStatus: 'maintenance' });

describe('evaluateGroupStatus', () => {
  it('returns null when there is nothing to evaluate', () => {
    expect(evaluateGroupStatus([])).toBeNull();
    expect(evaluateGroupStatus([paused('A'), paused('B')])).toBeNull();
    expect(evaluateGroupStatus([maint('A')])).toBeNull();
  });

  it('is up while every member is up', () => {
    expect(evaluateGroupStatus([up('A'), up('B')])).toBe('up');
  });

  it('is degraded when some but not all members are down', () => {
    expect(evaluateGroupStatus([down('A'), up('B')])).toBe('degraded');
    expect(evaluateGroupStatus([down('A'), up('B'), up('C')])).toBe('degraded');
  });

  it('is down only when every countable member is down', () => {
    expect(evaluateGroupStatus([down('A'), down('B')])).toBe('down');
    expect(evaluateGroupStatus([down('A'), down('B'), down('C')])).toBe('down');
  });

  // Tek devreli lokasyonda "kısmi kesinti" yoktur.
  it('reports a single-member group as down, never degraded', () => {
    expect(evaluateGroupStatus([down('A')])).toBe('down');
    expect(evaluateGroupStatus([up('A')])).toBe('up');
  });

  it('honours degradedThreshold before declaring degraded', () => {
    const members = [down('A'), up('B'), up('C')];
    expect(evaluateGroupStatus(members, 1)).toBe('degraded');
    expect(evaluateGroupStatus(members, 2)).toBe('up');
    expect(evaluateGroupStatus([down('A'), down('B'), up('C')], 2)).toBe('degraded');
  });

  it('treats a total outage as down even when the threshold is not met', () => {
    // Eşik 5 olsa bile hepsi düştüyse sonuç 'down' olmalı.
    expect(evaluateGroupStatus([down('A'), down('B')], 5)).toBe('down');
  });

  it('ignores paused members when deciding "all down"', () => {
    // B duraklatılmış; A tek sayılabilir üye ve o da down → lokasyon down.
    expect(evaluateGroupStatus([down('A'), paused('B')])).toBe('down');
  });

  it('ignores members in maintenance so planned work does not page anyone', () => {
    expect(evaluateGroupStatus([down('A'), maint('B')])).toBe('down');
    expect(evaluateGroupStatus([up('A'), maint('B')])).toBe('up');
  });

  it('guards against a nonsensical threshold', () => {
    expect(evaluateGroupStatus([down('A'), up('B')], 0)).toBe('degraded');
    expect(evaluateGroupStatus([down('A'), up('B')], -3)).toBe('degraded');
  });
});

describe('countableMembers', () => {
  it('drops paused and maintenance members', () => {
    const members = [up('A'), paused('B'), maint('C'), down('D')];
    expect(countableMembers(members).map((m) => m.name)).toEqual(['A', 'D']);
  });
});

describe('compositeTransition', () => {
  it('stays silent while the status is unchanged', () => {
    expect(compositeTransition('up', 'up')).toBe('none');
    expect(compositeTransition('down', 'down')).toBe('none');
    expect(compositeTransition('degraded', 'degraded')).toBe('none');
  });

  it('fires on escalation', () => {
    expect(compositeTransition('up', 'degraded')).toBe('degraded');
    expect(compositeTransition('up', 'down')).toBe('down');
    expect(compositeTransition('degraded', 'down')).toBe('down');
  });

  it('reports partial recovery as degraded, full recovery as recovered', () => {
    expect(compositeTransition('down', 'degraded')).toBe('degraded');
    expect(compositeTransition('down', 'up')).toBe('recovered');
    expect(compositeTransition('degraded', 'up')).toBe('recovered');
  });
});

describe('channelSetFor', () => {
  it('routes escalations to their own channel set', () => {
    expect(channelSetFor('down', 'up')).toBe('down');
    expect(channelSetFor('degraded', 'up')).toBe('degraded');
  });

  // Kimi uyandırdıysak "normale döndü"yü de ona söyleriz.
  it('sends the all-clear to whoever was alerted', () => {
    expect(channelSetFor('recovered', 'down')).toBe('down');
    expect(channelSetFor('recovered', 'degraded')).toBe('degraded');
  });

  it('has no channel set when nothing happened', () => {
    expect(channelSetFor('none', 'up')).toBeNull();
  });
});

describe('reason text', () => {
  it('lists the members that are down', () => {
    expect(downMemberNames([down('TT'), up('Vodafone')])).toEqual(['TT']);
    expect(downMemberNames([down('TT'), paused('Backup')])).toEqual(['TT']);
  });

  it('describes each action', () => {
    const members = [down('TT'), down('Vodafone')];
    expect(compositeReason('down', members)).toContain('All 2 member(s) are down');
    expect(compositeReason('down', members)).toContain('TT, Vodafone');
    expect(compositeReason('degraded', [down('TT'), up('Vodafone')])).toContain('1/2 member(s) down');
    expect(compositeReason('recovered', [up('TT'), up('Vodafone')])).toContain('back up');
    expect(compositeReason('none', members)).toBe('');
  });
});
