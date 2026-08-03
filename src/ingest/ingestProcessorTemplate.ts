/**
 * Structural template describing a curated subset of Elasticsearch ingest processor types
 * (https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-ingest-put-pipeline),
 * rendered as structured, per-processor form rows - mirroring the inputs/streams/vars template
 * pattern used for Integration Policies and the phases/actions template used for ILM Policies,
 * rather than hand-coding a form per processor type.
 *
 * Elasticsearch supports dozens of processor types (including ones added by plugins), so unlike
 * ILM's closed set of 5 phases, this template is deliberately NOT exhaustive. Any processor type
 * not in `INGEST_PROCESSORS` - whether hand-authored or from a future/plugin processor - falls
 * back to the `CUSTOM_PROCESSOR_ID` row, which captures the raw type name and a JSON config
 * object instead of losing data.
 */

export type IngestFieldType = 'string' | 'stringArray' | 'boolean' | 'multiline' | 'select';

export interface IngestProcessorFieldDef {
  key: string;
  label: string;
  type: IngestFieldType;
  default: string | number | boolean | string[];
  required?: boolean;
  hint?: string;
  /** Only used when type === 'select'. */
  options?: { value: string; label: string }[];
}

export interface IngestProcessorDef {
  id: string;
  label: string;
  fields: IngestProcessorFieldDef[];
}

export const CUSTOM_PROCESSOR_ID = '__custom__';

const CONVERT_TYPE_OPTIONS = [
  { value: 'integer', label: 'integer' },
  { value: 'long', label: 'long' },
  { value: 'float', label: 'float' },
  { value: 'double', label: 'double' },
  { value: 'string', label: 'string' },
  { value: 'boolean', label: 'boolean' },
  { value: 'ip', label: 'ip' },
];

export const INGEST_PROCESSORS: IngestProcessorDef[] = [
  {
    id: 'set',
    label: 'Set',
    fields: [
      { key: 'field', label: 'Field', type: 'string', default: '', required: true },
      { key: 'value', label: 'Value', type: 'string', default: '', required: true },
      { key: 'override', label: 'Override', type: 'boolean', default: true },
      { key: 'ignore_empty_value', label: 'Ignore Empty Value', type: 'boolean', default: false },
    ],
  },
  {
    id: 'remove',
    label: 'Remove',
    fields: [
      { key: 'field', label: 'Field(s)', type: 'stringArray', default: [], required: true, hint: 'One field per line.' },
      { key: 'ignore_missing', label: 'Ignore Missing', type: 'boolean', default: false },
    ],
  },
  {
    id: 'rename',
    label: 'Rename',
    fields: [
      { key: 'field', label: 'Field', type: 'string', default: '', required: true },
      { key: 'target_field', label: 'Target Field', type: 'string', default: '', required: true },
      { key: 'ignore_missing', label: 'Ignore Missing', type: 'boolean', default: false },
    ],
  },
  {
    id: 'append',
    label: 'Append',
    fields: [
      { key: 'field', label: 'Field', type: 'string', default: '', required: true },
      { key: 'value', label: 'Value(s)', type: 'stringArray', default: [], required: true, hint: 'One value per line.' },
      { key: 'allow_duplicates', label: 'Allow Duplicates', type: 'boolean', default: true },
    ],
  },
  {
    id: 'convert',
    label: 'Convert',
    fields: [
      { key: 'field', label: 'Field', type: 'string', default: '', required: true },
      { key: 'type', label: 'Type', type: 'select', default: 'string', required: true, options: CONVERT_TYPE_OPTIONS },
      { key: 'target_field', label: 'Target Field (optional)', type: 'string', default: '' },
      { key: 'ignore_missing', label: 'Ignore Missing', type: 'boolean', default: false },
    ],
  },
  {
    id: 'gsub',
    label: 'Gsub',
    fields: [
      { key: 'field', label: 'Field', type: 'string', default: '', required: true },
      { key: 'pattern', label: 'Pattern (regex)', type: 'string', default: '', required: true },
      { key: 'replacement', label: 'Replacement', type: 'string', default: '', required: true },
      { key: 'target_field', label: 'Target Field (optional)', type: 'string', default: '' },
    ],
  },
  {
    id: 'grok',
    label: 'Grok',
    fields: [
      { key: 'field', label: 'Field', type: 'string', default: '', required: true },
      { key: 'patterns', label: 'Patterns', type: 'stringArray', default: [], required: true, hint: 'One grok pattern per line.' },
      { key: 'ignore_missing', label: 'Ignore Missing', type: 'boolean', default: false },
    ],
  },
  {
    id: 'dissect',
    label: 'Dissect',
    fields: [
      { key: 'field', label: 'Field', type: 'string', default: '', required: true },
      { key: 'pattern', label: 'Pattern', type: 'string', default: '', required: true },
    ],
  },
  {
    id: 'date',
    label: 'Date',
    fields: [
      { key: 'field', label: 'Field', type: 'string', default: '', required: true },
      { key: 'formats', label: 'Formats', type: 'stringArray', default: [], required: true, hint: 'One date format per line, e.g. ISO8601.' },
      { key: 'target_field', label: 'Target Field (optional)', type: 'string', default: '', hint: 'Defaults to @timestamp.' },
      { key: 'timezone', label: 'Timezone (optional)', type: 'string', default: '' },
    ],
  },
  {
    id: 'json',
    label: 'JSON',
    fields: [
      { key: 'field', label: 'Field', type: 'string', default: '', required: true },
      { key: 'target_field', label: 'Target Field (optional)', type: 'string', default: '' },
      { key: 'add_to_root', label: 'Add To Root', type: 'boolean', default: false },
    ],
  },
  {
    id: 'script',
    label: 'Script',
    fields: [
      { key: 'source', label: 'Source', type: 'multiline', default: '', required: true },
      { key: 'lang', label: 'Language (optional)', type: 'string', default: '', hint: 'Defaults to painless.' },
    ],
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    fields: [{ key: 'name', label: 'Pipeline Name', type: 'string', default: '', required: true }],
  },
  {
    id: 'csv',
    label: 'CSV',
    fields: [
      { key: 'field', label: 'Field', type: 'string', default: '', required: true },
      { key: 'target_fields', label: 'Target Field(s)', type: 'stringArray', default: [], required: true, hint: 'One target field per line, in column order.' },
      { key: 'separator', label: 'Separator (optional)', type: 'string', default: '', hint: 'Defaults to ",".' },
    ],
  },
  {
    id: 'kv',
    label: 'Key/Value',
    fields: [
      { key: 'field', label: 'Field', type: 'string', default: '', required: true },
      { key: 'field_split', label: 'Field Split (regex)', type: 'string', default: '', required: true },
      { key: 'value_split', label: 'Value Split (regex)', type: 'string', default: '', required: true },
      { key: 'target_field', label: 'Target Field (optional)', type: 'string', default: '' },
    ],
  },
  {
    id: 'lowercase',
    label: 'Lowercase',
    fields: [
      { key: 'field', label: 'Field', type: 'string', default: '', required: true },
      { key: 'target_field', label: 'Target Field (optional)', type: 'string', default: '' },
    ],
  },
  {
    id: 'uppercase',
    label: 'Uppercase',
    fields: [
      { key: 'field', label: 'Field', type: 'string', default: '', required: true },
      { key: 'target_field', label: 'Target Field (optional)', type: 'string', default: '' },
    ],
  },
  {
    id: 'trim',
    label: 'Trim',
    fields: [
      { key: 'field', label: 'Field', type: 'string', default: '', required: true },
      { key: 'target_field', label: 'Target Field (optional)', type: 'string', default: '' },
    ],
  },
  {
    id: 'split',
    label: 'Split',
    fields: [
      { key: 'field', label: 'Field', type: 'string', default: '', required: true },
      { key: 'separator', label: 'Separator (regex)', type: 'string', default: '', required: true },
      { key: 'target_field', label: 'Target Field (optional)', type: 'string', default: '' },
    ],
  },
  {
    id: 'geoip',
    label: 'GeoIP',
    fields: [
      { key: 'field', label: 'Field', type: 'string', default: '', required: true },
      { key: 'target_field', label: 'Target Field (optional)', type: 'string', default: '', hint: 'Defaults to geoip.' },
    ],
  },
  {
    id: 'user_agent',
    label: 'User Agent',
    fields: [
      { key: 'field', label: 'Field', type: 'string', default: '', required: true },
      { key: 'target_field', label: 'Target Field (optional)', type: 'string', default: '', hint: 'Defaults to user_agent.' },
    ],
  },
  {
    id: 'fail',
    label: 'Fail',
    fields: [{ key: 'message', label: 'Message', type: 'string', default: '', required: true }],
  },
  {
    id: 'drop',
    label: 'Drop',
    fields: [],
  },
];

export function findProcessorDef(typeId: string): IngestProcessorDef | undefined {
  return INGEST_PROCESSORS.find((p) => p.id === typeId);
}

export type IngestFieldValue = string | number | boolean | string[];

export interface IngestProcessorFormValue {
  /** A known IngestProcessorDef id, or CUSTOM_PROCESSOR_ID when `isCustom` is true. */
  type: string;
  isCustom: boolean;
  /** The real processor type name when isCustom is true (e.g. "enrich"). */
  customType: string;
  /** JSON text for the processor's config object when isCustom is true. */
  customConfig: string;
  /** Field values keyed by IngestProcessorFieldDef.key, used when isCustom is false. */
  fields: Record<string, IngestFieldValue>;
  /** Common optional processor properties, supported by every processor type. */
  tag: string;
  condition: string;
  ignoreFailure: boolean;
}

function defaultsFromFields(fields: IngestProcessorFieldDef[]): Record<string, IngestFieldValue> {
  const result: Record<string, IngestFieldValue> = {};
  for (const field of fields) {
    result[field.key] = field.default;
  }
  return result;
}

/** A brand-new processor row, defaulted from its type's template (or a blank custom row for an unknown type). */
export function buildDefaultProcessorValue(typeId: string): IngestProcessorFormValue {
  const def = findProcessorDef(typeId);
  if (!def) {
    return {
      type: CUSTOM_PROCESSOR_ID,
      isCustom: true,
      customType: '',
      customConfig: '{}',
      fields: {},
      tag: '',
      condition: '',
      ignoreFailure: false,
    };
  }
  return {
    type: def.id,
    isCustom: false,
    customType: '',
    customConfig: '{}',
    fields: defaultsFromFields(def.fields),
    tag: '',
    condition: '',
    ignoreFailure: false,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Converts one raw `{ <type>: {...config} }` processor object into a structured form value. */
export function parseProcessor(raw: Record<string, unknown>): IngestProcessorFormValue {
  const [typeId] = Object.keys(raw);
  const rawConfig = isPlainObject(raw[typeId]) ? (raw[typeId] as Record<string, unknown>) : {};

  const tag = typeof rawConfig.tag === 'string' ? rawConfig.tag : '';
  const condition = typeof rawConfig.if === 'string' ? rawConfig.if : '';
  const ignoreFailure = typeof rawConfig.ignore_failure === 'boolean' ? rawConfig.ignore_failure : false;

  const def = findProcessorDef(typeId);
  if (!def) {
    const { tag: _tag, if: _if, ignore_failure: _ignoreFailure, ...rest } = rawConfig;
    return {
      type: CUSTOM_PROCESSOR_ID,
      isCustom: true,
      customType: typeId ?? '',
      customConfig: JSON.stringify(rest, null, 2),
      fields: {},
      tag,
      condition,
      ignoreFailure,
    };
  }

  const fields: Record<string, IngestFieldValue> = {};
  for (const field of def.fields) {
    const value = rawConfig[field.key];
    switch (field.type) {
      case 'stringArray':
        fields[field.key] = Array.isArray(value)
          ? (value as unknown[]).filter((v): v is string => typeof v === 'string')
          : typeof value === 'string'
            ? [value]
            : (field.default as string[]);
        break;
      case 'boolean':
        fields[field.key] = typeof value === 'boolean' ? value : field.default;
        break;
      default:
        // string, multiline, select
        fields[field.key] = typeof value === 'string' ? value : field.default;
    }
  }

  return { type: def.id, isCustom: false, customType: '', customConfig: '{}', fields, tag, condition, ignoreFailure };
}

export function parseProcessorsFromRaw(raw: Record<string, unknown>[] | undefined): IngestProcessorFormValue[] {
  return (raw ?? []).map(parseProcessor);
}

function isBlank(value: IngestFieldValue | undefined): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  return false;
}

/** Converts one structured form value back into a real `{ <type>: {...config} }` processor object. Throws on invalid/incomplete input. */
export function buildProcessorJson(value: IngestProcessorFormValue, rowLabel: string): Record<string, unknown> {
  let typeId: string;
  let config: Record<string, unknown>;

  if (value.isCustom) {
    typeId = (value.customType ?? '').trim();
    if (!typeId) {
      throw new Error(`${rowLabel}: Processor Type is required.`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(value.customConfig || '{}');
    } catch {
      throw new Error(`${rowLabel} ("${typeId}"): Configuration must be valid JSON.`);
    }
    if (!isPlainObject(parsed)) {
      throw new Error(`${rowLabel} ("${typeId}"): Configuration must be a JSON object.`);
    }
    config = parsed;
  } else {
    const def = findProcessorDef(value.type);
    if (!def) {
      throw new Error(`${rowLabel}: Unknown processor type "${value.type}".`);
    }
    typeId = def.id;
    config = {};
    for (const field of def.fields) {
      const fieldValue = value.fields[field.key];
      if (field.required && isBlank(fieldValue)) {
        throw new Error(`${rowLabel} (${def.label}): "${field.label}" is required.`);
      }
      if (isBlank(fieldValue)) {
        continue;
      }
      config[field.key] = fieldValue;
    }
  }

  if (value.tag && value.tag.trim()) {
    config.tag = value.tag.trim();
  }
  if (value.condition && value.condition.trim()) {
    config.if = value.condition.trim();
  }
  if (value.ignoreFailure) {
    config.ignore_failure = true;
  }

  return { [typeId]: config };
}

/** Converts a full ordered list of processor rows back into the real `processors`/`on_failure` API array. */
export function buildProcessorsJson(values: IngestProcessorFormValue[], fieldLabel: string): Record<string, unknown>[] {
  return values.map((value, index) => buildProcessorJson(value, `${fieldLabel} ${index + 1}`));
}
