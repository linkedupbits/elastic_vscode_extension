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

/**
 * Body shape of the Elasticsearch ILM Put Lifecycle API
 * (https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-ilm-put-lifecycle).
 * `phases` is free-form since its shape varies per phase/action; `name` is not part of the
 * API body (it's the URL path segment) but is kept here since it drives the saved file name.
 */
export interface IlmPolicyDefinition {
  name: string;
  policy: {
    phases: Record<string, unknown>;
    _meta?: Record<string, unknown>;
  };
}
