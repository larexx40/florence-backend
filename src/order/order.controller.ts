import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from 'src/guards/admin.guards';
import { StaffGuard } from 'src/guards/staff.guard';
import { AuthGuard } from 'src/guards/account.guard';
import { IRequest } from 'src/common/types';
import { OrderService } from './order.service';
import { OrderQueryDto } from './dto/order-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order.dto';
import { TrackOrderDto } from './dto/track-order.dto';

@ApiTags('orders')
@ApiSecurity('x-api-key')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // ── Public ────────────────────────────────────────────────────────────────────

  @Get('track')
  @ApiOperation({ summary: 'Track a guest order by email and order number (public)' })
  @ApiResponse({ status: 200, description: 'Order status and details' })
  @ApiResponse({ status: 404, description: 'No order found with those credentials' })
  track(@Query() dto: TrackOrderDto) {
    return this.orderService.track(dto);
  }

  // ── Authenticated customer ────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the current user's order history" })
  @ApiResponse({ status: 200, description: "Paginated list of the user's orders" })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMyOrders(@Query() query: OrderQueryDto, @Req() req: IRequest) {
    return this.orderService.getMyOrders(req.user.userId, query);
  }

  @Get('me/:orderId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get a single order from the current user's history" })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order detail' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  getMyOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Req() req: IRequest,
  ) {
    return this.orderService.getMyOrder(req.user.userId, orderId);
  }

  // ── Staff / admin ─────────────────────────────────────────────────────────────

  @Get()
  @UseGuards(AuthGuard, StaffGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all orders with optional filters (staff/admin)' })
  @ApiResponse({ status: 200, description: 'Paginated list of orders' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  getAll(@Query() query: OrderQueryDto) {
    return this.orderService.getAll(query);
  }

  @Get(':id')
  @UseGuards(AuthGuard, StaffGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single order by ID (staff/admin)' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order detail' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: IRequest,
  ) {
    return this.orderService.getOne(id, req);
  }

  @Patch(':id/status')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update order status or payment status (admin)' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateStatus(id, dto);
  }

  @Patch(':id/mark-paid')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mark a bank-transfer or cash-on-delivery order as paid (admin)',
    description: 'Only valid for BANK_TRANSFER and CASH_ON_DELIVERY orders. Also advances status from PENDING → CONFIRMED.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order marked as paid' })
  @ApiResponse({ status: 400, description: 'Already paid, or order is a Paystack order' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  markPaid(@Param('id', ParseUUIDPipe) id: string) {
    return this.orderService.markPaid(id);
  }

  @Get(':id/receipt')
  @UseGuards(AuthGuard, StaffGuard)
  @ApiBearerAuth()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({
    summary: 'Get printable thermal receipt for an order (staff/admin)',
    description: 'Returns an HTML page formatted for an 80mm thermal printer. Open in browser and use Ctrl+P / Cmd+P, or click the on-page Print button.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'HTML receipt page' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const html = await this.orderService.getReceiptHtml(id);
    res.send(html);
  }
}
