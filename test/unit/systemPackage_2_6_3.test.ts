import { computeRequiresRoot, buildDefaultInputs } from '../../src/integrations/packageTemplate';
import { systemPackageTemplate_2_6_3 } from '../../src/integrations/systemPackage_2_6_3';
import { assertTemplateIsWellFormed } from '../helpers/templateInvariants';

function input(id: string) {
  const found = systemPackageTemplate_2_6_3.inputs.find((i) => i.id === id);
  if (!found) throw new Error(`no such input: ${id}`);
  return found;
}

function stream(inputId: string, streamId: string) {
  const found = input(inputId).streams.find((s) => s.id === streamId);
  if (!found) throw new Error(`no such stream: ${inputId}/${streamId}`);
  return found;
}

describe('systemPackageTemplate_2_6_3', () => {
  it('is structurally well-formed', () => {
    assertTemplateIsWellFormed(systemPackageTemplate_2_6_3);
  });

  it('is package version 2.6.3, matching the published EPR package snapshot', () => {
    expect(systemPackageTemplate_2_6_3.name).toBe('system');
    expect(systemPackageTemplate_2_6_3.version).toBe('2.6.3');
  });

  it('has the four input types System declares, keyed as <package>-<type>', () => {
    expect(systemPackageTemplate_2_6_3.inputs.map((i) => i.id).sort()).toEqual([
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

  it('has no ntp metrics stream, same as 2.3.2 (added in a later release, present in 2.22.1)', () => {
    expect(input('system-system/metrics').streams.map((s) => s.id)).not.toContain('system.ntp');
  });

  it('has the expected metrics streams (no ntp)', () => {
    expect(input('system-system/metrics').streams.map((s) => s.id).sort()).toEqual([
      'system.core',
      'system.cpu',
      'system.diskio',
      'system.filesystem',
      'system.fsstat',
      'system.load',
      'system.memory',
      'system.network',
      'system.process',
      'system.process.summary',
      'system.socket_summary',
      'system.uptime',
    ]);
  });

  it('the logfile and journald inputs each have the auth and syslog streams', () => {
    expect(input('system-logfile').streams.map((s) => s.id).sort()).toEqual(['system.auth', 'system.syslog']);
    expect(input('system-journald').streams.map((s) => s.id).sort()).toEqual(['system.auth', 'system.syslog']);
  });

  it('the winlog input has application, security and system streams', () => {
    expect(input('system-winlog').streams.map((s) => s.id).sort()).toEqual([
      'system.application',
      'system.security',
      'system.system',
    ]);
  });

  it('system.core defaults to disabled, matching manifest enabled:false', () => {
    expect(stream('system-system/metrics', 'system.core').defaultEnabled).toBe(false);
  });

  it('system.filesystem and system.fsstat default to enabled, matching manifest enabled:true', () => {
    expect(stream('system-system/metrics', 'system.filesystem').defaultEnabled).toBe(true);
    expect(stream('system-system/metrics', 'system.fsstat').defaultEnabled).toBe(true);
  });

  it('winlog streams default to disabled (manifest has no enabled key, but Fleet UI defaults it off)', () => {
    expect(stream('system-winlog', 'system.application').defaultEnabled).toBe(false);
    expect(stream('system-winlog', 'system.security').defaultEnabled).toBe(false);
    expect(stream('system-winlog', 'system.system').defaultEnabled).toBe(false);
  });

  it("syslog's default paths don't include /var/log/maillog*", () => {
    const paths = stream('system-logfile', 'system.syslog').vars.find((f) => f.key === 'paths');
    expect(paths?.default).toEqual(['/var/log/messages*', '/var/log/syslog*', '/var/log/system*']);
  });

  it('auth paths default to /var/log/auth.log* and /var/log/secure*, and are required', () => {
    const paths = stream('system-logfile', 'system.auth').vars.find((f) => f.key === 'paths');
    expect(paths?.default).toEqual(['/var/log/auth.log*', '/var/log/secure*']);
    expect(paths?.required).toBe(true);
  });

  it('system.filesystem processors is required and has the mount-point drop_event default', () => {
    const processors = stream('system-system/metrics', 'system.filesystem').vars.find((f) => f.key === 'processors');
    expect(processors?.required).toBe(true);
    expect(processors?.default).toContain('system.filesystem.mount_point');
  });

  it('system.process has period, top-N and processes as required vars', () => {
    const proc = stream('system-system/metrics', 'system.process');
    expect(proc.vars.find((f) => f.key === 'period')?.required).toBe(true);
    expect(proc.vars.find((f) => f.key === 'process.include_top_n.by_cpu')?.required).toBe(true);
    expect(proc.vars.find((f) => f.key === 'process.include_top_n.by_memory')?.required).toBe(true);
    expect(proc.vars.find((f) => f.key === 'processes')?.required).toBe(true);
    expect(proc.vars.find((f) => f.key === 'processes')?.default).toEqual(['.*']);
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

  it("winlog's preserve_original_event is required, matching manifest required:true", () => {
    for (const streamId of ['system.application', 'system.security', 'system.system']) {
      const s = stream('system-winlog', streamId);
      expect(s.vars.find((f) => f.key === 'preserve_original_event')?.required).toBe(true);
    }
  });

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
    const inputs = buildDefaultInputs(systemPackageTemplate_2_6_3);
    expect(computeRequiresRoot(systemPackageTemplate_2_6_3, inputs)).toBe(true);
  });

  it('requires_root computes false once every root-needing stream is disabled', () => {
    const inputs = buildDefaultInputs(systemPackageTemplate_2_6_3);
    inputs['system-logfile'].streams['system.auth'].enabled = false;
    inputs['system-logfile'].streams['system.syslog'].enabled = false;
    inputs['system-journald'].streams['system.auth'].enabled = false;
    inputs['system-journald'].streams['system.syslog'].enabled = false;
    inputs['system-system/metrics'].streams['system.diskio'].enabled = false;

    expect(computeRequiresRoot(systemPackageTemplate_2_6_3, inputs)).toBe(false);
  });

  it('the logfile/journald condition defaults are complementary (mutually exclusive OS matches)', () => {
    const logfileCondition = input('system-logfile').vars?.find((f) => f.key === 'condition')?.default;
    const journaldCondition = input('system-journald').vars?.find((f) => f.key === 'condition')?.default;
    expect(typeof logfileCondition).toBe('string');
    expect(typeof journaldCondition).toBe('string');
    expect(logfileCondition).toContain('!=');
    expect(journaldCondition).toContain('==');
  });

  it('the condition strings cover Debian 13 "trixie" and per-SP SLES branches (unlike 2.3.2)', () => {
    const logfileCondition = input('system-logfile').vars?.find((f) => f.key === 'condition')?.default as string;
    expect(logfileCondition).toContain('13 (trixie)');
    expect(logfileCondition).toContain('15 SP1');
    expect(logfileCondition).toContain('15 SP7');
  });

  it('the condition strings do not yet include the "16.0" branch added in 2.22.1', () => {
    const logfileCondition = input('system-logfile').vars?.find((f) => f.key === 'condition')?.default as string;
    const journaldCondition = input('system-journald').vars?.find((f) => f.key === 'condition')?.default as string;
    expect(logfileCondition).not.toContain('16.0');
    expect(journaldCondition).not.toContain('16.0');
  });
});
