import { PaymentMethod, PaymentMode, PaymentPartners, TransactionStatus, TransactionTypes } from "@prisma/client";
import { IsOptional, IsString, IsIn, IsBoolean, IsInt, Min, IsEnum, IsUUID, IsNotEmpty, IsNumberString, IsNumber } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionQueryDto {
    @ApiPropertyOptional({ example: 'paystack' })
    @IsOptional()
    @IsString({ message: 'Search must be a string value.' })
    search?: string;

    @ApiPropertyOptional({ enum: ['createdAt', 'amount'], example: 'createdAt' })
    @IsOptional()
    @IsIn(['createdAt', 'amount'], { message: 'SortBy must be either "createdAt" or "amount".' })
    sortBy?: 'createdAt' | 'amount';

    @ApiPropertyOptional({ enum: ['asc', 'desc'], example: 'desc' })
    @IsOptional()
    @IsIn(['asc', 'desc'], { message: 'SortOrder must be either "asc" or "desc".' })
    sortOrder?: 'asc' | 'desc';

    @ApiPropertyOptional({ enum: TransactionStatus })
    @IsOptional()
    @IsEnum(TransactionStatus)
    status?: TransactionStatus;

    @ApiPropertyOptional({ example: '1' })
    @IsOptional()
    @IsNumberString()
    page?: string;

    @ApiPropertyOptional({ example: '10' })
    @IsOptional()
    @IsNumberString()
    limit?: string;
}

export class ChangeTransactionStatusDto {
    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
    @IsUUID('4', { message: 'Transaction id must be a valid id' })
    @IsNotEmpty({ message: 'Transaction id must not be empty' })
    transactionId: string;

    @ApiProperty({ enum: TransactionStatus })
    @IsNotEmpty({ message: 'Status cannot be empty' })
    @IsEnum(TransactionStatus)
    status: TransactionStatus;
}

export class CreateTransactionDto {
    @ApiProperty({ example: 5000 })
    @IsNotEmpty({ message: 'Amount is required' })
    @IsNumber({}, { message: 'Amount must be a valid number' })
    amount: number;

    @ApiProperty({ enum: PaymentMethod })
    @IsNotEmpty({ message: 'Payment method is required' })
    @IsEnum(PaymentMethod, {
        message: `Payment method must be one of the following: ${Object.values(PaymentMethod).join(', ')}`,
    })
    paymentMethod: PaymentMethod;

    @ApiProperty({ enum: PaymentPartners })
    @IsNotEmpty({ message: 'Payment via is required' })
    @IsEnum(PaymentPartners, {
        message: `Payment via must be one of the following: ${Object.values(PaymentPartners).join(', ')}`,
    })
    paymentVia: PaymentPartners;

    @ApiProperty({ enum: TransactionTypes })
    @IsNotEmpty({ message: 'Payment type is required' })
    @IsEnum(TransactionTypes, {
        message: `Payment type must be one of the following: ${Object.values(TransactionTypes).join(', ')}`,
    })
    paymentType: TransactionTypes;

    @ApiProperty({ enum: PaymentMode })
    @IsNotEmpty({ message: 'Payment mode is required' })
    @IsEnum(PaymentMode, {
        message: `Payment mode must be one of the following: ${Object.values(PaymentMode).join(', ')}`,
    })
    paymentMode: PaymentMode;

    @ApiPropertyOptional({ example: 'ref_abc123' })
    @IsOptional()
    @IsString({ message: 'Reference (ref) must be a valid string' })
    ref: string;
}

export class FundWalletDto {
    @ApiProperty({ example: 10000 })
    @IsNotEmpty({ message: 'Amount is required' })
    @IsNumber({}, { message: 'Amount must be a valid number' })
    amount: number;
}
