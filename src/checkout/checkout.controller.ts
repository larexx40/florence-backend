import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ShippingAddressResponseDto } from 'src/shipping-address/dto/response.dto';
import { LogisticsCompanyResponseDto } from 'src/logistics/dto/response.dto';
import { CheckoutService } from './checkout.service';
import { ResolveShippingDto } from './dto/checkout.dto';

@ApiTags('checkout')
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
}
