import { computeRequiresRoot, buildDefaultInputs } from '../../src/integrations/packageTemplate';
import { syntheticsPackageTemplate_1_7_0 } from '../../src/integrations/syntheticsPackage_1_7_0';
import { assertTemplateIsWellFormed } from '../helpers/templateInvariants';

function input(id: string) {
  const found = syntheticsPackageTemplate_1_7_0.inputs.find((i) => i.id === id);
  if (!found) throw new Error(`no such input: ${id}`);
  return found;
}

function stream(inputId: string, streamId: string) {
  const found = input(inputId).streams.find((s) => s.id === streamId);
  if (!found) throw new Error(`no such stream: ${inputId}/${streamId}`);
  return found;
}

describe('syntheticsPackageTemplate_1_7_0', () => {
  it('is structurally well-formed', () => {
    assertTemplateIsWellFormed(syntheticsPackageTemplate_1_7_0);
  });

  it('is package version 1.7.0, matching the published EPR package snapshot', () => {
    expect(syntheticsPackageTemplate_1_7_0.name).toBe('synthetics');
    expect(syntheticsPackageTemplate_1_7_0.version).toBe('1.7.0');
    expect(syntheticsPackageTemplate_1_7_0.title).toBe('Elastic Synthetics');
  });

  it('has the four monitor-type input types Synthetics declares, keyed as <package>-<type>', () => {
    expect(syntheticsPackageTemplate_1_7_0.inputs.map((i) => i.id).sort()).toEqual([
      'synthetics-synthetics/browser',
      'synthetics-synthetics/http',
      'synthetics-synthetics/icmp',
      'synthetics-synthetics/tcp',
    ]);
  });

  it('none of the four inputs declare input-level vars (manifest has no `vars:` key on any of them)', () => {
    for (const id of [
      'synthetics-synthetics/http',
      'synthetics-synthetics/tcp',
      'synthetics-synthetics/icmp',
      'synthetics-synthetics/browser',
    ]) {
      expect(input(id).vars).toBeUndefined();
    }
  });

  it('every input defaults to enabled', () => {
    for (const i of syntheticsPackageTemplate_1_7_0.inputs) {
      expect(i.defaultEnabled).toBe(true);
    }
  });

  it('the browser input covers browser, browser.network and browser.screenshot streams', () => {
    expect(input('synthetics-synthetics/browser').streams.map((s) => s.id).sort()).toEqual([
      'synthetics.browser',
      'synthetics.browser.network',
      'synthetics.browser.screenshot',
    ]);
  });

  it('http/tcp/icmp inputs each cover a single matching stream', () => {
    expect(input('synthetics-synthetics/http').streams.map((s) => s.id)).toEqual(['synthetics.http']);
    expect(input('synthetics-synthetics/tcp').streams.map((s) => s.id)).toEqual(['synthetics.tcp']);
    expect(input('synthetics-synthetics/icmp').streams.map((s) => s.id)).toEqual(['synthetics.icmp']);
  });

  it.each([
    ['synthetics-synthetics/http', 'synthetics.http'],
    ['synthetics-synthetics/tcp', 'synthetics.tcp'],
    ['synthetics-synthetics/icmp', 'synthetics.icmp'],
    ['synthetics-synthetics/browser', 'synthetics.browser'],
  ])(
    '%s / %s defaults to disabled, matching manifest enabled:false (Synthetics monitors are opt-in)',
    (inputId, streamId) => {
      expect(stream(inputId, streamId).defaultEnabled).toBe(false);
    }
  );

  it('browser.network and browser.screenshot default to disabled and carry no vars (manifest has none)', () => {
    for (const id of ['synthetics.browser.network', 'synthetics.browser.screenshot']) {
      const s = stream('synthetics-synthetics/browser', id);
      expect(s.defaultEnabled).toBe(false);
      expect(s.vars).toEqual([]);
    }
  });

  it.each([
    ['synthetics-synthetics/http', 'synthetics.http', 'http'],
    ['synthetics-synthetics/tcp', 'synthetics.tcp', 'tcp'],
    ['synthetics-synthetics/icmp', 'synthetics.icmp', 'icmp'],
    ['synthetics-synthetics/browser', 'synthetics.browser', 'browser'],
  ])('%s / %s: enabled/type/schedule are required, type defaults to "%s"', (inputId, streamId, monitorType) => {
    const s = stream(inputId, streamId);
    expect(s.vars.find((f) => f.key === 'enabled')).toMatchObject({ type: 'boolean', default: true, required: true });
    expect(s.vars.find((f) => f.key === 'type')).toMatchObject({
      type: 'string',
      default: monitorType,
      required: true,
    });
    expect(s.vars.find((f) => f.key === 'schedule')).toMatchObject({ default: '"@every 3m"', required: true });
  });

  it('http requires a singular `urls` string var (manifest deliberately keeps this multi:false)', () => {
    const urls = stream('synthetics-synthetics/http', 'synthetics.http').vars.find((f) => f.key === 'urls');
    expect(urls).toMatchObject({ type: 'string', default: '', required: true });
  });

  it('tcp and icmp each require a singular `hosts` string var', () => {
    expect(stream('synthetics-synthetics/tcp', 'synthetics.tcp').vars.find((f) => f.key === 'hosts')).toMatchObject({
      type: 'string',
      default: '',
      required: true,
    });
    expect(
      stream('synthetics-synthetics/icmp', 'synthetics.icmp').vars.find((f) => f.key === 'hosts')
    ).toMatchObject({ type: 'string', default: '', required: true });
  });

  it('icmp requires a `wait` var defaulting to 1s', () => {
    const wait = stream('synthetics-synthetics/icmp', 'synthetics.icmp').vars.find((f) => f.key === 'wait');
    expect(wait).toMatchObject({ default: '1s', required: true });
  });

  it('http/tcp/icmp location_name/location_id default to "Fleet managed"/"fleet_managed", not required', () => {
    for (const [inputId, streamId] of [
      ['synthetics-synthetics/http', 'synthetics.http'],
      ['synthetics-synthetics/tcp', 'synthetics.tcp'],
      ['synthetics-synthetics/icmp', 'synthetics.icmp'],
      ['synthetics-synthetics/browser', 'synthetics.browser'],
    ]) {
      const s = stream(inputId, streamId);
      expect(s.vars.find((f) => f.key === 'location_name')).toMatchObject({ default: 'Fleet managed' });
      expect(s.vars.find((f) => f.key === 'location_id')).toMatchObject({ default: 'fleet_managed' });
      expect(s.vars.find((f) => f.key === 'location_name')?.required).toBeUndefined();
      expect(s.vars.find((f) => f.key === 'location_id')?.required).toBeUndefined();
    }
  });

  it('http/tcp/icmp default ipv4/ipv6 to true and max_attempts to 2', () => {
    for (const [inputId, streamId] of [
      ['synthetics-synthetics/http', 'synthetics.http'],
      ['synthetics-synthetics/tcp', 'synthetics.tcp'],
      ['synthetics-synthetics/icmp', 'synthetics.icmp'],
    ]) {
      const s = stream(inputId, streamId);
      expect(s.vars.find((f) => f.key === 'ipv4')).toMatchObject({ type: 'boolean', default: true });
      expect(s.vars.find((f) => f.key === 'ipv6')).toMatchObject({ type: 'boolean', default: true });
      expect(s.vars.find((f) => f.key === 'max_attempts')).toMatchObject({ type: 'number', default: 2 });
    }
  });

  it('the browser stream has no mode/ipv4/ipv6 vars (manifest omits them, unlike http/tcp/icmp)', () => {
    const browser = stream('synthetics-synthetics/browser', 'synthetics.browser');
    for (const key of ['mode', 'ipv4', 'ipv6']) {
      expect(browser.vars.some((f) => f.key === key)).toBe(false);
    }
  });

  it('http keeps the manifest\'s own mislabeled vars verbatim rather than "fixing" them', () => {
    const http = stream('synthetics-synthetics/http', 'synthetics.http');
    expect(http.vars.find((f) => f.key === 'max_redirects')).toMatchObject({ type: 'number', label: 'Timeout' });
    expect(http.vars.find((f) => f.key === 'response.include_body')).toMatchObject({
      type: 'string',
      label: 'Index Response Headers',
    });
  });

  it('tcp keeps the manifest\'s own mislabeled proxy_use_local_resolver var (titled "Proxy URL") verbatim', () => {
    const tcp = stream('synthetics-synthetics/tcp', 'synthetics.tcp');
    expect(tcp.vars.find((f) => f.key === 'proxy_use_local_resolver')).toMatchObject({
      type: 'boolean',
      default: false,
      label: 'Proxy URL',
    });
  });

  it('http password (manifest type: password) maps to a string var', () => {
    const password = stream('synthetics-synthetics/http', 'synthetics.http').vars.find((f) => f.key === 'password');
    expect(password?.type).toBe('string');
    expect(password?.default).toBe('');
  });

  it('no stream declares requiresRoot, so a new Synthetics policy always computes requires_root=false', () => {
    for (const i of syntheticsPackageTemplate_1_7_0.inputs) {
      for (const s of i.streams) {
        expect(s.requiresRoot).toBeFalsy();
      }
    }
    const inputs = buildDefaultInputs(syntheticsPackageTemplate_1_7_0);
    expect(computeRequiresRoot(syntheticsPackageTemplate_1_7_0, inputs)).toBe(false);
  });
});
