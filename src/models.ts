export interface FleetProxy {
  id: string;
  name: string;
  url: string;
  certificate_authorities: string;
  certificates: string;
  certificate_key: string;
  is_preconfigured: boolean;
}

export interface FleetDownloadSource {
  id: string;
  name: string;
  host: string;
  is_default: boolean;
  proxy_id: string;
}

export type MonitoringTarget = 'logs' | 'metrics';

export interface AdvancedSettings {
  agent_logging_level?: 'error' | 'warning' | 'info' | 'debug' | '';
}

export interface FleetAgentPolicy {
  id: string;
  name: string;
  description: string;
  monitoring_enabled: MonitoringTarget[];
  inactivity_timeout: number;
  download_source_id: string;
  schema_version: string;
  namespace: string;
  advanced_settings: AdvancedSettings;
}

/** Minimal { id, name } projection used to populate dropdowns. */
export interface NamedRef {
  id: string;
  name: string;
}

export type VarValue = string | number | boolean | string[];

export interface IntegrationStreamValue {
  enabled: boolean;
  vars: Record<string, VarValue>;
}

export interface IntegrationInputValue {
  enabled: boolean;
  /** Absent when the input type has no input-level vars (matches the real Fleet API payload shape). */
  vars?: Record<string, VarValue>;
  streams: Record<string, IntegrationStreamValue>;
}

export interface IntegrationPackageRef {
  name: string;
  title: string;
  version: string;
  requires_root: boolean;
}

export interface IntegrationPolicy {
  name: string;
  namespace: string;
  description: string;
  package: IntegrationPackageRef;
  policy_id: string;
  policy_ids: string[];
  inputs: Record<string, IntegrationInputValue>;
  output_id: string | null;
  vars: Record<string, VarValue>;
}

export type IlmDataStreamType = 'logs' | 'metrics';

/** Maps this ILM policy onto the specific integration data streams it should apply to. */
export interface IntegrationLifecycleMapping {
  data_stream_type: IlmDataStreamType;
  dataset_name: string;
  integration_name: string;
  namespace: string;
}

/**
 * Body shape of the Elasticsearch ILM Put Lifecycle API
 * (https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-ilm-put-lifecycle).
 * `phases` is free-form since its shape varies per phase/action; `name` is not part of the
 * API body (it's the URL path segment) but is kept here since it drives the saved file name.
 * `integration_lifecycle_mappings` is not part of the Elasticsearch API either - it's this
 * project's own record of which integration data streams this policy applies to.
 */
export interface IlmPolicyDefinition {
  name: string;
  policy: {
    phases: Record<string, unknown>;
    _meta?: Record<string, unknown>;
  };
  integration_lifecycle_mappings: IntegrationLifecycleMapping[];
}

/**
 * Body shape of the Elasticsearch Put Pipeline API
 * (https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-ingest-put-pipeline).
 * Maps directly onto the real API body - there's no wrapper key, and unlike most other
 * artifact types in this project, `name` isn't persisted in the file at all: it's derived from
 * the file name (see `IngestPipelineFile`), since the API itself takes the pipeline name from
 * the URL path rather than the body. `processors`/`on_failure` are left free-form (each entry
 * is `{ <processor_type>: { ...config } }`) since Elasticsearch supports dozens of processor
 * types with very different configs.
 */
export interface IngestPipelineDefinition {
  name: string;
  description?: string;
  processors: Record<string, unknown>[];
  on_failure?: Record<string, unknown>[];
  version?: number;
  _meta?: Record<string, unknown>;
  deprecated?: boolean;
}

/** On-disk shape of an Ingest Pipeline file: the same as the real API body, with no `name` field. */
export type IngestPipelineFile = Omit<IngestPipelineDefinition, 'name'>;

export interface IndexTemplateDataStream {
  hidden?: boolean;
  allow_custom_routing?: boolean;
}

/**
 * Body shape of the Elasticsearch Put Index Template API
 * (https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-indices-put-index-template).
 * Maps directly onto the real API body - there's no wrapper key - except for `name`, which
 * isn't part of the body (it's the URL path segment) but is kept here since it drives the
 * saved file name. `template.settings`/`template.mappings`/`template.aliases` are left
 * free-form since index settings and field mappings are both open-ended schemas (arbitrarily
 * nested field types, plugin-provided settings, etc), unlike the rest of this shape.
 */
export interface IndexTemplateDefinition {
  name: string;
  index_patterns: string[];
  composed_of?: string[];
  priority?: number;
  version?: number;
  _meta?: Record<string, unknown>;
  template?: {
    settings?: Record<string, unknown>;
    mappings?: Record<string, unknown>;
    aliases?: Record<string, unknown>;
  };
  data_stream?: IndexTemplateDataStream;
  allow_auto_create?: boolean;
  ignore_missing_component_templates?: string[];
  deprecated?: boolean;
}

/**
 * Body shape of the Elasticsearch Put Role API
 * (https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-put-role).
 * Maps directly onto the real API body - there's no wrapper key - except for `name`, which
 * isn't part of the body (it's the URL path segment) but is kept here since it drives the
 * saved file name and (per `RoleFile` below) the saved file's root JSON key.
 * `indices`/`remote_indices`/`applications`/`remote_cluster` are left as
 * `Record<string, unknown>[]` since their structured shape is enforced/documented by
 * ../roles/rolePrivilegeTemplates.ts's form-value interfaces instead (mirroring how
 * `IngestPipelineDefinition.processors` is typed). `metadata` and `global` are left free-form:
 * `metadata` is arbitrary user metadata (like `_meta` elsewhere in this project), and `global`
 * describes conditional "global" privileges whose shape is itself open-ended (e.g. nested
 * application-management privilege conditions), unlike the rest of this shape.
 */
export interface RoleDefinition {
  name: string;
  description?: string;
  cluster?: string[];
  indices?: Record<string, unknown>[];
  remote_indices?: Record<string, unknown>[];
  applications?: Record<string, unknown>[];
  remote_cluster?: Record<string, unknown>[];
  run_as?: string[];
  metadata?: Record<string, unknown>;
  global?: Record<string, unknown>;
}

/**
 * On-disk shape of a Role file. Unlike `RoleDefinition`, the name is stored as the single root
 * JSON key rather than a `name` field, matching the shape Elasticsearch's own Get Role API
 * returns (https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-get-role).
 */
export type RoleFile = Record<string, Omit<RoleDefinition, 'name'>>;

/**
 * Body shape of the Elasticsearch Put Role Mapping API
 * (https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-put-role-mapping).
 * Maps directly onto the real API body - there's no wrapper key - except for `name`, which
 * isn't part of the body (it's the URL path segment) but is kept here since it drives the
 * saved file name and (per `RoleMappingFile` below) the saved file's root JSON key.
 * `role_templates` is left as `Record<string, unknown>[]` since its shape is
 * enforced/documented by ../roleMappings/roleTemplateRowTemplate.ts's form-value interface
 * instead. `rules` is left free-form: it's a recursive boolean expression tree (`field`,
 * `except`, `all`, `any`) whose shape is open-ended, much like a Query DSL object elsewhere in
 * this project, so it isn't practical to curate as structured fields. `enabled` is omitted
 * when true (Elasticsearch's own default) and only written out as an explicit `false`.
 */
export interface RoleMappingDefinition {
  name: string;
  enabled?: boolean;
  roles?: string[];
  role_templates?: Record<string, unknown>[];
  rules: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * On-disk shape of a Role Mapping file. Unlike `RoleMappingDefinition`, the name is stored as
 * the single root JSON key rather than a `name` field, matching the shape Elasticsearch's own
 * Get Role Mapping API returns
 * (https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-get-role-mapping).
 */
export type RoleMappingFile = Record<string, Omit<RoleMappingDefinition, 'name'>>;
