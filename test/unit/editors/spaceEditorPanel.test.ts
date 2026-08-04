import * as vscode from 'vscode';
import { SpaceEditorPanel } from '../../../src/editors/spaceEditorPanel';
import { SpaceDefinition } from '../../../src/models';
import { saveSpace } from '../../../src/repositories';
import { makeTempDir, removeTempDir } from '../../helpers/tempDir';
import { vscodeMock } from '../../helpers/vscodeMock';
import { sendReady, sendSave } from '../../helpers/webviewPanel';

const extensionUri = vscode.Uri.file('/ext');

function validSpacePayload(overrides: Partial<SpaceDefinition> = {}): SpaceDefinition {
  return {
    id: 'marketing',
    name: 'Marketing',
    ...overrides,
  };
}

describe('SpaceEditorPanel', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = makeTempDir();
    vscodeMock.__setWorkspaceFolders(workspaceRoot);
    vscodeMock.__resetWebviewPanels();
  });

  afterEach(() => {
    vscodeMock.__resetWorkspace();
    removeTempDir(workspaceRoot);
  });

  it('a new panel starts with blank fields', async () => {
    SpaceEditorPanel.openNew(extensionUri, () => undefined);
    const payload = (await sendReady()) as { isNew: boolean; item: SpaceDefinition };

    expect(payload.isNew).toBe(true);
    expect(payload.item.id).toBe('');
    expect(payload.item.name).toBe('');
    expect(payload.item.disabledFeatures).toEqual([]);
  });

  it('an existing panel loads the saved space from disk', async () => {
    const filePath = await saveSpace(undefined, validSpacePayload({ description: 'The Marketing space.' }));
    SpaceEditorPanel.openExisting(extensionUri, () => undefined, filePath);

    const payload = (await sendReady()) as { isNew: boolean; item: SpaceDefinition };
    expect(payload.isNew).toBe(false);
    expect(payload.item.id).toBe('marketing');
    expect(payload.item.name).toBe('Marketing');
    expect(payload.item.description).toBe('The Marketing space.');
  });

  it('saves trimmed values and writes <id>.json', async () => {
    SpaceEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validSpacePayload({ name: '  Padded Name  ' }));

    expect(message.type).toBe('saved');
    const data = message.payload as SpaceDefinition;
    expect(data.name).toBe('Padded Name');
    expect(data.id).toBe('marketing');
  });

  it('parses disabledFeatures from a newline-separated list', async () => {
    SpaceEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      ...validSpacePayload(),
      disabledFeatures: ['discover', '', ' dashboard ', '  '],
    });

    expect(message.type).toBe('saved');
    const data = message.payload as SpaceDefinition;
    expect(data.disabledFeatures).toEqual(['discover', 'dashboard']);
  });

  it('rejects a blank name', async () => {
    SpaceEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validSpacePayload({ name: '' }));
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('rejects an id with invalid characters', async () => {
    SpaceEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validSpacePayload({ id: 'Not Valid!' }));
    expect(message).toEqual({
      type: 'error',
      message: 'ID must contain only lowercase letters, digits, underscores and hyphens.',
    });
  });

  it('rejects a color that is not a valid hex value', async () => {
    SpaceEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ ...validSpacePayload(), color: 'blue' });
    expect(message).toEqual({ type: 'error', message: 'Color must be a valid hex color, e.g. #aabbcc.' });
  });

  it('accepts a valid hex color', async () => {
    SpaceEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ ...validSpacePayload(), color: '#aabbcc' });

    expect(message.type).toBe('saved');
    expect((message.payload as SpaceDefinition).color).toBe('#aabbcc');
  });

  it('rejects initials longer than 2 characters', async () => {
    SpaceEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ ...validSpacePayload(), initials: 'ABC' });
    expect(message).toEqual({ type: 'error', message: 'Initials can be at most 2 characters.' });
  });

  it('rejects an id colliding with an existing space', async () => {
    await saveSpace(undefined, validSpacePayload());
    SpaceEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave(validSpacePayload({ name: 'Another Marketing' }));
    expect(message).toEqual({ type: 'error', message: 'A Space with id "marketing" already exists.' });
  });
});
