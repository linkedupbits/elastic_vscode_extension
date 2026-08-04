import { computeRequiresRoot, buildDefaultInputs } from '../../src/integrations/packageTemplate';
import { phpFpmPackageTemplate_1_6_0 } from '../../src/integrations/phpFpmPackage_1_6_0';
import { assertTemplateIsWellFormed } from '../helpers/templateInvariants';

function input(id: string) {
  const found = phpFpmPackageTemplate_1_6_0.inputs.find((i) => i.id === id);
  if (!found) throw new Error(`no such input: ${id}`);
  return found;
}

function stream(inputId: string, streamId: string) {
  const found = input(inputId).streams.find((s) => s.id === streamId);
  if (!found) throw new Error(`no such stream: ${inputId}/${streamId}`);
  return found;
}

describe('phpFpmPackageTemplate_1_6_0', () => {
  it('is structurally well-formed', () => {
    assertTemplateIsWellFormed(phpFpmPackageTemplate_1_6_0);
  });

  it('is package php_fpm version 1.6.0, matching the EPR manifest.yml', () => {
    expect(phpFpmPackageTemplate_1_6_0.name).toBe('php_fpm');
    expect(phpFpmPackageTemplate_1_6_0.version).toBe('1.6.0');
    expect(phpFpmPackageTemplate_1_6_0.title).toBe('PHP-FPM');
  });

  it('has the single httpjson input type PHP-FPM declares, keyed as <package>-<type>', () => {
    expect(phpFpmPackageTemplate_1_6_0.inputs.map((i) => i.id)).toEqual(['php_fpm-httpjson']);
  });

  it('the httpjson input covers process and pool streams', () => {
    expect(input('php_fpm-httpjson').streams.map((s) => s.id).sort()).toEqual(['php_fpm.pool', 'php_fpm.process']);
  });

  it('the input-level hostname var is required and defaults to http://localhost', () => {
    const hostname = input('php_fpm-httpjson').vars?.find((f) => f.key === 'hostname');
    expect(hostname).toMatchObject({ default: 'http://localhost', required: true, type: 'string' });
  });

  it('the input-level status_path var is required and defaults to /status', () => {
    const statusPath = input('php_fpm-httpjson').vars?.find((f) => f.key === 'status_path');
    expect(statusPath).toMatchObject({ default: '/status', required: true, type: 'string' });
  });

  it('enable_request_tracer has no manifest default, so it falls back to the boolean empty default (false), and is not required', () => {
    const tracer = input('php_fpm-httpjson').vars?.find((f) => f.key === 'enable_request_tracer');
    expect(tracer).toMatchObject({ default: false, type: 'boolean' });
    expect(tracer?.required).toBeUndefined();
  });

  it('ssl is a yaml var mapped to multiline, with the manifest default preserved', () => {
    const ssl = input('php_fpm-httpjson').vars?.find((f) => f.key === 'ssl');
    expect(ssl?.type).toBe('multiline');
    expect(ssl?.default).toContain('#certificate_authorities:');
    expect(ssl?.required).toBeUndefined();
  });

  it("process and pool default tags mirror the manifest's package-specific defaults", () => {
    expect(stream('php_fpm-httpjson', 'php_fpm.process').vars.find((f) => f.key === 'tags')?.default).toEqual([
      'php_fpm-process',
      'forwarded',
    ]);
    expect(stream('php_fpm-httpjson', 'php_fpm.pool').vars.find((f) => f.key === 'tags')?.default).toEqual([
      'php_fpm-pool',
      'forwarded',
    ]);
  });

  it.each(['php_fpm.process', 'php_fpm.pool'])(
    '%s requires period, tags and preserve_original_event (all required: true in the manifest)',
    (streamId) => {
      const s = stream('php_fpm-httpjson', streamId);
      expect(s.vars.find((f) => f.key === 'period')?.required).toBe(true);
      expect(s.vars.find((f) => f.key === 'tags')?.required).toBe(true);
      expect(s.vars.find((f) => f.key === 'preserve_original_event')?.required).toBe(true);
    }
  );

  it('processors has no manifest default, so it falls back to the multiline empty default and is not required', () => {
    for (const streamId of ['php_fpm.process', 'php_fpm.pool']) {
      const processors = stream('php_fpm-httpjson', streamId).vars.find((f) => f.key === 'processors');
      expect(processors).toMatchObject({ default: '', type: 'multiline' });
      expect(processors?.required).toBeUndefined();
    }
  });

  it('no stream declares requiresRoot, so a new PHP-FPM policy always computes requires_root=false', () => {
    for (const i of phpFpmPackageTemplate_1_6_0.inputs) {
      for (const s of i.streams) {
        expect(s.requiresRoot).toBeFalsy();
      }
    }
    const inputs = buildDefaultInputs(phpFpmPackageTemplate_1_6_0);
    expect(computeRequiresRoot(phpFpmPackageTemplate_1_6_0, inputs)).toBe(false);
  });

  it('all streams default to enabled (neither data stream sets enabled: false)', () => {
    for (const i of phpFpmPackageTemplate_1_6_0.inputs) {
      expect(i.defaultEnabled).toBe(true);
      for (const s of i.streams) {
        expect(s.defaultEnabled).toBe(true);
      }
    }
  });
});
