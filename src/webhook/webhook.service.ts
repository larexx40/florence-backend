import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
    verifyPaystackSignature,
    verifyPaystackTransaction,
} from 'src/common/helpers/paystack.helper';
import { PaystackHookEvents, PayStackWebhook } from 'src/common/types/paystack.types';

@Injectable()
export class WebhookService {
    private readonly logger = new Logger(WebhookService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly httpService: HttpService,
    ) {}

    async handlePaystackWebhook(signature: string, payload: PayStackWebhook): Promise<void> {
        const isValid = verifyPaystackSignature(signature, JSON.stringify(payload));
        if (!isValid) throw new BadRequestException('Invalid webhook signature');

        switch (payload.event) {
            case PaystackHookEvents.CHARGE_SUCCESS:
                await this.approveOrder(payload.data.reference);
                break;
            default:
                this.logger.log(`Unhandled Paystack event: ${payload.event}`);
        }
    }

    // ── Private handlers ─────────────────────────────────────────────────────────

    private async approveOrder(reference: string): Promise<void> {
        const order = await this.prisma.order.findFirst({
            where: { paystackReference: reference },
            select: { id: true, orderNumber: true, paymentStatus: true },
        });

        if (!order) {
            // Paystack may send webhooks for test transactions not in our DB
            this.logger.warn(`charge.success received for unknown reference: ${reference}`);
            return;
        }

        if (order.paymentStatus === PaymentStatus.PAID) {
            this.logger.log(`Order ${order.orderNumber} already marked PAID — skipping`);
            return;
        }

        // Double-verify the transaction with Paystack before updating
        const verification = await verifyPaystackTransaction(this.httpService, reference);
        if (verification.status !== 'success') {
            this.logger.warn(
                `Paystack verify returned status "${verification.status}" for ref ${reference} — skipping`,
            );
            return;
        }

        await this.prisma.order.update({
            where: { id: order.id },
            data: {
                paymentStatus: PaymentStatus.PAID,
                status: OrderStatus.CONFIRMED,
            },
        });

        this.logger.log(`Order ${order.orderNumber} confirmed — payment verified`);
    }
}
