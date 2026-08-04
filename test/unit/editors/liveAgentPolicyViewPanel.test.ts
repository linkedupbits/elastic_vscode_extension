import * as vscode from 'vscode';
import { LiveAgentPolicyViewPanel } from '../../../src/editors/liveAgentPolicyViewPanel';
import { FleetAgentPolicy } from '../../../src/models';
import { vscodeMock } from '../../helpers/vscodeMock';
import { lastPanel } from '../../helpers/webviewPanel';

const extensionUri = vscode.Uri.file('/ext');

function agentPolicyFixture(overrides: Partial<FleetAgentPolicy> = {}): FleetAgentPolicy {
  return {
    id: 'policy-1',
    name: 'CMT Default',
    description: '',
    monitoring_enabled: [],
    inactivity_timeout: 1209600,
    download_source_id: '',
    schema_version: '1.1.0',
    namespace: 'default',
    advanced_settings: {},
    ...overrides,
  };
}

describe('LiveAgentPolicyViewPanel', () => {
  beforeEach(() => {
    vscodeMock.__resetWebviewPanels();
  });

  it('renders the agent policy fields read-only into the webview html', () => {
    LiveAgentPolicyViewPanel.open(
      extensionUri,
      'Staging',
      agentPolicyFixture({
        description: 'CMT default agent policy.',
        monitoring_enabled: ['logs', 'metrics'],
        inactivity_timeout: 604800,
        download_source_id: 'download-source-1',
        schema_version: '1.2.0',
        advanced_settings: { agent_logging_level: 'debug' },
      })
    );

    const html = lastPanel().webview.html;
    expect(html).toContain('CMT Default');
    expect(html).toContain('Staging');
    expect(html).toContain('policy-1');
    expect(html).toContain('CMT default agent policy.');
    expect(html).toContain('default');
    expect(html).toContain('logs, metrics');
    expect(html).toContain('604800');
    expect(html).toContain('download-source-1');
    expect(html).toContain('1.2.0');
    expect(html).toContain('debug');
  });

  it('renders blank fields when a live response omits optional-ish fields', () => {
    // The Fleet API is outside this project's control, so a minimal/older response missing
    // fields FleetAgentPolicy otherwise treats as required is a real scenario worth guarding.
    const minimalPolicy = { id: 'policy-1', name: 'Minimal Policy' } as unknown as FleetAgentPolicy;
    LiveAgentPolicyViewPanel.open(extensionUri, 'Staging', minimalPolicy);

    const html = lastPanel().webview.html;
    expect(html).toContain('Minimal Policy');
    expect((html.match(/value=""/g) ?? []).length).toBe(7);
  });

  it('escapes html-sensitive characters in policy and connection fields', () => {
    LiveAgentPolicyViewPanel.open(
      extensionUri,
      'Staging & Co',
      agentPolicyFixture({ name: '<script>alert(1)</script>', description: '"quoted" & <b>bold</b>' })
    );

    const html = lastPanel().webview.html;
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Staging &amp; Co');
    expect(html).toContain('&quot;quoted&quot; &amp; &lt;b&gt;bold&lt;/b&gt;');
  });

  it('sets the panel title to the policy name', () => {
    LiveAgentPolicyViewPanel.open(extensionUri, 'Staging', agentPolicyFixture({ name: 'Engineering Fleet' }));
    expect(lastPanel().title).toBe('Engineering Fleet');
  });
});
