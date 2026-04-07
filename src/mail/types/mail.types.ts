export interface SendMailOptions {
    to: string; // Recipient's email
    subject: string; // Email subject
    template?: string; // Name of the email template (e.g., 'otp', 'transaction')
    context?: Record<string, any>; // Data to populate in the template
    htmlBody?: string; // Optional: Pre-defined HTML content
}