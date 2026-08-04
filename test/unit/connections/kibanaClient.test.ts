import { fetchSpaces } from '../../../src/connections/kibanaClient';
import { SpaceDefinition } from '../../../src/models';

describe('fetchSpaces', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('requests the Get All Spaces API with an ApiKey Authorization header', async () => {
    const spaces: SpaceDefinition[] = [{ id: 'default', name: 'Default' }];
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => spaces,
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await fetchSpaces('https://example.kb.io', 'my-api-key');

    expect(result).toEqual(spaces);
    expect(mockFetch).toHaveBeenCalledWith('https://example.kb.io/api/spaces/space', {
      headers: {
        Authorization: 'ApiKey my-api-key',
        'kbn-xsrf': 'true',
      },
    });
  });

  it('strips a trailing slash from the Kibana URL', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => [],
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await fetchSpaces('https://example.kb.io/', 'my-api-key');

    expect(mockFetch).toHaveBeenCalledWith('https://example.kb.io/api/spaces/space', expect.anything());
  });

  it('throws with the status when the response is not ok', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({}),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await expect(fetchSpaces('https://example.kb.io', 'bad-key')).rejects.toThrow(
      'Failed to fetch spaces (401 Unauthorized).'
    );
  });

  it('propagates a network error', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    global.fetch = mockFetch as unknown as typeof fetch;

    await expect(fetchSpaces('https://example.kb.io', 'my-api-key')).rejects.toThrow('getaddrinfo ENOTFOUND');
  });
});
