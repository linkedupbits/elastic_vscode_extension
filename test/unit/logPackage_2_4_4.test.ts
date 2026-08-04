import { computeRequiresRoot, buildDefaultInputs } from '../../src/integrations/packageTemplate';
import { logPackageTemplate_2_4_4 } from '../../src/integrations/logPackage_2_4_4';
import { assertTemplateIsWellFormed } from '../helpers/templateInvariants';

function input(id: string) {
  const found = logPackageTemplate_2_4_4.inputs.find((i) => i.id === id);
  if (!found) throw new Error(`no such input: ${id}`);
  return found;
}

function stream(inputId: string, streamId: string) {
  const found = input(inputId).streams.find((s) => s.id === streamId);
  if (!found) throw new Error(`no such stream: ${inputId}/${streamId}`);
  return found;
}

describe('logPackageTemplate_2_4_4', () => {
  it('is structurally well-formed', () => {
    assertTemplateIsWellFormed(logPackageTemplate_2_4_4);
  });

  it('is package version 2.4.4, matching the published EPR package snapshot', () => {
    expect(logPackageTemplate_2_4_4.name).toBe('log');
    expect(logPackageTemplate_2_4_4.title).toBe('Custom Logs (Deprecated)');
    expect(logPackageTemplate_2_4_4.version).toBe('2.4.4');
  });

  it('has the single logfile input, keyed as <package>-<type>', () => {
    expect(logPackageTemplate_2_4_4.inputs.map((i) => i.id)).toEqual(['log-logfile']);
  });

  it('the logfile input has no input-level vars (this input package puts everything on the stream)', () => {
    expect(input('log-logfile').vars).toBeUndefined();
  });

  it('has a single log.logs stream', () => {
    expect(input('log-logfile').streams.map((s) => s.id)).toEqual(['log.logs']);
  });

  it('paths is required with an empty-array default (manifest: multi text, no default)', () => {
    const paths = stream('log-logfile', 'log.logs').vars.find((f) => f.key === 'paths');
    expect(paths).toMatchObject({ type: 'stringArray', default: [], required: true });
  });

  it('exclude_files is optional with an empty-array default (manifest: required: false)', () => {
    const excludeFiles = stream('log-logfile', 'log.logs').vars.find((f) => f.key === 'exclude_files');
    expect(excludeFiles).toMatchObject({ type: 'stringArray', default: [] });
    expect(excludeFiles?.required).toBeUndefined();
  });

  it('ignore_older defaults to 72h and is not required', () => {
    const ignoreOlder = stream('log-logfile', 'log.logs').vars.find((f) => f.key === 'ignore_older');
    expect(ignoreOlder).toMatchObject({ type: 'string', default: '72h' });
    expect(ignoreOlder?.required).toBeUndefined();
  });

  it('data_stream.dataset is required with an empty-string default (manifest: required, no default)', () => {
    const dataset = stream('log-logfile', 'log.logs').vars.find((f) => f.key === 'data_stream.dataset');
    expect(dataset).toMatchObject({ type: 'string', default: '', required: true });
  });

  it('processors and custom are multiline yaml vars defaulting empty', () => {
    const s = stream('log-logfile', 'log.logs');
    expect(s.vars.find((f) => f.key === 'processors')).toMatchObject({ type: 'multiline', default: '' });
    expect(s.vars.find((f) => f.key === 'custom')).toMatchObject({ type: 'multiline', default: '' });
  });

  it('no stream declares requiresRoot, so a new Custom Logs policy computes requires_root=false', () => {
    for (const i of logPackageTemplate_2_4_4.inputs) {
      for (const s of i.streams) {
        expect(s.requiresRoot).toBeFalsy();
      }
    }
    const inputs = buildDefaultInputs(logPackageTemplate_2_4_4);
    expect(computeRequiresRoot(logPackageTemplate_2_4_4, inputs)).toBe(false);
  });

  it('the input and its stream default to enabled', () => {
    expect(input('log-logfile').defaultEnabled).toBe(true);
    expect(stream('log-logfile', 'log.logs').defaultEnabled).toBe(true);
  });
});
