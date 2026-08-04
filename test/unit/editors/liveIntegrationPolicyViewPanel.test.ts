import * as vscode from 'vscode';
import { LiveIntegrationPolicyViewPanel } from '../../../src/editors/liveIntegrationPolicyViewPanel';
import { PackageTemplate } from '../../../src/integrations/packageTemplate';
import { resolveIntegrationTemplate } from '../../../src/integrations/registry';
import { FleetPackagePolicy } from '../../../src/models';
import { vscodeMock } from '../../helpers/vscodeMock';
import { lastPanel } from '../../helpers/webviewPanel';

jest.mock('../../../src/integrations/registry');
const mockResolveIntegrationTemplate = resolveIntegrationTemplate as jest.MockedFunction<
  typeof resolveIntegrationTemplate
>;

const extensionUri = vscode.Uri.file('/ext');

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
          id: 'fixture.stream',
          label: 'Fixture Stream',
          defaultEnabled: true,
          vars: [{ key: 'path', label: 'Path', type: 'string', default: '' }],
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
        streams: { 'fixture.stream': { enabled: true, vars: { path: '/var/log/app.log' } } },
      },
    },
    output_id: null,
    vars: {},
    ...overrides,
  };
}

/** Pulls the JSON object assigned to `window.__liveIntegrationPolicy` out of the rendered html. */
function extractEmbeddedPayload(html: string): unknown {
  const match = /window\.__liveIntegrationPolicy = (.*);<\/script>/.exec(html);
  if (!match) {
    throw new Error('Could not find the embedded __liveIntegrationPolicy payload in the rendered html.');
  }
  return JSON.parse(match[1]);
}

describe('LiveIntegrationPolicyViewPanel', () => {
  beforeEach(() => {
    vscodeMock.__resetWebviewPanels();
    mockResolveIntegrationTemplate.mockReset();
  });

  it('renders a CSP-nonced webview loading two external scripts (the shared renderer then the view script), with no Save/Cancel actions', () => {
    mockResolveIntegrationTemplate.mockReturnValue(fixtureTemplate);
    LiveIntegrationPolicyViewPanel.open(extensionUri, 'Staging', 'CMT Default', policyFixture());

    const html = lastPanel().webview.html;
    expect(html).toContain('Content-Security-Policy');
    expect(html).toMatch(/nonce-[A-Za-z0-9]{32}/);
    expect(html.match(/<script nonce="[^"]+" src="/g) ?? []).toHaveLength(2);
    expect(html).toContain('window.__liveIntegrationPolicy = ');
    expect(html).toContain('id="inputs-container"');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('Save');
  });

  it('sets the panel title to the policy name and shows the connection name read-only', () => {
    mockResolveIntegrationTemplate.mockReturnValue(fixtureTemplate);
    LiveIntegrationPolicyViewPanel.open(extensionUri, 'Staging', 'CMT Default', policyFixture({ name: 'Engineering Logs' }));

    expect(lastPanel().title).toBe('Engineering Logs');
    const html = lastPanel().webview.html;
    expect(html).toContain('Engineering Logs');
    expect(html).toContain('Staging');
  });

  it('escapes html-sensitive characters in the policy name and connection name', () => {
    mockResolveIntegrationTemplate.mockReturnValue(fixtureTemplate);
    LiveIntegrationPolicyViewPanel.open(
      extensionUri,
      'Staging & Co',
      'CMT Default',
      policyFixture({ name: '<script>alert(1)</script>' })
    );

    const html = lastPanel().webview.html;
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Staging &amp; Co');
  });

  it('resolves the structured-editor template via package name/version and embeds it alongside the policy and agent policy name', () => {
    mockResolveIntegrationTemplate.mockReturnValue(fixtureTemplate);
    const policy = policyFixture();
    LiveIntegrationPolicyViewPanel.open(extensionUri, 'Staging', 'CMT Default', policy);

    expect(mockResolveIntegrationTemplate).toHaveBeenCalledWith('fixture', '1.0.0');
    const payload = extractEmbeddedPayload(lastPanel().webview.html) as {
      agentPolicyName: string;
      policy: FleetPackagePolicy;
      template: PackageTemplate;
    };
    expect(payload.agentPolicyName).toBe('CMT Default');
    expect(payload.policy).toEqual(policy);
    expect(payload.template).toEqual(fixtureTemplate);
  });

  it('embeds no template key when no structured editor is registered for the package', () => {
    mockResolveIntegrationTemplate.mockReturnValue(undefined);
    LiveIntegrationPolicyViewPanel.open(extensionUri, 'Staging', 'CMT Default', policyFixture());

    const payload = extractEmbeddedPayload(lastPanel().webview.html) as Record<string, unknown>;
    expect(payload).not.toHaveProperty('template');
  });

  it('neutralizes "</script>" inside embedded policy data so it cannot close the inline script early', () => {
    mockResolveIntegrationTemplate.mockReturnValue(fixtureTemplate);
    LiveIntegrationPolicyViewPanel.open(
      extensionUri,
      'Staging',
      'CMT Default',
      policyFixture({ description: '</script><script>alert(1)</script>' })
    );

    const html = lastPanel().webview.html;
    expect(html).not.toContain('</script><script>alert(1)</script>');
    const payload = extractEmbeddedPayload(html) as { policy: FleetPackagePolicy };
    expect(payload.policy.description).toBe('</script><script>alert(1)</script>');
  });
});
