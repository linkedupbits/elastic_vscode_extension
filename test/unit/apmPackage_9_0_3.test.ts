import { computeRequiresRoot, buildDefaultInputs } from '../../src/integrations/packageTemplate';
import { apmPackageTemplate_9_0_3 } from '../../src/integrations/apmPackage_9_0_3';
import { assertTemplateIsWellFormed } from '../helpers/templateInvariants';

function input(id: string) {
  const found = apmPackageTemplate_9_0_3.inputs.find((i) => i.id === id);
  if (!found) throw new Error(`no such input: ${id}`);
  return found;
}

function stream(inputId: string, streamId: string) {
  const found = input(inputId).streams.find((s) => s.id === streamId);
  if (!found) throw new Error(`no such stream: ${inputId}/${streamId}`);
  return found;
}

describe('apmPackageTemplate_9_0_3', () => {
  it('is structurally well-formed', () => {
    assertTemplateIsWellFormed(apmPackageTemplate_9_0_3);
  });

  it('is named apm, titled Elastic APM, at version 9.0.3', () => {
    expect(apmPackageTemplate_9_0_3.name).toBe('apm');
    expect(apmPackageTemplate_9_0_3.title).toBe('Elastic APM');
    expect(apmPackageTemplate_9_0_3.version).toBe('9.0.3');
  });

  it('has a single input, keyed apm-<manifestInputType> per the naming convention', () => {
    expect(apmPackageTemplate_9_0_3.inputs.map((i) => i.id)).toEqual(['apm-apm']);
  });

  it('the apm input covers a single placeholder stream (the manifest declares no data streams)', () => {
    expect(input('apm-apm').streams.map((s) => s.id)).toEqual(['apm.server']);
    expect(stream('apm-apm', 'apm.server').vars).toEqual([]);
  });

  it('both the input and its placeholder stream default to enabled', () => {
    expect(input('apm-apm').defaultEnabled).toBe(true);
    expect(stream('apm-apm', 'apm.server').defaultEnabled).toBe(true);
  });

  it('host/url default to localhost:8200, matching the raw 9.0.0-preview manifest.yml', () => {
    const vars = input('apm-apm').vars ?? [];
    expect(vars.find((f) => f.key === 'host')?.default).toBe('localhost:8200');
    expect(vars.find((f) => f.key === 'url')?.default).toBe('http://localhost:8200');
  });

  it('secret_token has no manifest default, so it defaults to the empty string', () => {
    const secretToken = input('apm-apm').vars?.find((f) => f.key === 'secret_token');
    expect(secretToken?.type).toBe('string');
    expect(secretToken?.default).toBe('');
  });

  it('enable_rum and anonymous_enabled default true; api_key_enabled defaults false', () => {
    const vars = input('apm-apm').vars ?? [];
    expect(vars.find((f) => f.key === 'enable_rum')?.default).toBe(true);
    expect(vars.find((f) => f.key === 'anonymous_enabled')?.default).toBe(true);
    expect(vars.find((f) => f.key === 'api_key_enabled')?.default).toBe(false);
  });

  it('anonymous_allow_agent is a multi:true text var, mapped to stringArray with the raw manifest default', () => {
    const field = input('apm-apm').vars?.find((f) => f.key === 'anonymous_allow_agent');
    expect(field?.type).toBe('stringArray');
    expect(field?.default).toEqual(['rum-js', 'js-base', 'iOS/swift']);
  });

  it('anonymous_allow_service is multi:true with no manifest default, so it defaults to []', () => {
    const field = input('apm-apm').vars?.find((f) => f.key === 'anonymous_allow_service');
    expect(field?.type).toBe('stringArray');
    expect(field?.default).toEqual([]);
  });

  it('anonymous_rate_limit_event_limit/ip_limit are integer vars mapped to number', () => {
    const vars = input('apm-apm').vars ?? [];
    expect(vars.find((f) => f.key === 'anonymous_rate_limit_event_limit')).toMatchObject({
      type: 'number',
      default: 300,
    });
    expect(vars.find((f) => f.key === 'anonymous_rate_limit_ip_limit')).toMatchObject({
      type: 'number',
      default: 1000,
    });
  });

  it('rum_response_headers and response_headers are yaml vars mapped to multiline, defaulting to empty', () => {
    const vars = input('apm-apm').vars ?? [];
    expect(vars.find((f) => f.key === 'rum_response_headers')).toMatchObject({ type: 'multiline', default: '' });
    expect(vars.find((f) => f.key === 'response_headers')).toMatchObject({ type: 'multiline', default: '' });
  });

  it('tail_sampling_policies (yaml, multi:true) keeps the manifest default YAML block as multiline', () => {
    const field = input('apm-apm').vars?.find((f) => f.key === 'tail_sampling_policies');
    expect(field?.type).toBe('multiline');
    expect(field?.default).toBe('- sample_rate: 0.1\n');
  });

  it('tail_sampling_enabled defaults false and tail_sampling_storage_limit defaults 0GB', () => {
    const vars = input('apm-apm').vars ?? [];
    expect(vars.find((f) => f.key === 'tail_sampling_enabled')?.default).toBe(false);
    expect(vars.find((f) => f.key === 'tail_sampling_storage_limit')?.default).toBe('0GB');
  });

  it('tls_supported_protocols defaults to TLSv1.2/TLSv1.3, matching the manifest default', () => {
    const field = input('apm-apm').vars?.find((f) => f.key === 'tls_supported_protocols');
    expect(field?.default).toEqual(['TLSv1.2', 'TLSv1.3']);
  });

  it('tls_cipher_suites and tls_curve_types are multi:true with no manifest default, so [] ', () => {
    const vars = input('apm-apm').vars ?? [];
    expect(vars.find((f) => f.key === 'tls_cipher_suites')?.default).toEqual([]);
    expect(vars.find((f) => f.key === 'tls_curve_types')?.default).toEqual([]);
  });

  it('no var in the raw manifest declares required:true, so none are marked required here', () => {
    for (const field of input('apm-apm').vars ?? []) {
      expect(field.required).toBeUndefined();
    }
  });

  it('no stream declares requiresRoot (manifest has no agent.privileges.root), so requires_root computes false', () => {
    for (const i of apmPackageTemplate_9_0_3.inputs) {
      for (const s of i.streams) {
        expect(s.requiresRoot).toBeFalsy();
      }
    }
    const inputs = buildDefaultInputs(apmPackageTemplate_9_0_3);
    expect(computeRequiresRoot(apmPackageTemplate_9_0_3, inputs)).toBe(false);
  });
});
