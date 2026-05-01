import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import { PayStackWebhook } from 'src/common/types/paystack.types';

@ApiTags('webhook')
@Controller('webhook')
export class WebhookController {
    constructor(private readonly webhookService: WebhookService) {}

    @Post('paystack')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Receive Paystack webhook events' })
    @ApiResponse({ status: 200, description: 'Webhook processed' })
    @ApiResponse({ status: 400, description: 'Invalid signature or malformed payload' })
    async handlePaystackWebhook(
        @Headers('x-paystack-signature') signature: string,
        @Body() payload: PayStackWebhook,
    ): Promise<void> {
        return this.webhookService.handlePaystackWebhook(signature, payload);
    }
}
