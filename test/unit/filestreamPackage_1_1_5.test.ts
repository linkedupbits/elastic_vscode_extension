import { computeRequiresRoot, buildDefaultInputs } from '../../src/integrations/packageTemplate';
import { filestreamPackageTemplate_1_1_5 } from '../../src/integrations/filestreamPackage_1_1_5';
import { assertTemplateIsWellFormed } from '../helpers/templateInvariants';

function input(id: string) {
  const found = filestreamPackageTemplate_1_1_5.inputs.find((i) => i.id === id);
  if (!found) throw new Error(`no such input: ${id}`);
  return found;
}

function stream(inputId: string, streamId: string) {
  const found = input(inputId).streams.find((s) => s.id === streamId);
  if (!found) throw new Error(`no such stream: ${inputId}/${streamId}`);
  return found;
}

describe('filestreamPackageTemplate_1_1_5', () => {
  it('is structurally well-formed', () => {
    assertTemplateIsWellFormed(filestreamPackageTemplate_1_1_5);
  });

  it('is package version 1.1.5, matching the current upstream manifest.yml', () => {
    expect(filestreamPackageTemplate_1_1_5.name).toBe('filestream');
    expect(filestreamPackageTemplate_1_1_5.title).toBe('Custom Logs (Filestream)');
    expect(filestreamPackageTemplate_1_1_5.version).toBe('1.1.5');
  });

  it('has the single filestream input type, keyed as <package>-<type>', () => {
    expect(filestreamPackageTemplate_1_1_5.inputs.map((i) => i.id)).toEqual(['filestream-filestream']);
  });

  it('the filestream input has no input-level vars (manifest has no `vars:` key on the input)', () => {
    expect(input('filestream-filestream').vars).toBeUndefined();
  });

  it('the filestream input covers the single generic stream', () => {
    expect(input('filestream-filestream').streams.map((s) => s.id)).toEqual(['filestream.generic']);
  });

  it('paths defaults to /var/log/*.log and is required', () => {
    const paths = stream('filestream-filestream', 'filestream.generic').vars.find((f) => f.key === 'paths');
    expect(paths).toMatchObject({ type: 'stringArray', default: ['/var/log/*.log'], required: true });
  });

  it('data_stream.dataset defaults to filestream.generic and is required', () => {
    const dataset = stream('filestream-filestream', 'filestream.generic').vars.find(
      (f) => f.key === 'data_stream.dataset'
    );
    expect(dataset).toMatchObject({ type: 'string', default: 'filestream.generic', required: true });
  });

  it('exclude_files defaults to the gzip-exclusion regex, not required', () => {
    const excludeFiles = stream('filestream-filestream', 'filestream.generic').vars.find(
      (f) => f.key === 'exclude_files'
    );
    expect(excludeFiles).toMatchObject({ type: 'stringArray', default: ['\\.gz$'] });
    expect(excludeFiles?.required).toBeUndefined();
  });

  it('recursive_glob and fingerprint default to true, matching manifest defaults', () => {
    const s = stream('filestream-filestream', 'filestream.generic');
    expect(s.vars.find((f) => f.key === 'recursive_glob')).toMatchObject({ type: 'boolean', default: true });
    expect(s.vars.find((f) => f.key === 'fingerprint')).toMatchObject({ type: 'boolean', default: true });
  });

  it('fingerprint_offset/fingerprint_length map to number type with manifest defaults', () => {
    const s = stream('filestream-filestream', 'filestream.generic');
    expect(s.vars.find((f) => f.key === 'fingerprint_offset')).toMatchObject({ type: 'number', default: 0 });
    expect(s.vars.find((f) => f.key === 'fingerprint_length')).toMatchObject({ type: 'number', default: 1024 });
  });

  it('parsers and processors map to multiline type', () => {
    const s = stream('filestream-filestream', 'filestream.generic');
    expect(s.vars.find((f) => f.key === 'parsers')?.type).toBe('multiline');
    expect(s.vars.find((f) => f.key === 'processors')?.type).toBe('multiline');
    expect(s.vars.find((f) => f.key === 'processors')?.default).toBe('');
  });

  it('include_files/tags/exclude_lines/include_lines default to an empty array, not required', () => {
    const s = stream('filestream-filestream', 'filestream.generic');
    for (const key of ['include_files', 'tags', 'exclude_lines', 'include_lines']) {
      const field = s.vars.find((f) => f.key === key);
      expect(field?.default).toEqual([]);
      expect(field?.required).toBeUndefined();
    }
  });

  it('no stream declares requiresRoot, so a new Filestream policy always computes requires_root=false', () => {
    for (const i of filestreamPackageTemplate_1_1_5.inputs) {
      for (const s of i.streams) {
        expect(s.requiresRoot).toBeFalsy();
      }
    }
    const inputs = buildDefaultInputs(filestreamPackageTemplate_1_1_5);
    expect(computeRequiresRoot(filestreamPackageTemplate_1_1_5, inputs)).toBe(false);
  });

  it('the input and its stream default to enabled', () => {
    const i = input('filestream-filestream');
    expect(i.defaultEnabled).toBe(true);
    expect(i.streams[0].defaultEnabled).toBe(true);
  });
});
