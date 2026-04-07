export enum PaystackTransactionSources {
    CARD = 'card',
    ALL = 'all',
    BANK = 'bank',
}

export enum PaystackPreferredBank {
    ACCESS_BANK = 'access-BANK',
    WEMA_BANK = 'wema-bank',
}

export enum PaystackHookEvents {
    SUCCESS = 'charge.success',
    SUB_FAILED = 'invoice.payment_failed',
    POST_SUB = 'invoice.update',
    TRANSFER_SUCCESS = 'transfer.success',
    TRANSFER_FAILED = 'transfer.failed',
    SUBSCRIPTION_DISABLED = 'subscription.not_renew',
}
export interface PaystackResponseBase {
    status: boolean;
    message: string;
}

export interface InitPaystackTransactionResponse
    extends PaystackResponseBase {
    data: {
        authorization_url: string;
        access_code: string;
        reference: string;
    };
}

export interface PaystackAuthorization {
    authorization_code: string;
    bin: string;
    last4: string;
    exp_month: string;
    exp_year: string;
    channel: string;
    card_type: string;
    bank: string;
    country_code: string;
    brand: string;
    reusable: boolean;
    signature: string;
    account_name: string;
    receiver_bank_account_number: string | number;
    receiver_bank: string;
}

export interface VerifyPaystackTransferResponse {
    reference: string;
    amount: number;
    status: string;
    transfer_code: string;
}

export interface VerifyPaystackResponse {
    reference: string;
    metadata: {
        addCard: string;
    };
    amount: number;
    id: number;
    status: string;
    channel: string;
    customer: {
        id: number;
        firstname: null | string;
        lastname: null | string;
        email: string;
        customer_code: string;
    };
    transaction_date: string;
    authorization: PaystackAuthorization;
}

export enum PaymentChannel{
    CARD = 'card',
    BANK = 'bank',
    USSD = 'ussd',
    QR = 'qr',
    MOBILE_MONEY = 'mobile_money',
    BANK_TRANSFER = 'bank_transfer',
}

export interface CreateCustomerResponse extends PaystackResponseBase {
    data: {
        id: number;
        email: string;
        integration: number;
        domain: string;
        identified: boolean;
        createdAt: string;
        updatedAt: string;
    };
}

export interface FetchDedicatedBankProviderResponce extends  PaystackResponseBase{
    data:{
        provider_slug: string,
        bank_id: number
        bank_name: string,
        id: number
    }[]
}

export interface CreateVirtualAccountResponse extends PaystackResponseBase {
    data: {
        bank: {
            name: string;
            id: number;
            slug: string;
        };
        account_name: string;
        account_number: string;
        assigned: boolean;
        currency: string;
        metadata: any | null;
        active: boolean;
        id: number;
        created_at: string;
        updated_at: string;
        assignment: {
            integration: number;
            assignee_id: number;
            assignee_type: string;
            expired: boolean;
            account_type: string;
            assigned_at: string;
        };
        customer: {
            id: number;
            first_name: string;
            last_name: string;
            email: string;
            customer_code: string;
            phone: string;
            risk_action: string;
        };
    };
}

export class PayStackWebhook {
    event: PaystackHookEvents;
    data: {
        reference: string;
        subscription_code: string;
        reason: 'LIVE' | 'TEST';
        plan: { plan_code: string; description: string };
        metadata?: { addCard: string; domain: string };
        source: {
            type: string;
            source: string;
            entry_point: string;
            identifier: any;
        };
    };
}