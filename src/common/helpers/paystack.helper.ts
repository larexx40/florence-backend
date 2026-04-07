import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { async, first, lastValueFrom } from 'rxjs';
import { CreateCustomerResponse, CreateVirtualAccountResponse, FetchDedicatedBankProviderResponce, InitPaystackTransactionResponse, PaystackHookEvents, PaystackPreferredBank, PayStackWebhook, VerifyPaystackResponse, VerifyPaystackTransferResponse } from '../types/paystack.types';
import * as crypto from 'crypto';

const baseUrl = process.env.PAYSTACK_API_BASE_URL || 'https://api.paystack.co';
const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

const getHeaders = () => ({
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
});

/**
 * Initialize a transaction
 * @param reference - Transaction reference
 * @param email - Customer's email
 * @param amount - Transaction amount in naira (5000 NGN)
 * @param callbackUrl - URL to redirect after payment
 */
export const initializePaystackTransaction = async (
    refernce: string,
    email: string,
    amount: number,
    callbackUrl?: string,
): Promise<InitPaystackTransactionResponse> => {
    const httpService = new HttpService();
    const url = `${baseUrl}/transaction/initialize`;
    const payload = { email, amount: amount * 100, callback_url: callbackUrl, refernce };

    try {
        const response = await lastValueFrom(
            httpService.post(url, payload, { headers: getHeaders() }),
        );
        return response.data;
    } catch (error) {
        throw new HttpException(
            error.response?.data?.message || 'Unable to initialize transaction',
            error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }
};

/**
 * Verify a transaction
 * @param reference - Transaction reference
 */
export const verifyPaystackTransaction = async (
    reference: string,
): Promise<VerifyPaystackResponse> => {
    const httpService = new HttpService();
    const url = `${baseUrl}/transaction/verify/${reference}`;

    try {
        const response = await lastValueFrom(
            httpService.get(url, { headers: getHeaders() }),
        );
        return response.data;
    } catch (error) {
        throw new HttpException(
            error.response?.data?.message || 'Unable to verify transaction',
            error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }
};

/**
 * Register a customer on Paystack
 * @param email - Customer's email
 * @param firstName - Customer's first name
 * @param lastName - Customer's last name
 * @param lastName - Customer's last name
 */
export const registerPaystackCustomer = async (
    email: string,
    firstName: string,
    lastName: string,
): Promise<CreateCustomerResponse> => {
    const httpService = new HttpService();
    const url = `${baseUrl}/customer`;
    const payload = { email, first_name: firstName, last_name: lastName };

    try {
        const response = await lastValueFrom(
            httpService.post(url, payload, { headers: getHeaders() }),
        );
        return response.data;
    } catch (error) {
        throw new HttpException(
            error.response?.data?.message || 'Unable to register customer',
            error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }
};

/**
 * Create a virtual account for a customer
 * @param customerId - Paystack customer ID
 * @param preferredBank - Preferred bank slug for the virtual account
 */
export const createPaystackVirtualAccount = async (
    customerId: number,
    preferredBank = "wema-bank",
): Promise<CreateVirtualAccountResponse> => {
    const httpService = new HttpService();
    const url = `${baseUrl}/dedicated_account`;
    const payload = { customer: customerId, preferred_bank: preferredBank };

    try {
        const response = await lastValueFrom(
            httpService.post(url, payload, { headers: getHeaders() }),
        );
        return response.data;
    } catch (error) {
        throw new HttpException(
            error.response?.data?.message || 'Unable to create virtual account',
            error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }
};


/**
 * Assign a dedicated account to a user
 * @param email - User's email
 * @param preferredBank - Preferred bank slug for the virtual account
 * @param firstName - User's first name
 * @param lastName - User's last name
 */
export const assignPaystackDedicatedAccount = async (
    email: string,
    preferredBank: PaystackPreferredBank,
    firstName: string,
    lastName: string,
): Promise<CreateVirtualAccountResponse> => {
    const httpService = new HttpService();
    const url = `${baseUrl}/dedicated_account/assign`;
    const payload = {
        email,
        first_name: firstName,
        last_name: lastName,
        preferred_bank: preferredBank,
        country: "NG"
    };
    try {
        const response = await lastValueFrom(
            httpService.post(url, payload, { headers: getHeaders() }),
        );
        return response.data;
        
    } catch (error) {
        throw new HttpException(
            error.message || 'Unable to assign dedicated account',
            error.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }
};

/**
 * Fetch Dedicated Account Providers
 */
export const fetchPaystackBankProviders = async (): Promise<FetchDedicatedBankProviderResponce> => {
    const httpService = new HttpService()
    const url = `${baseUrl}/dedicated_account/available_providers`;

    try {
        const response = await lastValueFrom(
            httpService.get(url, { headers: getHeaders() }),
        );
        return response.data;
    } catch (error) {
        console.log(error)
        throw new HttpException(
            error.response?.data?.message || 'Unable to fetch bank provider list',
            error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }
};


export const handlePaystackwebHook = async (input: PayStackWebhook): Promise<boolean> =>{
    const { data, event } = input;
    try {
        switch (event) {
            case PaystackHookEvents.SUCCESS:
                //verify the transaction
                const res = await verifyPaystackTransaction(data.reference);
                if (res.status === 'success') {
                    return true;
                }
                break;
            case PaystackHookEvents.TRANSFER_SUCCESS: // transfer to bank account  
                break;
            case PaystackHookEvents.TRANSFER_FAILED:
                break;
            default:
                break;
        }
        return false;
    } catch (err) {
        throw new BadRequestException();
    }

}

export const  verifySignature =(signature: string, payload: any)=> {
    try {
        console.log('Paystack Secret Key:', paystackSecret);
        const hash = crypto
            .createHmac('sha512', paystackSecret)
            .update(JSON.stringify(payload))
            .digest('hex');

        return hash === signature;
    } catch(error) {
        console.error('Signature verification failed:', error);
        return false;
    }
}