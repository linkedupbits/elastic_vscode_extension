/**
 * Structural template describing the curated subset of Elasticsearch field mapping types that
 * the Index Template editor renders as structured per-field form sections - mirroring the
 * inputs/streams/vars template pattern used for Integration Policies (see
 * ../integrations/packageTemplate.ts) and the processor template used for Ingest Pipelines
 * (see ../ingest/ingestProcessorTemplate.ts).
 *
 * A field mapping's full schema is open-ended (dozens of types, deeply nested
 * `properties`/`fields`, analyzer settings, etc), so only the most common types and options
 * are curated here; anything else falls back to a "Custom / Other..." row - the same
 * data-loss-avoidance escape hatch used for uncurated Ingest processor types - which captures
 * the field's type name and its full definition (excluding `type`) as free-form JSON. Object
 * and nested fields with their own nested `properties`, or multi-fields beyond the single
 * curated keyword sub-field, are only representable via that escape hatch.
 */

export type MappingOptionType = 'string' | 'number' | 'boolean';

export interface MappingFieldOptionDef {
  key: string;
  label: string;
  type: MappingOptionType;
  default: string | number | boolean;
  hint?: string;
}

export interface MappingFieldTypeDef {
  id: string;
  label: string;
  options: MappingFieldOptionDef[];
}

export const CUSTOM_MAPPING_TYPE_ID = '__custom__';

export const MAPPING_FIELD_TYPES: MappingFieldTypeDef[] = [
  {
    id: 'text',
    label: 'Text',
    options: [
      { key: 'analyzer', label: 'Analyzer', type: 'string', default: '', hint: 'Leave blank for the default analyzer.' },
      {
        key: 'add_keyword_subfield',
        label: 'Add Keyword Sub-field (.keyword)',
        type: 'boolean',
        default: true,
        hint: 'Adds a not_analyzed "keyword" sub-field for sorting/aggregations, e.g. field.keyword.',
      },
    ],
  },
  {
    id: 'keyword',
    label: 'Keyword',
    options: [
      { key: 'ignore_above', label: 'Ignore Above', type: 'number', default: 0, hint: 'Leave 0 to omit (no limit).' },
    ],
  },
  { id: 'long', label: 'Long', options: [] },
  { id: 'integer', label: 'Integer', options: [] },
  { id: 'short', label: 'Short', options: [] },
  { id: 'byte', label: 'Byte', options: [] },
  { id: 'double', label: 'Double', options: [] },
  { id: 'float', label: 'Float', options: [] },
  { id: 'boolean', label: 'Boolean', options: [] },
  {
    id: 'date',
    label: 'Date',
    options: [
      {
        key: 'format',
        label: 'Format',
        type: 'string',
        default: '',
        hint: "e.g. yyyy-MM-dd'T'HH:mm:ssZ. Leave blank for the default formats.",
      },
    ],
  },
  { id: 'ip', label: 'IP', options: [] },
  { id: 'geo_point', label: 'Geo Point', options: [] },
  { id: 'object', label: 'Object', options: [] },
  { id: 'nested', label: 'Nested', options: [] },
  { id: 'binary', label: 'Binary', options: [] },
  { id: 'flattened', label: 'Flattened', options: [] },
];

export function findMappingFieldType(typeId: string): MappingFieldTypeDef | undefined {
  return MAPPING_FIELD_TYPES.find((t) => t.id === typeId);
}

export type MappingOptionValue = string | number | boolean;

export interface MappingFieldFormValue {
  name: string;
  type: string;
  isCustom: boolean;
  customType: string;
  customConfig: string;
  options: Record<string, MappingOptionValue>;
}

export function buildDefaultMappingFieldValue(typeId?: string): MappingFieldFormValue {
  const def = (typeId && findMappingFieldType(typeId)) || MAPPING_FIELD_TYPES[0];
  const options: Record<string, MappingOptionValue> = {};
  for (const opt of def.options) {
    options[opt.key] = opt.default;
  }
  return { name: '', type: def.id, isCustom: false, customType: '', customConfig: '{}', options };
}

/** Converts one saved `properties.<name>` entry (real mapping API shape) into the structured form value used by the editor. */
export function parseMappingField(name: string, raw: Record<string, unknown>): MappingFieldFormValue {
  const typeRaw = raw.type;
  const typeId = typeof typeRaw === 'string' ? typeRaw : '';
  const def = findMappingFieldType(typeId);
  if (!def) {
    const { type: _type, ...rest } = raw;
    return {
      name,
      type: CUSTOM_MAPPING_TYPE_ID,
      isCustom: true,
      customType: typeId,
      customConfig: JSON.stringify(rest, null, 2),
      options: {},
    };
  }

  const options: Record<string, MappingOptionValue> = {};
  for (const opt of def.options) {
    if (opt.key === 'add_keyword_subfield') {
      const fields = raw.fields;
      options[opt.key] = Boolean(fields && typeof fields === 'object' && !Array.isArray(fields) && 'keyword' in fields);
      continue;
    }
    const rawValue = raw[opt.key];
    if (opt.type === 'number') {
      options[opt.key] = typeof rawValue === 'number' ? rawValue : opt.default;
    } else {
      // opt.type === 'string' - the only two option types that reach this point; every
      // curated 'boolean' option is add_keyword_subfield, handled above before the loop
      // body gets here.
      options[opt.key] = typeof rawValue === 'string' ? rawValue : opt.default;
    }
  }
  return { name, type: def.id, isCustom: false, customType: '', customConfig: '{}', options };
}

/** Converts a saved `properties` object (real mapping API shape) into the structured list of field rows used by the editor. */
export function parseMappingFieldsFromRaw(raw: Record<string, unknown> | undefined): MappingFieldFormValue[] {
  if (!raw) {
    return [];
  }
  return Object.entries(raw).map(([name, def]) => parseMappingField(name, (def ?? {}) as Record<string, unknown>));
}

function buildOptionsJson(def: MappingFieldTypeDef, options: Record<string, MappingOptionValue>): Record<string, unknown> {
  const json: Record<string, unknown> = {};
  for (const opt of def.options) {
    const value = options[opt.key];
    if (opt.key === 'add_keyword_subfield') {
      if (value === true) {
        json.fields = { keyword: { type: 'keyword', ignore_above: 256 } };
      }
      continue;
    }
    if (opt.type === 'number') {
      const num = typeof value === 'number' ? value : Number(value);
      if (num) {
        json[opt.key] = num;
      }
    } else {
      // opt.type === 'string' - the only two option types that reach this point; every
      // curated 'boolean' option is add_keyword_subfield, handled above before the loop
      // body gets here.
      const str = typeof value === 'string' ? value.trim() : '';
      if (str) {
        json[opt.key] = str;
      }
    }
  }
  return json;
}

/** Converts one editor field row back into a real `properties.<name>` entry, throwing a row-labeled error if invalid. */
export function buildMappingFieldJson(value: MappingFieldFormValue, rowLabel: string): Record<string, unknown> {
  const name = (value.name ?? '').trim();
  if (!name) {
    throw new Error(`${rowLabel}: Field Name is required.`);
  }

  if (value.isCustom) {
    const customType = (value.customType ?? '').trim();
    if (!customType) {
      throw new Error(`${rowLabel} ("${name}"): Field Type is required.`);
    }
    const configRaw = (value.customConfig ?? '').trim() || '{}';
    let parsed: unknown;
    try {
      parsed = JSON.parse(configRaw);
    } catch {
      throw new Error(`${rowLabel} ("${name}"): Configuration must be valid JSON.`);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${rowLabel} ("${name}"): Configuration must be a JSON object.`);
    }
    return { type: customType, ...(parsed as Record<string, unknown>) };
  }

  const def = findMappingFieldType(value.type);
  if (!def) {
    throw new Error(`${rowLabel} ("${name}"): Unknown field type.`);
  }
  return { type: def.id, ...buildOptionsJson(def, value.options ?? {}) };
}

/** Converts the editor's structured field rows back into a real `properties` object, throwing a row-labeled error on the first invalid/duplicate row. */
export function buildMappingPropertiesJson(values: MappingFieldFormValue[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const seen = new Set<string>();
  values.forEach((value, index) => {
    const rowLabel = `Field ${index + 1}`;
    const json = buildMappingFieldJson(value, rowLabel);
    // buildMappingFieldJson above already throws if the name is blank/undefined, so by this
    // point value.name is guaranteed to be a non-blank string.
    const name = value.name.trim();
    if (seen.has(name)) {
      throw new Error(`${rowLabel}: A field named "${name}" is already defined.`);
    }
    seen.add(name);
    result[name] = json;
  });
  return result;
}

export type MappingDynamicValue = '' | 'true' | 'false' | 'strict';

export interface IndexTemplateMappingsFormValue {
  dynamic: MappingDynamicValue;
  disableSource: boolean;
  fields: MappingFieldFormValue[];
}

export function buildDefaultMappingsFormValue(): IndexTemplateMappingsFormValue {
  return { dynamic: '', disableSource: false, fields: [] };
}

/** Converts a saved template's raw `template.mappings` into the structured form value used by the editor. */
export function parseMappingsFromRaw(raw: Record<string, unknown> | undefined): IndexTemplateMappingsFormValue {
  if (!raw) {
    return buildDefaultMappingsFormValue();
  }
  const dynamicRaw = raw.dynamic;
  let dynamic: MappingDynamicValue = '';
  if (dynamicRaw === true) {
    dynamic = 'true';
  } else if (dynamicRaw === false) {
    dynamic = 'false';
  } else if (dynamicRaw === 'strict') {
    dynamic = 'strict';
  }

  const source = raw._source;
  const disableSource = Boolean(
    source && typeof source === 'object' && !Array.isArray(source) && (source as Record<string, unknown>).enabled === false
  );

  const properties = raw.properties;
  const fields = parseMappingFieldsFromRaw(
    properties && typeof properties === 'object' && !Array.isArray(properties) ? (properties as Record<string, unknown>) : undefined
  );

  return { dynamic, disableSource, fields };
}

/** Converts the editor's structured form value back into the real `template.mappings` API shape, or undefined if empty. */
export function buildMappingsJson(value: IndexTemplateMappingsFormValue): Record<string, unknown> | undefined {
  const result: Record<string, unknown> = {};
  if (value.dynamic === 'true') {
    result.dynamic = true;
  } else if (value.dynamic === 'false') {
    result.dynamic = false;
  } else if (value.dynamic === 'strict') {
    result.dynamic = 'strict';
  }
  if (value.disableSource) {
    result._source = { enabled: false };
  }
  if (value.fields.length > 0) {
    result.properties = buildMappingPropertiesJson(value.fields);
  }
  return Object.keys(result).length > 0 ? result : undefined;
}
