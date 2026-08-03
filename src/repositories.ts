import * as path from 'path';
import {
  getFleetAgentPoliciesDir,
  getFleetDownloadSourcesDir,
  getFleetProxiesDir,
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
import { FleetAgentPolicy, FleetDownloadSource, FleetProxy, IntegrationPolicy, NamedRef } from './models';

export interface LoadedArtifact<T> {
  /** For Fleet Proxies / Download Sources: the *.json file. For Agent Policies: the *.json file inside the policy folder. */
  filePath: string;
  data: T;
}

export class ArtifactConflictError extends Error {}

// ---------- Fleet Proxies ----------

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

export async function saveFleetProxy(
  existingFilePath: string | undefined,
  data: FleetProxy
): Promise<string> {
  const filePath = existingFilePath ?? path.join(getFleetProxiesDir(), `${data.id}.json`);
  await writeJsonFile(filePath, data);
  return filePath;
}

export async function deleteFleetProxy(filePath: string): Promise<void> {
  await deleteFile(filePath);
}

// ---------- Fleet Download Sources ----------

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

export async function saveFleetDownloadSource(
  existingFilePath: string | undefined,
  data: FleetDownloadSource
): Promise<string> {
  const filePath = existingFilePath ?? path.join(getFleetDownloadSourcesDir(), `${data.id}.json`);
  await writeJsonFile(filePath, data);
  return filePath;
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
