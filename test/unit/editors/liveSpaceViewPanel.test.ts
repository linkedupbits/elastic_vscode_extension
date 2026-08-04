import * as vscode from 'vscode';
import { LiveSpaceViewPanel } from '../../../src/editors/liveSpaceViewPanel';
import { SpaceDefinition } from '../../../src/models';
import { vscodeMock } from '../../helpers/vscodeMock';
import { lastPanel } from '../../helpers/webviewPanel';

const extensionUri = vscode.Uri.file('/ext');

function spaceFixture(overrides: Partial<SpaceDefinition> = {}): SpaceDefinition {
  return {
    id: 'marketing',
    name: 'Marketing',
    ...overrides,
  };
}

describe('LiveSpaceViewPanel', () => {
  beforeEach(() => {
    vscodeMock.__resetWebviewPanels();
  });

  it('renders the space fields read-only into the webview html', () => {
    LiveSpaceViewPanel.open(
      extensionUri,
      'Staging',
      spaceFixture({
        description: 'The Marketing space.',
        color: '#aabbcc',
        initials: 'MK',
        imageUrl: 'https://example.com/avatar.png',
        disabledFeatures: ['discover', 'dashboard'],
      })
    );

    const html = lastPanel().webview.html;
    expect(html).toContain('Marketing');
    expect(html).toContain('Staging');
    expect(html).toContain('marketing');
    expect(html).toContain('The Marketing space.');
    expect(html).toContain('#aabbcc');
    expect(html).toContain('MK');
    expect(html).toContain('https://example.com/avatar.png');
    expect(html).toContain('discover, dashboard');
  });

  it('renders blank fields for optional properties that are absent', () => {
    LiveSpaceViewPanel.open(extensionUri, 'Staging', spaceFixture());

    const html = lastPanel().webview.html;
    expect(html).toContain('value=""');
  });

  it('escapes html-sensitive characters in space and connection fields', () => {
    LiveSpaceViewPanel.open(
      extensionUri,
      'Staging & Co',
      spaceFixture({ name: '<script>alert(1)</script>', description: '"quoted" & <b>bold</b>' })
    );

    const html = lastPanel().webview.html;
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Staging &amp; Co');
    expect(html).toContain('&quot;quoted&quot; &amp; &lt;b&gt;bold&lt;/b&gt;');
  });

  it('sets the panel title to the space name', () => {
    LiveSpaceViewPanel.open(extensionUri, 'Staging', spaceFixture({ name: 'Engineering' }));
    expect(lastPanel().title).toBe('Engineering');
  });
});
