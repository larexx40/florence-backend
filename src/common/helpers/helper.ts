import { randomBytes } from "crypto";
import { v4 as uuidv4 } from 'uuid';
import * as jwt from 'jsonwebtoken';
import { AuthTokenPayload } from "src/auth/types/auth.type";

/**
 * Generates a random OTP of the specified number of digits.
 * @param digits The number of digits for the OTP. Defaults to 4.
 * @returns A random OTP with the specified number of digits.
 */
export const generateOtp = (digits: number = 4): number => {
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    return Math.floor(min + Math.random() * (max - min + 1));
};

/**
 * It creates a random token of a given size
 * @param {number} size - The size of the token in bytes.
 * @returns A random token
 */
export const createRandomToken = (size: number) => {
    const token = randomBytes(size).toString('hex');
    return token;
};

export const generateId = (): string => {
    return uuidv4();
}

/**
 * It takes an object, a key name, and an optional options object, and returns a signed JWT
 * @param {Object} payload - The object that you want to sign.
 * @param {'accessTokenPrivateKey' | 'refreshTokenPrivateKey'} hashKey - The name of the key to use to
 * sign the JWT.
 * @param {jwt.SignOptions | undefined} [options] - The options object is optional. It can contain the
 * following properties:
 * @returns token.
 */
export function signJwt(
    payload: AuthTokenPayload,
    hashKey: string,
    options?: jwt.SignOptions | undefined,
) {
    const token = jwt.sign(payload, hashKey, {
        ...(options && options),
        algorithm: 'RS256',
    });

    return token;
}

/**
 * It takes a token and a key name, and returns an object with a boolean value of whether the token is
 * valid or not, a boolean value of whether the token is expired or not, and the decoded token
 * @param {string} token - The token to verify
 * @param {'accessTokenPublicKey' | 'refreshTokenPublicKey'} keyName - This is the name of the key that
 * you want to use to verify the token.
 * @returns An object with the following properties:
 * - valid: boolean
 * - expired: boolean
 * - decoded: object
 */
export function verifyJwt(token: string, hashKey: string) {
    // const publicKey = Buffer.from(keys[keyName], 'base64').toString('ascii');

    try {
        const decoded: any = jwt.verify(token, hashKey);

        return { valid: true, expired: false, decoded };
    } catch (error: any) {
        return { valid: false, expired: true, decoded: null };
    }
}

export function generatePassword(){
    var chars = "0123456789abcdefghijklmnopqrstuvwxyz!@#$%^&*()ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var passwordLength = 12;
    var password = "";
    for (var x = 0; x < passwordLength; x++) {
        var i = Math.floor(Math.random() * chars.length);
        password += chars.charAt(i);
    }
    return password;
}

export function generateOrderNumber(): string {
    const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = Math.random().toString(36).toUpperCase().slice(2, 6);
    return `ORD-${yyyymmdd}-${suffix}`;
}

export function formatTimeAgo(dateString: string | Date): string {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    const intervals = [
        { label: 'year', seconds: 31536000 },
        { label: 'month', seconds: 2592000 },
        { label: 'week', seconds: 604800 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 },
        { label: 'second', seconds: 1 },
    ];

    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) {
            return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
        }
    }

    return 'just now';
}
