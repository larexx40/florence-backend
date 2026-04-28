import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ShippingAddressResponseDto } from 'src/shipping-address/dto/response.dto';
import { LogisticsCompanyResponseDto } from 'src/logistics/dto/response.dto';
import { CheckoutService } from './checkout.service';
import { PlaceOrderDto, ResolveShippingDto } from './dto/checkout.dto';

@ApiTags('checkout')
@ApiSecurity('x-api-key')
@ApiExtraModels(ShippingAddressResponseDto, LogisticsCompanyResponseDto)
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('resolve-shipping')
  @ApiOperation({
    summary: 'Resolve delivery addresses and available logistics for a customer email',
    description: [
      'Step 1 of checkout. Supply the customer email to get:',
      '  • addresses — all saved delivery addresses (empty if email unknown)',
      '  • selected  — the default or explicitly chosen address',
      '  • logistics — active logistics companies covering the selected address city',
      '',
      'If no addressId is given the default address is pre-selected automatically.',
      'Pass an addressId to switch to a different address.',
    ].join('\n'),
  })
  @ApiOkResponse({
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Shipping options resolved successfully' },
        data: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'uuid' },
                isNew: { type: 'boolean', example: false },
              },
            },
            addresses: {
              type: 'array',
              items: { $ref: getSchemaPath(ShippingAddressResponseDto) },
            },
            selected: {
              oneOf: [
                { $ref: getSchemaPath(ShippingAddressResponseDto) },
                { type: 'object', nullable: true, example: null },
              ],
            },
            logistics: {
              type: 'array',
              items: { $ref: getSchemaPath(LogisticsCompanyResponseDto) },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'addressId provided but not found for this user' })
  resolveShipping(@Body() dto: ResolveShippingDto) {
    return this.checkoutService.resolveShipping(dto);
  }

  @Post('place-order')
  @ApiOperation({
    summary: 'Place an order',
    description: [
      'Step 2 of checkout. Creates the order and returns payment info.',
      '',
      'Payment methods:',
      '  • PAYSTACK — returns authorization_url and access_code for redirect',
      '  • CASH_ON_DELIVERY — in-store pickup; no logistics required',
      '',
      'A customer account is automatically created if the email does not exist.',
      'Supply either addressId (existing address) or an inline address object.',
    ].join('\n'),
  })
  @ApiOkResponse({
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Order ORD-20260413-AB12 placed successfully' },
        data: {
          type: 'object',
          properties: {
            order: { type: 'object', description: 'Created order with items and address' },
            paystackUrl: { type: 'string', nullable: true, example: 'https://checkout.paystack.com/...' },
            accessCode: { type: 'string', nullable: true, example: 'abc123xyz' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input, insufficient stock, or business rule violation' })
  @ApiResponse({ status: 404, description: 'Address, variant, or logistics not found' })
  @ApiResponse({ status: 500, description: 'Paystack initialization failed after order was created' })
  placeOrder(@Body() dto: PlaceOrderDto) {
    return this.checkoutService.placeOrder(dto);
  }
}
