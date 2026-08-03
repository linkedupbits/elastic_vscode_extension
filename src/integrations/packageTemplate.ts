import { IntegrationInputValue, IntegrationPolicy, VarValue } from '../models';

export type VarType = 'string' | 'multiline' | 'boolean' | 'number' | 'stringArray';

export interface VarFieldDef {
  key: string;
  label: string;
  type: VarType;
  default: VarValue;
}

export interface StreamDef {
  id: string;
  label: string;
  defaultEnabled: boolean;
  vars: VarFieldDef[];
}

export interface InputDef {
  id: string;
  label: string;
  defaultEnabled: boolean;
  /**
   * Input-level vars, e.g. the `condition` that picks logfile vs journald collection.
   * `undefined` means this input type has no vars section at all, so the saved JSON omits
   * the `vars` key entirely (some input types include it as `{}` instead — the real Fleet
   * API payloads are inconsistent about this, so the template captures it per-input).
   */
  vars?: VarFieldDef[];
  streams: StreamDef[];
}

export interface PackageTemplate {
  name: string;
  title: string;
  version: string;
  requiresRoot: boolean;
  inputs: InputDef[];
}

function defaultsFromFields(fields: VarFieldDef[]): Record<string, VarValue> {
  return Object.fromEntries(fields.map((f) => [f.key, f.default]));
}

/** Builds a brand-new `inputs` object using every input/stream/var default from `template`. */
export function buildDefaultInputs(template: PackageTemplate): Record<string, IntegrationInputValue> {
  const inputs: Record<string, IntegrationInputValue> = {};
  for (const input of template.inputs) {
    const streams: IntegrationInputValue['streams'] = {};
    for (const stream of input.streams) {
      streams[stream.id] = {
        enabled: stream.defaultEnabled,
        vars: defaultsFromFields(stream.vars),
      };
    }
    inputs[input.id] = {
      enabled: input.defaultEnabled,
      streams,
      ...(input.vars ? { vars: defaultsFromFields(input.vars) } : {}),
    };
  }
  return inputs;
}

/**
 * Reconciles a possibly-incomplete/hand-edited `inputs` object against the template shape,
 * so the structured editor always has a value to show for every field the template defines.
 * Values present in `existing` win; anything missing falls back to the template default.
 */
export function mergeInputsWithTemplate(
  template: PackageTemplate,
  existing: Record<string, IntegrationInputValue> | undefined
): Record<string, IntegrationInputValue> {
  const merged: Record<string, IntegrationInputValue> = {};
  for (const input of template.inputs) {
    const existingInput = existing?.[input.id];
    const streams: IntegrationInputValue['streams'] = {};
    for (const stream of input.streams) {
      const existingStream = existingInput?.streams?.[stream.id];
      const vars: Record<string, VarValue> = {};
      for (const field of stream.vars) {
        vars[field.key] = existingStream?.vars?.[field.key] ?? field.default;
      }
      streams[stream.id] = { enabled: existingStream?.enabled ?? stream.defaultEnabled, vars };
    }
    let inputVars: Record<string, VarValue> | undefined;
    if (input.vars) {
      inputVars = {};
      for (const field of input.vars) {
        inputVars[field.key] = existingInput?.vars?.[field.key] ?? field.default;
      }
    }
    merged[input.id] = {
      enabled: existingInput?.enabled ?? input.defaultEnabled,
      streams,
      ...(inputVars ? { vars: inputVars } : {}),
    };
  }
  return merged;
}

export function buildDefaultIntegrationPolicy(
  template: PackageTemplate,
  agentPolicyId: string
): IntegrationPolicy {
  return {
    name: '',
    namespace: '',
    description: '',
    package: {
      name: template.name,
      title: template.title,
      version: template.version,
      requires_root: template.requiresRoot,
    },
    policy_id: agentPolicyId,
    policy_ids: [agentPolicyId],
    inputs: buildDefaultInputs(template),
    output_id: null,
    vars: {},
  };
}
