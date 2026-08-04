import * as vscode from 'vscode';

/** SecretStorage key a Connection's API key is stored under, namespaced by the connection's own id. */
function secretKeyFor(id: string): string {
  return `elasticSource.connection.${id}.apiKey`;
}

export async function storeApiKey(secrets: vscode.SecretStorage, id: string, apiKey: string): Promise<void> {
  await secrets.store(secretKeyFor(id), apiKey);
}

export async function getApiKey(secrets: vscode.SecretStorage, id: string): Promise<string | undefined> {
  return secrets.get(secretKeyFor(id));
}

export async function deleteApiKey(secrets: vscode.SecretStorage, id: string): Promise<void> {
  await secrets.delete(secretKeyFor(id));
}
