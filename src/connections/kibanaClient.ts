import { SpaceDefinition } from '../models';

/**
 * Fetches the full list of Kibana Spaces from a connected deployment via the Get All Spaces
 * API (https://www.elastic.co/docs/api/doc/kibana/operation/operation-get-spaces-space). The
 * response body's shape matches `SpaceDefinition` exactly, so it's reused here rather than
 * duplicated as a separate interface.
 */
export async function fetchSpaces(kibanaUrl: string, apiKey: string): Promise<SpaceDefinition[]> {
  const url = `${kibanaUrl.replace(/\/+$/, '')}/api/spaces/space`;
  const response = await fetch(url, {
    headers: {
      Authorization: `ApiKey ${apiKey}`,
      'kbn-xsrf': 'true',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch spaces (${response.status} ${response.statusText}).`);
  }

  return (await response.json()) as SpaceDefinition[];
}
