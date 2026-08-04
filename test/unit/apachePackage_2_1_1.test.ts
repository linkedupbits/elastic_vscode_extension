import { computeRequiresRoot, buildDefaultInputs } from '../../src/integrations/packageTemplate';
import { apachePackageTemplate_2_1_1 } from '../../src/integrations/apachePackage_2_1_1';
import { assertTemplateIsWellFormed } from '../helpers/templateInvariants';

function input(id: string) {
  const found = apachePackageTemplate_2_1_1.inputs.find((i) => i.id === id);
  if (!found) throw new Error(`no such input: ${id}`);
  return found;
}

function stream(inputId: string, streamId: string) {
  const found = input(inputId).streams.find((s) => s.id === streamId);
  if (!found) throw new Error(`no such stream: ${inputId}/${streamId}`);
  return found;
}

describe('apachePackageTemplate_2_1_1', () => {
  it('is structurally well-formed', () => {
    assertTemplateIsWellFormed(apachePackageTemplate_2_1_1);
  });

  it('is package version 2.1.1, matching the published EPR package snapshot', () => {
    expect(apachePackageTemplate_2_1_1.name).toBe('apache');
    expect(apachePackageTemplate_2_1_1.version).toBe('2.1.1');
    expect(apachePackageTemplate_2_1_1.title).toBe('Apache HTTP Server');
  });

  it('has the two input types Apache declares, keyed as <package>-<type>', () => {
    expect(apachePackageTemplate_2_1_1.inputs.map((i) => i.id).sort()).toEqual([
      'apache-apache/metrics',
      'apache-logfile',
    ]);
  });

  it('the logfile input covers access and error streams', () => {
    expect(input('apache-logfile').streams.map((s) => s.id).sort()).toEqual(['apache.access', 'apache.error']);
  });

  it('the metrics input covers the status stream', () => {
    expect(input('apache-apache/metrics').streams.map((s) => s.id)).toEqual(['apache.status']);
  });

  it('access/error default paths match the manifest defaults, unchanged from 2.0.0', () => {
    expect(stream('apache-logfile', 'apache.access').vars.find((f) => f.key === 'paths')?.default).toEqual([
      '/var/log/apache2/access.log*',
      '/var/log/apache2/other_vhosts_access.log*',
      '/var/log/httpd/access_log*',
    ]);
    expect(stream('apache-logfile', 'apache.error').vars.find((f) => f.key === 'paths')?.default).toEqual([
      '/var/log/apache2/error.log*',
      '/var/log/httpd/error_log*',
    ]);
  });

  it('the metrics input has an ssl var carrying the manifest default yaml comment block, without 2.0.0’s trailing whitespace', () => {
    const ssl = input('apache-apache/metrics').vars?.find((f) => f.key === 'ssl');
    expect(ssl?.type).toBe('multiline');
    expect(ssl?.default).toContain('#certificate_authorities:');
    expect(ssl?.default).toContain('-----BEGIN CERTIFICATE-----');
    expect(ssl?.default as string).toMatch(/-----END CERTIFICATE-----\n$/);
  });

  it('status defaults period=30s and server_status_path=/server-status, both required', () => {
    const s = stream('apache-apache/metrics', 'apache.status');
    expect(s.vars.find((f) => f.key === 'period')).toMatchObject({ default: '30s', required: true });
    expect(s.vars.find((f) => f.key === 'server_status_path')).toMatchObject({
      default: '/server-status',
      required: true,
    });
  });

  it('no stream declares requiresRoot, so a new Apache policy always computes requires_root=false', () => {
    for (const i of apachePackageTemplate_2_1_1.inputs) {
      for (const s of i.streams) {
        expect(s.requiresRoot).toBeFalsy();
      }
    }
    const inputs = buildDefaultInputs(apachePackageTemplate_2_1_1);
    expect(computeRequiresRoot(apachePackageTemplate_2_1_1, inputs)).toBe(false);
  });

  it('all inputs and streams default to enabled', () => {
    for (const i of apachePackageTemplate_2_1_1.inputs) {
      expect(i.defaultEnabled).toBe(true);
      for (const s of i.streams) {
        expect(s.defaultEnabled).toBe(true);
      }
    }
  });
});
