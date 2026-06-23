import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;

function getEncryptionKey() {
  const secret = process.env.MINIHOST_ENCRYPTION_KEY?.trim();

  if (!secret) {
    throw new Error("MINIHOST_ENCRYPTION_KEY não configurada.");
  }

  return scryptSync(secret, "minihost-cloudflare-v1", KEY_LENGTH);
}

export function encryptSecret(value: string) {
  const iv = randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(encryptedValue: string) {
  const [ivPart, authTagPart, encryptedPart] = encryptedValue.split(".");

  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error("Formato de secret criptografado inválido.");
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(authTagPart, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}
