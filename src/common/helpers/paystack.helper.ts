import { HttpException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import * as crypto from 'crypto';
import {
    InitPaystackTransactionResponse,
    VerifyPaystackResponse,
} from '../types/paystack.types';

const baseUrl = process.env.PAYSTACK_API_BASE_URL || 'https://api.paystack.co';

const getHeaders = () => {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) throw new InternalServerErrorException('PAYSTACK_SECRET_KEY is not configured');
    return {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
    };
};

/**
 * Initialize a Paystack transaction for an order.
 * @param httpService - injected HttpService from the calling service
 * @param reference - unique order reference (orderNumber)
 * @param email - customer email
 * @param amount - amount in naira (converted to kobo internally)
 * @param callbackUrl - redirect URL after payment
 * @param metadata - arbitrary metadata stored with the transaction
 */
export const initializePaystackTransaction = (
    httpService: HttpService,
    reference: string,
    email: string,
    amount: number,
    callbackUrl?: string,
    metadata?: Record<string, unknown>,
): Promise<InitPaystackTransactionResponse['data']> => {
    const url = `${baseUrl}/transaction/initialize`;
    const payload = {
        email,
        amount: Math.round(amount * 100), // kobo, no fractional kobo
        reference,
        ...(callbackUrl && { callback_url: callbackUrl }),
        ...(metadata && { metadata }),
    };

    return lastValueFrom(
        httpService
            .post<InitPaystackTransactionResponse>(url, payload, {
                headers: getHeaders(),
                timeout: 10_000,
            })
            .pipe(
                map((res) => res.data.data),
                catchError((err) => {
                    throw new HttpException(
                        err.response?.data?.message || 'Unable to initialize transaction',
                        err.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
                    );
                }),
            ),
    );
};

/**
 * Verify a Paystack transaction by reference.
 * @param httpService - injected HttpService from the calling service
 * @param reference - the transaction reference to verify
 */
export const verifyPaystackTransaction = (
    httpService: HttpService,
    reference: string,
): Promise<VerifyPaystackResponse> => {
    const url = `${baseUrl}/transaction/verify/${encodeURIComponent(reference)}`;

    return lastValueFrom(
        httpService
            .get<{ status: boolean; data: VerifyPaystackResponse }>(url, {
                headers: getHeaders(),
                timeout: 10_000,
            })
            .pipe(
                map((res) => res.data.data),
                catchError((err) => {
                    throw new HttpException(
                        err.response?.data?.message || 'Unable to verify transaction',
                        err.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
                    );
                }),
            ),
    );
};

/**
 * Verify Paystack webhook signature using HMAC-SHA512.
 * Returns false rather than throwing so the controller can respond 200 regardless.
 */
export const verifyPaystackSignature = (signature: string, rawBody: string): boolean => {
    try {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) return false;
        const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
        return hash === signature;
    } catch {
        return false;
    }
};
