import { decodeCloudId } from '../../../src/connections/cloudId';

/** Encodes a host/es-id/kibana-id triple into the base64 portion of a Cloud ID, for test fixtures. */
function encode(host: string, esId: string, kibanaId: string): string {
  return Buffer.from(`${host}$${esId}$${kibanaId}`, 'utf8').toString('base64');
}

describe('decodeCloudId', () => {
  it('decodes a valid Cloud ID into Elasticsearch and Kibana URLs', () => {
    const cloudId = `staging:${encode('us-east-1.aws.found.io', 'abcd1234', 'efgh5678')}`;

    expect(decodeCloudId(cloudId)).toEqual({
      esUrl: 'https://abcd1234.us-east-1.aws.found.io',
      kibanaUrl: 'https://efgh5678.us-east-1.aws.found.io',
    });
  });

  it('ignores extra $-separated segments (e.g. APM/Enterprise Search ids)', () => {
    const base64 = Buffer.from('us-east-1.aws.found.io$abcd1234$efgh5678$extra-segment', 'utf8').toString(
      'base64'
    );
    const cloudId = `staging:${base64}`;

    expect(decodeCloudId(cloudId)).toEqual({
      esUrl: 'https://abcd1234.us-east-1.aws.found.io',
      kibanaUrl: 'https://efgh5678.us-east-1.aws.found.io',
    });
  });

  it('trims surrounding whitespace', () => {
    const cloudId = `  staging:${encode('us-east-1.aws.found.io', 'abcd1234', 'efgh5678')}  `;

    expect(decodeCloudId(cloudId)).toEqual({
      esUrl: 'https://abcd1234.us-east-1.aws.found.io',
      kibanaUrl: 'https://efgh5678.us-east-1.aws.found.io',
    });
  });

  it('rejects a Cloud ID with no colon separator', () => {
    expect(() => decodeCloudId('not-a-cloud-id')).toThrow('Cloud ID must be in the form "<name>:<encoded>".');
  });

  it('rejects a Cloud ID whose decoded payload is missing the Kibana id', () => {
    const base64 = Buffer.from('us-east-1.aws.found.io$abcd1234', 'utf8').toString('base64');
    expect(() => decodeCloudId(`staging:${base64}`)).toThrow(
      'Cloud ID does not contain the expected Elasticsearch and Kibana endpoints.'
    );
  });

  it('rejects a Cloud ID whose decoded payload has no $ separators at all', () => {
    const base64 = Buffer.from('not-the-expected-shape', 'utf8').toString('base64');
    expect(() => decodeCloudId(`staging:${base64}`)).toThrow(
      'Cloud ID does not contain the expected Elasticsearch and Kibana endpoints.'
    );
  });
});
