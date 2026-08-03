import {
  buildAliasesJson,
  buildAliasJson,
  buildDefaultAliasFormValue,
  IndexTemplateAliasFormValue,
  parseAliasesFromRaw,
} from '../../src/indexTemplates/aliasesTemplate';

describe('aliasesTemplate', () => {
  describe('buildDefaultAliasFormValue', () => {
    it('returns an empty/default alias row', () => {
      expect(buildDefaultAliasFormValue()).toEqual({
        name: '',
        isWriteIndex: false,
        isHidden: false,
        routing: '',
        filter: '',
      });
    });
  });

  describe('parseAliasesFromRaw', () => {
    it('returns [] when raw is undefined', () => {
      expect(parseAliasesFromRaw(undefined)).toEqual([]);
    });

    it('parses every alias entry, defaulting a null definition to {}', () => {
      const values = parseAliasesFromRaw({
        'logs-alias': { is_write_index: true, is_hidden: true, routing: 'shard1' },
        'other-alias': null as unknown as Record<string, unknown>,
      });
      expect(values).toEqual([
        { name: 'logs-alias', isWriteIndex: true, isHidden: true, routing: 'shard1', filter: '' },
        { name: 'other-alias', isWriteIndex: false, isHidden: false, routing: '', filter: '' },
      ]);
    });

    it('parses a filter object into pretty-printed JSON', () => {
      const values = parseAliasesFromRaw({ 'logs-alias': { filter: { term: { tenant: 'acme' } } } });
      expect(JSON.parse(values[0].filter)).toEqual({ term: { tenant: 'acme' } });
    });

    it('ignores a non-object filter value', () => {
      const values = parseAliasesFromRaw({ 'logs-alias': { filter: 'not-an-object' } });
      expect(values[0].filter).toBe('');
    });

    it('treats a non-boolean is_write_index/is_hidden as false', () => {
      const values = parseAliasesFromRaw({ 'logs-alias': { is_write_index: 'yes', is_hidden: 1 } });
      expect(values[0].isWriteIndex).toBe(false);
      expect(values[0].isHidden).toBe(false);
    });

    it('treats a non-string routing as blank', () => {
      const values = parseAliasesFromRaw({ 'logs-alias': { routing: 42 } });
      expect(values[0].routing).toBe('');
    });
  });

  describe('buildAliasJson', () => {
    it('throws when the alias name is blank', () => {
      const value = buildDefaultAliasFormValue();
      expect(() => buildAliasJson(value, 'Alias 1')).toThrow('Alias 1: Alias Name is required.');
    });

    it('throws when the alias name is entirely missing (distinct from a blank string)', () => {
      const value = {} as unknown as IndexTemplateAliasFormValue;
      expect(() => buildAliasJson(value, 'Alias 1')).toThrow('Alias 1: Alias Name is required.');
    });

    it('treats an entirely missing routing/filter as blank', () => {
      const value = { name: 'logs-alias' } as unknown as IndexTemplateAliasFormValue;
      expect(buildAliasJson(value, 'Alias 1')).toEqual({});
    });

    it('builds a minimal alias with just a name', () => {
      const value: IndexTemplateAliasFormValue = { ...buildDefaultAliasFormValue(), name: 'logs-alias' };
      expect(buildAliasJson(value, 'Alias 1')).toEqual({});
    });

    it('includes is_write_index/is_hidden only when true', () => {
      const value: IndexTemplateAliasFormValue = {
        ...buildDefaultAliasFormValue(),
        name: 'logs-alias',
        isWriteIndex: true,
        isHidden: true,
      };
      expect(buildAliasJson(value, 'Alias 1')).toEqual({ is_write_index: true, is_hidden: true });
    });

    it('includes a trimmed routing value', () => {
      const value: IndexTemplateAliasFormValue = { ...buildDefaultAliasFormValue(), name: 'logs-alias', routing: '  shard1  ' };
      expect(buildAliasJson(value, 'Alias 1')).toEqual({ routing: 'shard1' });
    });

    it('includes a parsed filter object', () => {
      const value: IndexTemplateAliasFormValue = {
        ...buildDefaultAliasFormValue(),
        name: 'logs-alias',
        filter: '{"term": {"tenant": "acme"}}',
      };
      expect(buildAliasJson(value, 'Alias 1')).toEqual({ filter: { term: { tenant: 'acme' } } });
    });

    it('throws when the filter is malformed JSON', () => {
      const value: IndexTemplateAliasFormValue = { ...buildDefaultAliasFormValue(), name: 'logs-alias', filter: '{ not valid json' };
      expect(() => buildAliasJson(value, 'Alias 1')).toThrow('Alias 1 ("logs-alias"): Filter must be valid JSON.');
    });

    it('throws when the filter parses but is not a JSON object', () => {
      const value: IndexTemplateAliasFormValue = { ...buildDefaultAliasFormValue(), name: 'logs-alias', filter: '[1, 2, 3]' };
      expect(() => buildAliasJson(value, 'Alias 1')).toThrow('Alias 1 ("logs-alias"): Filter must be a JSON object.');
    });
  });

  describe('buildAliasesJson', () => {
    it('builds every row keyed by its trimmed name', () => {
      const values: IndexTemplateAliasFormValue[] = [
        { ...buildDefaultAliasFormValue(), name: '  logs-alias  ' },
        { ...buildDefaultAliasFormValue(), name: 'other-alias', isWriteIndex: true },
      ];
      expect(buildAliasesJson(values)).toEqual({
        'logs-alias': {},
        'other-alias': { is_write_index: true },
      });
    });

    it('labels errors with a 1-based row index', () => {
      const values: IndexTemplateAliasFormValue[] = [
        { ...buildDefaultAliasFormValue(), name: 'logs-alias' },
        { ...buildDefaultAliasFormValue(), name: '' },
      ];
      expect(() => buildAliasesJson(values)).toThrow('Alias 2: Alias Name is required.');
    });

    it('throws on a duplicate alias name', () => {
      const values: IndexTemplateAliasFormValue[] = [
        { ...buildDefaultAliasFormValue(), name: 'logs-alias' },
        { ...buildDefaultAliasFormValue(), name: 'logs-alias' },
      ];
      expect(() => buildAliasesJson(values)).toThrow('Alias 2: An alias named "logs-alias" is already defined.');
    });

    it('round-trips through parseAliasesFromRaw', () => {
      const raw = { 'logs-alias': { is_write_index: true, routing: 'shard1', filter: { term: { tenant: 'acme' } } } };
      expect(buildAliasesJson(parseAliasesFromRaw(raw))).toEqual(raw);
    });
  });
});
