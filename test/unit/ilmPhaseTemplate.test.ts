import {
  buildDefaultPhasesFormValue,
  buildPhasesJson,
  hasEnabledPhase,
  ILM_PHASES,
  parsePhasesFromRaw,
} from '../../src/ilm/ilmPhaseTemplate';

describe('ilmPhaseTemplate', () => {
  describe('ILM_PHASES', () => {
    it('declares the five standard ILM phases in order', () => {
      expect(ILM_PHASES.map((p) => p.id)).toEqual(['hot', 'warm', 'cold', 'frozen', 'delete']);
    });

    it('every action id is unique within its phase', () => {
      for (const phase of ILM_PHASES) {
        const ids = phase.actions.map((a) => a.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    });
  });

  describe('buildDefaultPhasesFormValue', () => {
    it('starts every phase and action disabled', () => {
      const value = buildDefaultPhasesFormValue();
      for (const phase of ILM_PHASES) {
        expect(value[phase.id].enabled).toBe(false);
        expect(value[phase.id].min_age).toBe(phase.defaultMinAge);
        for (const action of phase.actions) {
          expect(value[phase.id].actions[action.id].enabled).toBe(false);
        }
      }
    });

    it('fields start at their template default value', () => {
      const value = buildDefaultPhasesFormValue();
      expect(value.hot.actions.set_priority.fields.priority).toBe(100);
      expect(value.hot.actions.rollover.fields.max_age).toBe('30d');
      expect(value.warm.actions.migrate.fields.enabled).toBe(true);
    });

    it('hasEnabledPhase is false for the all-disabled default', () => {
      expect(hasEnabledPhase(buildDefaultPhasesFormValue())).toBe(false);
    });
  });

  describe('parsePhasesFromRaw', () => {
    it('returns all-disabled defaults for undefined input', () => {
      expect(parsePhasesFromRaw(undefined)).toEqual(buildDefaultPhasesFormValue());
    });

    it('marks a phase enabled and captures its min_age when present in raw json', () => {
      const parsed = parsePhasesFromRaw({ hot: { min_age: '0ms', actions: {} } });
      expect(parsed.hot.enabled).toBe(true);
      expect(parsed.hot.min_age).toBe('0ms');
      expect(parsed.warm.enabled).toBe(false);
    });

    it('marks an action enabled and captures its field values', () => {
      const parsed = parsePhasesFromRaw({
        hot: {
          min_age: '0ms',
          actions: {
            rollover: { max_age: '7d', max_primary_shard_size: '25gb', max_docs: 1000 },
            set_priority: { priority: 200 },
          },
        },
      });
      expect(parsed.hot.actions.rollover.enabled).toBe(true);
      expect(parsed.hot.actions.rollover.fields).toEqual({
        max_age: '7d',
        max_primary_shard_size: '25gb',
        max_docs: 1000,
      });
      expect(parsed.hot.actions.set_priority.enabled).toBe(true);
      expect(parsed.hot.actions.set_priority.fields.priority).toBe(200);
      // Actions absent from raw json stay disabled.
      expect(parsed.hot.actions.forcemerge.enabled).toBe(false);
    });

    it('ignores a field whose raw value does not match the declared field type', () => {
      const parsed = parsePhasesFromRaw({
        hot: { actions: { set_priority: { priority: 'not-a-number' } } },
      });
      expect(parsed.hot.actions.set_priority.enabled).toBe(true);
      // Falls back to the template default rather than accepting the mistyped value.
      expect(parsed.hot.actions.set_priority.fields.priority).toBe(100);
    });

    it('treats a non-object action value as enabled but leaves its fields at their defaults', () => {
      const parsed = parsePhasesFromRaw({ hot: { actions: { rollover: true } } });
      expect(parsed.hot.actions.rollover.enabled).toBe(true);
      expect(parsed.hot.actions.rollover.fields.max_age).toBe('30d');
    });

    it('a phase with no actions object still gets marked enabled', () => {
      const parsed = parsePhasesFromRaw({ delete: { min_age: '90d' } });
      expect(parsed.delete.enabled).toBe(true);
      expect(parsed.delete.actions.delete.enabled).toBe(false);
    });
  });

  describe('buildPhasesJson', () => {
    it('omits disabled phases entirely', () => {
      const value = buildDefaultPhasesFormValue();
      value.hot.enabled = true;
      expect(buildPhasesJson(value)).toEqual({ hot: { min_age: '0ms', actions: {} } });
    });

    it('omits disabled actions within an enabled phase', () => {
      const value = buildDefaultPhasesFormValue();
      value.hot.enabled = true;
      value.hot.actions.set_priority.enabled = true;
      const json = buildPhasesJson(value);
      expect(json.hot).toEqual({ min_age: '0ms', actions: { set_priority: { priority: 100 } } });
    });

    it('omits blank string fields but keeps number/boolean fields regardless of value', () => {
      const value = buildDefaultPhasesFormValue();
      value.cold.enabled = true;
      value.cold.actions.searchable_snapshot.enabled = true;
      value.cold.actions.searchable_snapshot.fields.snapshot_repository = '';
      value.cold.actions.allocate.enabled = true;
      value.cold.actions.allocate.fields.number_of_replicas = 0;

      const json = buildPhasesJson(value) as { cold: { actions: Record<string, unknown> } };
      expect(json.cold.actions.searchable_snapshot).toEqual({});
      expect(json.cold.actions.allocate).toEqual({ number_of_replicas: 0 });
    });

    it('omits min_age when blank', () => {
      const value = buildDefaultPhasesFormValue();
      value.hot.enabled = true;
      value.hot.min_age = '   ';
      const json = buildPhasesJson(value) as { hot: Record<string, unknown> };
      expect(json.hot.min_age).toBeUndefined();
    });

    it('round-trips through parsePhasesFromRaw for a realistic multi-phase policy', () => {
      const raw = {
        hot: {
          min_age: '0ms',
          actions: {
            rollover: { max_age: '30d', max_primary_shard_size: '50gb', max_docs: 0 },
            set_priority: { priority: 100 },
          },
        },
        delete: {
          min_age: '90d',
          actions: { delete: { delete_searchable_snapshot: true } },
        },
      };
      const roundTripped = buildPhasesJson(parsePhasesFromRaw(raw));
      expect(roundTripped).toEqual(raw);
    });
  });

  describe('hasEnabledPhase', () => {
    it('is true as soon as any single phase is enabled', () => {
      const value = buildDefaultPhasesFormValue();
      value.frozen.enabled = true;
      expect(hasEnabledPhase(value)).toBe(true);
    });
  });
});
