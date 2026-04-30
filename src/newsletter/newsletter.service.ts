import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponse } from 'src/common/types';
import { SubscribeDto } from './dto/newsletter.dto';

@Injectable()
export class NewsletterService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(dto: SubscribeDto): Promise<ApiResponse<null>> {
    const existing = await this.prisma.newsletterSubscriber.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('This email is already subscribed to our newsletter');
    }

    await this.prisma.newsletterSubscriber.create({
      data: { email: dto.email },
    });

    return { status: true, message: 'Successfully subscribed to our newsletter', data: null };
  }
}
