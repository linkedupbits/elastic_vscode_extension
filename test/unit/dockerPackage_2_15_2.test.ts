import { computeRequiresRoot, buildDefaultInputs } from '../../src/integrations/packageTemplate';
import { dockerPackageTemplate_2_15_2 } from '../../src/integrations/dockerPackage_2_15_2';
import { assertTemplateIsWellFormed } from '../helpers/templateInvariants';

function input(id: string) {
  const found = dockerPackageTemplate_2_15_2.inputs.find((i) => i.id === id);
  if (!found) throw new Error(`no such input: ${id}`);
  return found;
}

function stream(inputId: string, streamId: string) {
  const found = input(inputId).streams.find((s) => s.id === streamId);
  if (!found) throw new Error(`no such stream: ${inputId}/${streamId}`);
  return found;
}

describe('dockerPackageTemplate_2_15_2', () => {
  it('is structurally well-formed', () => {
    assertTemplateIsWellFormed(dockerPackageTemplate_2_15_2);
  });

  it('is package version 2.15.2, matching the published EPR package snapshot', () => {
    expect(dockerPackageTemplate_2_15_2.name).toBe('docker');
    expect(dockerPackageTemplate_2_15_2.version).toBe('2.15.2');
    expect(dockerPackageTemplate_2_15_2.title).toBe('Docker');
  });

  it('has the two input types Docker declares, keyed as <package>-<type>', () => {
    expect(dockerPackageTemplate_2_15_2.inputs.map((i) => i.id).sort()).toEqual([
      'docker-docker/metrics',
      'docker-filestream',
    ]);
  });

  it('the docker/metrics input carries the podman boolean var, defaulting false', () => {
    const podman = input('docker-docker/metrics').vars?.find((f) => f.key === 'podman');
    expect(podman).toMatchObject({ type: 'boolean', default: false });
  });

  it('the filestream input has no input-level vars (manifest has no `vars:` key on it)', () => {
    expect(input('docker-filestream').vars).toBeUndefined();
  });

  it('the docker/metrics input covers every metric stream the manifest declares', () => {
    expect(input('docker-docker/metrics').streams.map((s) => s.id).sort()).toEqual([
      'docker.container',
      'docker.cpu',
      'docker.diskio',
      'docker.event',
      'docker.healthcheck',
      'docker.image',
      'docker.info',
      'docker.memory',
      'docker.network',
    ]);
  });

  it('the filestream input covers only the container_logs stream', () => {
    expect(input('docker-filestream').streams.map((s) => s.id)).toEqual(['docker.container_logs']);
  });

  it('image is the only metrics stream that defaults to disabled (manifest enabled:false)', () => {
    expect(stream('docker-docker/metrics', 'docker.image').defaultEnabled).toBe(false);
    for (const id of ['container', 'cpu', 'diskio', 'event', 'healthcheck', 'info', 'memory', 'network']) {
      expect(stream('docker-docker/metrics', `docker.${id}`).defaultEnabled).toBe(true);
    }
  });

  it.each(['docker.container', 'docker.cpu', 'docker.diskio', 'docker.event', 'docker.healthcheck', 'docker.image', 'docker.memory', 'docker.network'])(
    '%s requires hosts and period, and has a labels.dedot var',
    (streamId) => {
      const s = stream('docker-docker/metrics', streamId);
      expect(s.vars.find((f) => f.key === 'hosts')).toMatchObject({
        default: ['unix:///var/run/docker.sock'],
        required: true,
      });
      expect(s.vars.find((f) => f.key === 'period')).toMatchObject({ default: '10s', required: true });
      expect(s.vars.find((f) => f.key === 'labels.dedot')).toMatchObject({ type: 'boolean', default: true });
    }
  );

  it('docker.info is the only metrics stream without a labels.dedot var (manifest omits it)', () => {
    expect(stream('docker-docker/metrics', 'docker.info').vars.some((f) => f.key === 'labels.dedot')).toBe(false);
  });

  it('docker.diskio has a skip_major stringArray var defaulting to ["9", "253"]', () => {
    const skipMajor = stream('docker-docker/metrics', 'docker.diskio').vars.find((f) => f.key === 'skip_major');
    expect(skipMajor).toMatchObject({ type: 'stringArray', default: ['9', '253'] });
  });

  it('container_logs requires paths and containerParserStream, and has a required additionalParsersConfig', () => {
    const s = stream('docker-filestream', 'docker.container_logs');
    expect(s.vars.find((f) => f.key === 'paths')).toMatchObject({
      default: ['/var/lib/docker/containers/${docker.container.id}/*-json.log'],
      required: true,
    });
    expect(s.vars.find((f) => f.key === 'containerParserStream')).toMatchObject({ default: 'all', required: true });
    const additionalParsersConfig = s.vars.find((f) => f.key === 'additionalParsersConfig');
    expect(additionalParsersConfig?.type).toBe('multiline');
    expect(additionalParsersConfig?.required).toBe(true);
    expect(additionalParsersConfig?.default).toContain('# - ndjson:');
  });

  it('no stream declares requiresRoot, so a new Docker policy always computes requires_root=false', () => {
    for (const i of dockerPackageTemplate_2_15_2.inputs) {
      for (const s of i.streams) {
        expect(s.requiresRoot).toBeFalsy();
      }
    }
    const inputs = buildDefaultInputs(dockerPackageTemplate_2_15_2);
    expect(computeRequiresRoot(dockerPackageTemplate_2_15_2, inputs)).toBe(false);
  });

  it('both inputs default to enabled', () => {
    for (const i of dockerPackageTemplate_2_15_2.inputs) {
      expect(i.defaultEnabled).toBe(true);
    }
  });
});
