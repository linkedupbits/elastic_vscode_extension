import * as path from 'path';
import {
  getFleetAgentPoliciesDir,
  getFleetDownloadSourcesDir,
  getFleetProxiesDir,
  getIndexLifecyclePoliciesDir,
  getIndexTemplatesDir,
  getIngestPipelinesDir,
  getRolesDir,
} from './config';
import {
  deleteFile,
  deleteFolderRecursive,
  ensureDir,
  listJsonFiles,
  listSubdirectories,
  pathExists,
  readJsonFile,
  renameFolder,
  writeJsonFile,
} from './fileSystem';
import {
  FleetAgentPolicy,
  FleetDownloadSource,
  FleetProxy,
  IlmPolicyDefinition,
  IndexTemplateDefinition,
  IngestPipelineDefinition,
  IntegrationPolicy,
  NamedRef,
  RoleDefinition,
} from './models';

export interface LoadedArtifact<T> {
  /** For Fleet Proxies / Download Sources: the *.json file. For Agent Policies: the *.json file inside the policy folder. */
  filePath: string;
  data: T;
}

export class ArtifactConflictError extends Error {}

// ---------- Fleet Proxies ----------
// Each lives as a *.json file named after its own `name` attribute.

export async function listFleetProxies(): Promise<LoadedArtifact<FleetProxy>[]> {
  const files = await listJsonFiles(getFleetProxiesDir());
  const items = await Promise.all(
    files.map(async (filePath) => ({ filePath, data: await readJsonFile<FleetProxy>(filePath) }))
  );
  return items.sort((a, b) => a.data.name.localeCompare(b.data.name));
}

export async function getFleetProxyRefs(): Promise<NamedRef[]> {
  return (await listFleetProxies()).map(({ data }) => ({ id: data.id, name: data.name }));
}

/**
 * Creates or updates a Fleet Proxy. If the name changed on an existing proxy, the json
 * file is renamed to match.
 */
export async function saveFleetProxy(
  existingFilePath: string | undefined,
  data: FleetProxy
): Promise<string> {
  const targetFile = path.join(getFleetProxiesDir(), `${data.name}.json`);

  if (targetFile !== existingFilePath && (await pathExists(targetFile))) {
    throw new ArtifactConflictError(`A Fleet Proxy named "${data.name}" already exists.`);
  }

  await writeJsonFile(targetFile, data);
  if (existingFilePath && existingFilePath !== targetFile) {
    await deleteFile(existingFilePath);
  }
  return targetFile;
}

export async function deleteFleetProxy(filePath: string): Promise<void> {
  await deleteFile(filePath);
}

// ---------- Fleet Download Sources ----------
// Each lives as a *.json file named after its own `name` attribute.

export async function listFleetDownloadSources(): Promise<LoadedArtifact<FleetDownloadSource>[]> {
  const files = await listJsonFiles(getFleetDownloadSourcesDir());
  const items = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      data: await readJsonFile<FleetDownloadSource>(filePath),
    }))
  );
  return items.sort((a, b) => a.data.name.localeCompare(b.data.name));
}

export async function getFleetDownloadSourceRefs(): Promise<NamedRef[]> {
  return (await listFleetDownloadSources()).map(({ data }) => ({ id: data.id, name: data.name }));
}

/**
 * Creates or updates a Fleet Download Source. If the name changed on an existing download
 * source, the json file is renamed to match.
 */
export async function saveFleetDownloadSource(
  existingFilePath: string | undefined,
  data: FleetDownloadSource
): Promise<string> {
  const targetFile = path.join(getFleetDownloadSourcesDir(), `${data.name}.json`);

  if (targetFile !== existingFilePath && (await pathExists(targetFile))) {
    throw new ArtifactConflictError(`A Fleet Download Source named "${data.name}" already exists.`);
  }

  await writeJsonFile(targetFile, data);
  if (existingFilePath && existingFilePath !== targetFile) {
    await deleteFile(existingFilePath);
  }
  return targetFile;
}

export async function deleteFleetDownloadSource(filePath: string): Promise<void> {
  await deleteFile(filePath);
}

// ---------- Fleet Agent Policies ----------
// Each policy lives in its own folder: Fleet_Agent_Policies/<name>/<name>.json

export async function listFleetAgentPolicies(): Promise<LoadedArtifact<FleetAgentPolicy>[]> {
  const folders = await listSubdirectories(getFleetAgentPoliciesDir());
  const items: LoadedArtifact<FleetAgentPolicy>[] = [];
  for (const folder of folders) {
    const expectedFile = path.join(folder, `${path.basename(folder)}.json`);
    if (await pathExists(expectedFile)) {
      items.push({ filePath: expectedFile, data: await readJsonFile<FleetAgentPolicy>(expectedFile) });
    }
  }
  return items.sort((a, b) => a.data.name.localeCompare(b.data.name));
}

/**
 * Creates or updates an agent policy. If the name changed on an existing policy, the
 * folder and the json file are renamed to match, since the spec requires folder/file
 * name === policy name.
 */
export async function saveFleetAgentPolicy(
  existingFilePath: string | undefined,
  data: FleetAgentPolicy
): Promise<string> {
  const targetFolder = path.join(getFleetAgentPoliciesDir(), data.name);
  const targetFile = path.join(targetFolder, `${data.name}.json`);
  const existingFolder = existingFilePath ? path.dirname(existingFilePath) : undefined;

  if (existingFolder && existingFolder !== targetFolder) {
    if (await pathExists(targetFolder)) {
      throw new ArtifactConflictError(
        `An agent policy folder named "${data.name}" already exists.`
      );
    }
    await renameFolder(existingFolder, targetFolder);
    const staleFile = path.join(targetFolder, path.basename(existingFilePath as string));
    if (staleFile !== targetFile && (await pathExists(staleFile))) {
      await deleteFile(staleFile);
    }
  } else if (!existingFolder && (await pathExists(targetFolder))) {
    throw new ArtifactConflictError(
      `An agent policy folder named "${data.name}" already exists.`
    );
  }

  await ensureDir(targetFolder);
  await writeJsonFile(targetFile, data);
  return targetFile;
}

export async function deleteFleetAgentPolicy(filePath: string): Promise<void> {
  await deleteFolderRecursive(path.dirname(filePath));
}

// ---------- Integration Policies ----------
// Each lives as a *.json file inside an "Integrations" folder next to its owning Agent
// Policy's own file, e.g. Fleet_Agent_Policies/<Policy>/Integrations/<name>.json, named
// after its own `name` attribute.

/** The Integrations folder that holds the given agent policy's integration policy files. */
export function getIntegrationsDir(agentPolicyFilePath: string): string {
  return path.join(path.dirname(agentPolicyFilePath), 'Integrations');
}

export async function listIntegrationPolicies(
  agentPolicyFilePath: string
): Promise<LoadedArtifact<IntegrationPolicy>[]> {
  const files = await listJsonFiles(getIntegrationsDir(agentPolicyFilePath));
  const items = await Promise.all(
    files.map(async (filePath) => ({ filePath, data: await readJsonFile<IntegrationPolicy>(filePath) }))
  );
  return items.sort((a, b) => a.data.name.localeCompare(b.data.name));
}

/**
 * Creates or updates an integration policy inside its owning agent policy's Integrations
 * folder. If the name changed on an existing policy, the json file is renamed to match,
 * mirroring the name-must-match-filename rule used for Agent Policies.
 */
export async function saveIntegrationPolicy(
  existingFilePath: string | undefined,
  agentPolicyFilePath: string,
  data: IntegrationPolicy
): Promise<string> {
  const targetFile = path.join(getIntegrationsDir(agentPolicyFilePath), `${data.name}.json`);

  if (targetFile !== existingFilePath && (await pathExists(targetFile))) {
    throw new ArtifactConflictError(
      `An integration policy named "${data.name}" already exists in this agent policy.`
    );
  }

  await writeJsonFile(targetFile, data);
  if (existingFilePath && existingFilePath !== targetFile) {
    await deleteFile(existingFilePath);
  }
  return targetFile;
}

export async function deleteIntegrationPolicy(filePath: string): Promise<void> {
  await deleteFile(filePath);
}

// ---------- Index Lifecycle Policies ----------
// Each lives as a *.json file named after its own `name` attribute.

export async function listIlmPolicies(): Promise<LoadedArtifact<IlmPolicyDefinition>[]> {
  const files = await listJsonFiles(getIndexLifecyclePoliciesDir());
  const items = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      data: await readJsonFile<IlmPolicyDefinition>(filePath),
    }))
  );
  return items.sort((a, b) => a.data.name.localeCompare(b.data.name));
}

/**
 * Creates or updates an Index Lifecycle Policy. If the name changed on an existing policy,
 * the json file is renamed to match.
 */
export async function saveIlmPolicy(
  existingFilePath: string | undefined,
  data: IlmPolicyDefinition
): Promise<string> {
  const targetFile = path.join(getIndexLifecyclePoliciesDir(), `${data.name}.json`);

  if (targetFile !== existingFilePath && (await pathExists(targetFile))) {
    throw new ArtifactConflictError(`An Index Lifecycle Policy named "${data.name}" already exists.`);
  }

  await writeJsonFile(targetFile, data);
  if (existingFilePath && existingFilePath !== targetFile) {
    await deleteFile(existingFilePath);
  }
  return targetFile;
}

export async function deleteIlmPolicy(filePath: string): Promise<void> {
  await deleteFile(filePath);
}

// ---------- Ingest Pipelines ----------
// Each lives as a *.json file named after its own `name` attribute.

export async function listIngestPipelines(): Promise<LoadedArtifact<IngestPipelineDefinition>[]> {
  const files = await listJsonFiles(getIngestPipelinesDir());
  const items = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      data: await readJsonFile<IngestPipelineDefinition>(filePath),
    }))
  );
  return items.sort((a, b) => a.data.name.localeCompare(b.data.name));
}

/**
 * Creates or updates an Ingest Pipeline. If the name changed on an existing pipeline, the
 * json file is renamed to match.
 */
export async function saveIngestPipeline(
  existingFilePath: string | undefined,
  data: IngestPipelineDefinition
): Promise<string> {
  const targetFile = path.join(getIngestPipelinesDir(), `${data.name}.json`);

  if (targetFile !== existingFilePath && (await pathExists(targetFile))) {
    throw new ArtifactConflictError(`An Ingest Pipeline named "${data.name}" already exists.`);
  }

  await writeJsonFile(targetFile, data);
  if (existingFilePath && existingFilePath !== targetFile) {
    await deleteFile(existingFilePath);
  }
  return targetFile;
}

export async function deleteIngestPipeline(filePath: string): Promise<void> {
  await deleteFile(filePath);
}

// ---------- Index Templates ----------
// Each lives as a *.json file named after its own `name` attribute.

export async function listIndexTemplates(): Promise<LoadedArtifact<IndexTemplateDefinition>[]> {
  const files = await listJsonFiles(getIndexTemplatesDir());
  const items = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      data: await readJsonFile<IndexTemplateDefinition>(filePath),
    }))
  );
  return items.sort((a, b) => a.data.name.localeCompare(b.data.name));
}

/**
 * Creates or updates an Index Template. If the name changed on an existing template, the
 * json file is renamed to match.
 */
export async function saveIndexTemplate(
  existingFilePath: string | undefined,
  data: IndexTemplateDefinition
): Promise<string> {
  const targetFile = path.join(getIndexTemplatesDir(), `${data.name}.json`);

  if (targetFile !== existingFilePath && (await pathExists(targetFile))) {
    throw new ArtifactConflictError(`An Index Template named "${data.name}" already exists.`);
  }

  await writeJsonFile(targetFile, data);
  if (existingFilePath && existingFilePath !== targetFile) {
    await deleteFile(existingFilePath);
  }
  return targetFile;
}

export async function deleteIndexTemplate(filePath: string): Promise<void> {
  await deleteFile(filePath);
}

// ---------- Roles ----------
// Each lives as a *.json file named after its own `name` attribute.

export async function listRoles(): Promise<LoadedArtifact<RoleDefinition>[]> {
  const files = await listJsonFiles(getRolesDir());
  const items = await Promise.all(
    files.map(async (filePath) => ({ filePath, data: await readJsonFile<RoleDefinition>(filePath) }))
  );
  return items.sort((a, b) => a.data.name.localeCompare(b.data.name));
}

/**
 * Creates or updates a Role. If the name changed on an existing role, the json file is
 * renamed to match.
 */
export async function saveRole(existingFilePath: string | undefined, data: RoleDefinition): Promise<string> {
  const targetFile = path.join(getRolesDir(), `${data.name}.json`);

  if (targetFile !== existingFilePath && (await pathExists(targetFile))) {
    throw new ArtifactConflictError(`A Role named "${data.name}" already exists.`);
  }

  await writeJsonFile(targetFile, data);
  if (existingFilePath && existingFilePath !== targetFile) {
    await deleteFile(existingFilePath);
  }
  return targetFile;
}

export async function deleteRole(filePath: string): Promise<void> {
  await deleteFile(filePath);
}
