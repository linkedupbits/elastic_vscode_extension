/** A deployment's Elasticsearch and Kibana endpoint URLs, decoded from its Cloud ID. */
export interface CloudEndpoints {
  esUrl: string;
  kibanaUrl: string;
}

/**
 * Decodes an Elastic Cloud ID into its Elasticsearch and Kibana endpoint URLs, using the same
 * algorithm the official Elastic clients (e.g. elasticsearch-js) use: `<name>:<base64>`, where
 * the base64 part decodes to `<host>$<es_uuid>$<kibana_uuid>` (`host` has no scheme/port -
 * both endpoints are always `https://` on the default port). Only the first three `$`-separated
 * segments are used; any further segments (e.g. APM/Enterprise Search ids on newer Cloud IDs)
 * are ignored since this project only needs the Elasticsearch and Kibana endpoints.
 */
export function decodeCloudId(cloudId: string): CloudEndpoints {
  const trimmed = cloudId.trim();
  const colonIndex = trimmed.indexOf(':');
  if (colonIndex < 0) {
    throw new Error('Cloud ID must be in the form "<name>:<encoded>".');
  }

  const encoded = trimmed.slice(colonIndex + 1);
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');

  const [host, esId, kibanaId] = decoded.split('$');
  if (!host || !esId || !kibanaId) {
    throw new Error('Cloud ID does not contain the expected Elasticsearch and Kibana endpoints.');
  }

  return {
    esUrl: `https://${esId}.${host}`,
    kibanaUrl: `https://${kibanaId}.${host}`,
  };
}
