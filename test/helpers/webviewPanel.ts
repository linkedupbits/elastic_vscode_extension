import type { MockWebviewPanel } from '../mocks/vscode';
import { vscodeMock } from './vscodeMock';

/** The most recently created mock webview panel, i.e. the one an editor panel class just opened. */
export function lastPanel(): MockWebviewPanel {
  const panel = vscodeMock.__getLastCreatedWebviewPanel();
  if (!panel) {
    throw new Error('No webview panel has been created yet.');
  }
  return panel;
}

/** Simulates the webview signaling readiness; returns the resulting 'init' message's payload. */
export async function sendReady(): Promise<unknown> {
  const panel = lastPanel();
  await panel.webview.__receive({ type: 'ready' });
  const initMessage = panel.webview.posted.find((m) => m.type === 'init');
  return initMessage?.payload;
}

/** Simulates a save from the webview; returns whichever outgoing message ('saved' or 'error') results. */
export async function sendSave(payload: unknown): Promise<{ type: string; [key: string]: unknown }> {
  const panel = lastPanel();
  await panel.webview.__receive({ type: 'save', payload });
  return panel.webview.posted[panel.webview.posted.length - 1];
}

/** Simulates a cancel from the webview. */
export async function sendCancel(): Promise<void> {
  await lastPanel().webview.__receive({ type: 'cancel' });
}
