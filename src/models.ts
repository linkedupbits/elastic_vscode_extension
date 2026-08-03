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
