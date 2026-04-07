import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ApiResponse, IRequest, PaginatedData } from 'src/common/types';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChangeTransactionStatusDto, CreateTransactionDto, FundWalletDto, TransactionQueryDto } from './dto/transaction.dto';
import { Prisma, Transaction, TransactionStatus, TransactionTypes } from '@prisma/client';
import { initializePaystackTransaction, verifyPaystackTransaction } from 'src/common/helpers/paystack.helper';

@Injectable()
export class TransactionService {
    constructor(
        private readonly prisma: PrismaService,
    ) {}

    async getAll(
        input: TransactionQueryDto,
        request: IRequest,
        userId?: string
    ): Promise<ApiResponse<{transactions: Transaction[], pagination: PaginatedData}>> {
        //validate user access
        const user = request.user
        if(!user) throw new UnauthorizedException("Unauthorized user access.")

        if(user.accountType === "BUYER"){
            userId = user.userId
        }

        const {sortBy,search,sortOrder,status} = input
        const limit = input.limit ? parseInt(input.limit) : 20;
        const page = input.page ? parseInt(input.page) : 1;
        const skip = (page - 1) * limit;
        

        const where: Prisma.TransactionWhereInput = {
            ...(search && {
                OR:[
                    { reference: {contains: search, mode: "insensitive"}},
                    {id:{contains:search, mode:"insensitive"}},
                    {userId:{contains:search, mode:"insensitive"}},
                    {voucherId:{contains:search, mode:"insensitive"}}
                ]
            } ),
            ...(status && {status}),
            ...(userId && {userId})
        }

        // Prisma query for pagination, sorting, and filtering
        const [transactions, total] = await Promise.all([
            this.prisma.transaction.findMany({
                where,
                skip,                       // Pagination
                take: limit,                // Limit results
                orderBy: {
                    [sortBy]: sortOrder,    // Sorting by the field and order (ASC or DESC)
                },
            }),

            this.prisma.transaction.count({
                where
            })
        ]) 
        

        return {
            status: true,
            message: "Transactions fetched successfully",
            data: {
                transactions,
                pagination: {
                    totalData: total,
                    totalPages: Math.ceil(total / limit),
                    currentPage: page,
                    perPage: limit,
                }
            },
        };
    }

    async getOne(id: string, request: IRequest, userId?:string): Promise<ApiResponse<Transaction>> {
        //validate user access
        const user = request.user
        if (!user) throw new UnauthorizedException("Unauthorized user access.");

        if (user.accountType === "BUYER") {
            userId = user.userId
        }

        const whereClause: Prisma.TransactionWhereInput = {
            id,
            ...(userId && { userId }), // Add userId to the query if present
        };

        // Fetch the transaction
        const transaction = await this.prisma.transaction.findFirst({ where: whereClause });

        if (!transaction) {
            throw new NotFoundException('Transaction not found.');
        }

        // Ensure user access
        if (transaction.userId !== request.user.userId) {
            throw new BadRequestException('Access denied.');
        }

        return {
            status: true,
            message: 'Transaction fetched successfully',
            data: transaction,
        };
    }

    async delete(id: string, request: IRequest): Promise<ApiResponse<null>> {
        //validate user access
        const user = request.user
        if (!user) throw new UnauthorizedException("Unauthorized user access.");
        if(user.accountType !== "ADMIN") throw new UnauthorizedException("Unauthorized user access")

        const transaction = await this.prisma.transaction.findUnique({ where: { id } });

        if (!transaction) {
            throw new NotFoundException('Transaction not found.');
        }

        await this.prisma.transaction.delete({ where: { id } });

        return {
            status: true,
            message: 'Transaction deleted successfully',
            data: null,
        };
    }

    async changeStatus( request: IRequest, input: ChangeTransactionStatusDto): Promise<ApiResponse<null>> {
        //validate user access
        const user = request.user
        if (!user) throw new UnauthorizedException("Unauthorized user access.");
        if (user.accountType !== "ADMIN") throw new UnauthorizedException("Unauthorized user access")

        const transaction = await this.prisma.transaction.findUnique({ where: { id: input.transactionId } });

        if (!transaction) {
            throw new NotFoundException('Transaction not found.');
        }

        await this.prisma.transaction.update({ 
            where: { id: input.transactionId },
            data:{
                status: input.status
            } 
        });

        return {
            status: true,
            message: 'Transaction status updated successfully',
            data: null,
        };
    }

    async createTransaction(request: IRequest, input:CreateTransactionDto ): Promise<ApiResponse<Transaction>> {
        //validate user access
        const user = request.user
        if (!user) throw new UnauthorizedException("Unauthorized user access.");
        try {
            
            const ref = input.ref? input.ref : `INF-PYS-${Date.now()}`
            const transaction = await this.prisma.transaction.create({
                data:{
                    userId: user.userId,
                    totalAmount: input.amount,
                    paymentMethod: input.paymentMethod,
                    status: "PENDING",
                    paymentPartner:input.paymentVia,
                    reference: ref,
                    paymentType: input.paymentType,
                    paymentMode: input.paymentMode
                },
            });
            return {
                status: true,
                message: 'Transaction status updated successfully',
                data: transaction,
            };
        } catch (error) {
            throw new Error(`Failed to create transaction: ${error.message}`);
        }

        
    }

    async fundAccount(
        request: IRequest,
        input: FundWalletDto,
    ) {
        if(!input) throw new BadRequestException("Invalid input");
        if (input.amount <= 0) throw new BadRequestException("Invalid amount passed.");

        const userInSession = await this.prisma.user.findUnique({
            where: {
                id: request.user.userId
            }
        })
        if (!userInSession) throw new UnauthorizedException("Unauthorized user access.");

        return await this.prisma.$transaction(async (tx) => {
            const ref = `INF-PYS-${Date.now()}`
            const newtnx = await tx.transaction.create({
                data: {
                    userId: userInSession.id,
                    totalAmount: input.amount,
                    paymentMethod: 'ONLINE',
                    status: "PENDING",
                    paymentPartner: 'PAYSTACK',
                    reference: ref,
                    paymentType: 'FUND_WALLET',
                    paymentMode: 'UNKNOWN'
                }
            })
            
            const callbackUrl = 'https://theinfluxapp.com/'
            const fund = await initializePaystackTransaction(ref, userInSession.email, input.amount, callbackUrl)
            if (!fund || !fund.status) throw new InternalServerErrorException("Unable to fund wallet at the moment");

            tx.transaction.update({
                where:{
                    id: newtnx.id
                },
                data:{
                    accessCode: fund.data.access_code
                }
            })

            return {
                status: true,
                message: "Paymemt link generated successfully",
                data: {
                    accessCode: fund.data.access_code,
                    paymentUrl: fund.data.authorization_url
                }

            }
        });
        


    }

    async verifyTransaction(
        request: IRequest,
        reference: string
    ){
        const user = request.user
        if (!user) throw new UnauthorizedException("Unauthorized user access.");
        if(!reference) throw new BadRequestException("Invalid input");

        return await this.prisma.$transaction(async (tx) => {
            const transaction = await tx.transaction.findFirst({
                where:{
                    userId: user.userId,
                    reference
                }
            })

            if(!transaction) throw new NotFoundException("Transaction with reference not found. ")

            const verify = await verifyPaystackTransaction(reference);
            if (!verify) throw new InternalServerErrorException("Unable to verify transaction at the moment.");
            if (verify?.status === 'success' && verify?.reference === transaction.reference){
                const tnx = await tx.transaction.update({
                    where:{
                        id: transaction.id
                    },
                    data:{
                        status:"SUCCESS"
                    }
                })
                return {
                    status: true,
                    message:" Transaction successful",
                    data: tnx
                } 
            
            }else if (['failed', 'failure', 'fail'].includes(verify?.status) && verify?.reference === transaction.reference){
                const tnx = await tx.transaction.update({
                    where: {
                        id: transaction.id
                    },
                    data: {
                        status: "FAILED"
                    }
                })

                return {
                    status: true,
                    message: " Transaction failed",
                    data: tnx
                } 
            }

            
        });
    }
    
        

}
