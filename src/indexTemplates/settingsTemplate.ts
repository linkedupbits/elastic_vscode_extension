/**
 * Structural template describing the curated subset of Elasticsearch index settings that the
 * Index Template editor renders as structured fields (see ../ilm/ilmPhaseTemplate.ts and
 * ../ingest/ingestProcessorTemplate.ts for the same curated-template pattern applied
 * elsewhere). Settings outside this curated set - or expressed with a different key shape
 * than the flat, dotted keys used here (e.g. a nested `{ "index": { ... } }` object rather
 * than a flat `"index.lifecycle.name"` key) - are preserved verbatim in the "Advanced
 * Settings" JSON escape hatch, the same curated-fields-plus-JSON-escape-hatch pattern already
 * used for `_meta` throughout this project, since Elasticsearch's full settings schema is
 * open-ended (plugin-provided settings, etc).
 */

export type SettingsFieldType = 'string' | 'number' | 'select';

export interface SettingsFieldDef {
  key: string;
  label: string;
  type: SettingsFieldType;
  hint?: string;
  options?: { value: string; label: string }[];
}

export const INDEX_TEMPLATE_SETTINGS_FIELDS: SettingsFieldDef[] = [
  { key: 'number_of_shards', label: 'Number of Shards', type: 'number' },
  { key: 'number_of_replicas', label: 'Number of Replicas', type: 'number' },
  {
    key: 'refresh_interval',
    label: 'Refresh Interval',
    type: 'string',
    hint: 'e.g. 1s, 30s, or -1 to disable.',
  },
  {
    key: 'codec',
    label: 'Codec',
    type: 'select',
    options: [
      { value: '', label: '(default)' },
      { value: 'best_compression', label: 'best_compression' },
    ],
  },
  {
    key: 'index.lifecycle.name',
    label: 'ILM Policy Name',
    type: 'string',
    hint: 'Name of an Index Lifecycle Policy managing indices created from this template.',
  },
  {
    key: 'index.mapping.total_fields.limit',
    label: 'Total Fields Limit',
    type: 'number',
  },
];

export interface IndexTemplateSettingsFormValue {
  fields: Record<string, string>;
  advanced: string;
}

export function buildDefaultSettingsFormValue(): IndexTemplateSettingsFormValue {
  const fields: Record<string, string> = {};
  for (const field of INDEX_TEMPLATE_SETTINGS_FIELDS) {
    fields[field.key] = '';
  }
  return { fields, advanced: '' };
}

/** Converts a saved template's raw `template.settings` into the structured form value used by the editor. */
export function parseSettingsFromRaw(raw: Record<string, unknown> | undefined): IndexTemplateSettingsFormValue {
  const value = buildDefaultSettingsFormValue();
  if (!raw) {
    return value;
  }
  const remaining: Record<string, unknown> = { ...raw };
  for (const field of INDEX_TEMPLATE_SETTINGS_FIELDS) {
    if (!(field.key in remaining)) {
      continue;
    }
    const rawValue = remaining[field.key];
    if (rawValue === undefined || rawValue === null) {
      delete remaining[field.key];
      continue;
    }
    if (field.type === 'select') {
      const isKnownOption = field.options?.some((o) => o.value === String(rawValue));
      if (isKnownOption) {
        value.fields[field.key] = String(rawValue);
        delete remaining[field.key];
      }
      // else: leave it in `remaining` so an unrecognized option value still round-trips
      // through Advanced Settings instead of being silently dropped.
      continue;
    }
    value.fields[field.key] = String(rawValue);
    delete remaining[field.key];
  }
  value.advanced = Object.keys(remaining).length > 0 ? JSON.stringify(remaining, null, 2) : '';
  return value;
}

/** Converts the editor's structured form value back into the real `template.settings` API shape, or undefined if empty. */
export function buildSettingsJson(value: IndexTemplateSettingsFormValue): Record<string, unknown> | undefined {
  const advancedRaw = (value.advanced ?? '').trim();
  let result: Record<string, unknown> = {};
  if (advancedRaw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(advancedRaw);
    } catch {
      throw new Error('Advanced Settings must be valid JSON.');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Advanced Settings must be a JSON object.');
    }
    result = { ...(parsed as Record<string, unknown>) };
  }

  for (const field of INDEX_TEMPLATE_SETTINGS_FIELDS) {
    const raw = (value.fields[field.key] ?? '').trim();
    if (!raw) {
      continue;
    }
    if (field.type === 'number') {
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        throw new Error(`"${field.label}" must be a number.`);
      }
      result[field.key] = num;
    } else {
      result[field.key] = raw;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
