import { describe, it, expect } from 'vitest';
import {
  parseChannelConfig, emailRecipients, matchingRules, channelsForRules, canManageNotificationItem,
  planLegacyMigration, formatMessage, type RuleLike
} from '../notifications';

const rule = (over: Partial<RuleLike>): RuleLike => ({
  id: 'r', enabled: true, events: ['down', 'up'], allMonitors: false,
  monitorIds: [], groupIds: [], tagIds: [], channelIds: ['c1'], ...over
});
const mon = { id: 'm1', groupId: 'g1', tagIds: ['tA', 'tB'] };

describe('parseChannelConfig', () => {
  it('accepts valid configs per type', () => {
    expect(parseChannelConfig('email', { to: 'a@b.co, c@d.co' }).ok).toBe(true);
    expect(parseChannelConfig('slack', { url: 'https://hooks.slack.com/x' }).ok).toBe(true);
    expect(parseChannelConfig('telegram', { chatId: '-100123' }).ok).toBe(true);
  });
  it('rejects bad values, unknown keys and unknown types', () => {
    expect(parseChannelConfig('email', { to: 'not-an-email' }).ok).toBe(false);
    expect(parseChannelConfig('slack', { url: 'javascript:alert(1)' }).ok).toBe(false);
    expect(parseChannelConfig('slack', { url: 'https://x.co', extra: 1 }).ok).toBe(false);
    expect(parseChannelConfig('sms', { to: '1' }).ok).toBe(false);
  });
  it('splits recipient lists', () => {
    expect(emailRecipients('a@b.co; c@d.co  e@f.co')).toEqual(['a@b.co', 'c@d.co', 'e@f.co']);
  });
});

describe('matchingRules — scope', () => {
  it('matches by monitor, group, tag or allMonitors', () => {
    expect(matchingRules([rule({ monitorIds: ['m1'] })], 'down', { monitor: mon })).toHaveLength(1);
    expect(matchingRules([rule({ groupIds: ['g1'] })], 'down', { monitor: mon })).toHaveLength(1);
    expect(matchingRules([rule({ tagIds: ['tB'] })], 'down', { monitor: mon })).toHaveLength(1);
    expect(matchingRules([rule({ allMonitors: true })], 'down', { monitor: mon })).toHaveLength(1);
  });
  it('one monitor can reach two business units through two tags', () => {
    const rules = [rule({ id: 'domain', tagIds: ['tA'], channelIds: ['slack-domain'] }), rule({ id: 'unit', tagIds: ['tB'], channelIds: ['mail-unit'] })];
    const matched = matchingRules(rules, 'down', { monitor: mon });
    expect(channelsForRules(matched).map(c => c.channelId).sort()).toEqual(['mail-unit', 'slack-domain']);
  });
  it('does not match out-of-scope, disabled or unsubscribed rules', () => {
    expect(matchingRules([rule({ monitorIds: ['other'] })], 'down', { monitor: mon })).toHaveLength(0);
    expect(matchingRules([rule({ allMonitors: true, enabled: false })], 'down', { monitor: mon })).toHaveLength(0);
    expect(matchingRules([rule({ allMonitors: true, events: ['down'] })], 'degraded', { monitor: mon })).toHaveLength(0);
  });
  it('deduplicates channels shared by several rules', () => {
    const rules = [rule({ id: 'a', allMonitors: true, channelIds: ['c1', 'c2'] }), rule({ id: 'b', allMonitors: true, channelIds: ['c2'] })];
    expect(channelsForRules(matchingRules(rules, 'down', { monitor: mon }))).toEqual([{ channelId: 'c1', ruleId: 'a' }, { channelId: 'c2', ruleId: 'a' }]);
  });
});

describe('matchingRules — recovery only for incidents the rule was told about', () => {
  it('a down-only rule does not get "recovered" after a degraded incident', () => {
    const r = rule({ allMonitors: true, events: ['down', 'up'] });
    expect(matchingRules([r], 'up', { monitor: mon }, { recoveredFrom: 'degraded' })).toHaveLength(0);
    expect(matchingRules([r], 'up', { monitor: mon }, { recoveredFrom: 'down' })).toHaveLength(1);
  });
  it('location recovery goes to the set of the state being left', () => {
    const downRule = rule({ id: 'd', groupIds: ['g1'], events: ['location_down', 'location_up'] });
    const degRule = rule({ id: 'g', groupIds: ['g1'], events: ['location_degraded', 'location_up'] });
    expect(matchingRules([downRule, degRule], 'location_up', { groupId: 'g1' }, { locationRecoveredFrom: 'location_down' }).map(r => r.id)).toEqual(['d']);
  });
  it('location events use group scope, not monitor scope', () => {
    expect(matchingRules([rule({ tagIds: ['tA'], events: ['location_down'] })], 'location_down', { groupId: 'g1' })).toHaveLength(0);
    expect(matchingRules([rule({ groupIds: ['g1'], events: ['location_down'] })], 'location_down', { groupId: 'g1' })).toHaveLength(1);
  });
});

describe('canManageNotificationItem', () => {
  it('admins manage everything; members only their teams', () => {
    expect(canManageNotificationItem({ isAdmin: true, teamIds: [] }, null)).toBe(true);
    expect(canManageNotificationItem({ isAdmin: false, teamIds: ['t1'] }, 't1')).toBe(true);
    expect(canManageNotificationItem({ isAdmin: false, teamIds: ['t1'] }, 't2')).toBe(false);
    expect(canManageNotificationItem({ isAdmin: false, teamIds: ['t1'] }, null)).toBe(false);
  });
});

describe('planLegacyMigration', () => {
  it('turns per-monitor fields into shared channels and grouped rules', () => {
    const plan = planLegacyMigration([
      { id: 'm1', name: 'A', slackWebhook: 'https://hooks.slack.com/T1', alertEmail: 'ops@x.co' },
      { id: 'm2', name: 'B', slackWebhook: 'https://hooks.slack.com/T1', alertEmail: 'ops@x.co' },
      { id: 'm3', name: 'C', slackWebhook: 'https://hooks.slack.com/T1', notifyOnDegraded: true },
      { id: 'm4', name: 'D' },
      { id: 'm5', name: 'E', alertEmail: 'broken' }
    ], []);
    expect(plan.channels).toHaveLength(2); // slack + email, shared
    expect(plan.rules).toHaveLength(2);
    const r1 = plan.rules.find(r => r.monitorIds.includes('m1'))!;
    expect(r1.monitorIds).toEqual(['m1', 'm2']);
    expect(r1.events).not.toContain('degraded');
    const r2 = plan.rules.find(r => r.monitorIds.includes('m3'))!;
    expect(r2.events).toContain('degraded');
  });
  it('turns location channel sets into location rules', () => {
    const plan = planLegacyMigration([], [
      { id: 'g1', name: 'Eksim', degradedChannels: JSON.stringify({ slackWebhook: 'https://hooks.slack.com/A' }), downChannels: JSON.stringify({ alertEmail: 'oncall@x.co' }) }
    ]);
    expect(plan.rules.map(r => r.events)).toEqual([['location_degraded', 'location_up'], ['location_down', 'location_up']]);
    expect(plan.rules.every(r => r.groupIds[0] === 'g1')).toBe(true);
  });
});

describe('formatMessage', () => {
  it('contains the subject, reason and url', () => {
    const m = formatMessage('down', 'API', { url: 'https://api.x', reason: 'HTTP 500', at: new Date('2026-01-01T00:00:00Z') });
    expect(m).toContain('API'); expect(m).toContain('HTTP 500'); expect(m).toContain('https://api.x');
  });
});
