import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { ApiResponse, IRequest, LoginResponseData } from 'src/common/types';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { AuthTokenPayload } from './types/auth.type';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { createRandomToken } from 'src/common/helpers/helper';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name, { timestamp: true });

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  // ── Public auth ─────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<ApiResponse<LoginResponseData>> {
    const { email, password } = dto;

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid email or password');
    if (!user.isActive) throw new UnauthorizedException('Account is inactive, contact support');
    if (!user.password) throw new UnauthorizedException('Account credentials not set up yet, contact admin');

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Invalid email or password');

    // Update last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = this.generateTokens(user);

    const message = user.isProfileComplete
      ? 'Login successful'
      : 'Login successful. Please complete your profile setup to continue.';

    return {
      status: true,
      message,
      data: {
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        isVerified: user.isEmailVerified,
        isProfileComplete: user.isProfileComplete,
      },
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<ApiResponse<null>> {
    const { email } = dto;
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always respond the same way to prevent email enumeration
    if (!user || !user.isActive) {
      return { status: true, message: 'If that email is registered, a reset link has been sent', data: null };
    }

    // Invalidate all previous unused reset tokens for this email
    await this.prisma.otp.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    const token = createRandomToken(32);
    const hashed = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.otp.create({ data: { email, hash: hashed, expiresAt } });

    this.mailService.sendMail({
      to: email,
      subject: 'Password Reset Request — Everything Florence',
      template: 'forgot-password',
      context: {
        firstName: user.firstName ?? 'User',
        resetToken: token,
        resetEmail: email,
      },
    });

    return { status: true, message: 'If that email is registered, a reset link has been sent', data: null };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<ApiResponse<null>> {
    const { email, token, password, confirmPassword } = dto;

    if (password !== confirmPassword) throw new BadRequestException('Passwords do not match');

    const now = new Date();
    // Find the most recent unused, unexpired OTP for this email
    const recentOtp = await this.prisma.otp.findFirst({
      where: { email, used: false, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });

    if (!recentOtp) throw new BadRequestException('Invalid or expired reset token');

    const tokenMatch = await bcrypt.compare(token, recentOtp.hash);
    if (!tokenMatch) throw new BadRequestException('Invalid or expired reset token');

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('User not found');

    const hashed = await bcrypt.hash(password, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { password: hashed } }),
      this.prisma.otp.update({ where: { id: recentOtp.id }, data: { used: true } }),
    ]);

    return { status: true, message: 'Password reset successfully', data: null };
  }

  async refreshToken(dto: RefreshTokenDto): Promise<ApiResponse<{ accessToken: string }>> {
    const refreshKey = process.env.JWT_SECRET_REFRESH_KEY ?? process.env.JWT_SECRET_ACCESS_KEY;
    if (!refreshKey) throw new Error('JWT refresh key is not configured');

    let decoded: { userId: string };
    try {
      decoded = jwt.verify(dto.refreshToken, refreshKey) as { userId: string };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) throw new UnauthorizedException('User not found or account inactive');

    const { accessToken } = this.generateTokens(user);

    return { status: true, message: 'Token refreshed successfully', data: { accessToken } };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private generateTokens(user: User): { accessToken: string; refreshToken: string } {
    const accessKey = process.env.JWT_SECRET_ACCESS_KEY;
    if (!accessKey) throw new Error('JWT_SECRET_ACCESS_KEY is not configured');

    const refreshKey = process.env.JWT_SECRET_REFRESH_KEY ?? accessKey;

    const payload: AuthTokenPayload = {
      userId: user.id,
      email: user.email,
      username: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      role: user.role,
      isActive: user.isActive,
    };

    const accessToken = jwt.sign(payload, accessKey, { expiresIn: '1d' });
    // refresh token only carries userId — no role/permission claims
    const refreshToken = jwt.sign({ userId: user.id }, refreshKey, { expiresIn: '7d' });

    return { accessToken, refreshToken };
  }
}
