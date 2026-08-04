import * as vscode from 'vscode';
import {
  LIVE_INTEGRATION_POLICY_SCHEME,
  LiveIntegrationPolicyDocumentProvider,
} from '../../../src/editors/liveIntegrationPolicyDocumentProvider';
import { PackageTemplate } from '../../../src/integrations/packageTemplate';
import { resolveIntegrationTemplate } from '../../../src/integrations/registry';
import { FleetPackagePolicy } from '../../../src/models';

jest.mock('../../../src/integrations/registry');
const mockResolveIntegrationTemplate = resolveIntegrationTemplate as jest.MockedFunction<
  typeof resolveIntegrationTemplate
>;

/** Small template exercising an input-level var, a stream-level var, and a disabled stream. */
const fixtureTemplate: PackageTemplate = {
  name: 'fixture',
  title: 'Fixture',
  version: '1.0.0',
  inputs: [
    {
      id: 'fixture-input',
      label: 'Fixture Input',
      defaultEnabled: true,
      vars: [{ key: 'mode', label: 'Mode', type: 'string', default: '', required: true }],
      streams: [
        {
          id: 'fixture.enabled-stream',
          label: 'Enabled Stream',
          defaultEnabled: true,
          vars: [{ key: 'path', label: 'Path', type: 'string', default: '' }],
        },
        {
          id: 'fixture.disabled-stream',
          label: 'Disabled Stream',
          defaultEnabled: false,
          vars: [],
        },
      ],
    },
  ],
};

function policyFixture(overrides: Partial<FleetPackagePolicy> = {}): FleetPackagePolicy {
  return {
    id: 'integration-1',
    name: 'system-cmt-default',
    namespace: 'default',
    description: 'CMT default integration.',
    package: { name: 'fixture', title: 'Fixture', version: '1.0.0', requires_root: false },
    policy_id: 'agent-policy-1',
    policy_ids: ['agent-policy-1'],
    inputs: {
      'fixture-input': {
        enabled: true,
        vars: { mode: 'active' },
        streams: {
          'fixture.enabled-stream': { enabled: true, vars: { path: '/var/log/app.log' } },
          'fixture.disabled-stream': { enabled: false, vars: {} },
        },
      },
    },
    output_id: null,
    vars: {},
    ...overrides,
  };
}

describe('LiveIntegrationPolicyDocumentProvider', () => {
  let provider: LiveIntegrationPolicyDocumentProvider;

  beforeEach(() => {
    provider = new LiveIntegrationPolicyDocumentProvider();
    mockResolveIntegrationTemplate.mockReset();
  });

  describe('uriFor', () => {
    it('builds a Uri on the live-integration-policy scheme, named after the policy, keyed by its id', () => {
      const uri = provider.uriFor('Staging', policyFixture({ id: 'integration-1', name: 'system-cmt-default' }));

      expect(uri.scheme).toBe(LIVE_INTEGRATION_POLICY_SCHEME);
      expect(uri.path).toBe('/system-cmt-default.md');
      expect(uri.query).toBe('integration-1');
    });
  });

  describe('provideTextDocumentContent', () => {
    it('renders a template-driven structured view: header fields, and one section per input/stream with enabled state and var values', () => {
      mockResolveIntegrationTemplate.mockReturnValue(fixtureTemplate);
      const policy = policyFixture();
      const uri = provider.uriFor('Staging', policy);

      const content = provider.provideTextDocumentContent(uri);

      expect(content).toContain('# system-cmt-default');
      expect(content).toContain('Staging');
      expect(content).toContain('Fixture');
      expect(content).toContain('v1.0.0');
      expect(content).toContain('default');
      expect(content).toContain('CMT default integration.');
      expect(content).toContain('agent-policy-1');
      expect(content).toContain('## Fixture Input ✅ Enabled');
      expect(content).toContain('| Mode \\* | `active` |');
      expect(content).toContain('### Enabled Stream ✅ Enabled');
      expect(content).toContain('| Path | `/var/log/app.log` |');
      expect(content).toContain('### Disabled Stream ⬜ Disabled');
    });

    it('falls back to a raw JSON dump when no structured-editor template is registered for the package', () => {
      mockResolveIntegrationTemplate.mockReturnValue(undefined);
      const policy = policyFixture({ vars: { custom: 'value' } });
      const uri = provider.uriFor('Staging', policy);

      const content = provider.provideTextDocumentContent(uri);

      expect(content).toContain('## Inputs');
      expect(content).toContain('"fixture-input"');
      expect(content).toContain('## Vars');
      expect(content).toContain('"custom": "value"');
    });

    it('omits the Vars section in the raw fallback when there are no top-level vars', () => {
      mockResolveIntegrationTemplate.mockReturnValue(undefined);
      const uri = provider.uriFor('Staging', policyFixture({ vars: {} }));

      expect(provider.provideTextDocumentContent(uri)).not.toContain('## Vars');
    });

    it('shows "not set"/"empty" placeholders for missing or blank var values', () => {
      mockResolveIntegrationTemplate.mockReturnValue(fixtureTemplate);
      const policy = policyFixture({
        inputs: {
          'fixture-input': {
            enabled: true,
            vars: {},
            streams: {
              'fixture.enabled-stream': { enabled: true, vars: { path: '' } },
              'fixture.disabled-stream': { enabled: false, vars: {} },
            },
          },
        },
      });
      const uri = provider.uriFor('Staging', policy);

      const content = provider.provideTextDocumentContent(uri);

      expect(content).toContain('| Mode \\* | _(not set)_ |');
      expect(content).toContain('| Path | _(empty)_ |');
    });

    it('escapes markdown table-breaking characters in var values', () => {
      mockResolveIntegrationTemplate.mockReturnValue(fixtureTemplate);
      const policy = policyFixture({
        inputs: {
          'fixture-input': {
            enabled: true,
            vars: { mode: 'a | b \\ c' },
            streams: {
              'fixture.enabled-stream': { enabled: true, vars: { path: '/tmp' } },
              'fixture.disabled-stream': { enabled: false, vars: {} },
            },
          },
        },
      });
      const uri = provider.uriFor('Staging', policy);

      const content = provider.provideTextDocumentContent(uri);

      expect(content).toContain('`a \\| b \\\\ c`');
    });

    it('returns a placeholder message for a Uri whose policy was never registered (or is stale)', () => {
      const staleUri = vscode.Uri.from({
        scheme: LIVE_INTEGRATION_POLICY_SCHEME,
        path: '/unknown.md',
        query: 'unknown-id',
      });

      expect(provider.provideTextDocumentContent(staleUri)).toContain('no longer available');
    });
  });
});
