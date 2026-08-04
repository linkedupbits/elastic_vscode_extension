import * as path from 'path';
import {
  getFleetAgentPoliciesDir,
  getFleetDownloadSourcesDir,
  getFleetProxiesDir,
  getIndexLifecyclePoliciesDir,
  getIndexTemplatesDir,
  getIngestPipelinesDir,
  getRoleMappingsDir,
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
  RoleMappingDefinition,
  RoleMappingFile,
} from './models';

export interface LoadedArtifact<T> {
  /** For Fleet Proxies / Download Sources: the *.json file. For Agent Policies: the *.json file inside the policy folder. */
  filePath: string;
  data: T;
}

/** A *.json file that exists but failed to load (e.g. invalid JSON). */
export interface FailedArtifact {
  filePath: string;
  error: Error;
}

/** The result of loading one artifact file: either its parsed data, or the error that loading it threw. */
export type ArtifactResult<T> = LoadedArtifact<T> | FailedArtifact;

export function isLoadedArtifact<T>(item: ArtifactResult<T>): item is LoadedArtifact<T> {
  return 'data' in item;
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * A file can be syntactically valid JSON while still being unusable (e.g. missing the `name`
 * every artifact is keyed/displayed by). Since `readJsonFile` only throws on a JSON syntax
 * error, this check is what makes that kind of malformed-but-parseable file surface as a load
 * error too, instead of rendering as a tree item with a blank/garbage label.
 */
function assertHasName<T extends { name: string }>(data: T, filePath: string): void {
  if (typeof data?.name !== 'string' || data.name.trim() === '') {
    throw new Error(`"${path.basename(filePath)}" is missing a valid "name" field.`);
  }
}

/** Sorts loaded artifacts by name, falling back to the file name for any that failed to load. */
function sortArtifacts<T extends { name: string }>(items: ArtifactResult<T>[]): ArtifactResult<T>[] {
  const sortKey = (item: ArtifactResult<T>): string =>
    isLoadedArtifact(item) ? item.data.name : path.basename(item.filePath);
  return items.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

/** Reads each file with `load`, catching per-file errors instead of letting one bad file fail the whole list. */
async function loadArtifacts<T extends { name: string }>(
  files: string[],
  load: (filePath: string) => Promise<T>
): Promise<ArtifactResult<T>[]> {
  const items = await Promise.all(
    files.map(async (filePath): Promise<ArtifactResult<T>> => {
      try {
        const data = await load(filePath);
        assertHasName(data, filePath);
        return { filePath, data };
      } catch (err) {
        return { filePath, error: toError(err) };
      }
    })
  );
  return sortArtifacts(items);
}

export class ArtifactConflictError extends Error {}

// ---------- Fleet Proxies ----------
// Each lives as a *.json file named after its own `name` attribute.

export async function listFleetProxies(): Promise<ArtifactResult<FleetProxy>[]> {
  const files = await listJsonFiles(getFleetProxiesDir());
  return loadArtifacts(files, (filePath) => readJsonFile<FleetProxy>(filePath));
}

export async function getFleetProxyRefs(): Promise<NamedRef[]> {
  return (await listFleetProxies()).filter(isLoadedArtifact).map(({ data }) => ({ id: data.id, name: data.name }));
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

export async function listFleetDownloadSources(): Promise<ArtifactResult<FleetDownloadSource>[]> {
  const files = await listJsonFiles(getFleetDownloadSourcesDir());
  return loadArtifacts(files, (filePath) => readJsonFile<FleetDownloadSource>(filePath));
}

export async function getFleetDownloadSourceRefs(): Promise<NamedRef[]> {
  return (await listFleetDownloadSources())
    .filter(isLoadedArtifact)
    .map(({ data }) => ({ id: data.id, name: data.name }));
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

export async function listFleetAgentPolicies(): Promise<ArtifactResult<FleetAgentPolicy>[]> {
  const folders = await listSubdirectories(getFleetAgentPoliciesDir());
  const items: ArtifactResult<FleetAgentPolicy>[] = [];
  for (const folder of folders) {
    const expectedFile = path.join(folder, `${path.basename(folder)}.json`);
    if (await pathExists(expectedFile)) {
      try {
        const data = await readJsonFile<FleetAgentPolicy>(expectedFile);
        assertHasName(data, expectedFile);
        items.push({ filePath: expectedFile, data });
      } catch (err) {
        items.push({ filePath: expectedFile, error: toError(err) });
      }
    }
  }
  return sortArtifacts(items);
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
): Promise<ArtifactResult<IntegrationPolicy>[]> {
  const files = await listJsonFiles(getIntegrationsDir(agentPolicyFilePath));
  return loadArtifacts(files, (filePath) => readJsonFile<IntegrationPolicy>(filePath));
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

export async function listIlmPolicies(): Promise<ArtifactResult<IlmPolicyDefinition>[]> {
  const files = await listJsonFiles(getIndexLifecyclePoliciesDir());
  return loadArtifacts(files, (filePath) => readJsonFile<IlmPolicyDefinition>(filePath));
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

export async function listIngestPipelines(): Promise<ArtifactResult<IngestPipelineDefinition>[]> {
  const files = await listJsonFiles(getIngestPipelinesDir());
  return loadArtifacts(files, (filePath) => readJsonFile<IngestPipelineDefinition>(filePath));
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

export async function listIndexTemplates(): Promise<ArtifactResult<IndexTemplateDefinition>[]> {
  const files = await listJsonFiles(getIndexTemplatesDir());
  return loadArtifacts(files, (filePath) => readJsonFile<IndexTemplateDefinition>(filePath));
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

export async function listRoles(): Promise<ArtifactResult<RoleDefinition>[]> {
  const files = await listJsonFiles(getRolesDir());
  return loadArtifacts(files, (filePath) => readJsonFile<RoleDefinition>(filePath));
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

// ---------- Role Mappings ----------
// Each lives as a *.json file named after its own `name` attribute. On disk, the name is
// stored as the file's root JSON key (matching the Elasticsearch Get Role Mapping API
// response shape) rather than as a `name` field in the body - see `RoleMappingFile`.

function roleMappingFromFile(file: RoleMappingFile, filePath: string): RoleMappingDefinition {
  const entries = Object.entries(file);
  if (entries.length !== 1) {
    throw new Error(`"${path.basename(filePath)}" must have exactly one root key (the role mapping name).`);
  }
  const [name, definition] = entries[0];
  if (typeof definition !== 'object' || definition === null || Array.isArray(definition)) {
    throw new Error(`"${path.basename(filePath)}" - the value of "${name}" must be a JSON object.`);
  }
  return { name, ...definition };
}

function roleMappingToFile(data: RoleMappingDefinition): RoleMappingFile {
  const { name, ...definition } = data;
  return { [name]: definition };
}

export async function loadRoleMapping(filePath: string): Promise<RoleMappingDefinition> {
  return roleMappingFromFile(await readJsonFile<RoleMappingFile>(filePath), filePath);
}

export async function listRoleMappings(): Promise<ArtifactResult<RoleMappingDefinition>[]> {
  const files = await listJsonFiles(getRoleMappingsDir());
  return loadArtifacts(files, loadRoleMapping);
}

/**
 * Creates or updates a Role Mapping. If the name changed on an existing role mapping, the
 * json file is renamed to match.
 */
export async function saveRoleMapping(
  existingFilePath: string | undefined,
  data: RoleMappingDefinition
): Promise<string> {
  const targetFile = path.join(getRoleMappingsDir(), `${data.name}.json`);

  if (targetFile !== existingFilePath && (await pathExists(targetFile))) {
    throw new ArtifactConflictError(`A Role Mapping named "${data.name}" already exists.`);
  }

  await writeJsonFile(targetFile, roleMappingToFile(data));
  if (existingFilePath && existingFilePath !== targetFile) {
    await deleteFile(existingFilePath);
  }
  return targetFile;
}

export async function deleteRoleMapping(filePath: string): Promise<void> {
  await deleteFile(filePath);
}
