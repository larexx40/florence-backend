export enum IncidenceType {
    BUYNOW = 'BUYNOW',
    SAVINGSPLAN = 'SAVINGSPLAN',
    BVN = 'BVN',
    WITHDRAWAL = 'WITHDRAWAL',
    IDENTITY = 'IDENTITY',
    PAYMENT = 'PAYMENT',
    TRANSFER = 'TRANSFER',
    OTHER = 'OTHER',
    SYSTEM = "SYSTEM",
    CAC = "CAC"
}

export enum IncidentSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

export enum ImageType {
    CATEGORIES = 'categories',
    PRODUCT = 'products',
    USER = 'users',
}

export enum BullQueues {
    NOTIFICATION = 'notification.queue',
    PRODUCT = "product.queue",
    MERCHANT = 'merchant.queue',
    USER = 'user.queue',
    AUTH = 'auth.queue',
    MAIL = 'mail.queue',
    MAIL_MARKETING = 'mail.marketing.queue',
    ADMIN = 'admin.queue',

}

export enum BullJobName {
    PROFILE_UPDATED = 'profile.update.job',
    LAST_LOGIN_UPDATE = 'last.login.update.job',
    FIRST_LOGIN_TODAY = 'first.login.today.job ',
    COMPLETE_SIGNUP = 'complete.signup.job',
    SEND_NOTIFICATION = 'send.notification',
    SEND_NOTIFICATION_MAIL = 'send.notification.mail',
    SEND_MAIL = 'send.email.job',
    SEND_MAIL_MARKETING = 'send.email.marketing.job',
    SEND_MAIL_SERVICE = 'send.email.service',
    SEND_MAIL_BC = 'send.email.bc',
    SEND_MAIL_CUSTOM = 'send.email.custom',
    SEND_SMS_OTP = 'send-sms-otp',
    CREATE_REFERRAL_CODE = 'create-referral-code'
}

// Slack Channels
export enum SlackChannel {
    DEFAULT = 'C09PUPRS9JS', // fallback C09PUPRS9JS
    ERRORS = 'C09QX4BFQUQ',
    BUYNOWALERTS = 'C09TVRG6JV8',
}


export enum SlackUser {
    ADMIN = 'D08UH2NKXGW',
    DEVOPS = 'D08UH2NFFRC',
}