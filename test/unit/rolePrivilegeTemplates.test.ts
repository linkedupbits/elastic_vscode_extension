import {
  ApplicationPrivilegeFormValue,
  buildApplicationPrivilegesJson,
  buildDefaultApplicationPrivilegeValue,
  buildDefaultIndexPrivilegeValue,
  buildDefaultRemoteClusterPrivilegeValue,
  buildDefaultRemoteIndexPrivilegeValue,
  buildIndexPrivilegesJson,
  buildRemoteClusterPrivilegesJson,
  buildRemoteIndexPrivilegesJson,
  IndexPrivilegeFormValue,
  parseApplicationPrivilegesFromRaw,
  parseIndexPrivilegesFromRaw,
  parseOptionalJsonObject,
  parseRemoteClusterPrivilegesFromRaw,
  parseRemoteIndexPrivilegesFromRaw,
  RemoteClusterPrivilegeFormValue,
  RemoteIndexPrivilegeFormValue,
  toStringArray,
} from '../../src/roles/rolePrivilegeTemplates';

describe('rolePrivilegeTemplates', () => {
  describe('toStringArray', () => {
    it('trims and filters blank entries', () => {
      expect(toStringArray([' a ', '', '  ', 'b'])).toEqual(['a', 'b']);
    });

    it('returns [] for a non-array value', () => {
      expect(toStringArray(undefined)).toEqual([]);
      expect(toStringArray('not-an-array')).toEqual([]);
    });
  });

  describe('parseOptionalJsonObject', () => {
    it('returns undefined for a blank string', () => {
      expect(parseOptionalJsonObject('   ', 'Metadata')).toBeUndefined();
    });

    it('parses a valid JSON object', () => {
      expect(parseOptionalJsonObject('{"a": 1}', 'Metadata')).toEqual({ a: 1 });
    });

    it('treats an entirely missing value as blank (distinct from an empty string)', () => {
      expect(parseOptionalJsonObject(undefined as unknown as string, 'Metadata')).toBeUndefined();
    });

    it('throws for malformed JSON', () => {
      expect(() => parseOptionalJsonObject('{ nope', 'Metadata')).toThrow('Metadata must be valid JSON.');
    });

    it('throws when the JSON parses but is not an object', () => {
      expect(() => parseOptionalJsonObject('[1,2]', 'Metadata')).toThrow('Metadata must be a JSON object.');
    });
  });

  describe('Index Privileges', () => {
    it('buildDefaultIndexPrivilegeValue returns a blank row', () => {
      expect(buildDefaultIndexPrivilegeValue()).toEqual({
        names: [],
        privileges: [],
        allowRestrictedIndices: false,
        fieldSecurityGrant: [],
        fieldSecurityExcept: [],
        query: '',
      });
    });

    describe('parseIndexPrivilegesFromRaw', () => {
      it('returns [] when raw is not an array', () => {
        expect(parseIndexPrivilegesFromRaw(undefined)).toEqual([]);
      });

      it('parses a full entry, defaulting a null entry to {}', () => {
        const values = parseIndexPrivilegesFromRaw([
          {
            names: ['logs-*'],
            privileges: ['read'],
            allow_restricted_indices: true,
            field_security: { grant: ['*'], except: ['secret'] },
            query: '{"match_all": {}}',
          },
          null as unknown as Record<string, unknown>,
        ]);
        expect(values[0]).toEqual({
          names: ['logs-*'],
          privileges: ['read'],
          allowRestrictedIndices: true,
          fieldSecurityGrant: ['*'],
          fieldSecurityExcept: ['secret'],
          query: '{"match_all": {}}',
        });
        expect(values[1]).toEqual(buildDefaultIndexPrivilegeValue());
      });

      it('ignores a non-object field_security value', () => {
        const values = parseIndexPrivilegesFromRaw([{ field_security: 'nope' }]);
        expect(values[0].fieldSecurityGrant).toEqual([]);
        expect(values[0].fieldSecurityExcept).toEqual([]);
      });

      it('treats a non-string query as blank', () => {
        const values = parseIndexPrivilegesFromRaw([{ query: 123 }]);
        expect(values[0].query).toBe('');
      });

      it('filters non-string entries out of names/privileges arrays', () => {
        const values = parseIndexPrivilegesFromRaw([{ names: ['a', 1, null], privileges: ['read', 2] }]);
        expect(values[0].names).toEqual(['a']);
        expect(values[0].privileges).toEqual(['read']);
      });
    });

    describe('buildIndexPrivilegesJson', () => {
      function rowValue(overrides: Partial<IndexPrivilegeFormValue> = {}): IndexPrivilegeFormValue {
        return { ...buildDefaultIndexPrivilegeValue(), ...overrides };
      }

      it('builds a minimal row with just names/privileges', () => {
        const values = [rowValue({ names: ['logs-*'], privileges: ['read'] })];
        expect(buildIndexPrivilegesJson(values, 'Index Privilege')).toEqual([{ names: ['logs-*'], privileges: ['read'] }]);
      });

      it('includes allow_restricted_indices only when true', () => {
        const values = [rowValue({ names: ['logs-*'], privileges: ['read'], allowRestrictedIndices: true })];
        expect(buildIndexPrivilegesJson(values, 'Index Privilege')[0].allow_restricted_indices).toBe(true);
      });

      it('includes field_security only with the sub-keys that are set', () => {
        const values = [
          rowValue({ names: ['logs-*'], privileges: ['read'], fieldSecurityGrant: ['*'] }),
          rowValue({ names: ['logs-*'], privileges: ['read'], fieldSecurityExcept: ['secret'] }),
        ];
        const built = buildIndexPrivilegesJson(values, 'Index Privilege');
        expect(built[0].field_security).toEqual({ grant: ['*'] });
        expect(built[1].field_security).toEqual({ except: ['secret'] });
      });

      it('includes a valid query as a string', () => {
        const values = [rowValue({ names: ['logs-*'], privileges: ['read'], query: '{"match_all": {}}' })];
        expect(buildIndexPrivilegesJson(values, 'Index Privilege')[0].query).toBe('{"match_all": {}}');
      });

      it('throws a row-labeled error when names is empty', () => {
        const values = [rowValue({ privileges: ['read'] })];
        expect(() => buildIndexPrivilegesJson(values, 'Index Privilege')).toThrow(
          'Index Privilege 1: At least one index name/pattern is required.'
        );
      });

      it('throws a row-labeled error when privileges is empty', () => {
        const values = [rowValue({ names: ['logs-*'] })];
        expect(() => buildIndexPrivilegesJson(values, 'Index Privilege')).toThrow(
          'Index Privilege 1: At least one privilege is required.'
        );
      });

      it('treats an entirely missing query as blank (distinct from an empty string)', () => {
        const values = [{ names: ['logs-*'], privileges: ['read'] } as unknown as IndexPrivilegeFormValue];
        expect(buildIndexPrivilegesJson(values, 'Index Privilege')).toEqual([{ names: ['logs-*'], privileges: ['read'] }]);
      });

      it('throws a row-labeled error for malformed query JSON', () => {
        const values = [rowValue({ names: ['logs-*'], privileges: ['read'], query: '{ nope' })];
        expect(() => buildIndexPrivilegesJson(values, 'Index Privilege')).toThrow('Index Privilege 1: Query must be valid JSON.');
      });

      it('labels errors with a 1-based row index', () => {
        const values = [
          rowValue({ names: ['logs-*'], privileges: ['read'] }),
          rowValue({ privileges: ['read'] }),
        ];
        expect(() => buildIndexPrivilegesJson(values, 'Index Privilege')).toThrow(
          'Index Privilege 2: At least one index name/pattern is required.'
        );
      });

      it('round-trips through parseIndexPrivilegesFromRaw', () => {
        const raw = [
          {
            names: ['logs-*'],
            privileges: ['read'],
            allow_restricted_indices: true,
            field_security: { grant: ['*'], except: ['secret'] },
            query: '{"match_all": {}}',
          },
        ];
        expect(buildIndexPrivilegesJson(parseIndexPrivilegesFromRaw(raw), 'Index Privilege')).toEqual(raw);
      });
    });
  });

  describe('Remote Index Privileges', () => {
    it('buildDefaultRemoteIndexPrivilegeValue includes an empty clusters list', () => {
      expect(buildDefaultRemoteIndexPrivilegeValue()).toEqual({ ...buildDefaultIndexPrivilegeValue(), clusters: [] });
    });

    it('parseRemoteIndexPrivilegesFromRaw returns [] when raw is not an array', () => {
      expect(parseRemoteIndexPrivilegesFromRaw(undefined)).toEqual([]);
    });

    it('parseRemoteIndexPrivilegesFromRaw parses clusters alongside the shared index-privilege fields', () => {
      const values = parseRemoteIndexPrivilegesFromRaw([
        { clusters: ['cluster-a'], names: ['logs-*'], privileges: ['read'] },
      ]);
      expect(values[0].clusters).toEqual(['cluster-a']);
      expect(values[0].names).toEqual(['logs-*']);
    });

    it('parseRemoteIndexPrivilegesFromRaw defaults a null entry to {}', () => {
      const values = parseRemoteIndexPrivilegesFromRaw([null as unknown as Record<string, unknown>]);
      expect(values[0]).toEqual(buildDefaultRemoteIndexPrivilegeValue());
    });

    describe('buildRemoteIndexPrivilegesJson', () => {
      function rowValue(overrides: Partial<RemoteIndexPrivilegeFormValue> = {}): RemoteIndexPrivilegeFormValue {
        return { ...buildDefaultRemoteIndexPrivilegeValue(), ...overrides };
      }

      it('builds a row with clusters plus the shared index-privilege fields', () => {
        const values = [rowValue({ clusters: ['cluster-a'], names: ['logs-*'], privileges: ['read'] })];
        expect(buildRemoteIndexPrivilegesJson(values, 'Remote Index Privilege')).toEqual([
          { clusters: ['cluster-a'], names: ['logs-*'], privileges: ['read'] },
        ]);
      });

      it('throws a row-labeled error when clusters is empty', () => {
        const values = [rowValue({ names: ['logs-*'], privileges: ['read'] })];
        expect(() => buildRemoteIndexPrivilegesJson(values, 'Remote Index Privilege')).toThrow(
          'Remote Index Privilege 1: At least one cluster is required.'
        );
      });

      it('still throws the shared index-privilege errors (e.g. missing names)', () => {
        const values = [rowValue({ clusters: ['cluster-a'], privileges: ['read'] })];
        expect(() => buildRemoteIndexPrivilegesJson(values, 'Remote Index Privilege')).toThrow(
          'Remote Index Privilege 1: At least one index name/pattern is required.'
        );
      });

      it('round-trips through parseRemoteIndexPrivilegesFromRaw', () => {
        const raw = [{ clusters: ['cluster-a'], names: ['logs-*'], privileges: ['read'] }];
        expect(buildRemoteIndexPrivilegesJson(parseRemoteIndexPrivilegesFromRaw(raw), 'Remote Index Privilege')).toEqual(raw);
      });
    });
  });

  describe('Application Privileges', () => {
    it('buildDefaultApplicationPrivilegeValue returns a blank row', () => {
      expect(buildDefaultApplicationPrivilegeValue()).toEqual({ application: '', privileges: [], resources: [] });
    });

    describe('parseApplicationPrivilegesFromRaw', () => {
      it('returns [] when raw is not an array', () => {
        expect(parseApplicationPrivilegesFromRaw(undefined)).toEqual([]);
      });

      it('parses a full entry, defaulting a null entry to {}', () => {
        const values = parseApplicationPrivilegesFromRaw([
          { application: 'kibana-.kibana', privileges: ['read'], resources: ['*'] },
          null as unknown as Record<string, unknown>,
        ]);
        expect(values[0]).toEqual({ application: 'kibana-.kibana', privileges: ['read'], resources: ['*'] });
        expect(values[1]).toEqual(buildDefaultApplicationPrivilegeValue());
      });

      it('treats a non-string application as blank', () => {
        const values = parseApplicationPrivilegesFromRaw([{ application: 42 }]);
        expect(values[0].application).toBe('');
      });
    });

    describe('buildApplicationPrivilegesJson', () => {
      function rowValue(overrides: Partial<ApplicationPrivilegeFormValue> = {}): ApplicationPrivilegeFormValue {
        return { ...buildDefaultApplicationPrivilegeValue(), ...overrides };
      }

      it('builds a valid row', () => {
        const values = [rowValue({ application: 'kibana-.kibana', privileges: ['read'], resources: ['*'] })];
        expect(buildApplicationPrivilegesJson(values, 'Application Privilege')).toEqual([
          { application: 'kibana-.kibana', privileges: ['read'], resources: ['*'] },
        ]);
      });

      it('throws a row-labeled error when application is blank', () => {
        const values = [rowValue({ privileges: ['read'], resources: ['*'] })];
        expect(() => buildApplicationPrivilegesJson(values, 'Application Privilege')).toThrow(
          'Application Privilege 1: Application is required.'
        );
      });

      it('throws when application is entirely missing (distinct from a blank string)', () => {
        const values = [{ privileges: ['read'], resources: ['*'] } as unknown as ApplicationPrivilegeFormValue];
        expect(() => buildApplicationPrivilegesJson(values, 'Application Privilege')).toThrow(
          'Application Privilege 1: Application is required.'
        );
      });

      it('throws a row-labeled error when privileges is empty', () => {
        const values = [rowValue({ application: 'kibana-.kibana', resources: ['*'] })];
        expect(() => buildApplicationPrivilegesJson(values, 'Application Privilege')).toThrow(
          'Application Privilege 1: At least one privilege is required.'
        );
      });

      it('throws a row-labeled error when resources is empty', () => {
        const values = [rowValue({ application: 'kibana-.kibana', privileges: ['read'] })];
        expect(() => buildApplicationPrivilegesJson(values, 'Application Privilege')).toThrow(
          'Application Privilege 1: At least one resource is required.'
        );
      });

      it('round-trips through parseApplicationPrivilegesFromRaw', () => {
        const raw = [{ application: 'kibana-.kibana', privileges: ['read'], resources: ['*'] }];
        expect(buildApplicationPrivilegesJson(parseApplicationPrivilegesFromRaw(raw), 'Application Privilege')).toEqual(raw);
      });
    });
  });

  describe('Remote Cluster Privileges', () => {
    it('buildDefaultRemoteClusterPrivilegeValue returns a blank row', () => {
      expect(buildDefaultRemoteClusterPrivilegeValue()).toEqual({ clusters: [], privileges: [] });
    });

    describe('parseRemoteClusterPrivilegesFromRaw', () => {
      it('returns [] when raw is not an array', () => {
        expect(parseRemoteClusterPrivilegesFromRaw(undefined)).toEqual([]);
      });

      it('parses a full entry, defaulting a null entry to {}', () => {
        const values = parseRemoteClusterPrivilegesFromRaw([
          { clusters: ['cluster-a'], privileges: ['monitor_enrich'] },
          null as unknown as Record<string, unknown>,
        ]);
        expect(values[0]).toEqual({ clusters: ['cluster-a'], privileges: ['monitor_enrich'] });
        expect(values[1]).toEqual(buildDefaultRemoteClusterPrivilegeValue());
      });
    });

    describe('buildRemoteClusterPrivilegesJson', () => {
      function rowValue(overrides: Partial<RemoteClusterPrivilegeFormValue> = {}): RemoteClusterPrivilegeFormValue {
        return { ...buildDefaultRemoteClusterPrivilegeValue(), ...overrides };
      }

      it('builds a valid row', () => {
        const values = [rowValue({ clusters: ['cluster-a'], privileges: ['monitor_enrich'] })];
        expect(buildRemoteClusterPrivilegesJson(values, 'Remote Cluster Privilege')).toEqual([
          { clusters: ['cluster-a'], privileges: ['monitor_enrich'] },
        ]);
      });

      it('throws a row-labeled error when clusters is empty', () => {
        const values = [rowValue({ privileges: ['monitor_enrich'] })];
        expect(() => buildRemoteClusterPrivilegesJson(values, 'Remote Cluster Privilege')).toThrow(
          'Remote Cluster Privilege 1: At least one cluster is required.'
        );
      });

      it('throws a row-labeled error when privileges is empty', () => {
        const values = [rowValue({ clusters: ['cluster-a'] })];
        expect(() => buildRemoteClusterPrivilegesJson(values, 'Remote Cluster Privilege')).toThrow(
          'Remote Cluster Privilege 1: At least one privilege is required.'
        );
      });

      it('round-trips through parseRemoteClusterPrivilegesFromRaw', () => {
        const raw = [{ clusters: ['cluster-a'], privileges: ['monitor_enrich'] }];
        expect(
          buildRemoteClusterPrivilegesJson(parseRemoteClusterPrivilegesFromRaw(raw), 'Remote Cluster Privilege')
        ).toEqual(raw);
      });
    });
  });
});
