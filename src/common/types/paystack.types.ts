export enum PaystackHookEvents {
    CHARGE_SUCCESS = 'charge.success',
    TRANSFER_SUCCESS = 'transfer.success',
    TRANSFER_FAILED = 'transfer.failed',
    TRANSFER_REVERSED = 'transfer.reversed',
}

export interface PaystackResponseBase {
    status: boolean;
    message: string;
}

export interface InitPaystackTransactionResponse extends PaystackResponseBase {
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
    account_name: string | null;
}

export interface VerifyPaystackResponse {
    id: number;
    reference: string;
    amount: number; // kobo
    status: string; // 'success' | 'failed' | 'abandoned'
    channel: string;
    currency: string;
    paid_at: string;
    created_at: string;
    metadata: Record<string, unknown> | null;
    customer: {
        id: number;
        email: string;
        first_name: string | null;
        last_name: string | null;
        customer_code: string;
        phone: string | null;
    };
    authorization: PaystackAuthorization;
}

// ── Webhook ───────────────────────────────────────────────────────────────────

// charge.success event data shape
export interface PaystackChargeData {
    id: number;
    reference: string;
    amount: number; // kobo
    status: string;
    channel: string;
    currency: string;
    paid_at: string;
    created_at: string;
    metadata: Record<string, unknown> | null;
    customer: {
        id: number;
        email: string;
        first_name: string | null;
        last_name: string | null;
        customer_code: string;
        phone: string | null;
    };
    authorization: PaystackAuthorization;
}

export interface PayStackWebhook {
    event: PaystackHookEvents;
    data: PaystackChargeData;
}
