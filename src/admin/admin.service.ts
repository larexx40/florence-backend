import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { ApiResponse, IRequest } from 'src/common/types';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { generatePassword } from 'src/common/helpers/helper';
import {
  AddAdminDto,
  ChangeUserRole,
  UpdateNewAdminProfileDto,
} from './dto/admin.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name, { timestamp: true });

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  // ── Self ─────────────────────────────────────────────────────────────────────

  async getProfile(request: IRequest): Promise<ApiResponse<User>> {
    const user = await this.prisma.user.findUnique({ where: { id: request.user.userId } });
    if (!user) throw new UnauthorizedException('User not found');

    return { status: true, message: 'Profile fetched successfully', data: user };
  }

  async updateProfile(request: IRequest, input: UpdateNewAdminProfileDto): Promise<ApiResponse<User>> {
    const { firstName, lastName, phone, password } = input;
    const userId = request.user.userId;

    const userInSession = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!userInSession) throw new UnauthorizedException('Unauthorized user access');

    if (phone) {
      const existingPhoneUser = await this.prisma.user.findFirst({ where: { phone, id: { not: userId } } });
      if (existingPhoneUser) throw new ConflictException('Phone number already in use');
    }

    const hashed = await bcrypt.hash(password, 10);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { firstName, lastName, phone, password: hashed, isProfileComplete: true },
    });

    return { status: true, message: 'Profile updated successfully', data: updated };
  }

  // ── Role management (SUPER_ADMIN only) ──────────────────────────────────────

  async changeUserRole(request: IRequest, input: ChangeUserRole): Promise<ApiResponse<User>> {
    if (request.user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admins can change user roles');
    }

    const target = await this.prisma.user.findUnique({ where: { id: input.userId } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot change the role of a super admin');
    }

    const updated = await this.prisma.user.update({
      where: { id: input.userId },
      data: { role: input.role },
    });

    return { status: true, message: 'User role updated successfully', data: updated };
  }

  // ── Admin creation (SUPER_ADMIN only) ───────────────────────────────────────

  async addAdmin(request: IRequest, input: AddAdminDto): Promise<ApiResponse<User>> {
    if (request.user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admins can add admins');
    }

    const { email, firstName, lastName } = input;

    const existing = await this.prisma.user.findFirst({ where: { email } });
    if (existing) throw new ConflictException(`A user with email ${email} already exists`);

    const password = generatePassword();
    const hashed = await bcrypt.hash(password, 10);

    const newAdmin = await this.prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        role: Role.ADMIN,
        password: hashed,
        isProfileComplete: false,
        isEmailVerified: false,
      },
    });

    this.mailService.sendMail({
      to: email,
      subject: 'Welcome — Everything Florence Admin',
      template: 'welcome-admin',
      context: { adminEmail: email, adminPassword: password },
    });

    return { status: true, message: 'Admin added successfully', data: newAdmin };
  }
}
