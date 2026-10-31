/// <reference types="jest" />

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const mockGetItemAsync = jest.fn(async (_key: string) => null as string | null);
const mockSetItemAsync = jest.fn(async (_key: string, _value: string) => undefined);
const mockExpoGetRandomValues = jest.fn();

jest.mock('expo-secure-store', () => ({
  getItemAsync: (key: string) => mockGetItemAsync(key),
  setItemAsync: (key: string, value: string) => mockSetItemAsync(key, value),
}), { virtual: true });

jest.mock('expo-crypto', () => ({
  getRandomValues: (values: Uint8Array) => mockExpoGetRandomValues(values),
}), { virtual: true });

const mockRequest = jest.fn();

jest.mock('../../lib/api-client', () => ({
  apiClient: {
    request: (...args: unknown[]) => mockRequest(...args),
  },
}));

// eslint-disable-next-line import/first
import {
  ensureChatKeyPair,
  loadChatKeyPair,
  fetchParticipantPublicKey,
  encryptChatMessage,
  decryptChatMessage,
  encryptPrivateKeyForBackup,
  decryptPrivateKeyFromBackup,
  backupChatKeyPair,
  hasChatKeyBackup,
  restoreChatKeyPair,
  deleteChatKeyBackup,
} from '../../lib/chat-encryption';
// eslint-disable-next-line import/first
import { x25519 } from '@noble/curves/ed25519';
// eslint-disable-next-line import/first
import { bytesToHex } from '@noble/ciphers/utils.js';

describe('chat-encryption', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItemAsync.mockResolvedValue(null);
    mockRequest.mockResolvedValue({ data: { data: { success: true } }, success: true });
  });

  describe('encrypt/decrypt round trip', () => {
    it('lets the recipient recover the plaintext using ECDH symmetry (A encrypts with A.priv+B.pub, B decrypts with B.priv+A.pub)', () => {
      const alicePriv = x25519.utils.randomSecretKey();
      const alicePub = x25519.getPublicKey(alicePriv);
      const bobPriv = x25519.utils.randomSecretKey();
      const bobPub = x25519.getPublicKey(bobPriv);

      const payload = encryptChatMessage('Running 5 minutes late, sorry!', alicePriv, bobPub);
      expect(payload.ciphertext).toEqual(expect.any(String));
      expect(payload.nonce).toEqual(expect.any(String));

      const decrypted = decryptChatMessage(payload, bobPriv, alicePub);
      expect(decrypted).toBe('Running 5 minutes late, sorry!');
    });

    it('lets the sender decrypt their own sent message using the same shared secret', () => {
      const alicePriv = x25519.utils.randomSecretKey();
      const bobPriv = x25519.utils.randomSecretKey();
      const bobPub = x25519.getPublicKey(bobPriv);
      const alicePub = x25519.getPublicKey(alicePriv);

      const payload = encryptChatMessage('See you at the booth', alicePriv, bobPub);
      // Alice re-reading her own sent message: same conversation key,
      // derived from (alicePriv, bobPub) == (bobPriv, alicePub).
      const decrypted = decryptChatMessage(payload, alicePriv, bobPub);
      expect(decrypted).toBe('See you at the booth');
    });

    it('produces a different nonce (and generally different ciphertext) for each call, even for the same plaintext', () => {
      const alicePriv = x25519.utils.randomSecretKey();
      const bobPriv = x25519.utils.randomSecretKey();
      const bobPub = x25519.getPublicKey(bobPriv);

      const first = encryptChatMessage('hello', alicePriv, bobPub);
      const second = encryptChatMessage('hello', alicePriv, bobPub);
      expect(first.nonce).not.toBe(second.nonce);
      expect(first.ciphertext).not.toBe(second.ciphertext);
    });

    it('returns null instead of throwing when the ciphertext is corrupted (tamper/wrong-key detection via AEAD)', () => {
      const alicePriv = x25519.utils.randomSecretKey();
      const bobPriv = x25519.utils.randomSecretKey();
      const bobPub = x25519.getPublicKey(bobPriv);
      const alicePub = x25519.getPublicKey(alicePriv);

      const payload = encryptChatMessage('sensitive meeting notes', alicePriv, bobPub);
      // XOR (not overwrite) the last tag byte: overwriting with a fixed value
      // was flaky -- it silently no-ops (~1/256 of runs) whenever the real
      // random tag byte already equals that value, since XChaCha20-Poly1305
      // appends the auth tag at the end and hex-encodes it. XOR with a
      // non-zero value is guaranteed to always change the byte.
      const lastByte = parseInt(payload.ciphertext.slice(-2), 16);
      const tamperedByte = (lastByte ^ 0xff).toString(16).padStart(2, '0');
      const tampered = { ...payload, ciphertext: payload.ciphertext.slice(0, -2) + tamperedByte };

      expect(decryptChatMessage(tampered, bobPriv, alicePub)).toBeNull();
    });

    it('returns null when decrypted with the wrong keypair entirely', () => {
      const alicePriv = x25519.utils.randomSecretKey();
      const bobPriv = x25519.utils.randomSecretKey();
      const bobPub = x25519.getPublicKey(bobPriv);
      const eve = x25519.utils.randomSecretKey();
      const evePub = x25519.getPublicKey(eve);

      const payload = encryptChatMessage('private', alicePriv, bobPub);
      expect(decryptChatMessage(payload, eve, evePub)).toBeNull();
    });
  });

  describe('ensureChatKeyPair', () => {
    it('loads the expo crypto polyfill when native crypto lacks getRandomValues', async () => {
      const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {} });
      mockExpoGetRandomValues.mockImplementation((values: Uint8Array) => {
        values.forEach((_value, index) => { values[index] = index + 1; });
        return values;
      });

      try {
        await expect(ensureChatKeyPair('user-without-crypto')).resolves.toBeInstanceOf(Uint8Array);
        globalThis.crypto.getRandomValues(new Uint8Array(4));
        expect(mockExpoGetRandomValues).toHaveBeenCalled();
      } finally {
        if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
        else Reflect.deleteProperty(globalThis, 'crypto');
      }
    });

    it('loads an existing key without generating or publishing one', async () => {
      const existingPriv = x25519.utils.randomSecretKey();
      mockGetItemAsync.mockResolvedValue(bytesToHex(existingPriv));

      await expect(loadChatKeyPair('user-123')).resolves.toEqual(existingPriv);
      expect(mockRequest).not.toHaveBeenCalled();
      expect(mockSetItemAsync).not.toHaveBeenCalled();
    });

    it('returns null when no local key exists without generating or publishing one', async () => {
      await expect(loadChatKeyPair('user-123')).resolves.toBeNull();
      expect(mockRequest).not.toHaveBeenCalled();
      expect(mockSetItemAsync).not.toHaveBeenCalled();
    });

    it('generates and publishes a new keypair on first use, then persists it to SecureStore', async () => {
      const priv = await ensureChatKeyPair('user-123');

      expect(priv).toBeInstanceOf(Uint8Array);
      expect(mockSetItemAsync).toHaveBeenCalledWith(
        'hashpass_chat_privkey_v1_user-123',
        expect.any(String)
      );
      expect(mockRequest).toHaveBeenCalledWith('chat/keys', expect.objectContaining({
        method: 'POST',
        body: { action: 'publish-public-key', publicKey: expect.any(String) },
        skipEventSegment: true,
      }));
    });

    it('reuses an existing stored key without publishing again', async () => {
      const existingPriv = x25519.utils.randomSecretKey();
      mockGetItemAsync.mockResolvedValue(bytesToHex(existingPriv));

      const priv = await ensureChatKeyPair('user-123');

      expect(priv).toEqual(existingPriv);
      expect(mockRequest).not.toHaveBeenCalled();
      expect(mockSetItemAsync).not.toHaveBeenCalled();
    });

    it('throws if publishing the new public key fails, so callers do not silently proceed keyless', async () => {
      mockRequest.mockResolvedValue({ data: null, error: 'network error', success: false });

      await expect(ensureChatKeyPair('user-123')).rejects.toThrow(/Failed to publish chat public key/);
    });

    it('throws when the publish RPC returns an unsuccessful response', async () => {
      mockRequest.mockResolvedValue({ data: { data: { success: false, error: 'key rejected' } }, success: true });

      await expect(ensureChatKeyPair('user-123')).rejects.toThrow(/key rejected/);
    });
  });

  describe('web key storage', () => {
    const platform = require('react-native').Platform as { OS: string };
    const originalPlatform = platform.OS;
    const originalWindow = global.window;

    afterEach(() => {
      platform.OS = originalPlatform;
      Object.defineProperty(global, 'window', { value: originalWindow, configurable: true });
    });

    it('stores and reuses the private key in localStorage on web', async () => {
      const stored = new Map<string, string>();
      platform.OS = 'web';
      Object.defineProperty(global, 'window', {
        configurable: true,
        value: { localStorage: { getItem: jest.fn((key: string) => stored.get(key) || null), setItem: jest.fn((key: string, value: string) => stored.set(key, value)) } },
      });
      const first = await ensureChatKeyPair('web-user');
      const second = await ensureChatKeyPair('web-user');

      expect(second).toEqual(first);
      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(stored.get('hashpass_chat_privkey_v1_web-user')).toEqual(expect.any(String));
    });

    it('does not persist a web key when localStorage is unavailable', async () => {
      platform.OS = 'web';
      Object.defineProperty(global, 'window', { configurable: true, value: undefined });
      await expect(ensureChatKeyPair('web-no-storage')).resolves.toBeInstanceOf(Uint8Array);
      expect(mockRequest).toHaveBeenCalled();
    });
  });

  describe('fetchParticipantPublicKey', () => {
    it('returns the decoded public key bytes when the RPC finds one', async () => {
      const theirPriv = x25519.utils.randomSecretKey();
      const theirPub = x25519.getPublicKey(theirPriv);
      mockRequest.mockResolvedValue({ data: { data: { success: true, public_key: bytesToHex(theirPub) } }, success: true });

      const result = await fetchParticipantPublicKey('other-user');
      expect(result).toEqual(theirPub);
    });

    it('returns null when the other participant has not set up chat yet', async () => {
      mockRequest.mockResolvedValue({ data: { data: { success: false, error: 'key_not_found' } }, success: true });

      const result = await fetchParticipantPublicKey('other-user');
      expect(result).toBeNull();
    });

    it('returns null (not throw) on an RPC-level error', async () => {
      mockRequest.mockResolvedValue({ data: null, error: 'network error', success: false });

      const result = await fetchParticipantPublicKey('other-user');
      expect(result).toBeNull();
    });
  });

  describe('key backup and restore', () => {
    it('round-trips a private key through password encryption', () => {
      const privateKey = x25519.utils.randomSecretKey();
      const backup = encryptPrivateKeyForBackup(privateKey, 'correct horse battery staple');

      expect(backup.encryptedKey).toContain(':');
      expect(backup.salt).toHaveLength(32);
      expect(decryptPrivateKeyFromBackup(
        backup.encryptedKey,
        backup.salt,
        'correct horse battery staple',
      )).toEqual(privateKey);
    });

    it('rejects malformed, tampered, and incorrectly passworded backups', () => {
      const privateKey = x25519.utils.randomSecretKey();
      const backup = encryptPrivateKeyForBackup(privateKey, 'backup-password');
      const lastByte = parseInt(backup.encryptedKey.slice(-2), 16);
      const tampered = `${backup.encryptedKey.slice(0, -2)}${(lastByte ^ 0xff).toString(16).padStart(2, '0')}`;

      expect(decryptPrivateKeyFromBackup('malformed', backup.salt, 'backup-password')).toBeNull();
      expect(decryptPrivateKeyFromBackup(tampered, backup.salt, 'backup-password')).toBeNull();
      expect(decryptPrivateKeyFromBackup(backup.encryptedKey, backup.salt, 'wrong-password')).toBeNull();
    });

    it('stores an encrypted backup and reports a missing local key', async () => {
      mockGetItemAsync.mockResolvedValue(bytesToHex(x25519.utils.randomSecretKey()));

      await expect(backupChatKeyPair('user-123', 'backup-password')).resolves.toEqual({ success: true });
      expect(mockRequest).toHaveBeenCalledWith('chat/keys', expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          action: 'store-backup',
          encryptedPrivateKey: expect.stringMatching(/^[0-9a-f]{48}:[0-9a-f]{96}$/i),
          salt: expect.any(String),
        }),
        skipEventSegment: true,
      }));

      mockGetItemAsync.mockResolvedValue(null);
      await expect(backupChatKeyPair('user-123', 'backup-password')).resolves.toEqual({
        success: false,
        error: 'no_key_pair',
      });
    });

    it('handles backup lookup success, absence, and RPC errors', async () => {
      mockRequest.mockResolvedValue({
        data: { data: { success: true, encrypted_private_key: 'nonce:ciphertext', created_at: '2026-08-05T10:00:00Z' } },
        success: true,
      });
      await expect(hasChatKeyBackup('user-123')).resolves.toEqual({
        hasBackup: true,
        createdAt: '2026-08-05T10:00:00Z',
      });

      mockRequest.mockResolvedValue({ data: { data: { success: false, error: 'no_backup' } }, success: true });
      await expect(hasChatKeyBackup('user-123')).resolves.toEqual({ hasBackup: false });

      mockRequest.mockResolvedValue({ data: null, error: 'network error', success: false });
      await expect(hasChatKeyBackup('user-123')).resolves.toEqual({ hasBackup: false, error: 'network error' });
    });

    it('restores the private key, persists it, and republishes the public key', async () => {
      const privateKey = x25519.utils.randomSecretKey();
      const backup = encryptPrivateKeyForBackup(privateKey, 'backup-password');
      mockRequest
        .mockResolvedValueOnce({
          data: { data: { success: true, encrypted_private_key: backup.encryptedKey, salt: backup.salt } },
          success: true,
        })
        .mockResolvedValueOnce({ data: { data: { success: true } }, success: true });

      await expect(restoreChatKeyPair('user-123', 'backup-password')).resolves.toEqual({ success: true });
      expect(mockSetItemAsync).toHaveBeenCalledWith('hashpass_chat_privkey_v1_user-123', bytesToHex(privateKey));
      expect(mockRequest).toHaveBeenLastCalledWith('chat/keys', expect.objectContaining({
        method: 'POST',
        body: {
          action: 'publish-public-key',
          publicKey: bytesToHex(x25519.getPublicKey(privateKey)),
        },
      }));
    });

    it('returns a wrong-password error without publishing when decryption fails', async () => {
      const backup = encryptPrivateKeyForBackup(x25519.utils.randomSecretKey(), 'backup-password');
      mockRequest.mockResolvedValue({
        data: { data: { success: true, encrypted_private_key: backup.encryptedKey, salt: backup.salt } },
        success: true,
      });

      await expect(restoreChatKeyPair('user-123', 'wrong-password')).resolves.toEqual({
        success: false,
        error: 'wrong_password',
      });
      expect(mockSetItemAsync).not.toHaveBeenCalled();
    });

    it('returns server and delete failures from restore and delete operations', async () => {
      mockRequest.mockResolvedValueOnce({ data: null, error: 'backup unavailable', success: false });
      await expect(restoreChatKeyPair('user-123', 'backup-password')).resolves.toEqual({
        success: false,
        error: 'backup unavailable',
      });

      mockRequest.mockResolvedValue({ data: null, error: 'delete failed', success: false });
      await expect(deleteChatKeyBackup('user-123')).resolves.toEqual({ success: false, error: 'delete failed' });
      expect(mockRequest).toHaveBeenLastCalledWith('chat/keys', expect.objectContaining({
        method: 'DELETE',
        skipEventSegment: true,
      }));
    });
  });
});
