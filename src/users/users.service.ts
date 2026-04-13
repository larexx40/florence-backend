import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Role, StoreCreditReason, StoreCreditType, User } from '@prisma/client';
import { ApiResponse, IRequest, PaginatedData } from 'src/common/types';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { generatePassword } from 'src/common/helpers/helper';
import {
  AwardStoreCreditDto,
  ChangePasswordDto,
  CreateUserDto,
  SendUserEmailDto,
  SetupAccountDto,
  UpdateProfileDto,
  UserOrderQueryDto,
  UserQueryDto,
} from './dto/user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name, { timestamp: true });

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  // ── Self-service ─────────────────────────────────────────────────────────────

  async getProfile(request: IRequest): Promise<ApiResponse<User>> {
    const user = await this.prisma.user.findUnique({ where: { id: request.user.userId } });
    if (!user) throw new UnauthorizedException('User not found');

    return { status: true, message: 'Profile fetched successfully', data: user };
  }

  async setupAccount(request: IRequest, dto: SetupAccountDto): Promise<ApiResponse<User>> {
    const { password, confirmPassword, firstName, lastName, phone, businessName } = dto;

    if (password !== confirmPassword) throw new BadRequestException('Passwords do not match');

    const userId = request.user.userId;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    if (phone) {
      const phoneInUse = await this.prisma.user.findFirst({ where: { phone, id: { not: userId } } });
      if (phoneInUse) throw new ConflictException('Phone number is already in use');
    }

    const hashed = await bcrypt.hash(password, 10);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashed,
        isProfileComplete: true,
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        phone,
        ...(businessName && { businessName }),
      },
    });

    return { status: true, message: 'Account set up successfully', data: updated };
  }

  async changePassword(request: IRequest, dto: ChangePasswordDto): Promise<ApiResponse<null>> {
    const { currentPassword, newPassword, confirmPassword } = dto;

    if (newPassword !== confirmPassword) throw new BadRequestException('New passwords do not match');

    const user = await this.prisma.user.findUnique({ where: { id: request.user.userId } });
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.password) throw new BadRequestException('No password is set — use the forgot password flow instead');

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw new BadRequestException('Current password is incorrect');

    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

    return { status: true, message: 'Password changed successfully', data: null };
  }

  async updateProfile(request: IRequest, dto: UpdateProfileDto): Promise<ApiResponse<User>> {
    const { firstName, lastName, phone, businessName } = dto;
    const userId = request.user.userId;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    if (phone) {
      const phoneInUse = await this.prisma.user.findFirst({ where: { phone, id: { not: userId } } });
      if (phoneInUse) throw new ConflictException('Phone number is already in use');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(businessName !== undefined && { businessName }),
      },
    });

    return { status: true, message: 'Profile updated successfully', data: updated };
  }

  // ── Admin user management ────────────────────────────────────────────────────

  async createUser(input: CreateUserDto): Promise<ApiResponse<User>> {
    const { email, firstName, lastName, role, phone, businessName } = input;

    const existing = await this.prisma.user.findFirst({ where: { email } });
    if (existing) throw new ConflictException(`A user with email ${email} already exists`);

    if (phone) {
      const phoneInUse = await this.prisma.user.findFirst({ where: { phone } });
      if (phoneInUse) throw new ConflictException('Phone number is already in use');
    }

    const newUser = await this.prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        role: role ?? Role.CUSTOMER,
        phone: phone ?? null,
        businessName: businessName ?? null,
        isProfileComplete: false,
        isEmailVerified: false,
      },
    });

    return { status: true, message: 'User created successfully', data: newUser };
  }

  async getAllUsers(
    query: UserQueryDto,
  ): Promise<ApiResponse<{ users: User[]; pagination: PaginatedData }>> {
    const limit = query.limit ?? 20;
    const page = query.page ?? 1;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.UserWhereInput = {};

    if (query.role) where.role = query.role;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder } }),
      this.prisma.user.count({ where }),
    ]);

    return {
      status: true,
      message: 'Users fetched successfully',
      data: {
        users,
        pagination: {
          totalData: total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          perPage: limit,
        },
      },
    };
  }

  async getUserById(userId: string): Promise<ApiResponse<User>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return { status: true, message: 'User fetched successfully', data: user };
  }

  async getUserOrders(
    userId: string,
    query: UserOrderQueryDto,
  ): Promise<ApiResponse<{ orders: any[]; pagination: PaginatedData }>> {
    const limit = query.limit ?? 20;
    const page = query.page ?? 1;
    const skip = (page - 1) * limit;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { placedAt: 'desc' },
        include: { items: true, shippingAddress: true, logistics: true },
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return {
      status: true,
      message: 'User orders fetched successfully',
      data: {
        orders,
        pagination: {
          totalData: total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          perPage: limit,
        },
      },
    };
  }

  async getUserStats(userId: string): Promise<ApiResponse<{
    totalOrders: number;
    totalSpent: number;
    storeCreditBalance: number;
    lastOrderAt: Date | null;
  }>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const [orderStats, lastOrder] = await Promise.all([
      this.prisma.order.aggregate({
        where: { userId },
        _count: { id: true },
        _sum: { total: true },
      }),
      this.prisma.order.findFirst({
        where: { userId },
        orderBy: { placedAt: 'desc' },
        select: { placedAt: true },
      }),
    ]);

    return {
      status: true,
      message: 'User stats fetched successfully',
      data: {
        totalOrders: orderStats._count.id,
        totalSpent: Number(orderStats._sum.total ?? 0),
        storeCreditBalance: Number(user.storeCreditBalance),
        lastOrderAt: lastOrder?.placedAt ?? null,
      },
    };
  }

  async getUserTransactions(
    userId: string,
    query: UserOrderQueryDto,
  ): Promise<ApiResponse<{ transactions: any[]; pagination: PaginatedData }>> {
    const limit = query.limit ?? 20;
    const page = query.page ?? 1;
    const skip = (page - 1) * limit;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const [transactions, total] = await Promise.all([
      this.prisma.storeCreditTransaction.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { order: { select: { orderNumber: true } } },
      }),
      this.prisma.storeCreditTransaction.count({ where: { userId } }),
    ]);

    return {
      status: true,
      message: 'User transactions fetched successfully',
      data: {
        transactions,
        pagination: {
          totalData: total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          perPage: limit,
        },
      },
    };
  }

  async awardStoreCredit(
    request: IRequest,
    userId: string,
    input: AwardStoreCreditDto,
  ): Promise<ApiResponse<null>> {
    const { amount, note } = input;
    const adminId = request.user.userId;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { storeCreditBalance: { increment: amount } },
        select: { storeCreditBalance: true },
      });

      await tx.storeCreditTransaction.create({
        data: {
          userId,
          type: StoreCreditType.CREDIT,
          reason: StoreCreditReason.ADMIN_ADJUSTMENT,
          amount,
          balanceAfter: updated.storeCreditBalance,
          note: note ?? null,
          createdBy: adminId,
        },
      });
    });

    this.mailService.sendMail({
      to: user.email,
      subject: 'Store Credit Added — Everything Florence',
      template: 'store-credit-awarded',
      context: {
        firstName: user.firstName ?? 'Customer',
        amount,
        note: note ?? null,
      },
    });

    return { status: true, message: `₦${amount.toLocaleString()} store credit awarded successfully`, data: null };
  }

  async sendEmailToUser(
    userId: string,
    input: SendUserEmailDto,
  ): Promise<ApiResponse<null>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.mailService.sendMail({
      to: user.email,
      subject: input.subject,
      htmlBody: `<p>${input.message.replace(/\n/g, '<br>')}</p>`,
    });

    return { status: true, message: 'Email sent successfully', data: null };
  }

  async sendLoginDetails(
    request: IRequest,
    userId: string,
  ): Promise<ApiResponse<null>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Guard: only allow this once per user
    if (user.loginDetailsSent) {
      throw new BadRequestException('Login details have already been sent to this user');
    }

    const password = generatePassword();
    const hashed = await bcrypt.hash(password, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed, loginDetailsSent: true },
    });

    await this.mailService.sendMail({
      to: user.email,
      subject: 'Your Login Details — Everything Florence',
      template: 'send-login-details',
      context: {
        firstName: user.firstName ?? 'User',
        email: user.email,
        password,
      },
    });

    return { status: true, message: 'Login details sent successfully', data: null };
  }

  async toggleUserActive(
    request: IRequest,
    userId: string,
  ): Promise<ApiResponse<User>> {
    if (userId === request.user.userId) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot deactivate a super admin account');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
    });

    const action = updated.isActive ? 'activated' : 'deactivated';
    return { status: true, message: `User account ${action} successfully`, data: updated };
  }
}
