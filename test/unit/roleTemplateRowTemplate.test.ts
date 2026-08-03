import {
  buildDefaultRoleTemplateValue,
  buildRoleTemplatesJson,
  parseRoleTemplatesFromRaw,
  RoleTemplateFormValue,
} from '../../src/roleMappings/roleTemplateRowTemplate';

describe('roleTemplateRowTemplate', () => {
  describe('buildDefaultRoleTemplateValue', () => {
    it('returns a blank row', () => {
      expect(buildDefaultRoleTemplateValue()).toEqual({ template: '', format: '' });
    });
  });

  describe('parseRoleTemplatesFromRaw', () => {
    it('returns [] when raw is not an array', () => {
      expect(parseRoleTemplatesFromRaw(undefined)).toEqual([]);
    });

    it('parses the nested template.source and a valid format', () => {
      const values = parseRoleTemplatesFromRaw([
        { template: { source: '{{username}}' }, format: 'json' },
      ]);
      expect(values).toEqual([{ template: '{{username}}', format: 'json' }]);
    });

    it('defaults a null entry to {}', () => {
      const values = parseRoleTemplatesFromRaw([null as unknown as Record<string, unknown>]);
      expect(values).toEqual([buildDefaultRoleTemplateValue()]);
    });

    it('falls back to an unrecognized format as blank', () => {
      const values = parseRoleTemplatesFromRaw([{ template: { source: 'x' }, format: 'yaml' }]);
      expect(values[0].format).toBe('');
    });

    it('treats a bare string template as the source directly (legacy shape)', () => {
      const values = parseRoleTemplatesFromRaw([{ template: '{{username}}' }]);
      expect(values[0].template).toBe('{{username}}');
    });

    it('treats a non-string/non-object template as blank', () => {
      const values = parseRoleTemplatesFromRaw([{ template: 42 }]);
      expect(values[0].template).toBe('');
    });

    it('treats a template object with a non-string source as blank', () => {
      const values = parseRoleTemplatesFromRaw([{ template: { source: 42 } }]);
      expect(values[0].template).toBe('');
    });
  });

  describe('buildRoleTemplatesJson', () => {
    function rowValue(overrides: Partial<RoleTemplateFormValue> = {}): RoleTemplateFormValue {
      return { ...buildDefaultRoleTemplateValue(), ...overrides };
    }

    it('builds a row with just a template, omitting format when unset', () => {
      const values = [rowValue({ template: '{{username}}' })];
      expect(buildRoleTemplatesJson(values, 'Role Template')).toEqual([{ template: { source: '{{username}}' } }]);
    });

    it('includes format when set', () => {
      const values = [rowValue({ template: '{{username}}', format: 'json' })];
      expect(buildRoleTemplatesJson(values, 'Role Template')).toEqual([
        { template: { source: '{{username}}' }, format: 'json' },
      ]);
    });

    it('trims the template text', () => {
      const values = [rowValue({ template: '  {{username}}  ' })];
      expect(buildRoleTemplatesJson(values, 'Role Template')[0].template).toEqual({ source: '{{username}}' });
    });

    it('throws a row-labeled error when the template is blank', () => {
      const values = [rowValue()];
      expect(() => buildRoleTemplatesJson(values, 'Role Template')).toThrow('Role Template 1: Template is required.');
    });

    it('throws when the template is entirely missing (distinct from a blank string)', () => {
      const values = [{ format: '' } as unknown as RoleTemplateFormValue];
      expect(() => buildRoleTemplatesJson(values, 'Role Template')).toThrow('Role Template 1: Template is required.');
    });

    it('labels errors with a 1-based row index', () => {
      const values = [rowValue({ template: '{{username}}' }), rowValue()];
      expect(() => buildRoleTemplatesJson(values, 'Role Template')).toThrow('Role Template 2: Template is required.');
    });

    it('round-trips through parseRoleTemplatesFromRaw', () => {
      const raw = [{ template: { source: '{{username}}' }, format: 'json' }];
      expect(buildRoleTemplatesJson(parseRoleTemplatesFromRaw(raw), 'Role Template')).toEqual(raw);
    });
  });
});
