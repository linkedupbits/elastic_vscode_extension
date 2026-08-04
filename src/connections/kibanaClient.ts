import { FleetAgentPolicy, FleetPackagePolicy, SpaceDefinition } from '../models';

/** Shared GET helper: builds the standard authenticated Kibana API request every fetch here uses. */
async function kibanaGet(kibanaUrl: string, apiKey: string, path: string): Promise<Response> {
  const url = `${kibanaUrl.replace(/\/+$/, '')}${path}`;
  return fetch(url, {
    headers: {
      Authorization: `ApiKey ${apiKey}`,
      'kbn-xsrf': 'true',
    },
  });
}

/**
 * Fetches the full list of Kibana Spaces from a connected deployment via the Get All Spaces
 * API (https://www.elastic.co/docs/api/doc/kibana/operation/operation-get-spaces-space). The
 * response body's shape matches `SpaceDefinition` exactly, so it's reused here rather than
 * duplicated as a separate interface.
 */
export async function fetchSpaces(kibanaUrl: string, apiKey: string): Promise<SpaceDefinition[]> {
  const response = await kibanaGet(kibanaUrl, apiKey, '/api/spaces/space');

  if (!response.ok) {
    throw new Error(`Failed to fetch spaces (${response.status} ${response.statusText}).`);
  }

  return (await response.json()) as SpaceDefinition[];
}

/**
 * Prefixes `path` with Kibana's space-scoping URL segment
 * (https://www.elastic.co/docs/api/doc/kibana/operation/operation-get-spaces-space), so a
 * request is resolved against a specific space's saved objects rather than the deployment's
 * default space. Kibana treats the default space as the unprefixed base path, so `'default'`
 * (and `undefined`, for callers that aren't space-aware) is left unprefixed rather than
 * rewritten to `/s/default`.
 */
function spaceScopedPath(path: string, spaceId?: string): string {
  return spaceId && spaceId !== 'default' ? `/s/${spaceId}${path}` : path;
}

/** Page size used when following pagination on the paginated Fleet list endpoints below. */
const FLEET_PAGE_SIZE = 100;

/**
 * Fully paginates one of Fleet's list endpoints (Agent Policies, Package Policies), which both
 * wrap their results in an `{ items, total, page, perPage }` envelope. Requests `perPage`-sized
 * pages, starting at `page=1`, until either the accumulated item count reaches the API's
 * reported `total` or a page comes back short (fewer than `perPage` items) - the latter is a
 * safety net for a deployment that never reports `total`, so an endpoint drifting from the
 * documented shape can't turn into an infinite loop.
 */
async function fetchAllPages<T>(
  kibanaUrl: string,
  apiKey: string,
  basePath: string,
  spaceId: string | undefined,
  errorNoun: string
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;

  for (;;) {
    const separator = basePath.includes('?') ? '&' : '?';
    const path = `${basePath}${separator}perPage=${FLEET_PAGE_SIZE}&page=${page}`;
    const response = await kibanaGet(kibanaUrl, apiKey, spaceScopedPath(path, spaceId));

    if (!response.ok) {
      throw new Error(`Failed to fetch ${errorNoun} (${response.status} ${response.statusText}).`);
    }

    const body = (await response.json()) as { items: T[]; total?: number };
    items.push(...body.items);

    const reachedTotal = body.total !== undefined && items.length >= body.total;
    const gotShortPage = body.items.length < FLEET_PAGE_SIZE;
    if (reachedTotal || gotShortPage) {
      break;
    }
    page += 1;
  }

  return items;
}

/**
 * Fetches the full list of Fleet Agent Policies from a connected deployment via the Get Agent
 * Policies API (https://www.elastic.co/docs/api/doc/kibana/operation/operation-get-fleet-agent-policies),
 * following its pagination (see `fetchAllPages`) so deployments with more than one page of agent
 * policies are shown in full. An agent policy can belong to more than one space, so `spaceId`
 * scopes the request to the policies visible from that particular space (omit it, or pass
 * `'default'`, for the deployment's default space).
 */
export async function fetchAgentPolicies(
  kibanaUrl: string,
  apiKey: string,
  spaceId?: string
): Promise<FleetAgentPolicy[]> {
  return fetchAllPages<FleetAgentPolicy>(kibanaUrl, apiKey, '/api/fleet/agent_policies', spaceId, 'agent policies');
}

/**
 * Fetches the full list of Fleet Integration (Package) Policies from a connected deployment via
 * the Get Package Policies API (https://www.elastic.co/docs/api/doc/kibana/operation/operation-get-fleet-package-policies),
 * following its pagination the same way `fetchAgentPolicies` does. Each item carries
 * `policy_id`/`policy_ids`, which callers use to assign it to the agent policy/policies it
 * belongs to. `spaceId` scopes the request the same way as `fetchAgentPolicies` - callers pass
 * the same space to both so the two lists line up.
 */
export async function fetchPackagePolicies(
  kibanaUrl: string,
  apiKey: string,
  spaceId?: string
): Promise<FleetPackagePolicy[]> {
  return fetchAllPages<FleetPackagePolicy>(
    kibanaUrl,
    apiKey,
    '/api/fleet/package_policies',
    spaceId,
    'integration policies'
  );
}
