import { computeRequiresRoot, buildDefaultInputs } from '../../src/integrations/packageTemplate';
import { prometheusPackageTemplate_1_23_1 } from '../../src/integrations/prometheusPackage_1_23_1';
import { assertTemplateIsWellFormed } from '../helpers/templateInvariants';

function input(id: string) {
  const found = prometheusPackageTemplate_1_23_1.inputs.find((i) => i.id === id);
  if (!found) throw new Error(`no such input: ${id}`);
  return found;
}

function stream(inputId: string, streamId: string) {
  const found = input(inputId).streams.find((s) => s.id === streamId);
  if (!found) throw new Error(`no such stream: ${inputId}/${streamId}`);
  return found;
}

describe('prometheusPackageTemplate_1_23_1', () => {
  it('is structurally well-formed', () => {
    assertTemplateIsWellFormed(prometheusPackageTemplate_1_23_1);
  });

  it('is package prometheus version 1.23.1, matching the EPR manifest.yml', () => {
    expect(prometheusPackageTemplate_1_23_1.name).toBe('prometheus');
    expect(prometheusPackageTemplate_1_23_1.version).toBe('1.23.1');
    expect(prometheusPackageTemplate_1_23_1.title).toBe('Prometheus');
  });

  it('has the single prometheus/metrics input type, keyed as <package>-<type> (slash preserved)', () => {
    expect(prometheusPackageTemplate_1_23_1.inputs.map((i) => i.id)).toEqual(['prometheus-prometheus/metrics']);
  });

  it('has no input-level vars (manifest input entry has no `vars:` key at all)', () => {
    expect(input('prometheus-prometheus/metrics').vars).toBeUndefined();
  });

  it('the input covers collector, query and remote_write streams', () => {
    expect(input('prometheus-prometheus/metrics').streams.map((s) => s.id).sort()).toEqual([
      'prometheus.collector',
      'prometheus.query',
      'prometheus.remote_write',
    ]);
  });

  it('collector defaults to enabled (manifest data_stream enabled: true)', () => {
    expect(stream('prometheus-prometheus/metrics', 'prometheus.collector').defaultEnabled).toBe(true);
  });

  it('query and remote_write default to disabled (manifest data_stream enabled: false)', () => {
    expect(stream('prometheus-prometheus/metrics', 'prometheus.query').defaultEnabled).toBe(false);
    expect(stream('prometheus-prometheus/metrics', 'prometheus.remote_write').defaultEnabled).toBe(false);
  });

  it('the input defaults to enabled because collector (one of its streams) defaults to enabled', () => {
    expect(input('prometheus-prometheus/metrics').defaultEnabled).toBe(true);
  });

  it('collector requires hosts, defaulting to [localhost:9090]', () => {
    const hosts = stream('prometheus-prometheus/metrics', 'prometheus.collector').vars.find(
      (f) => f.key === 'hosts'
    );
    expect(hosts).toMatchObject({ default: ['localhost:9090'], required: true, type: 'stringArray' });
  });

  it('collector metrics_path is optional (required: false in manifest) and defaults to /metrics', () => {
    const metricsPath = stream('prometheus-prometheus/metrics', 'prometheus.collector').vars.find(
      (f) => f.key === 'metrics_path'
    );
    expect(metricsPath).toMatchObject({ default: '/metrics', type: 'string' });
    expect(metricsPath?.required).toBeUndefined();
  });

  it('collector ssl.certificate_authorities has no manifest default, so it falls back to the stringArray empty default', () => {
    const certs = stream('prometheus-prometheus/metrics', 'prometheus.collector').vars.find(
      (f) => f.key === 'ssl.certificate_authorities'
    );
    expect(certs).toMatchObject({ default: [], type: 'stringArray' });
    expect(certs?.required).toBeUndefined();
  });

  it('collector data_stream.dataset is required and defaults to prometheus.collector', () => {
    const dataset = stream('prometheus-prometheus/metrics', 'prometheus.collector').vars.find(
      (f) => f.key === 'data_stream.dataset'
    );
    expect(dataset).toMatchObject({ default: 'prometheus.collector', required: true, type: 'string' });
  });

  it('query requires queries (mapped from yaml to multiline), with the manifest default preserved', () => {
    const queries = stream('prometheus-prometheus/metrics', 'prometheus.query').vars.find(
      (f) => f.key === 'queries'
    );
    expect(queries?.type).toBe('multiline');
    expect(queries?.required).toBe(true);
    expect(queries?.default).toContain('instant_vector');
  });

  it('remote_write requires host and port, defaulting to localhost / 9201', () => {
    const s = stream('prometheus-prometheus/metrics', 'prometheus.remote_write');
    expect(s.vars.find((f) => f.key === 'host')).toMatchObject({ default: 'localhost', required: true });
    expect(s.vars.find((f) => f.key === 'port')).toMatchObject({ default: '9201', required: true });
  });

  it('remote_write ssl.certificate defaults to /etc/pki/server/cert.pem and is optional', () => {
    const cert = stream('prometheus-prometheus/metrics', 'prometheus.remote_write').vars.find(
      (f) => f.key === 'ssl.certificate'
    );
    expect(cert).toMatchObject({ default: '/etc/pki/server/cert.pem', type: 'string' });
    expect(cert?.required).toBeUndefined();
  });

  it('remote_write period defaults to 1m (distinct from collector/query which default to 10s)', () => {
    const period = stream('prometheus-prometheus/metrics', 'prometheus.remote_write').vars.find(
      (f) => f.key === 'period'
    );
    expect(period?.default).toBe('1m');
  });

  it('no stream declares requiresRoot, so a new Prometheus policy always computes requires_root=false', () => {
    for (const i of prometheusPackageTemplate_1_23_1.inputs) {
      for (const s of i.streams) {
        expect(s.requiresRoot).toBeFalsy();
      }
    }
    const inputs = buildDefaultInputs(prometheusPackageTemplate_1_23_1);
    expect(computeRequiresRoot(prometheusPackageTemplate_1_23_1, inputs)).toBe(false);
  });
});
