import { Injectable } from '@nestjs/common';
import { encrypt, decrypt } from '../helpers/crypto.helpers';
@Injectable()
export class EncryptionService {
    private readonly password = process.env.ENCRYPTION_PASSWORD; // Read from environment variable

    async encryptData(data: string): Promise<string> {
        return await encrypt(data, this.password);
    }

    async decryptData(encryptedData: string): Promise<string> {
        return await decrypt(encryptedData, this.password);
    }

    async encryptBvn (bvn: string, firstName: string, lastName: string): Promise<{ firstEncrypt: string; lastEncrypt: string; }>{
        const midpoint = Math.floor(bvn.length / 2);
        const bvnFirstHalf = bvn.slice(0, midpoint);
        const bvnSecondHalf = bvn.slice(midpoint);

        const bvnFirstNameEncrypt = await this.encryptData(`${firstName}:${bvnFirstHalf}`)
        const bvnLastNameEncrypt = await this.encryptData(`${lastName}:${bvnSecondHalf}`)
        return{
            firstEncrypt: bvnFirstNameEncrypt,
            lastEncrypt: bvnLastNameEncrypt
        }
    } 

    async decryptBvn(firstEncrypt: string, lastEncrypt: string): Promise<{ firstCombo: string; lastCombo: string; }>{
        const decryptFirstEncrypt = await this.decryptData(firstEncrypt);
        const decryptLastEncrypt = await this.decryptData(lastEncrypt);
        return {
            firstCombo: decryptFirstEncrypt,
            lastCombo: decryptLastEncrypt
        }
    }
}