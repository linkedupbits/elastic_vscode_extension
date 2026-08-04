import * as path from 'path';
import * as vscode from 'vscode';

export class NoWorkspaceError extends Error {
  constructor() {
    super('Open a folder or workspace before using Elastic Source.');
  }
}

function getWorkspaceRoot(): string {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new NoWorkspaceError();
  }
  return folder.uri.fsPath;
}

/** Absolute path to the configured `Elastic_Source` project root. */
export function getElasticSourceRoot(): string {
  const rootFolder = vscode.workspace
    .getConfiguration('elasticSource')
    .get<string>('rootFolder', 'Elastic_Source');
  return path.join(getWorkspaceRoot(), rootFolder || 'Elastic_Source');
}

export function getFleetProxiesDir(): string {
  return path.join(getElasticSourceRoot(), 'Fleet_Proxies');
}

export function getFleetDownloadSourcesDir(): string {
  return path.join(getElasticSourceRoot(), 'Fleet_Download_Sources');
}

export function getFleetAgentPoliciesDir(): string {
  return path.join(getElasticSourceRoot(), 'Fleet_Agent_Policies');
}

export function getIndexLifecyclePoliciesDir(): string {
  return path.join(getElasticSourceRoot(), 'Index_Lifecycle_Policies');
}

export function getIngestPipelinesDir(): string {
  return path.join(getElasticSourceRoot(), 'Ingest_Pipelines');
}

export function getIndexTemplatesDir(): string {
  return path.join(getElasticSourceRoot(), 'Index_Templates');
}

export function getRolesDir(): string {
  return path.join(getElasticSourceRoot(), 'Roles');
}

export function getRoleMappingsDir(): string {
  return path.join(getElasticSourceRoot(), 'Role_Mappings');
}

export function getSpacesDir(): string {
  return path.join(getElasticSourceRoot(), 'Spaces');
}
