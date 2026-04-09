import { createCipheriv, randomBytes, scrypt, createDecipheriv } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

const algorithm = 'aes-256-cbc';
const ivLength = 16; // AES block size

export async function encrypt(text: string, encryptionKey: string): Promise<string> {
    const iv = randomBytes(ivLength);
    const key = (await scryptAsync(encryptionKey, 'salt', 32)) as Buffer; // Derive key from password

    const cipher = createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}:${encrypted}`;
}

export async function decrypt(encryptedText: string, encryptionKey: string): Promise<string> {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = (await scryptAsync(encryptionKey, 'salt', 32)) as Buffer; // Derive key from password

    const decipher = createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}