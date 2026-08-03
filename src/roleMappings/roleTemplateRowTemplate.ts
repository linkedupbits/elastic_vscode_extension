/**
 * Structural helpers for the repeatable `role_templates` rows of an Elasticsearch role
 * mapping (https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-put-role-mapping).
 * Each row's `template` is itself just a Mustache template string (wrapped as `{ "source": ... }`
 * in the real API body) - unlike `rules`, which is a genuinely recursive/open-ended boolean
 * expression tree left as free-form JSON in ../models.ts's RoleMappingDefinition - so it's a
 * plain text field rather than a JSON escape hatch.
 */

export type RoleTemplateFormat = '' | 'string' | 'json';

export interface RoleTemplateFormValue {
  template: string;
  format: RoleTemplateFormat;
}

export function buildDefaultRoleTemplateValue(): RoleTemplateFormValue {
  return { template: '', format: '' };
}

const VALID_FORMATS: RoleTemplateFormat[] = ['string', 'json'];

/** Converts a saved role mapping's raw `role_templates` array (real API shape) into the structured form value used by the editor. */
export function parseRoleTemplatesFromRaw(raw: unknown[] | undefined): RoleTemplateFormValue[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((entry) => {
    const obj = (entry ?? {}) as Record<string, unknown>;
    const template = obj.template;
    const source =
      template && typeof template === 'object' && !Array.isArray(template)
        ? (template as Record<string, unknown>).source
        : template;
    const format = VALID_FORMATS.includes(obj.format as RoleTemplateFormat) ? (obj.format as RoleTemplateFormat) : '';
    return { template: typeof source === 'string' ? source : '', format };
  });
}

/** Converts the editor's structured role_templates rows back into a real `role_templates` array, throwing a row-labeled error on the first invalid row. */
export function buildRoleTemplatesJson(values: RoleTemplateFormValue[], fieldLabel: string): Record<string, unknown>[] {
  return values.map((value, index) => {
    const rowLabel = `${fieldLabel} ${index + 1}`;
    const template = (value.template ?? '').trim();
    if (!template) {
      throw new Error(`${rowLabel}: Template is required.`);
    }
    return {
      template: { source: template },
      ...(value.format ? { format: value.format } : {}),
    };
  });
}
