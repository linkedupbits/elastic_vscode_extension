/**
 * Structural template describing the (curated) subset of the Elasticsearch ILM Put Lifecycle
 * API's phases/actions (https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-ilm-put-lifecycle)
 * that the editor renders as structured, per-phase form sections - mirroring the
 * inputs/streams/vars template pattern used for Integration Policies (see
 * ../integrations/packageTemplate.ts) rather than hand-coding one form per phase.
 */

export type IlmFieldType = 'string' | 'number' | 'boolean';

export interface IlmActionFieldDef {
  key: string;
  label: string;
  type: IlmFieldType;
  default: string | number | boolean;
  hint?: string;
}

export interface IlmActionDef {
  id: string;
  label: string;
  fields: IlmActionFieldDef[];
}

export type IlmPhaseId = 'hot' | 'warm' | 'cold' | 'frozen' | 'delete';

export interface IlmPhaseDef {
  id: IlmPhaseId;
  label: string;
  defaultMinAge: string;
  actions: IlmActionDef[];
}

export const ILM_PHASES: IlmPhaseDef[] = [
  {
    id: 'hot',
    label: 'Hot',
    defaultMinAge: '0ms',
    actions: [
      {
        id: 'rollover',
        label: 'Rollover',
        fields: [
          { key: 'max_age', label: 'Max Age', type: 'string', default: '30d', hint: 'e.g. 30d' },
          {
            key: 'max_primary_shard_size',
            label: 'Max Primary Shard Size',
            type: 'string',
            default: '50gb',
            hint: 'e.g. 50gb',
          },
          { key: 'max_docs', label: 'Max Docs', type: 'number', default: 0, hint: 'Leave 0 to omit.' },
        ],
      },
      { id: 'set_priority', label: 'Set Priority', fields: [{ key: 'priority', label: 'Priority', type: 'number', default: 100 }] },
      {
        id: 'forcemerge',
        label: 'Force Merge',
        fields: [{ key: 'max_num_segments', label: 'Max Num Segments', type: 'number', default: 1 }],
      },
      {
        id: 'shrink',
        label: 'Shrink',
        fields: [{ key: 'number_of_shards', label: 'Number of Shards', type: 'number', default: 1 }],
      },
      { id: 'readonly', label: 'Read Only', fields: [] },
    ],
  },
  {
    id: 'warm',
    label: 'Warm',
    defaultMinAge: '30d',
    actions: [
      { id: 'set_priority', label: 'Set Priority', fields: [{ key: 'priority', label: 'Priority', type: 'number', default: 50 }] },
      {
        id: 'allocate',
        label: 'Allocate',
        fields: [{ key: 'number_of_replicas', label: 'Number of Replicas', type: 'number', default: 1 }],
      },
      {
        id: 'forcemerge',
        label: 'Force Merge',
        fields: [{ key: 'max_num_segments', label: 'Max Num Segments', type: 'number', default: 1 }],
      },
      {
        id: 'shrink',
        label: 'Shrink',
        fields: [{ key: 'number_of_shards', label: 'Number of Shards', type: 'number', default: 1 }],
      },
      { id: 'migrate', label: 'Migrate', fields: [{ key: 'enabled', label: 'Enabled', type: 'boolean', default: true }] },
      { id: 'readonly', label: 'Read Only', fields: [] },
    ],
  },
  {
    id: 'cold',
    label: 'Cold',
    defaultMinAge: '60d',
    actions: [
      { id: 'set_priority', label: 'Set Priority', fields: [{ key: 'priority', label: 'Priority', type: 'number', default: 0 }] },
      {
        id: 'allocate',
        label: 'Allocate',
        fields: [{ key: 'number_of_replicas', label: 'Number of Replicas', type: 'number', default: 0 }],
      },
      {
        id: 'searchable_snapshot',
        label: 'Searchable Snapshot',
        fields: [{ key: 'snapshot_repository', label: 'Snapshot Repository', type: 'string', default: '' }],
      },
      { id: 'migrate', label: 'Migrate', fields: [{ key: 'enabled', label: 'Enabled', type: 'boolean', default: true }] },
      { id: 'readonly', label: 'Read Only', fields: [] },
    ],
  },
  {
    id: 'frozen',
    label: 'Frozen',
    defaultMinAge: '90d',
    actions: [
      {
        id: 'searchable_snapshot',
        label: 'Searchable Snapshot',
        fields: [{ key: 'snapshot_repository', label: 'Snapshot Repository', type: 'string', default: '' }],
      },
    ],
  },
  {
    id: 'delete',
    label: 'Delete',
    defaultMinAge: '90d',
    actions: [
      {
        id: 'wait_for_snapshot',
        label: 'Wait For Snapshot',
        fields: [{ key: 'policy', label: 'SLM Policy Name', type: 'string', default: '' }],
      },
      {
        id: 'delete',
        label: 'Delete',
        fields: [{ key: 'delete_searchable_snapshot', label: 'Delete Searchable Snapshot', type: 'boolean', default: true }],
      },
    ],
  },
];

export interface IlmActionValue {
  enabled: boolean;
  fields: Record<string, string | number | boolean>;
}

export interface IlmPhaseValue {
  enabled: boolean;
  min_age: string;
  actions: Record<string, IlmActionValue>;
}

export type IlmPhasesFormValue = Record<string, IlmPhaseValue>;

/** All phases disabled, all actions disabled, fields at their template defaults. */
export function buildDefaultPhasesFormValue(): IlmPhasesFormValue {
  const result: IlmPhasesFormValue = {};
  for (const phase of ILM_PHASES) {
    const actions: Record<string, IlmActionValue> = {};
    for (const action of phase.actions) {
      const fields: Record<string, string | number | boolean> = {};
      for (const field of action.fields) {
        fields[field.key] = field.default;
      }
      actions[action.id] = { enabled: false, fields };
    }
    result[phase.id] = { enabled: false, min_age: phase.defaultMinAge, actions };
  }
  return result;
}

/** Converts a saved policy's raw `policy.phases` (real ILM API shape) into the structured form value used by the editor. */
export function parsePhasesFromRaw(raw: Record<string, unknown> | undefined): IlmPhasesFormValue {
  const result = buildDefaultPhasesFormValue();
  if (!raw) {
    return result;
  }
  for (const phase of ILM_PHASES) {
    const rawPhase = raw[phase.id];
    if (typeof rawPhase !== 'object' || rawPhase === null) {
      continue;
    }
    const phaseValue = result[phase.id];
    phaseValue.enabled = true;

    const rawPhaseObj = rawPhase as Record<string, unknown>;
    if (typeof rawPhaseObj.min_age === 'string' && rawPhaseObj.min_age) {
      phaseValue.min_age = rawPhaseObj.min_age;
    }

    const rawActions =
      typeof rawPhaseObj.actions === 'object' && rawPhaseObj.actions !== null
        ? (rawPhaseObj.actions as Record<string, unknown>)
        : {};
    for (const action of phase.actions) {
      const rawAction = rawActions[action.id];
      if (rawAction === undefined) {
        continue;
      }
      const actionValue = phaseValue.actions[action.id];
      actionValue.enabled = true;

      const rawFields = typeof rawAction === 'object' && rawAction !== null ? (rawAction as Record<string, unknown>) : {};
      for (const field of action.fields) {
        if (!(field.key in rawFields)) {
          continue;
        }
        const value = rawFields[field.key];
        if (field.type === 'number' && typeof value === 'number') {
          actionValue.fields[field.key] = value;
        } else if (field.type === 'boolean' && typeof value === 'boolean') {
          actionValue.fields[field.key] = value;
        } else if (field.type === 'string' && typeof value === 'string') {
          actionValue.fields[field.key] = value;
        }
      }
    }
  }
  return result;
}

/** Converts the editor's structured form value back into the real `policy.phases` API shape, dropping disabled phases/actions and blank string fields. */
export function buildPhasesJson(formValue: IlmPhasesFormValue): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const phase of ILM_PHASES) {
    const phaseValue = formValue[phase.id];
    if (!phaseValue?.enabled) {
      continue;
    }

    const phaseJson: Record<string, unknown> = {};
    if (phaseValue.min_age && phaseValue.min_age.trim()) {
      phaseJson.min_age = phaseValue.min_age.trim();
    }

    const actionsJson: Record<string, unknown> = {};
    for (const action of phase.actions) {
      const actionValue = phaseValue.actions[action.id];
      if (!actionValue?.enabled) {
        continue;
      }
      const fieldsJson: Record<string, unknown> = {};
      for (const field of action.fields) {
        const value = actionValue.fields[field.key];
        if (field.type === 'string' && (!value || String(value).trim() === '')) {
          continue;
        }
        fieldsJson[field.key] = value;
      }
      actionsJson[action.id] = fieldsJson;
    }
    phaseJson.actions = actionsJson;

    result[phase.id] = phaseJson;
  }
  return result;
}

export function hasEnabledPhase(formValue: IlmPhasesFormValue): boolean {
  return ILM_PHASES.some((phase) => formValue[phase.id]?.enabled);
}
