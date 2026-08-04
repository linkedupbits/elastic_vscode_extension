import { fetchAgentPolicies, fetchPackagePolicies, fetchSpaces } from '../../../src/connections/kibanaClient';
import { FleetAgentPolicy, FleetPackagePolicy, SpaceDefinition } from '../../../src/models';

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

describe('fetchAgentPolicies', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function agentPolicyFixture(overrides: Partial<FleetAgentPolicy> = {}): FleetAgentPolicy {
    return {
      id: 'policy-1',
      name: 'CMT Default',
      description: '',
      monitoring_enabled: ['logs', 'metrics'],
      inactivity_timeout: 1209600,
      download_source_id: '',
      schema_version: '1.1.0',
      namespace: 'default',
      advanced_settings: {},
      ...overrides,
    };
  }

  it('requests the Get Agent Policies API and unwraps the items envelope', async () => {
    const policies: FleetAgentPolicy[] = [agentPolicyFixture()];
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ items: policies, total: 1, page: 1, perPage: 100 }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await fetchAgentPolicies('https://example.kb.io', 'my-api-key');

    expect(result).toEqual(policies);
    expect(mockFetch).toHaveBeenCalledWith('https://example.kb.io/api/fleet/agent_policies?perPage=100', {
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
      json: async () => ({ items: [] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await fetchAgentPolicies('https://example.kb.io/', 'my-api-key');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.kb.io/api/fleet/agent_policies?perPage=100',
      expect.anything()
    );
  });

  it('throws with the status when the response is not ok', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({}),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await expect(fetchAgentPolicies('https://example.kb.io', 'bad-key')).rejects.toThrow(
      'Failed to fetch agent policies (403 Forbidden).'
    );
  });

  it('propagates a network error', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    global.fetch = mockFetch as unknown as typeof fetch;

    await expect(fetchAgentPolicies('https://example.kb.io', 'my-api-key')).rejects.toThrow(
      'getaddrinfo ENOTFOUND'
    );
  });

  it('prefixes the request with /s/<space_id> for a non-default space', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ items: [] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await fetchAgentPolicies('https://example.kb.io', 'my-api-key', 'marketing');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.kb.io/s/marketing/api/fleet/agent_policies?perPage=100',
      expect.anything()
    );
  });

  it('does not prefix the request for the "default" space', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ items: [] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await fetchAgentPolicies('https://example.kb.io', 'my-api-key', 'default');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.kb.io/api/fleet/agent_policies?perPage=100',
      expect.anything()
    );
  });
});

describe('fetchPackagePolicies', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function packagePolicyFixture(overrides: Partial<FleetPackagePolicy> = {}): FleetPackagePolicy {
    return {
      id: 'integration-1',
      name: 'system-cmt-default',
      namespace: 'default',
      description: '',
      package: { name: 'system', title: 'System', version: '2.22.1', requires_root: true },
      policy_id: 'policy-1',
      policy_ids: ['policy-1'],
      inputs: {},
      output_id: null,
      vars: {},
      ...overrides,
    };
  }

  it('requests the Get Package Policies API and unwraps the items envelope', async () => {
    const policies: FleetPackagePolicy[] = [packagePolicyFixture()];
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ items: policies, total: 1, page: 1, perPage: 100 }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await fetchPackagePolicies('https://example.kb.io', 'my-api-key');

    expect(result).toEqual(policies);
    expect(mockFetch).toHaveBeenCalledWith('https://example.kb.io/api/fleet/package_policies?perPage=100', {
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
      json: async () => ({ items: [] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await fetchPackagePolicies('https://example.kb.io/', 'my-api-key');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.kb.io/api/fleet/package_policies?perPage=100',
      expect.anything()
    );
  });

  it('throws with the status when the response is not ok', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({}),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await expect(fetchPackagePolicies('https://example.kb.io', 'bad-key')).rejects.toThrow(
      'Failed to fetch integration policies (403 Forbidden).'
    );
  });

  it('propagates a network error', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    global.fetch = mockFetch as unknown as typeof fetch;

    await expect(fetchPackagePolicies('https://example.kb.io', 'my-api-key')).rejects.toThrow(
      'getaddrinfo ENOTFOUND'
    );
  });

  it('prefixes the request with /s/<space_id> for a non-default space', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ items: [] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await fetchPackagePolicies('https://example.kb.io', 'my-api-key', 'marketing');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.kb.io/s/marketing/api/fleet/package_policies?perPage=100',
      expect.anything()
    );
  });
});
