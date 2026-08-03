import {
  buildDefaultSettingsFormValue,
  buildSettingsJson,
  INDEX_TEMPLATE_SETTINGS_FIELDS,
  IndexTemplateSettingsFormValue,
  parseSettingsFromRaw,
} from '../../src/indexTemplates/settingsTemplate';

describe('settingsTemplate', () => {
  describe('buildDefaultSettingsFormValue', () => {
    it('returns a blank string for every curated field and an empty advanced value', () => {
      const value = buildDefaultSettingsFormValue();
      for (const field of INDEX_TEMPLATE_SETTINGS_FIELDS) {
        expect(value.fields[field.key]).toBe('');
      }
      expect(value.advanced).toBe('');
    });
  });

  describe('parseSettingsFromRaw', () => {
    it('returns the defaults when raw is undefined', () => {
      const value = parseSettingsFromRaw(undefined);
      expect(value).toEqual(buildDefaultSettingsFormValue());
    });

    it('parses each curated field into its string form', () => {
      const value = parseSettingsFromRaw({
        number_of_shards: 3,
        number_of_replicas: 1,
        refresh_interval: '30s',
        codec: 'best_compression',
        'index.lifecycle.name': 'logs-policy',
        'index.mapping.total_fields.limit': 2000,
      });
      expect(value.fields.number_of_shards).toBe('3');
      expect(value.fields.number_of_replicas).toBe('1');
      expect(value.fields.refresh_interval).toBe('30s');
      expect(value.fields.codec).toBe('best_compression');
      expect(value.fields['index.lifecycle.name']).toBe('logs-policy');
      expect(value.fields['index.mapping.total_fields.limit']).toBe('2000');
      expect(value.advanced).toBe('');
    });

    it('ignores a select field value that is not one of the known options', () => {
      const value = parseSettingsFromRaw({ codec: 'zstd' });
      expect(value.fields.codec).toBe('');
      expect(value.advanced).toBe(JSON.stringify({ codec: 'zstd' }, null, 2));
    });

    it('ignores a curated key whose value is null or undefined', () => {
      const value = parseSettingsFromRaw({ number_of_shards: null });
      expect(value.fields.number_of_shards).toBe('');
    });

    it('puts every unrecognized key into the advanced JSON blob', () => {
      const value = parseSettingsFromRaw({
        number_of_shards: 1,
        'index.number_of_routing_shards': 30,
        'sort.field': 'timestamp',
      });
      expect(value.fields.number_of_shards).toBe('1');
      expect(JSON.parse(value.advanced)).toEqual({
        'index.number_of_routing_shards': 30,
        'sort.field': 'timestamp',
      });
    });

    it('leaves advanced empty when every key is curated', () => {
      const value = parseSettingsFromRaw({ number_of_shards: 1 });
      expect(value.advanced).toBe('');
    });
  });

  describe('buildSettingsJson', () => {
    function formValue(overrides: Partial<IndexTemplateSettingsFormValue> = {}): IndexTemplateSettingsFormValue {
      return { ...buildDefaultSettingsFormValue(), ...overrides };
    }

    it('returns undefined when nothing is set', () => {
      expect(buildSettingsJson(formValue())).toBeUndefined();
    });

    it('writes every non-blank curated field, coercing numbers', () => {
      const value = formValue({
        fields: {
          number_of_shards: '3',
          number_of_replicas: '1',
          refresh_interval: '30s',
          codec: 'best_compression',
          'index.lifecycle.name': 'logs-policy',
          'index.mapping.total_fields.limit': '2000',
        },
      });
      expect(buildSettingsJson(value)).toEqual({
        number_of_shards: 3,
        number_of_replicas: 1,
        refresh_interval: '30s',
        codec: 'best_compression',
        'index.lifecycle.name': 'logs-policy',
        'index.mapping.total_fields.limit': 2000,
      });
    });

    it('omits blank/whitespace-only curated fields', () => {
      const value = formValue({ fields: { ...buildDefaultSettingsFormValue().fields, refresh_interval: '   ' } });
      expect(buildSettingsJson(value)).toBeUndefined();
    });

    it('throws a field-labeled error when a numeric field is not a number', () => {
      const value = formValue({
        fields: { ...buildDefaultSettingsFormValue().fields, number_of_shards: 'not-a-number' },
      });
      expect(() => buildSettingsJson(value)).toThrow('"Number of Shards" must be a number.');
    });

    it('merges the advanced JSON blob with curated fields taking precedence on key collision', () => {
      const value = formValue({
        fields: { ...buildDefaultSettingsFormValue().fields, number_of_shards: '3' },
        advanced: '{"number_of_shards": 99, "sort.field": "timestamp"}',
      });
      expect(buildSettingsJson(value)).toEqual({ number_of_shards: 3, 'sort.field': 'timestamp' });
    });

    it('throws when the advanced JSON is malformed', () => {
      const value = formValue({ advanced: '{ not valid json' });
      expect(() => buildSettingsJson(value)).toThrow('Advanced Settings must be valid JSON.');
    });

    it('throws when the advanced JSON parses but is not an object', () => {
      const value = formValue({ advanced: '[1, 2, 3]' });
      expect(() => buildSettingsJson(value)).toThrow('Advanced Settings must be a JSON object.');
    });

    it('treats an entirely missing advanced key as blank', () => {
      const value = formValue();
      delete (value as { advanced?: string }).advanced;
      expect(buildSettingsJson(value)).toBeUndefined();
    });

    it('treats an entirely missing fields key as blank for every curated field', () => {
      const value = formValue({ fields: {} });
      expect(buildSettingsJson(value)).toBeUndefined();
    });

    it('round-trips through parseSettingsFromRaw', () => {
      const raw = {
        number_of_shards: 3,
        refresh_interval: '30s',
        'sort.field': 'timestamp',
      };
      const value = parseSettingsFromRaw(raw);
      expect(buildSettingsJson(value)).toEqual(raw);
    });
  });
});
