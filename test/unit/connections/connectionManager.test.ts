import { deleteApiKey, getApiKey, storeApiKey } from '../../../src/connections/connectionManager';
import { vscodeMock } from '../../helpers/vscodeMock';

describe('connectionManager', () => {
  it('stores and retrieves an API key, namespaced by connection id', async () => {
    const secrets = new vscodeMock.MockSecretStorage();

    await storeApiKey(secrets, 'conn-1', 'key-one');
    await storeApiKey(secrets, 'conn-2', 'key-two');

    expect(await getApiKey(secrets, 'conn-1')).toBe('key-one');
    expect(await getApiKey(secrets, 'conn-2')).toBe('key-two');
  });

  it('returns undefined for a connection with no stored key', async () => {
    const secrets = new vscodeMock.MockSecretStorage();
    expect(await getApiKey(secrets, 'unknown')).toBeUndefined();
  });

  it('deletes a stored API key', async () => {
    const secrets = new vscodeMock.MockSecretStorage();
    await storeApiKey(secrets, 'conn-1', 'key-one');

    await deleteApiKey(secrets, 'conn-1');

    expect(await getApiKey(secrets, 'conn-1')).toBeUndefined();
  });
});
