import { computeRequiresRoot, buildDefaultInputs } from '../../src/integrations/packageTemplate';
import { filestreamPackageTemplate_1_1_3 } from '../../src/integrations/filestreamPackage_1_1_3';
import { filestreamPackageTemplate_1_1_5 } from '../../src/integrations/filestreamPackage_1_1_5';
import { assertTemplateIsWellFormed } from '../helpers/templateInvariants';

function input(id: string) {
  const found = filestreamPackageTemplate_1_1_3.inputs.find((i) => i.id === id);
  if (!found) throw new Error(`no such input: ${id}`);
  return found;
}

function stream(inputId: string, streamId: string) {
  const found = input(inputId).streams.find((s) => s.id === streamId);
  if (!found) throw new Error(`no such stream: ${inputId}/${streamId}`);
  return found;
}

describe('filestreamPackageTemplate_1_1_3', () => {
  it('is structurally well-formed', () => {
    assertTemplateIsWellFormed(filestreamPackageTemplate_1_1_3);
  });

  it('is package version 1.1.3, matching the published EPR package snapshot', () => {
    expect(filestreamPackageTemplate_1_1_3.name).toBe('filestream');
    expect(filestreamPackageTemplate_1_1_3.title).toBe('Custom Logs (Filestream)');
    expect(filestreamPackageTemplate_1_1_3.version).toBe('1.1.3');
  });

  it('has the single filestream input type, keyed as <package>-<type>', () => {
    expect(filestreamPackageTemplate_1_1_3.inputs.map((i) => i.id)).toEqual(['filestream-filestream']);
  });

  it('the filestream input has no input-level vars (manifest has no `vars:` key on the input)', () => {
    expect(input('filestream-filestream').vars).toBeUndefined();
  });

  it('the filestream input covers the single generic stream', () => {
    expect(input('filestream-filestream').streams.map((s) => s.id)).toEqual(['filestream.generic']);
  });

  it('paths defaults to /var/log/*.log and is required, unchanged from 1.1.5', () => {
    const paths = stream('filestream-filestream', 'filestream.generic').vars.find((f) => f.key === 'paths');
    expect(paths).toMatchObject({ type: 'stringArray', default: ['/var/log/*.log'], required: true });
  });

  it('data_stream.dataset defaults to filestream.generic and is required', () => {
    const dataset = stream('filestream-filestream', 'filestream.generic').vars.find(
      (f) => f.key === 'data_stream.dataset'
    );
    expect(dataset).toMatchObject({ type: 'string', default: 'filestream.generic', required: true });
  });

  it('clean_inactive maps text-with-numeric-default to a string type, matching manifest default -1', () => {
    const cleanInactive = stream('filestream-filestream', 'filestream.generic').vars.find(
      (f) => f.key === 'clean_inactive'
    );
    expect(cleanInactive).toMatchObject({ type: 'string', default: '-1' });
  });

  it('harvester_limit maps the integer type to number, defaulting to 0', () => {
    const harvesterLimit = stream('filestream-filestream', 'filestream.generic').vars.find(
      (f) => f.key === 'harvester_limit'
    );
    expect(harvesterLimit).toMatchObject({ type: 'number', default: 0 });
  });

  it('no stream declares requiresRoot, so a new Filestream policy always computes requires_root=false', () => {
    for (const i of filestreamPackageTemplate_1_1_3.inputs) {
      for (const s of i.streams) {
        expect(s.requiresRoot).toBeFalsy();
      }
    }
    const inputs = buildDefaultInputs(filestreamPackageTemplate_1_1_3);
    expect(computeRequiresRoot(filestreamPackageTemplate_1_1_3, inputs)).toBe(false);
  });

  it('the input and its stream default to enabled', () => {
    const i = input('filestream-filestream');
    expect(i.defaultEnabled).toBe(true);
    expect(i.streams[0].defaultEnabled).toBe(true);
  });

  it('is structurally identical to the 1.1.5 sibling apart from the version string', () => {
    const stripVersion = (t: typeof filestreamPackageTemplate_1_1_3) => ({ ...t, version: undefined });
    expect(stripVersion(filestreamPackageTemplate_1_1_3)).toEqual(stripVersion(filestreamPackageTemplate_1_1_5));
  });
});
