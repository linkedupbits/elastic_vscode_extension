import {
  buildDefaultProcessorValue,
  buildProcessorJson,
  buildProcessorsJson,
  CUSTOM_PROCESSOR_ID,
  findProcessorDef,
  INGEST_PROCESSORS,
  IngestProcessorFormValue,
  parseProcessor,
  parseProcessorsFromRaw,
} from '../../src/ingest/ingestProcessorTemplate';

describe('ingestProcessorTemplate', () => {
  describe('INGEST_PROCESSORS', () => {
    it('has no duplicate processor ids', () => {
      const ids = INGEST_PROCESSORS.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('every field within a processor has a unique key', () => {
      for (const def of INGEST_PROCESSORS) {
        const keys = def.fields.map((f) => f.key);
        expect(new Set(keys).size).toBe(keys.length);
      }
    });

    it('findProcessorDef finds a known type and returns undefined for an unknown one', () => {
      expect(findProcessorDef('set')?.label).toBe('Set');
      expect(findProcessorDef('does-not-exist')).toBeUndefined();
    });
  });

  describe('buildDefaultProcessorValue', () => {
    it('defaults every field from the template for a known type', () => {
      const value = buildDefaultProcessorValue('set');
      expect(value.isCustom).toBe(false);
      expect(value.type).toBe('set');
      expect(value.fields).toEqual({ field: '', value: '', override: true, ignore_empty_value: false });
      expect(value.tag).toBe('');
      expect(value.condition).toBe('');
      expect(value.ignoreFailure).toBe(false);
    });

    it('falls back to a blank custom row for an unrecognized type id', () => {
      const value = buildDefaultProcessorValue('not-a-real-type');
      expect(value).toEqual({
        type: CUSTOM_PROCESSOR_ID,
        isCustom: true,
        customType: '',
        customConfig: '{}',
        fields: {},
        tag: '',
        condition: '',
        ignoreFailure: false,
      });
    });

    it('a processor with no fields (drop) still gets an empty fields object', () => {
      expect(buildDefaultProcessorValue('drop').fields).toEqual({});
    });
  });

  describe('parseProcessor', () => {
    it('parses a known processor type, capturing its fields', () => {
      const value = parseProcessor({ set: { field: 'event.dataset', value: 'x', override: false } });
      expect(value.isCustom).toBe(false);
      expect(value.type).toBe('set');
      expect(value.fields.field).toBe('event.dataset');
      expect(value.fields.value).toBe('x');
      expect(value.fields.override).toBe(false);
      // ignore_empty_value absent from raw -> falls back to template default.
      expect(value.fields.ignore_empty_value).toBe(false);
    });

    it('normalizes a stringArray field given as a single string', () => {
      const value = parseProcessor({ remove: { field: 'unwanted' } });
      expect(value.fields.field).toEqual(['unwanted']);
    });

    it('normalizes a stringArray field given as an array', () => {
      const value = parseProcessor({ remove: { field: ['a', 'b'] } });
      expect(value.fields.field).toEqual(['a', 'b']);
    });

    it('ignores non-string entries within a stringArray field', () => {
      const value = parseProcessor({ remove: { field: ['a', 42, 'b'] } });
      expect(value.fields.field).toEqual(['a', 'b']);
    });

    it('falls back to the field default when the raw value has the wrong JS type', () => {
      const value = parseProcessor({ set: { field: 'x', value: 'y', override: 'not-a-boolean' } });
      expect(value.fields.override).toBe(true); // template default
    });

    it('captures the common tag/if/ignore_failure properties', () => {
      const value = parseProcessor({
        set: { field: 'x', value: 'y', tag: 'my-tag', if: "ctx.foo == 'bar'", ignore_failure: true },
      });
      expect(value.tag).toBe('my-tag');
      expect(value.condition).toBe("ctx.foo == 'bar'");
      expect(value.ignoreFailure).toBe(true);
    });

    it('treats a processor whose config is not an object as having no fields', () => {
      const value = parseProcessor({ drop: null as unknown as Record<string, unknown> });
      expect(value.type).toBe('drop');
      expect(value.fields).toEqual({});
    });

    it('treats a processor object with no keys at all as an unnamed custom row', () => {
      const value = parseProcessor({});
      expect(value.isCustom).toBe(true);
      expect(value.customType).toBe('');
    });

    it('falls back to a field default when a stringArray value is entirely missing', () => {
      const value = parseProcessor({ remove: {} });
      expect(value.fields.field).toEqual([]);
    });

    it('falls back to a field default when a string-typed value is entirely missing', () => {
      const value = parseProcessor({ set: {} });
      expect(value.fields.field).toBe('');
    });

    it('falls back to a custom row for an unrecognized processor type, preserving its raw config as JSON', () => {
      const value = parseProcessor({ enrich: { policy_name: 'my-policy', field: 'ip', target_field: 'geo' } });
      expect(value.isCustom).toBe(true);
      expect(value.type).toBe(CUSTOM_PROCESSOR_ID);
      expect(value.customType).toBe('enrich');
      expect(JSON.parse(value.customConfig)).toEqual({ policy_name: 'my-policy', field: 'ip', target_field: 'geo' });
    });

    it('strips tag/if/ignore_failure out of the custom config JSON since they are shown as separate common fields', () => {
      const value = parseProcessor({
        enrich: { policy_name: 'my-policy', tag: 't', if: 'true', ignore_failure: true },
      });
      expect(JSON.parse(value.customConfig)).toEqual({ policy_name: 'my-policy' });
      expect(value.tag).toBe('t');
      expect(value.condition).toBe('true');
      expect(value.ignoreFailure).toBe(true);
    });
  });

  describe('parseProcessorsFromRaw', () => {
    it('returns [] for undefined', () => {
      expect(parseProcessorsFromRaw(undefined)).toEqual([]);
    });

    it('parses each entry in order', () => {
      const values = parseProcessorsFromRaw([{ set: { field: 'a', value: '1' } }, { remove: { field: 'a' } }]);
      expect(values.map((v) => v.type)).toEqual(['set', 'remove']);
    });
  });

  describe('buildProcessorJson', () => {
    it('builds a minimal config, omitting optional blank fields', () => {
      const value = buildDefaultProcessorValue('set');
      value.fields.field = 'event.dataset';
      value.fields.value = 'nginx';

      expect(buildProcessorJson(value, 'Processor 1')).toEqual({
        set: { field: 'event.dataset', value: 'nginx', override: true, ignore_empty_value: false },
      });
    });

    it('omits an optional blank string field entirely', () => {
      const value = buildDefaultProcessorValue('convert');
      value.fields.field = 'x';
      value.fields.type = 'integer';
      // target_field left blank

      const json = buildProcessorJson(value, 'Processor 1') as { convert: Record<string, unknown> };
      expect('target_field' in json.convert).toBe(false);
    });

    it('includes a non-empty stringArray field', () => {
      const value = buildDefaultProcessorValue('remove');
      value.fields.field = ['a', 'b'];

      expect(buildProcessorJson(value, 'Processor 1')).toEqual({ remove: { field: ['a', 'b'], ignore_missing: false } });
    });

    it('throws when a required field is blank', () => {
      const value = buildDefaultProcessorValue('set');
      expect(() => buildProcessorJson(value, 'Processor 1')).toThrow('Processor 1 (Set): "Field" is required.');
    });

    it('throws when a required field is entirely missing from `fields` (undefined)', () => {
      const value = buildDefaultProcessorValue('set');
      value.fields = {}; // simulates a malformed/older saved state missing the key entirely
      expect(() => buildProcessorJson(value, 'Processor 1')).toThrow('Processor 1 (Set): "Field" is required.');
    });

    it('throws when a required stringArray field is empty', () => {
      const value = buildDefaultProcessorValue('remove');
      expect(() => buildProcessorJson(value, 'Processor 1')).toThrow('Processor 1 (Remove): "Field(s)" is required.');
    });

    it('a processor with no fields (drop) builds an empty config object', () => {
      const value = buildDefaultProcessorValue('drop');
      expect(buildProcessorJson(value, 'Processor 1')).toEqual({ drop: {} });
    });

    it('throws for an unrecognized non-custom type (defensive)', () => {
      const value: IngestProcessorFormValue = {
        type: 'not-a-real-type',
        isCustom: false,
        customType: '',
        customConfig: '{}',
        fields: {},
        tag: '',
        condition: '',
        ignoreFailure: false,
      };
      expect(() => buildProcessorJson(value, 'Processor 1')).toThrow(
        'Processor 1: Unknown processor type "not-a-real-type".'
      );
    });

    it('appends tag/if/ignore_failure onto the built config when set', () => {
      const value = buildDefaultProcessorValue('drop');
      value.tag = ' my-tag ';
      value.condition = " ctx.foo == 'bar' ";
      value.ignoreFailure = true;

      expect(buildProcessorJson(value, 'Processor 1')).toEqual({
        drop: { tag: 'my-tag', if: "ctx.foo == 'bar'", ignore_failure: true },
      });
    });

    it('omits ignore_failure entirely when false', () => {
      const value = buildDefaultProcessorValue('drop');
      const json = buildProcessorJson(value, 'Processor 1') as { drop: Record<string, unknown> };
      expect('ignore_failure' in json.drop).toBe(false);
    });

    describe('custom processors', () => {
      it('builds from the custom type name and JSON config', () => {
        const value: IngestProcessorFormValue = {
          type: CUSTOM_PROCESSOR_ID,
          isCustom: true,
          customType: 'enrich',
          customConfig: '{"policy_name": "my-policy"}',
          fields: {},
          tag: '',
          condition: '',
          ignoreFailure: false,
        };
        expect(buildProcessorJson(value, 'Processor 1')).toEqual({ enrich: { policy_name: 'my-policy' } });
      });

      it('throws when the custom type name is blank', () => {
        const value: IngestProcessorFormValue = {
          type: CUSTOM_PROCESSOR_ID,
          isCustom: true,
          customType: '  ',
          customConfig: '{}',
          fields: {},
          tag: '',
          condition: '',
          ignoreFailure: false,
        };
        expect(() => buildProcessorJson(value, 'Processor 1')).toThrow('Processor 1: Processor Type is required.');
      });

      it('throws when the custom type name is entirely missing (undefined)', () => {
        const value: IngestProcessorFormValue = {
          type: CUSTOM_PROCESSOR_ID,
          isCustom: true,
          customType: undefined as unknown as string,
          customConfig: '{}',
          fields: {},
          tag: '',
          condition: '',
          ignoreFailure: false,
        };
        expect(() => buildProcessorJson(value, 'Processor 1')).toThrow('Processor 1: Processor Type is required.');
      });

      it('throws when the custom config is not valid JSON', () => {
        const value: IngestProcessorFormValue = {
          type: CUSTOM_PROCESSOR_ID,
          isCustom: true,
          customType: 'enrich',
          customConfig: '{ not valid json',
          fields: {},
          tag: '',
          condition: '',
          ignoreFailure: false,
        };
        expect(() => buildProcessorJson(value, 'Processor 1')).toThrow(
          'Processor 1 ("enrich"): Configuration must be valid JSON.'
        );
      });

      it('throws when the custom config parses but is not a JSON object', () => {
        const value: IngestProcessorFormValue = {
          type: CUSTOM_PROCESSOR_ID,
          isCustom: true,
          customType: 'enrich',
          customConfig: '[1, 2, 3]',
          fields: {},
          tag: '',
          condition: '',
          ignoreFailure: false,
        };
        expect(() => buildProcessorJson(value, 'Processor 1')).toThrow(
          'Processor 1 ("enrich"): Configuration must be a JSON object.'
        );
      });

      it('defaults a blank custom config to an empty object', () => {
        const value: IngestProcessorFormValue = {
          type: CUSTOM_PROCESSOR_ID,
          isCustom: true,
          customType: 'enrich',
          customConfig: '',
          fields: {},
          tag: '',
          condition: '',
          ignoreFailure: false,
        };
        expect(buildProcessorJson(value, 'Processor 1')).toEqual({ enrich: {} });
      });
    });
  });

  describe('buildProcessorsJson', () => {
    it('builds each row in order, labeling errors with a 1-based index', () => {
      const values = [buildDefaultProcessorValue('drop'), buildDefaultProcessorValue('set')];
      expect(() => buildProcessorsJson(values, 'Processor')).toThrow('Processor 2 (Set): "Field" is required.');
    });

    it('round-trips through parseProcessorsFromRaw for a realistic multi-processor pipeline', () => {
      const raw = [
        { set: { field: 'event.dataset', value: 'nginx', override: true, ignore_empty_value: false } },
        { remove: { field: ['unwanted'], ignore_missing: false } },
        { enrich: { policy_name: 'my-policy' } },
      ];
      const roundTripped = buildProcessorsJson(parseProcessorsFromRaw(raw), 'Processor');
      expect(roundTripped).toEqual(raw);
    });
  });
});
