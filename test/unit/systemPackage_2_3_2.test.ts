import { computeRequiresRoot, buildDefaultInputs } from '../../src/integrations/packageTemplate';
import { systemPackageTemplate_2_3_2 } from '../../src/integrations/systemPackage_2_3_2';
import { assertTemplateIsWellFormed } from '../helpers/templateInvariants';

function input(id: string) {
  const found = systemPackageTemplate_2_3_2.inputs.find((i) => i.id === id);
  if (!found) throw new Error(`no such input: ${id}`);
  return found;
}

function stream(inputId: string, streamId: string) {
  const found = input(inputId).streams.find((s) => s.id === streamId);
  if (!found) throw new Error(`no such stream: ${inputId}/${streamId}`);
  return found;
}

describe('systemPackageTemplate_2_3_2', () => {
  it('is structurally well-formed', () => {
    assertTemplateIsWellFormed(systemPackageTemplate_2_3_2);
  });

  it('is package version 2.3.2, matching the published EPR package snapshot', () => {
    expect(systemPackageTemplate_2_3_2.name).toBe('system');
    expect(systemPackageTemplate_2_3_2.version).toBe('2.3.2');
  });

  it('has the four input types System declares, keyed as <package>-<type>', () => {
    expect(systemPackageTemplate_2_3_2.inputs.map((i) => i.id).sort()).toEqual([
      'system-journald',
      'system-logfile',
      'system-system/metrics',
      'system-winlog',
    ]);
  });

  it('winlog has no input-level vars (matches manifest: no `vars:` key on that input type)', () => {
    expect(input('system-winlog').vars).toBeUndefined();
  });

  it('the metrics input has the system.hostfs var', () => {
    expect(input('system-system/metrics').vars?.map((f) => f.key)).toEqual(['system.hostfs']);
  });

  it('has no ntp metrics stream, unlike the newer 2.22.1 template (added in a later release)', () => {
    expect(input('system-system/metrics').streams.map((s) => s.id)).not.toContain('system.ntp');
  });

  it('system.core defaults to disabled, matching manifest enabled:false', () => {
    expect(stream('system-system/metrics', 'system.core').defaultEnabled).toBe(false);
  });

  it("syslog's default paths don't include /var/log/maillog*", () => {
    const paths = stream('system-logfile', 'system.syslog').vars.find((f) => f.key === 'paths');
    expect(paths?.default).toEqual(['/var/log/messages*', '/var/log/syslog*', '/var/log/system*']);
  });

  it.each([
    ['system-logfile', 'system.auth'],
    ['system-logfile', 'system.syslog'],
    ['system-journald', 'system.auth'],
    ['system-journald', 'system.syslog'],
    ['system-system/metrics', 'system.core'],
    ['system-system/metrics', 'system.cpu'],
    ['system-system/metrics', 'system.diskio'],
    ['system-system/metrics', 'system.load'],
    ['system-system/metrics', 'system.memory'],
    ['system-system/metrics', 'system.network'],
    ['system-system/metrics', 'system.process'],
    ['system-system/metrics', 'system.process.summary'],
    ['system-system/metrics', 'system.socket_summary'],
    ['system-system/metrics', 'system.uptime'],
  ])('%s / %s has a processors var', (inputId, streamId) => {
    expect(stream(inputId, streamId).vars.some((f) => f.key === 'processors')).toBe(true);
  });

  it.each(['system.application', 'system.security', 'system.system'])(
    '%s (winlog) has event_id and processors vars',
    (streamId) => {
      const s = stream('system-winlog', streamId);
      expect(s.vars.some((f) => f.key === 'event_id')).toBe(true);
      expect(s.vars.some((f) => f.key === 'processors')).toBe(true);
    }
  );

  describe('requiresRoot — only auth, syslog and diskio declare agent.privileges.root: true', () => {
    it.each([
      ['system-logfile', 'system.auth', true],
      ['system-logfile', 'system.syslog', true],
      ['system-journald', 'system.auth', true],
      ['system-journald', 'system.syslog', true],
      ['system-system/metrics', 'system.diskio', true],
      ['system-system/metrics', 'system.cpu', false],
      ['system-system/metrics', 'system.core', false],
      ['system-winlog', 'system.application', false],
    ] as const)('%s / %s -> requiresRoot=%s', (inputId, streamId, expected) => {
      expect(Boolean(stream(inputId, streamId).requiresRoot)).toBe(expected);
    });
  });

  it('a brand-new System policy computes requires_root=true (auth/syslog enabled by default)', () => {
    const inputs = buildDefaultInputs(systemPackageTemplate_2_3_2);
    expect(computeRequiresRoot(systemPackageTemplate_2_3_2, inputs)).toBe(true);
  });

  it('requires_root computes false once every root-needing stream is disabled', () => {
    const inputs = buildDefaultInputs(systemPackageTemplate_2_3_2);
    inputs['system-logfile'].streams['system.auth'].enabled = false;
    inputs['system-logfile'].streams['system.syslog'].enabled = false;
    inputs['system-journald'].streams['system.auth'].enabled = false;
    inputs['system-journald'].streams['system.syslog'].enabled = false;
    inputs['system-system/metrics'].streams['system.diskio'].enabled = false;

    expect(computeRequiresRoot(systemPackageTemplate_2_3_2, inputs)).toBe(false);
  });

  it('the logfile/journald condition defaults are complementary (mutually exclusive OS matches)', () => {
    const logfileCondition = input('system-logfile').vars?.find((f) => f.key === 'condition')?.default;
    const journaldCondition = input('system-journald').vars?.find((f) => f.key === 'condition')?.default;
    expect(typeof logfileCondition).toBe('string');
    expect(typeof journaldCondition).toBe('string');
    expect(logfileCondition).toContain('!=');
    expect(journaldCondition).toContain('==');
  });
});
