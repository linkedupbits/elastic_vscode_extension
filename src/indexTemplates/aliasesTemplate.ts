/**
 * Structural template for the curated fields of an Elasticsearch index template alias
 * definition (https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-indices-put-index-template).
 * `filter` (a Query DSL object) is left free-form JSON since query DSL is itself open-ended -
 * the same rationale used for `template.settings`/`mappings`/`aliases` staying JSON at the
 * top level, applied one level deeper to this specific, well-known, inherently open-ended
 * property.
 */

export interface IndexTemplateAliasFormValue {
  name: string;
  isWriteIndex: boolean;
  isHidden: boolean;
  routing: string;
  filter: string;
}

export function buildDefaultAliasFormValue(): IndexTemplateAliasFormValue {
  return { name: '', isWriteIndex: false, isHidden: false, routing: '', filter: '' };
}

/** Converts a saved template's raw `template.aliases` into the structured list of alias rows used by the editor. */
export function parseAliasesFromRaw(raw: Record<string, unknown> | undefined): IndexTemplateAliasFormValue[] {
  if (!raw) {
    return [];
  }
  return Object.entries(raw).map(([name, rawDef]) => {
    const def = (rawDef ?? {}) as Record<string, unknown>;
    const filter = def.filter;
    return {
      name,
      isWriteIndex: def.is_write_index === true,
      isHidden: def.is_hidden === true,
      routing: typeof def.routing === 'string' ? def.routing : '',
      filter: filter && typeof filter === 'object' && !Array.isArray(filter) ? JSON.stringify(filter, null, 2) : '',
    };
  });
}

/** Converts one editor alias row back into a real `aliases.<name>` entry, throwing a row-labeled error if invalid. */
export function buildAliasJson(value: IndexTemplateAliasFormValue, rowLabel: string): Record<string, unknown> {
  const name = (value.name ?? '').trim();
  if (!name) {
    throw new Error(`${rowLabel}: Alias Name is required.`);
  }

  const result: Record<string, unknown> = {};
  if (value.isWriteIndex) {
    result.is_write_index = true;
  }
  if (value.isHidden) {
    result.is_hidden = true;
  }
  const routing = (value.routing ?? '').trim();
  if (routing) {
    result.routing = routing;
  }
  const filterRaw = (value.filter ?? '').trim();
  if (filterRaw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(filterRaw);
    } catch {
      throw new Error(`${rowLabel} ("${name}"): Filter must be valid JSON.`);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${rowLabel} ("${name}"): Filter must be a JSON object.`);
    }
    result.filter = parsed;
  }
  return result;
}

/** Converts the editor's structured alias rows back into a real `aliases` object, throwing a row-labeled error on the first invalid/duplicate row. */
export function buildAliasesJson(values: IndexTemplateAliasFormValue[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const seen = new Set<string>();
  values.forEach((value, index) => {
    const rowLabel = `Alias ${index + 1}`;
    const json = buildAliasJson(value, rowLabel);
    // buildAliasJson above already throws if the name is blank/undefined, so by this point
    // value.name is guaranteed to be a non-blank string.
    const name = value.name.trim();
    if (seen.has(name)) {
      throw new Error(`${rowLabel}: An alias named "${name}" is already defined.`);
    }
    seen.add(name);
    result[name] = json;
  });
  return result;
}
