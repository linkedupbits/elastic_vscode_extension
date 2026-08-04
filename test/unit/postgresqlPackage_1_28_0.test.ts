import { computeRequiresRoot, buildDefaultInputs } from '../../src/integrations/packageTemplate';
import { postgresqlPackageTemplate_1_28_0 } from '../../src/integrations/postgresqlPackage_1_28_0';
import { assertTemplateIsWellFormed } from '../helpers/templateInvariants';

function input(id: string) {
  const found = postgresqlPackageTemplate_1_28_0.inputs.find((i) => i.id === id);
  if (!found) throw new Error(`no such input: ${id}`);
  return found;
}

function stream(inputId: string, streamId: string) {
  const found = input(inputId).streams.find((s) => s.id === streamId);
  if (!found) throw new Error(`no such stream: ${inputId}/${streamId}`);
  return found;
}

describe('postgresqlPackageTemplate_1_28_0', () => {
  it('is structurally well-formed', () => {
    assertTemplateIsWellFormed(postgresqlPackageTemplate_1_28_0);
  });

  it('is package version 1.28.0, matching the published EPR package snapshot', () => {
    expect(postgresqlPackageTemplate_1_28_0.name).toBe('postgresql');
    expect(postgresqlPackageTemplate_1_28_0.version).toBe('1.28.0');
    expect(postgresqlPackageTemplate_1_28_0.title).toBe('PostgreSQL');
  });

  it('has the two input types PostgreSQL declares, keyed as <package>-<type>', () => {
    expect(postgresqlPackageTemplate_1_28_0.inputs.map((i) => i.id).sort()).toEqual([
      'postgresql-logfile',
      'postgresql-postgresql/metrics',
    ]);
  });

  it('the logfile input covers only the log stream', () => {
    expect(input('postgresql-logfile').streams.map((s) => s.id)).toEqual(['postgresql.log']);
  });

  it('the metrics input covers activity, bgwriter, database and statement streams', () => {
    expect(input('postgresql-postgresql/metrics').streams.map((s) => s.id).sort()).toEqual([
      'postgresql.activity',
      'postgresql.bgwriter',
      'postgresql.database',
      'postgresql.statement',
    ]);
  });

  it('the log stream default paths match the manifest defaults', () => {
    expect(stream('postgresql-logfile', 'postgresql.log').vars.find((f) => f.key === 'paths')?.default).toEqual([
      '/var/log/postgresql/postgresql-*-*.log*',
      '/var/log/postgresql/postgresql-*-*.csv*',
    ]);
  });

  it('the log stream requires paths, tags and preserve_original_event', () => {
    const s = stream('postgresql-logfile', 'postgresql.log');
    expect(s.vars.find((f) => f.key === 'paths')?.required).toBe(true);
    expect(s.vars.find((f) => f.key === 'tags')?.required).toBe(true);
    expect(s.vars.find((f) => f.key === 'preserve_original_event')).toMatchObject({
      default: false,
      required: true,
    });
  });

  it('the metrics input requires `hosts`, defaulting to postgres://localhost:5432', () => {
    const hosts = input('postgresql-postgresql/metrics').vars?.find((f) => f.key === 'hosts');
    expect(hosts?.default).toEqual(['postgres://localhost:5432']);
    expect(hosts?.required).toBe(true);
  });

  it('username and password are optional (manifest has no `required:` key on them)', () => {
    const metricsVars = input('postgresql-postgresql/metrics').vars ?? [];
    const username = metricsVars.find((f) => f.key === 'username');
    const password = metricsVars.find((f) => f.key === 'password');
    expect(username?.default).toBe('');
    expect(username?.required).toBeUndefined();
    expect(password?.default).toBe('');
    expect(password?.required).toBeUndefined();
  });

  it.each(['postgresql.activity', 'postgresql.bgwriter', 'postgresql.database', 'postgresql.statement'])(
    '%s defaults period=10s (required) and has a non-required processors var',
    (streamId) => {
      const s = stream('postgresql-postgresql/metrics', streamId);
      expect(s.vars.find((f) => f.key === 'period')).toMatchObject({ default: '10s', required: true });
      const processors = s.vars.find((f) => f.key === 'processors');
      expect(processors?.default).toBe('');
      expect(processors?.required).toBeUndefined();
    }
  );

  it('no stream declares requiresRoot, so a new PostgreSQL policy always computes requires_root=false', () => {
    for (const i of postgresqlPackageTemplate_1_28_0.inputs) {
      for (const s of i.streams) {
        expect(s.requiresRoot).toBeFalsy();
      }
    }
    const inputs = buildDefaultInputs(postgresqlPackageTemplate_1_28_0);
    expect(computeRequiresRoot(postgresqlPackageTemplate_1_28_0, inputs)).toBe(false);
  });

  it('all inputs and streams default to enabled (no manifest sets enabled: false)', () => {
    for (const i of postgresqlPackageTemplate_1_28_0.inputs) {
      expect(i.defaultEnabled).toBe(true);
      for (const s of i.streams) {
        expect(s.defaultEnabled).toBe(true);
      }
    }
  });
});
