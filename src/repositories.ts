import * as path from 'path';
import {
  getAgentPolicyNamePattern,
  getConnectionsDir,
  getFleetAgentPoliciesDir,
  getFleetDownloadSourcesDir,
  getFleetProxiesDir,
  getIndexLifecyclePoliciesDir,
  getIndexTemplatesDir,
  getIngestPipelinesDir,
  getRoleMappingsDir,
  getRolesDir,
  getSnapshotPoliciesDir,
  getSpacesDir,
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
  validateArtifactName,
  writeJsonFile,
} from './fileSystem';
import {
  ConnectionDefinition,
  FleetAgentPolicy,
  FleetDownloadSource,
  FleetPackagePolicy,
  FleetProxy,
  IlmPolicyDefinition,
  IndexTemplateDefinition,
  IngestPipelineDefinition,
  IngestPipelineFile,
  IntegrationPolicy,
  NamedRef,
  RoleDefinition,
  RoleFile,
  RoleMappingDefinition,
  RoleMappingFile,
  SnapshotPolicyDefinition,
  SnapshotPolicyFile,
  SpaceDefinition,
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

/**
 * Sorts loaded artifacts by `sortKey(data)` (by name, unless overridden - e.g. Snapshot
 * Policies sort by `policyId` since their body's own `name` field means something else),
 * falling back to the file name for any that failed to load.
 */
function sortArtifacts<T extends { name: string }>(
  items: ArtifactResult<T>[],
  sortKey: (data: T) => string = (data) => data.name
): ArtifactResult<T>[] {
  const key = (item: ArtifactResult<T>): string =>
    isLoadedArtifact(item) ? sortKey(item.data) : path.basename(item.filePath);
  return items.sort((a, b) => key(a).localeCompare(key(b)));
}

/** Reads each file with `load`, catching per-file errors instead of letting one bad file fail the whole list. */
async function loadArtifacts<T extends { name: string }>(
  files: string[],
  load: (filePath: string) => Promise<T>,
  sortKey?: (data: T) => string
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
  return sortArtifacts(items, sortKey);
}

/**
 * Unwraps a file whose shape mirrors Elasticsearch's own "Get" API response - a single root
 * key holding the artifact's identifier, its value the rest of the definition (used by Roles,
 * Role Mappings and Snapshot Policies; see `RoleFile`/`RoleMappingFile`/`SnapshotPolicyFile`).
 * `keyField` is the property the root key is unwrapped into - usually `name`, but e.g. Snapshot
 * Policies use `policyId` since their body already has its own unrelated `name` field.
 */
function fromNamedWrapperFile<T, K extends string>(
  file: Record<string, T>,
  filePath: string,
  kind: string,
  keyField: K
): { [P in K]: string } & T {
  const entries = Object.entries(file);
  if (entries.length !== 1) {
    throw new Error(`"${path.basename(filePath)}" must have exactly one root key (the ${kind} name).`);
  }
  const [key, definition] = entries[0];
  if (typeof definition !== 'object' || definition === null || Array.isArray(definition)) {
    throw new Error(`"${path.basename(filePath)}" - the value of "${key}" must be a JSON object.`);
  }
  return { [keyField]: key, ...definition } as { [P in K]: string } & T;
}

/** Wraps a value back into its named-root-key on-disk shape, keyed by `data[keyField]`. */
function toNamedWrapperFile<T extends object, K extends keyof T & string>(
  data: T,
  keyField: K
): Record<string, Omit<T, K>> {
  const { [keyField]: key, ...definition } = data as Record<string, unknown>;
  return { [key as string]: definition } as Record<string, Omit<T, K>>;
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
// Each lives as a *.json file named after its own name; unlike other artifact types, the name
// isn't stored in the body at all (see `IngestPipelineFile`) - it's derived from the file name.

export async function loadIngestPipeline(filePath: string): Promise<IngestPipelineDefinition> {
  const body = await readJsonFile<IngestPipelineFile>(filePath);
  return { name: path.basename(filePath, '.json'), ...body };
}

export async function listIngestPipelines(): Promise<ArtifactResult<IngestPipelineDefinition>[]> {
  const files = await listJsonFiles(getIngestPipelinesDir());
  return loadArtifacts(files, loadIngestPipeline);
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

  const { name, ...body } = data;
  await writeJsonFile(targetFile, body);
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
// Each lives as a *.json file named after its own `name` attribute. On disk, the name is
// stored as the file's root JSON key (matching the Elasticsearch Get Role API response shape)
// rather than as a `name` field in the body - see `RoleFile`.

export async function loadRole(filePath: string): Promise<RoleDefinition> {
  return fromNamedWrapperFile(await readJsonFile<RoleFile>(filePath), filePath, 'role', 'name');
}

export async function listRoles(): Promise<ArtifactResult<RoleDefinition>[]> {
  const files = await listJsonFiles(getRolesDir());
  return loadArtifacts(files, loadRole);
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

  await writeJsonFile(targetFile, toNamedWrapperFile(data, 'name'));
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

export async function loadRoleMapping(filePath: string): Promise<RoleMappingDefinition> {
  return fromNamedWrapperFile(await readJsonFile<RoleMappingFile>(filePath), filePath, 'role mapping', 'name');
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

  await writeJsonFile(targetFile, toNamedWrapperFile(data, 'name'));
  if (existingFilePath && existingFilePath !== targetFile) {
    await deleteFile(existingFilePath);
  }
  return targetFile;
}

export async function deleteRoleMapping(filePath: string): Promise<void> {
  await deleteFile(filePath);
}

// ---------- Spaces ----------
// Each lives as a *.json file named after its own `id` attribute (its URL-safe identifier,
// not its display `name`).

export async function listSpaces(): Promise<ArtifactResult<SpaceDefinition>[]> {
  const files = await listJsonFiles(getSpacesDir());
  return loadArtifacts(files, (filePath) => readJsonFile<SpaceDefinition>(filePath));
}

/**
 * Creates or updates a Space. If the id changed on an existing space, the json file is
 * renamed to match.
 */
export async function saveSpace(existingFilePath: string | undefined, data: SpaceDefinition): Promise<string> {
  const targetFile = path.join(getSpacesDir(), `${data.id}.json`);

  if (targetFile !== existingFilePath && (await pathExists(targetFile))) {
    throw new ArtifactConflictError(`A Space with id "${data.id}" already exists.`);
  }

  await writeJsonFile(targetFile, data);
  if (existingFilePath && existingFilePath !== targetFile) {
    await deleteFile(existingFilePath);
  }
  return targetFile;
}

export async function deleteSpace(filePath: string): Promise<void> {
  await deleteFile(filePath);
}

// ---------- Snapshot Policies ----------
// Each lives as a *.json file named after its own `policyId`. On disk, the policy id is
// stored as the file's root JSON key (the real API takes it from the URL path, not the body)
// rather than as a `policyId` field in the body - see `SnapshotPolicyFile`.

export async function loadSnapshotPolicy(filePath: string): Promise<SnapshotPolicyDefinition> {
  return fromNamedWrapperFile(
    await readJsonFile<SnapshotPolicyFile>(filePath),
    filePath,
    'snapshot policy',
    'policyId'
  );
}

export async function listSnapshotPolicies(): Promise<ArtifactResult<SnapshotPolicyDefinition>[]> {
  const files = await listJsonFiles(getSnapshotPoliciesDir());
  return loadArtifacts(files, loadSnapshotPolicy, (data) => data.policyId);
}

/**
 * Creates or updates a Snapshot Policy. If the policy id changed on an existing policy, the
 * json file is renamed to match.
 */
export async function saveSnapshotPolicy(
  existingFilePath: string | undefined,
  data: SnapshotPolicyDefinition
): Promise<string> {
  const targetFile = path.join(getSnapshotPoliciesDir(), `${data.policyId}.json`);

  if (targetFile !== existingFilePath && (await pathExists(targetFile))) {
    throw new ArtifactConflictError(`A Snapshot Policy with id "${data.policyId}" already exists.`);
  }

  await writeJsonFile(targetFile, toNamedWrapperFile(data, 'policyId'));
  if (existingFilePath && existingFilePath !== targetFile) {
    await deleteFile(existingFilePath);
  }
  return targetFile;
}

export async function deleteSnapshotPolicy(filePath: string): Promise<void> {
  await deleteFile(filePath);
}

// ---------- Connections ----------
// Each lives as a *.json file named after its own `id` attribute, generated once at creation
// time (see `generateId` in fileSystem.ts) - unlike most artifact ids, it's never user-entered.
// Only the non-secret metadata (id, name, cloudId) lives here; the API key lives in
// SecretStorage (see connections/connectionManager.ts), never on disk.

export async function listConnections(): Promise<ArtifactResult<ConnectionDefinition>[]> {
  const files = await listJsonFiles(getConnectionsDir());
  return loadArtifacts(files, (filePath) => readJsonFile<ConnectionDefinition>(filePath));
}

/**
 * Creates or updates a Connection's metadata. If the id changed on an existing connection, the
 * json file is renamed to match.
 */
export async function saveConnection(
  existingFilePath: string | undefined,
  data: ConnectionDefinition
): Promise<string> {
  const targetFile = path.join(getConnectionsDir(), `${data.id}.json`);

  if (targetFile !== existingFilePath && (await pathExists(targetFile))) {
    throw new ArtifactConflictError(`A Connection with id "${data.id}" already exists.`);
  }

  await writeJsonFile(targetFile, data);
  if (existingFilePath && existingFilePath !== targetFile) {
    await deleteFile(existingFilePath);
  }
  return targetFile;
}

export async function deleteConnection(filePath: string): Promise<void> {
  await deleteFile(filePath);
}

// ---------- Live Downloads ----------
// "Download to Project" turns a live item fetched from a Connection (see
// connections/kibanaClient.ts) into a local artifact file, the reverse of this project's usual
// direction. Both functions sanitize away any extra fields the live API response may carry
// beyond the known shape (e.g. Kibana's own `_reserved` on a built-in Space) before delegating
// to the normal saveX function, and default to throwing the normal ArtifactConflictError if a
// local artifact already occupies that name/id - pass `overwrite: true` to replace it instead,
// once the caller has confirmed that with the user.

/**
 * Saves a live-fetched Kibana Space as a local Space artifact. Throws `ArtifactConflictError`
 * if a local Space with this id already exists, unless `overwrite` is true.
 */
export async function downloadSpace(data: SpaceDefinition, overwrite = false): Promise<string> {
  const { id, name, description, color, initials, imageUrl, disabledFeatures } = data;
  const sanitized: SpaceDefinition = {
    id,
    name,
    ...(description !== undefined ? { description } : {}),
    ...(color !== undefined ? { color } : {}),
    ...(initials !== undefined ? { initials } : {}),
    ...(imageUrl !== undefined ? { imageUrl } : {}),
    ...(disabledFeatures !== undefined ? { disabledFeatures } : {}),
  };

  const targetFile = path.join(getSpacesDir(), `${sanitized.id}.json`);
  return saveSpace(overwrite ? targetFile : undefined, sanitized);
}

/**
 * Extracts the portion of a live Fleet Agent Policy's (or Integration Policy's) name to use
 * locally, via the configurable `elasticSource.agentPolicyNamePattern` regex (see
 * `getAgentPolicyNamePattern` in config.ts) - e.g. its default strips a trailing
 * " | <environment>" suffix (`"system-datatech-datacentral | test"` → `"system-datatech-datacentral"`)
 * so the same policy downloaded from different environments lands under one consistent local
 * name. Falls back to the full original name if the pattern is invalid or doesn't match, rather
 * than failing the download. Shared by `downloadAgentPolicy` and `downloadIntegrationPolicy`,
 * despite the setting's agent-policy-specific name, since both kinds of live name carry the same
 * per-environment suffix in practice.
 */
function extractDownloadedArtifactName(rawName: string): string {
  try {
    const match = new RegExp(getAgentPolicyNamePattern()).exec(rawName);
    return match?.[1]?.trim() || rawName;
  } catch {
    return rawName;
  }
}

/**
 * Saves a live-fetched Fleet Agent Policy as a local Fleet Agent Policy artifact, with its name
 * run through `extractDownloadedArtifactName` first. Unlike a Space's id, a live policy's name
 * isn't guaranteed to be safe as a folder/file name (it's free text in Kibana, unlike a Kibana
 * space id's constrained charset), so the extracted name is validated the same way the local
 * "New Fleet Agent Policy" form validates one before saving. Throws `ArtifactConflictError` if a
 * local agent policy with this name already exists, unless `overwrite` is true.
 */
export async function downloadAgentPolicy(data: FleetAgentPolicy, overwrite = false): Promise<string> {
  const name = extractDownloadedArtifactName(data.name);

  const nameError = validateArtifactName(name);
  if (nameError) {
    throw new Error(`Cannot download this agent policy: ${nameError}`);
  }

  const sanitized: FleetAgentPolicy = {
    id: data.id,
    name,
    description: data.description,
    monitoring_enabled: data.monitoring_enabled,
    inactivity_timeout: data.inactivity_timeout,
    download_source_id: data.download_source_id,
    schema_version: data.schema_version,
    namespace: data.namespace,
    advanced_settings: data.advanced_settings,
  };

  const targetFile = path.join(getFleetAgentPoliciesDir(), sanitized.name, `${sanitized.name}.json`);
  return saveFleetAgentPolicy(overwrite ? targetFile : undefined, sanitized);
}

/**
 * Finds the local Fleet Agent Policy whose downloaded `id` matches a live Fleet agent policy id
 * (an id is preserved as-is by `downloadAgentPolicy` above). Returns `undefined` if that agent
 * policy hasn't been downloaded to the project yet - a live integration policy can only be
 * downloaded once its owning agent policy already has a local folder for its "Integrations"
 * subfolder to live under.
 */
export async function findAgentPolicyFilePathById(agentPolicyId: string): Promise<string | undefined> {
  const locals = await listFleetAgentPolicies();
  const match = locals.find(
    (item): item is LoadedArtifact<FleetAgentPolicy> => isLoadedArtifact(item) && item.data.id === agentPolicyId
  );
  return match?.filePath;
}

/**
 * Saves a live-fetched Fleet integration (package) policy as a local Integration Policy
 * artifact, nested under its owning agent policy's own "Integrations" folder (see
 * `getIntegrationsDir`) - `agentPolicyFilePath` is normally the result of
 * `findAgentPolicyFilePathById`. Its name is run through `extractDownloadedArtifactName` and
 * validated the same way `downloadAgentPolicy` handles its own live name, since an integration
 * policy name carries the same per-environment " | <environment>" suffix in practice (e.g.
 * `"system-datatech-datacentral | test"` downloads as `"system-datatech-datacentral"`) and,
 * being free text in Kibana, isn't guaranteed to be safe as a file name either. Throws
 * `ArtifactConflictError` if a local integration policy with this name already exists there,
 * unless `overwrite` is true.
 */
export async function downloadIntegrationPolicy(
  agentPolicyFilePath: string,
  data: FleetPackagePolicy,
  overwrite = false
): Promise<string> {
  const name = extractDownloadedArtifactName(data.name);

  const nameError = validateArtifactName(name);
  if (nameError) {
    throw new Error(`Cannot download this integration policy: ${nameError}`);
  }

  const { namespace, description, package: pkg, policy_id, policy_ids, inputs, output_id, vars } = data;
  const sanitized: IntegrationPolicy = {
    name,
    namespace,
    description,
    package: pkg,
    policy_id,
    policy_ids,
    inputs,
    output_id,
    vars,
  };

  const targetFile = path.join(getIntegrationsDir(agentPolicyFilePath), `${sanitized.name}.json`);
  return saveIntegrationPolicy(overwrite ? targetFile : undefined, agentPolicyFilePath, sanitized);
}
