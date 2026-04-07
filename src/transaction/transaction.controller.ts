import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/guards/account.guard';
import { ChangeTransactionStatusDto, CreateTransactionDto, FundWalletDto, TransactionQueryDto } from './dto/transaction.dto';
import { IRequest } from 'src/common/types';
import { TransactionService } from './transaction.service';
import { AdminGuard } from 'src/guards/admin.guards';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(AuthGuard)
export class TransactionController {
    constructor(
        private readonly transactionService: TransactionService
    ) {}

    @Get()
    @ApiOperation({ summary: 'Get all transactions for the authenticated user' })
    @ApiResponse({ status: 200, description: 'Transactions returned' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getAllTransaction(
        @Req() request: IRequest,
        @Query() query: TransactionQueryDto,
    ) {
        return await this.transactionService.getAll(query, request);
    }

    @Delete(':id')
    @UseGuards(AdminGuard)
    @ApiOperation({ summary: 'Delete a transaction by ID (admin only)' })
    @ApiParam({ name: 'id', description: 'Transaction UUID' })
    @ApiResponse({ status: 200, description: 'Transaction deleted' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
    @ApiResponse({ status: 404, description: 'Transaction not found' })
    async deleteTrasaction(
        @Req() request: IRequest,
        @Param('id') id: string,
    ) {
        return await this.transactionService.delete(id, request);
    }

    @Patch('change-status')
    @UseGuards(AdminGuard)
    @ApiOperation({ summary: 'Change transaction status (admin only)' })
    @ApiResponse({ status: 200, description: 'Status updated' })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
    @ApiResponse({ status: 404, description: 'Transaction not found' })
    async changeTransactionStatus(
        @Req() request: IRequest,
        @Body() input: ChangeTransactionStatusDto,
    ) {
        return await this.transactionService.changeStatus(request, input);
    }

    @Post()
    @UseGuards(AdminGuard)
    @ApiOperation({ summary: 'Create a transaction (admin only)' })
    @ApiResponse({ status: 201, description: 'Transaction created' })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
    async createTransaction(
        @Req() request: IRequest,
        @Body() input: CreateTransactionDto,
    ) {
        return await this.transactionService.createTransaction(request, input);
    }

    @Post('fund-wallet')
    @UseGuards(AdminGuard)
    @ApiOperation({ summary: 'Fund a user wallet (admin only)' })
    @ApiResponse({ status: 201, description: 'Wallet funded' })
    @ApiResponse({ status: 400, description: 'Invalid input or insufficient funds' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
    async fundAccount(
        @Req() request: IRequest,
        @Body() input: FundWalletDto,
    ) {
        return await this.transactionService.fundAccount(request, input);
    }
}
