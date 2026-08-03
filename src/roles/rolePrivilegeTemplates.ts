/**
 * Structural helpers for the repeatable privilege-grant rows of an Elasticsearch role
 * definition (https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-put-role):
 * `indices`, `remote_indices`, `applications` and `remote_cluster`. Each is a fixed, bounded
 * shape (unlike `metadata`/`global`, which stay free-form JSON in ../models.ts's
 * RoleDefinition since they're genuinely open-ended), so each is rendered as a repeatable list
 * of structured rows in the editor - mirroring the row patterns already used for Integration
 * Lifecycle Mappings, Ingest processors and Index Template aliases/mapping fields.
 */

function toStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((v) => String(v).trim()).filter((v) => v.length > 0);
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((v): v is string => typeof v === 'string');
}

function parseOptionalJsonObject(raw: string, fieldLabel: string): Record<string, unknown> | undefined {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`${fieldLabel} must be valid JSON.`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

// ---------- Index Privileges (`indices` / `remote_indices`) ----------

export interface IndexPrivilegeFormValue {
  names: string[];
  privileges: string[];
  allowRestrictedIndices: boolean;
  fieldSecurityGrant: string[];
  fieldSecurityExcept: string[];
  query: string;
}

export function buildDefaultIndexPrivilegeValue(): IndexPrivilegeFormValue {
  return {
    names: [],
    privileges: [],
    allowRestrictedIndices: false,
    fieldSecurityGrant: [],
    fieldSecurityExcept: [],
    query: '',
  };
}

function parseIndexPrivilegeFields(raw: Record<string, unknown>): IndexPrivilegeFormValue {
  const fieldSecurity = raw.field_security;
  const fieldSecurityObj =
    fieldSecurity && typeof fieldSecurity === 'object' && !Array.isArray(fieldSecurity)
      ? (fieldSecurity as Record<string, unknown>)
      : undefined;
  const query = raw.query;
  return {
    names: parseStringArray(raw.names),
    privileges: parseStringArray(raw.privileges),
    allowRestrictedIndices: raw.allow_restricted_indices === true,
    fieldSecurityGrant: parseStringArray(fieldSecurityObj?.grant),
    fieldSecurityExcept: parseStringArray(fieldSecurityObj?.except),
    query: typeof query === 'string' ? query : '',
  };
}

/** Converts a saved role's raw `indices` array (real API shape) into the structured form value used by the editor. */
export function parseIndexPrivilegesFromRaw(raw: unknown[] | undefined): IndexPrivilegeFormValue[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((entry) => parseIndexPrivilegeFields((entry ?? {}) as Record<string, unknown>));
}

function buildIndexPrivilegeFields(value: IndexPrivilegeFormValue, rowLabel: string): Record<string, unknown> {
  const names = toStringArray(value.names);
  if (names.length === 0) {
    throw new Error(`${rowLabel}: At least one index name/pattern is required.`);
  }
  const privileges = toStringArray(value.privileges);
  if (privileges.length === 0) {
    throw new Error(`${rowLabel}: At least one privilege is required.`);
  }

  const grant = toStringArray(value.fieldSecurityGrant);
  const except = toStringArray(value.fieldSecurityExcept);
  const fieldSecurity = grant.length > 0 || except.length > 0 ? { ...(grant.length > 0 ? { grant } : {}), ...(except.length > 0 ? { except } : {}) } : undefined;

  const queryRaw = (value.query ?? '').trim();
  if (queryRaw) {
    try {
      JSON.parse(queryRaw);
    } catch {
      throw new Error(`${rowLabel}: Query must be valid JSON.`);
    }
  }

  return {
    names,
    privileges,
    ...(value.allowRestrictedIndices ? { allow_restricted_indices: true } : {}),
    ...(fieldSecurity ? { field_security: fieldSecurity } : {}),
    ...(queryRaw ? { query: queryRaw } : {}),
  };
}

/** Converts the editor's structured index privilege rows back into a real `indices` array, throwing a row-labeled error on the first invalid row. */
export function buildIndexPrivilegesJson(values: IndexPrivilegeFormValue[], fieldLabel: string): Record<string, unknown>[] {
  return values.map((value, index) => buildIndexPrivilegeFields(value, `${fieldLabel} ${index + 1}`));
}

// ---------- Remote Index Privileges (`remote_indices`) ----------

export interface RemoteIndexPrivilegeFormValue extends IndexPrivilegeFormValue {
  clusters: string[];
}

export function buildDefaultRemoteIndexPrivilegeValue(): RemoteIndexPrivilegeFormValue {
  return { ...buildDefaultIndexPrivilegeValue(), clusters: [] };
}

/** Converts a saved role's raw `remote_indices` array (real API shape) into the structured form value used by the editor. */
export function parseRemoteIndexPrivilegesFromRaw(raw: unknown[] | undefined): RemoteIndexPrivilegeFormValue[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((entry) => {
    const obj = (entry ?? {}) as Record<string, unknown>;
    return { ...parseIndexPrivilegeFields(obj), clusters: parseStringArray(obj.clusters) };
  });
}

/** Converts the editor's structured remote index privilege rows back into a real `remote_indices` array, throwing a row-labeled error on the first invalid row. */
export function buildRemoteIndexPrivilegesJson(
  values: RemoteIndexPrivilegeFormValue[],
  fieldLabel: string
): Record<string, unknown>[] {
  return values.map((value, index) => {
    const rowLabel = `${fieldLabel} ${index + 1}`;
    const clusters = toStringArray(value.clusters);
    if (clusters.length === 0) {
      throw new Error(`${rowLabel}: At least one cluster is required.`);
    }
    return { clusters, ...buildIndexPrivilegeFields(value, rowLabel) };
  });
}

// ---------- Application Privileges (`applications`) ----------

export interface ApplicationPrivilegeFormValue {
  application: string;
  privileges: string[];
  resources: string[];
}

export function buildDefaultApplicationPrivilegeValue(): ApplicationPrivilegeFormValue {
  return { application: '', privileges: [], resources: [] };
}

/** Converts a saved role's raw `applications` array (real API shape) into the structured form value used by the editor. */
export function parseApplicationPrivilegesFromRaw(raw: unknown[] | undefined): ApplicationPrivilegeFormValue[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((entry) => {
    const obj = (entry ?? {}) as Record<string, unknown>;
    return {
      application: typeof obj.application === 'string' ? obj.application : '',
      privileges: parseStringArray(obj.privileges),
      resources: parseStringArray(obj.resources),
    };
  });
}

/** Converts the editor's structured application privilege rows back into a real `applications` array, throwing a row-labeled error on the first invalid row. */
export function buildApplicationPrivilegesJson(
  values: ApplicationPrivilegeFormValue[],
  fieldLabel: string
): Record<string, unknown>[] {
  return values.map((value, index) => {
    const rowLabel = `${fieldLabel} ${index + 1}`;
    const application = (value.application ?? '').trim();
    if (!application) {
      throw new Error(`${rowLabel}: Application is required.`);
    }
    const privileges = toStringArray(value.privileges);
    if (privileges.length === 0) {
      throw new Error(`${rowLabel}: At least one privilege is required.`);
    }
    const resources = toStringArray(value.resources);
    if (resources.length === 0) {
      throw new Error(`${rowLabel}: At least one resource is required.`);
    }
    return { application, privileges, resources };
  });
}

// ---------- Remote Cluster Privileges (`remote_cluster`) ----------

export interface RemoteClusterPrivilegeFormValue {
  clusters: string[];
  privileges: string[];
}

export function buildDefaultRemoteClusterPrivilegeValue(): RemoteClusterPrivilegeFormValue {
  return { clusters: [], privileges: [] };
}

/** Converts a saved role's raw `remote_cluster` array (real API shape) into the structured form value used by the editor. */
export function parseRemoteClusterPrivilegesFromRaw(raw: unknown[] | undefined): RemoteClusterPrivilegeFormValue[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((entry) => {
    const obj = (entry ?? {}) as Record<string, unknown>;
    return { clusters: parseStringArray(obj.clusters), privileges: parseStringArray(obj.privileges) };
  });
}

/** Converts the editor's structured remote cluster privilege rows back into a real `remote_cluster` array, throwing a row-labeled error on the first invalid row. */
export function buildRemoteClusterPrivilegesJson(
  values: RemoteClusterPrivilegeFormValue[],
  fieldLabel: string
): Record<string, unknown>[] {
  return values.map((value, index) => {
    const rowLabel = `${fieldLabel} ${index + 1}`;
    const clusters = toStringArray(value.clusters);
    if (clusters.length === 0) {
      throw new Error(`${rowLabel}: At least one cluster is required.`);
    }
    const privileges = toStringArray(value.privileges);
    if (privileges.length === 0) {
      throw new Error(`${rowLabel}: At least one privilege is required.`);
    }
    return { clusters, privileges };
  });
}

export { parseOptionalJsonObject, toStringArray };
