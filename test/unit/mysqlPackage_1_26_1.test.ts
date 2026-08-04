import { computeRequiresRoot, buildDefaultInputs } from '../../src/integrations/packageTemplate';
import { mysqlPackageTemplate_1_26_1 } from '../../src/integrations/mysqlPackage_1_26_1';
import { assertTemplateIsWellFormed } from '../helpers/templateInvariants';

function input(id: string) {
  const found = mysqlPackageTemplate_1_26_1.inputs.find((i) => i.id === id);
  if (!found) throw new Error(`no such input: ${id}`);
  return found;
}

function stream(inputId: string, streamId: string) {
  const found = input(inputId).streams.find((s) => s.id === streamId);
  if (!found) throw new Error(`no such stream: ${inputId}/${streamId}`);
  return found;
}

describe('mysqlPackageTemplate_1_26_1', () => {
  it('is structurally well-formed', () => {
    assertTemplateIsWellFormed(mysqlPackageTemplate_1_26_1);
  });

  it('is package version 1.26.1, matching the published EPR package snapshot', () => {
    expect(mysqlPackageTemplate_1_26_1.name).toBe('mysql');
    expect(mysqlPackageTemplate_1_26_1.title).toBe('MySQL');
    expect(mysqlPackageTemplate_1_26_1.version).toBe('1.26.1');
  });

  it('has the three input types MySQL declares, keyed as <package>-<type>', () => {
    expect(mysqlPackageTemplate_1_26_1.inputs.map((i) => i.id).sort()).toEqual([
      'mysql-logfile',
      'mysql-mysql/metrics',
      'mysql-sql/metrics',
    ]);
  });

  it('the logfile input covers error and slowlog streams', () => {
    expect(input('mysql-logfile').streams.map((s) => s.id).sort()).toEqual(['mysql.error', 'mysql.slowlog']);
  });

  it('the logfile input has no input-level vars (matches manifest: no `vars:` key on that input type)', () => {
    expect(input('mysql-logfile').vars).toBeUndefined();
  });

  it('the mysql/metrics input covers status, performance and galera_status streams', () => {
    expect(input('mysql-mysql/metrics').streams.map((s) => s.id).sort()).toEqual([
      'mysql.galera_status',
      'mysql.performance',
      'mysql.status',
    ]);
  });

  it('the sql/metrics input covers the replica_status stream', () => {
    expect(input('mysql-sql/metrics').streams.map((s) => s.id)).toEqual(['mysql.replica_status']);
  });

  it('error/slowlog default paths match the manifest defaults', () => {
    expect(stream('mysql-logfile', 'mysql.error').vars.find((f) => f.key === 'paths')?.default).toEqual([
      '/var/log/mysql/error.log*',
      '/var/log/mysqld.log*',
    ]);
    expect(stream('mysql-logfile', 'mysql.slowlog').vars.find((f) => f.key === 'paths')?.default).toEqual([
      '/var/log/mysql/*-slow.log*',
      '/var/lib/mysql/*-slow.log*',
    ]);
  });

  it.each(['mysql.error', 'mysql.slowlog'])('%s requires paths, tags and preserve_original_event', (streamId) => {
    const s = stream('mysql-logfile', streamId);
    expect(s.vars.find((f) => f.key === 'paths')?.required).toBe(true);
    expect(s.vars.find((f) => f.key === 'tags')?.required).toBe(true);
    expect(s.vars.find((f) => f.key === 'preserve_original_event')?.required).toBe(true);
  });

  it('the mysql/metrics input requires `hosts`, defaulting to tcp(127.0.0.1:3306)/', () => {
    const hosts = input('mysql-mysql/metrics').vars?.find((f) => f.key === 'hosts');
    expect(hosts?.default).toEqual(['tcp(127.0.0.1:3306)/']);
    expect(hosts?.required).toBe(true);
  });

  it('the mysql/metrics input has username/password/ssl vars, none required, mapped to string/string/multiline', () => {
    const vars = input('mysql-mysql/metrics').vars ?? [];
    const username = vars.find((f) => f.key === 'username');
    const password = vars.find((f) => f.key === 'password');
    const ssl = vars.find((f) => f.key === 'ssl');
    expect(username).toMatchObject({ type: 'string', default: 'root' });
    expect(username?.required).toBeUndefined();
    expect(password).toMatchObject({ type: 'string', default: 'test' });
    expect(password?.required).toBeUndefined();
    expect(ssl?.type).toBe('multiline');
    expect(ssl?.required).toBeUndefined();
    expect(typeof ssl?.default).toBe('string');
    expect(ssl?.default).toContain('#certificate_authorities:');
  });

  it('the sql/metrics input requires hosts and replication_status_query, defaulting per manifest', () => {
    const vars = input('mysql-sql/metrics').vars ?? [];
    const hosts = vars.find((f) => f.key === 'hosts');
    const query = vars.find((f) => f.key === 'replication_status_query');
    expect(hosts?.default).toEqual(['username:password@tcp(localhost:3306)/']);
    expect(hosts?.required).toBe(true);
    expect(query?.default).toBe('SHOW REPLICA STATUS;');
    expect(query?.required).toBe(true);
  });

  it('status and performance streams default period=10s and raw=false, both required', () => {
    for (const streamId of ['mysql.status', 'mysql.performance']) {
      const s = stream('mysql-mysql/metrics', streamId);
      expect(s.vars.find((f) => f.key === 'period')).toMatchObject({ default: '10s', required: true });
      expect(s.vars.find((f) => f.key === 'raw')).toMatchObject({ default: false, required: true });
    }
  });

  it('galera_status defaults to disabled, matching manifest enabled:false', () => {
    expect(stream('mysql-mysql/metrics', 'mysql.galera_status').defaultEnabled).toBe(false);
  });

  it("galera_status's raw var has no required key (manifest omits `required:` on that var)", () => {
    const raw = stream('mysql-mysql/metrics', 'mysql.galera_status').vars.find((f) => f.key === 'raw');
    expect(raw).toMatchObject({ type: 'boolean', default: false });
    expect(raw?.required).toBeUndefined();
  });

  it('replica_status defaults period=10m and tags=[mysql-replica_status], both required', () => {
    const s = stream('mysql-sql/metrics', 'mysql.replica_status');
    expect(s.vars.find((f) => f.key === 'period')).toMatchObject({ default: '10m', required: true });
    expect(s.vars.find((f) => f.key === 'tags')).toMatchObject({
      default: ['mysql-replica_status'],
      required: true,
    });
  });

  it('no stream declares requiresRoot, so a new MySQL policy always computes requires_root=false', () => {
    for (const i of mysqlPackageTemplate_1_26_1.inputs) {
      for (const s of i.streams) {
        expect(s.requiresRoot).toBeFalsy();
      }
    }
    const inputs = buildDefaultInputs(mysqlPackageTemplate_1_26_1);
    expect(computeRequiresRoot(mysqlPackageTemplate_1_26_1, inputs)).toBe(false);
  });

  it('every input defaults to enabled, and every stream defaults to enabled except galera_status', () => {
    for (const i of mysqlPackageTemplate_1_26_1.inputs) {
      expect(i.defaultEnabled).toBe(true);
      for (const s of i.streams) {
        expect(s.defaultEnabled).toBe(s.id !== 'mysql.galera_status');
      }
    }
  });
});
