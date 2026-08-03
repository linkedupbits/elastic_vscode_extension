import {
  buildDefaultMappingFieldValue,
  buildDefaultMappingsFormValue,
  buildMappingFieldJson,
  buildMappingPropertiesJson,
  buildMappingsJson,
  CUSTOM_MAPPING_TYPE_ID,
  findMappingFieldType,
  IndexTemplateMappingsFormValue,
  MAPPING_FIELD_TYPES,
  MappingFieldFormValue,
  parseMappingField,
  parseMappingFieldsFromRaw,
  parseMappingsFromRaw,
} from '../../src/indexTemplates/mappingsTemplate';

describe('mappingsTemplate', () => {
  describe('findMappingFieldType', () => {
    it('finds a known type by id', () => {
      expect(findMappingFieldType('text')?.label).toBe('Text');
    });

    it('returns undefined for an unknown type', () => {
      expect(findMappingFieldType('dense_vector')).toBeUndefined();
    });
  });

  describe('buildDefaultMappingFieldValue', () => {
    it('defaults to the first curated type when no typeId is given', () => {
      const value = buildDefaultMappingFieldValue();
      expect(value.type).toBe(MAPPING_FIELD_TYPES[0].id);
      expect(value.isCustom).toBe(false);
      expect(value.name).toBe('');
    });

    it('uses the requested type and its option defaults', () => {
      const value = buildDefaultMappingFieldValue('keyword');
      expect(value.type).toBe('keyword');
      expect(value.options.ignore_above).toBe(0);
    });

    it('falls back to the first curated type for an unrecognized typeId', () => {
      const value = buildDefaultMappingFieldValue('not-a-real-type');
      expect(value.type).toBe(MAPPING_FIELD_TYPES[0].id);
    });
  });

  describe('parseMappingField', () => {
    it('parses a curated type with typed options', () => {
      const value = parseMappingField('message', { type: 'text', analyzer: 'standard' });
      expect(value).toEqual({
        name: 'message',
        type: 'text',
        isCustom: false,
        customType: '',
        customConfig: '{}',
        options: { analyzer: 'standard', add_keyword_subfield: false },
      });
    });

    it('detects an existing keyword sub-field as add_keyword_subfield: true', () => {
      const value = parseMappingField('message', {
        type: 'text',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      });
      expect(value.options.add_keyword_subfield).toBe(true);
    });

    it('parses a correctly-typed numeric option', () => {
      const value = parseMappingField('count', { type: 'keyword', ignore_above: 256 });
      expect(value.options.ignore_above).toBe(256);
    });

    it('falls back to the option default when a numeric option has the wrong JS type', () => {
      const value = parseMappingField('count', { type: 'keyword', ignore_above: 'not-a-number' });
      expect(value.options.ignore_above).toBe(0);
    });

    it('falls back to the option default when a string option has the wrong JS type', () => {
      const value = parseMappingField('created_at', { type: 'date', format: 42 });
      expect(value.options.format).toBe('');
    });

    it('a curated type with no curated options (e.g. boolean) parses to an empty options object', () => {
      const value = parseMappingField('flag', { type: 'boolean' });
      expect(value.options).toEqual({});
    });

    it('parses an uncurated type as a custom row, capturing the rest of the definition as JSON', () => {
      const value = parseMappingField('embedding', { type: 'dense_vector', dims: 384 });
      expect(value.isCustom).toBe(true);
      expect(value.type).toBe(CUSTOM_MAPPING_TYPE_ID);
      expect(value.customType).toBe('dense_vector');
      expect(JSON.parse(value.customConfig)).toEqual({ dims: 384 });
    });

    it('parses a definition with no type key as a custom row with a blank customType', () => {
      const value = parseMappingField('mystery', {});
      expect(value.isCustom).toBe(true);
      expect(value.customType).toBe('');
      expect(value.customConfig).toBe('{}');
    });
  });

  describe('parseMappingFieldsFromRaw', () => {
    it('returns [] when raw is undefined', () => {
      expect(parseMappingFieldsFromRaw(undefined)).toEqual([]);
    });

    it('parses every property, defaulting a null definition to {}', () => {
      const values = parseMappingFieldsFromRaw({
        message: { type: 'text' },
        count: null as unknown as Record<string, unknown>,
      });
      expect(values.map((v) => v.name)).toEqual(['message', 'count']);
      expect(values[1].isCustom).toBe(true);
    });
  });

  describe('buildMappingFieldJson', () => {
    it('throws when the field name is blank', () => {
      const value: MappingFieldFormValue = { name: '', type: 'text', isCustom: false, customType: '', customConfig: '{}', options: {} };
      expect(() => buildMappingFieldJson(value, 'Field 1')).toThrow('Field 1: Field Name is required.');
    });

    it('throws when the field name is entirely missing (distinct from a blank string)', () => {
      const value = { type: 'text', isCustom: false, customType: '', customConfig: '{}', options: {} } as unknown as MappingFieldFormValue;
      expect(() => buildMappingFieldJson(value, 'Field 1')).toThrow('Field 1: Field Name is required.');
    });

    it('treats an entirely missing options key as no curated options set', () => {
      const value = { name: 'status', type: 'keyword', isCustom: false, customType: '', customConfig: '{}' } as unknown as MappingFieldFormValue;
      expect(buildMappingFieldJson(value, 'Field 1')).toEqual({ type: 'keyword' });
    });

    it('builds a curated field with its typed options, omitting defaults', () => {
      const value = buildDefaultMappingFieldValue('keyword');
      value.name = 'status';
      expect(buildMappingFieldJson(value, 'Field 1')).toEqual({ type: 'keyword' });
    });

    it('includes a set numeric option', () => {
      const value = buildDefaultMappingFieldValue('keyword');
      value.name = 'status';
      value.options.ignore_above = 256;
      expect(buildMappingFieldJson(value, 'Field 1')).toEqual({ type: 'keyword', ignore_above: 256 });
    });

    it('coerces a numeric option value that arrives as a numeric string', () => {
      const value = buildDefaultMappingFieldValue('keyword');
      value.name = 'status';
      value.options.ignore_above = '256' as unknown as number;
      expect(buildMappingFieldJson(value, 'Field 1')).toEqual({ type: 'keyword', ignore_above: 256 });
    });

    it('omits a string option that is missing from the options object entirely', () => {
      const value = buildDefaultMappingFieldValue('text');
      value.name = 'message';
      value.options = { add_keyword_subfield: false };
      expect(buildMappingFieldJson(value, 'Field 1')).toEqual({ type: 'text' });
    });

    it('includes a set string option, trimmed', () => {
      const value = buildDefaultMappingFieldValue('date');
      value.name = 'created_at';
      value.options.format = '  yyyy-MM-dd  ';
      expect(buildMappingFieldJson(value, 'Field 1')).toEqual({ type: 'date', format: 'yyyy-MM-dd' });
    });

    it('adds a keyword sub-field when add_keyword_subfield is true', () => {
      const value = buildDefaultMappingFieldValue('text');
      value.name = 'message';
      value.options.add_keyword_subfield = true;
      expect(buildMappingFieldJson(value, 'Field 1')).toEqual({
        type: 'text',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      });
    });

    it('omits the keyword sub-field when add_keyword_subfield is false', () => {
      const value = buildDefaultMappingFieldValue('text');
      value.name = 'message';
      value.options.add_keyword_subfield = false;
      expect(buildMappingFieldJson(value, 'Field 1')).toEqual({ type: 'text' });
    });

    it('throws for a recognized-but-unregistered type value on a non-custom row', () => {
      const value: MappingFieldFormValue = {
        name: 'x',
        type: 'not-a-real-type',
        isCustom: false,
        customType: '',
        customConfig: '{}',
        options: {},
      };
      expect(() => buildMappingFieldJson(value, 'Field 1')).toThrow('Field 1 ("x"): Unknown field type.');
    });

    describe('custom rows', () => {
      it('throws when the custom type name is blank', () => {
        const value: MappingFieldFormValue = {
          name: 'embedding',
          type: CUSTOM_MAPPING_TYPE_ID,
          isCustom: true,
          customType: '',
          customConfig: '{}',
          options: {},
        };
        expect(() => buildMappingFieldJson(value, 'Field 1')).toThrow('Field 1 ("embedding"): Field Type is required.');
      });

      it('throws when the custom type is entirely missing (distinct from a blank string)', () => {
        const value = {
          name: 'embedding',
          type: CUSTOM_MAPPING_TYPE_ID,
          isCustom: true,
          customConfig: '{}',
          options: {},
        } as unknown as MappingFieldFormValue;
        expect(() => buildMappingFieldJson(value, 'Field 1')).toThrow('Field 1 ("embedding"): Field Type is required.');
      });

      it('treats an entirely missing custom config as an empty object', () => {
        const value = {
          name: 'embedding',
          type: CUSTOM_MAPPING_TYPE_ID,
          isCustom: true,
          customType: 'dense_vector',
          options: {},
        } as unknown as MappingFieldFormValue;
        expect(buildMappingFieldJson(value, 'Field 1')).toEqual({ type: 'dense_vector' });
      });

      it('throws when the custom config is malformed JSON', () => {
        const value: MappingFieldFormValue = {
          name: 'embedding',
          type: CUSTOM_MAPPING_TYPE_ID,
          isCustom: true,
          customType: 'dense_vector',
          customConfig: '{ not valid json',
          options: {},
        };
        expect(() => buildMappingFieldJson(value, 'Field 1')).toThrow('Field 1 ("embedding"): Configuration must be valid JSON.');
      });

      it('throws when the custom config parses but is not a JSON object', () => {
        const value: MappingFieldFormValue = {
          name: 'embedding',
          type: CUSTOM_MAPPING_TYPE_ID,
          isCustom: true,
          customType: 'dense_vector',
          customConfig: '[1, 2, 3]',
          options: {},
        };
        expect(() => buildMappingFieldJson(value, 'Field 1')).toThrow('Field 1 ("embedding"): Configuration must be a JSON object.');
      });

      it('treats a blank custom config as an empty object', () => {
        const value: MappingFieldFormValue = {
          name: 'embedding',
          type: CUSTOM_MAPPING_TYPE_ID,
          isCustom: true,
          customType: 'dense_vector',
          customConfig: '   ',
          options: {},
        };
        expect(buildMappingFieldJson(value, 'Field 1')).toEqual({ type: 'dense_vector' });
      });

      it('merges the custom config on top of the custom type', () => {
        const value: MappingFieldFormValue = {
          name: 'embedding',
          type: CUSTOM_MAPPING_TYPE_ID,
          isCustom: true,
          customType: 'dense_vector',
          customConfig: '{"dims": 384}',
          options: {},
        };
        expect(buildMappingFieldJson(value, 'Field 1')).toEqual({ type: 'dense_vector', dims: 384 });
      });
    });
  });

  describe('buildMappingPropertiesJson', () => {
    it('builds every row keyed by its trimmed name', () => {
      const values = [buildDefaultMappingFieldValue('keyword'), buildDefaultMappingFieldValue('text')];
      values[0].name = '  status  ';
      values[1].name = 'message';
      expect(buildMappingPropertiesJson(values)).toEqual({
        status: { type: 'keyword' },
        message: { type: 'text', fields: { keyword: { type: 'keyword', ignore_above: 256 } } },
      });
    });

    it('labels errors with a 1-based row index', () => {
      const values = [buildDefaultMappingFieldValue('keyword'), buildDefaultMappingFieldValue('text')];
      values[0].name = 'status';
      values[1].name = '';
      expect(() => buildMappingPropertiesJson(values)).toThrow('Field 2: Field Name is required.');
    });

    it('throws on a duplicate field name', () => {
      const values = [buildDefaultMappingFieldValue('keyword'), buildDefaultMappingFieldValue('text')];
      values[0].name = 'status';
      values[1].name = 'status';
      expect(() => buildMappingPropertiesJson(values)).toThrow('Field 2: A field named "status" is already defined.');
    });
  });

  describe('buildDefaultMappingsFormValue / parseMappingsFromRaw / buildMappingsJson', () => {
    it('buildDefaultMappingsFormValue returns an empty/default mapping', () => {
      expect(buildDefaultMappingsFormValue()).toEqual({ dynamic: '', disableSource: false, fields: [] });
    });

    it('parseMappingsFromRaw returns the defaults when raw is undefined', () => {
      expect(parseMappingsFromRaw(undefined)).toEqual(buildDefaultMappingsFormValue());
    });

    it.each([
      [true, 'true'],
      [false, 'false'],
      ['strict', 'strict'],
    ])('parses dynamic: %p as %p', (rawDynamic, expected) => {
      const value = parseMappingsFromRaw({ dynamic: rawDynamic });
      expect(value.dynamic).toBe(expected);
    });

    it('parses an unrecognized dynamic value as unset', () => {
      const value = parseMappingsFromRaw({ dynamic: 'runtime' });
      expect(value.dynamic).toBe('');
    });

    it('parses _source.enabled: false as disableSource: true', () => {
      const value = parseMappingsFromRaw({ _source: { enabled: false } });
      expect(value.disableSource).toBe(true);
    });

    it('treats a missing/enabled _source as disableSource: false', () => {
      expect(parseMappingsFromRaw({}).disableSource).toBe(false);
      expect(parseMappingsFromRaw({ _source: { enabled: true } }).disableSource).toBe(false);
    });

    it('parses properties into field rows', () => {
      const value = parseMappingsFromRaw({ properties: { message: { type: 'text' } } });
      expect(value.fields).toHaveLength(1);
      expect(value.fields[0].name).toBe('message');
    });

    it('ignores a non-object properties value', () => {
      const value = parseMappingsFromRaw({ properties: 'not-an-object' });
      expect(value.fields).toEqual([]);
    });

    function mappingsFormValue(overrides: Partial<IndexTemplateMappingsFormValue> = {}): IndexTemplateMappingsFormValue {
      return { ...buildDefaultMappingsFormValue(), ...overrides };
    }

    it('buildMappingsJson returns undefined when nothing is set', () => {
      expect(buildMappingsJson(mappingsFormValue())).toBeUndefined();
    });

    it.each([
      ['true', true],
      ['false', false],
      ['strict', 'strict'],
    ])('buildMappingsJson writes dynamic: %p as %p', (dynamic, expected) => {
      const value = mappingsFormValue({ dynamic: dynamic as IndexTemplateMappingsFormValue['dynamic'] });
      expect(buildMappingsJson(value)).toEqual({ dynamic: expected });
    });

    it('buildMappingsJson writes dynamic, _source and properties when set', () => {
      const field = buildDefaultMappingFieldValue('keyword');
      field.name = 'status';
      const value = mappingsFormValue({ dynamic: 'strict', disableSource: true, fields: [field] });
      expect(buildMappingsJson(value)).toEqual({
        dynamic: 'strict',
        _source: { enabled: false },
        properties: { status: { type: 'keyword' } },
      });
    });

    it('round-trips through parseMappingsFromRaw', () => {
      const raw = {
        dynamic: false,
        _source: { enabled: false },
        properties: { message: { type: 'text', analyzer: 'standard' } },
      };
      expect(buildMappingsJson(parseMappingsFromRaw(raw))).toEqual(raw);
    });
  });
});
