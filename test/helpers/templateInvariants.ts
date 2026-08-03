import { PackageTemplate, VarFieldDef } from '../../src/integrations/packageTemplate';

const VALID_VAR_TYPES = new Set(['string', 'multiline', 'boolean', 'number', 'stringArray', 'select']);

function assertField(field: VarFieldDef, where: string): void {
  if (!field.key) {
    throw new Error(`${where}: var has an empty key`);
  }
  if (!field.label) {
    throw new Error(`${where} (${field.key}): var has an empty label`);
  }
  if (!VALID_VAR_TYPES.has(field.type)) {
    throw new Error(`${where} (${field.key}): unknown var type "${field.type}"`);
  }
  if (field.default === undefined) {
    throw new Error(`${where} (${field.key}): default must be defined`);
  }

  if (field.type === 'select') {
    if (!field.options || field.options.length === 0) {
      throw new Error(`${where} (${field.key}): select field needs non-empty options`);
    }
    for (const option of field.options) {
      expect(typeof option.value).toBe('string');
      expect(typeof option.label).toBe('string');
    }
  }
}

/**
 * Structural sanity applicable to every PackageTemplate, independent of package-specific data:
 * unique input ids, non-empty stream lists, unique stream ids within an input (they may repeat
 * *across* inputs, e.g. System's "system.auth" under both logfile and journald), and every var
 * field shaped correctly.
 */
export function assertTemplateIsWellFormed(template: PackageTemplate): void {
  expect(template.inputs.length).toBeGreaterThan(0);

  const inputIds = template.inputs.map((i) => i.id);
  expect(new Set(inputIds).size).toBe(inputIds.length);

  for (const input of template.inputs) {
    if (input.streams.length === 0) {
      throw new Error(`input "${input.id}" should have at least one stream`);
    }

    const streamIds = input.streams.map((s) => s.id);
    expect(new Set(streamIds).size).toBe(streamIds.length);

    for (const field of input.vars ?? []) {
      assertField(field, `${input.id} (input-level)`);
    }
    for (const stream of input.streams) {
      for (const field of stream.vars) {
        assertField(field, `${input.id} / ${stream.id}`);
      }
    }
  }
}
