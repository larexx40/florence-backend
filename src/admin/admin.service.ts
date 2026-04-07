import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ApiResponse, IRequest } from 'src/common/types';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddAdminDto, ChangeUserRole, UpdateNewAdminProfileDto } from './dto/admin.dto';
import { Role, User } from '@prisma/client';
import { generateId, generatePassword } from 'src/common/helpers/helper';
import { MailService } from 'src/mail/mail.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
    private readonly logger = new Logger(AdminService.name, { timestamp: true });
    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService
    ) {}

    async getProfile(request: IRequest): Promise<ApiResponse<User>> {
        const user = request.user;
        if(!user) throw new UnauthorizedException("Unauthorised user access");

        const userProfile = await this.prisma.user.findUnique({
            where: { id: user.userId },
        });

        return {
            status: true,
            message: 'User profile fetched successfully',
            data: userProfile,
        };
    }

    async changeUserRole(request: IRequest, input: ChangeUserRole): Promise<ApiResponse<User>> {
        const user = request.user;
        if(user.role !== Role.SUPER_ADMIN) throw new NotFoundException("You are not authorized to perform this action");

        const newUserRole = await this.prisma.user.findUnique({
            where: { id: input.userId },
        });

        if (!newUserRole) {
            throw new NotFoundException(`User with id ${input.userId} not found`);
        }

        // Check if the user is an admin
        if (newUserRole.role === Role.SUPER_ADMIN) {
            throw new UnauthorizedException(`You cannot change the role of an admin user`);
        }

        // Update the user role
        const updatedUser = await this.prisma.user.update({
            where: { id: input.userId },
            data: { role: input.role },
        });

        return {
            status: true,
            message: 'User role updated successfully',
            data: updatedUser,
        };
    }

    async addAdmin(request: IRequest, input: AddAdminDto): Promise<ApiResponse<User>> {
        const user = request.user;
        if(user.role !== Role.SUPER_ADMIN) throw new NotFoundException("You are not authorized to perform this action");

        const { email, firstName, lastName } = input;

        // Check if the user already exists
        const userExists = await this.prisma.user.findFirst({
            where: { email },
        });
        if (userExists) {
            throw new NotFoundException(`User with email ${email} already exists`);
        }

        const password = generatePassword();
        const hashedPassword = await bcrypt.hash(password, 10); 
        //save user
        const newUser = await this.prisma.user.create({
            data: {
                email,
                firstName: firstName,
                lastName: lastName,
                role: Role.ADMIN,
                password: hashedPassword,
                phone: null,
                isProfileComplete: false,
                isEmailVerified: false,
            },
        });

        // send as mail
        this.mailService.sendMail({
            to: email,
            subject: 'Welcome Everything Florence Admin',
            template: 'welcome-admin',
            context: {
                adminEmail: email,
                adminPassword: password,
            },
        });

        return {
            status: true,
            message: 'Admin added successfully',
            data: newUser,
        };
    }

    async updateProfile(request: IRequest, input: UpdateNewAdminProfileDto): Promise<ApiResponse<User>> {
        const user = request.user;
        const { firstName, lastName, phone, password } = input;

        // Check if the user already exists
        const userId = request.user.userId;

        // Fetch the user along with phone and username checks in a single batch
        const [userInSession, existingPhoneUser] = await this.prisma.$transaction([
            this.prisma.user.findUnique({ where: { id: userId } }),
            phone ? this.prisma.user.findFirst({ where: { phone: phone, id: { not: userId } } }) : null,
        ]);

        if (!userInSession) {
            throw new UnauthorizedException("Unauthorized user access.");
        }

        if (existingPhoneUser) {
            throw new BadRequestException("Phone number already in use.");
        }


        const hashedPassword = await bcrypt.hash(password, 10); 
        //save user
        const newUser = await this.prisma.user.update({
            where:{id: user.userId},
            data: {
                firstName,
                lastName,
                phone,
                password: hashedPassword,
                isProfileComplete: true,
            },
        });

        return {
            status: true,
            message: 'Profile updated successfully',
            data: newUser,
        };
    }

}
