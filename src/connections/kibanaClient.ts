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
 * Fetches the full list of Fleet Agent Policies from a connected deployment via the Get Agent
 * Policies API (https://www.elastic.co/docs/api/doc/kibana/operation/operation-get-fleet-agent-policies).
 * Unlike the Spaces API, this one is paginated and wraps the list in an `items` envelope
 * alongside `total`/`page`/`perPage`; `perPage=100` is used to cover typical deployments in a
 * single request rather than implementing full pagination for this read-only tree view.
 */
export async function fetchAgentPolicies(kibanaUrl: string, apiKey: string): Promise<FleetAgentPolicy[]> {
  const response = await kibanaGet(kibanaUrl, apiKey, '/api/fleet/agent_policies?perPage=100');

  if (!response.ok) {
    throw new Error(`Failed to fetch agent policies (${response.status} ${response.statusText}).`);
  }

  const body = (await response.json()) as { items: FleetAgentPolicy[] };
  return body.items;
}

/**
 * Fetches the full list of Fleet Integration (Package) Policies from a connected deployment via
 * the Get Package Policies API (https://www.elastic.co/docs/api/doc/kibana/operation/operation-get-fleet-package-policies).
 * Paginated like Agent Policies; `perPage=100` covers typical deployments in a single request.
 * Each item carries `policy_id`/`policy_ids`, which callers use to assign it to the agent
 * policy/policies it belongs to.
 */
export async function fetchPackagePolicies(kibanaUrl: string, apiKey: string): Promise<FleetPackagePolicy[]> {
  const response = await kibanaGet(kibanaUrl, apiKey, '/api/fleet/package_policies?perPage=100');

  if (!response.ok) {
    throw new Error(`Failed to fetch integration policies (${response.status} ${response.statusText}).`);
  }

  const body = (await response.json()) as { items: FleetPackagePolicy[] };
  return body.items;
}
