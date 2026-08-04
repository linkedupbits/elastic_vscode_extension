import { computeRequiresRoot, buildDefaultInputs } from '../../src/integrations/packageTemplate';
import { nginxPackageTemplate_2_0_0 } from '../../src/integrations/nginxPackage_2_0_0';
import { assertTemplateIsWellFormed } from '../helpers/templateInvariants';

function input(id: string) {
  const found = nginxPackageTemplate_2_0_0.inputs.find((i) => i.id === id);
  if (!found) throw new Error(`no such input: ${id}`);
  return found;
}

function stream(inputId: string, streamId: string) {
  const found = input(inputId).streams.find((s) => s.id === streamId);
  if (!found) throw new Error(`no such stream: ${inputId}/${streamId}`);
  return found;
}

describe('nginxPackageTemplate_2_0_0', () => {
  it('is structurally well-formed', () => {
    assertTemplateIsWellFormed(nginxPackageTemplate_2_0_0);
  });

  it('is package version 2.0.0, matching the published EPR package snapshot', () => {
    expect(nginxPackageTemplate_2_0_0.name).toBe('nginx');
    expect(nginxPackageTemplate_2_0_0.title).toBe('Nginx');
    expect(nginxPackageTemplate_2_0_0.version).toBe('2.0.0');
  });

  it('has the two input types Nginx declares, keyed as <package>-<type>', () => {
    expect(nginxPackageTemplate_2_0_0.inputs.map((i) => i.id).sort()).toEqual([
      'nginx-logfile',
      'nginx-nginx/metrics',
    ]);
  });

  it('the logfile input covers access and error streams', () => {
    expect(input('nginx-logfile').streams.map((s) => s.id).sort()).toEqual(['nginx.access', 'nginx.error']);
  });

  it('the metrics input covers the stubstatus stream', () => {
    expect(input('nginx-nginx/metrics').streams.map((s) => s.id)).toEqual(['nginx.stubstatus']);
  });

  it('unlike the newer 3.2.1 template, neither input declares a `condition` var', () => {
    expect(input('nginx-logfile').vars).toBeUndefined();
    expect(input('nginx-nginx/metrics').vars?.map((f) => f.key)).toEqual(['hosts']);
  });

  it('access/error default paths match the manifest defaults', () => {
    expect(stream('nginx-logfile', 'nginx.access').vars.find((f) => f.key === 'paths')?.default).toEqual([
      '/var/log/nginx/access.log*',
    ]);
    expect(stream('nginx-logfile', 'nginx.error').vars.find((f) => f.key === 'paths')?.default).toEqual([
      '/var/log/nginx/error.log*',
    ]);
  });

  it('the metrics input requires `hosts`, defaulting to http://127.0.0.1:80', () => {
    const hosts = input('nginx-nginx/metrics').vars?.find((f) => f.key === 'hosts');
    expect(hosts?.default).toEqual(['http://127.0.0.1:80']);
    expect(hosts?.required).toBe(true);
  });

  it('stubstatus defaults period=10s and server_status_path=/nginx_status, both required', () => {
    const s = stream('nginx-nginx/metrics', 'nginx.stubstatus');
    expect(s.vars.find((f) => f.key === 'period')).toMatchObject({ default: '10s', required: true });
    expect(s.vars.find((f) => f.key === 'server_status_path')).toMatchObject({
      default: '/nginx_status',
      required: true,
    });
  });

  it.each(['nginx.access', 'nginx.error'])('%s requires paths and tags', (streamId) => {
    const s = stream('nginx-logfile', streamId);
    expect(s.vars.find((f) => f.key === 'paths')?.required).toBe(true);
    expect(s.vars.find((f) => f.key === 'tags')?.required).toBe(true);
  });

  it('no stream declares requiresRoot, so a new Nginx 2.0.0 policy always computes requires_root=false', () => {
    for (const i of nginxPackageTemplate_2_0_0.inputs) {
      for (const s of i.streams) {
        expect(s.requiresRoot).toBeFalsy();
      }
    }
    const inputs = buildDefaultInputs(nginxPackageTemplate_2_0_0);
    expect(computeRequiresRoot(nginxPackageTemplate_2_0_0, inputs)).toBe(false);
  });

  it('all streams default to enabled', () => {
    for (const i of nginxPackageTemplate_2_0_0.inputs) {
      expect(i.defaultEnabled).toBe(true);
      for (const s of i.streams) {
        expect(s.defaultEnabled).toBe(true);
      }
    }
  });
});
