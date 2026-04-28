import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { OptionalAuthGuard } from 'src/guards/optional-auth.guard';
import { LogisticsController } from './logistics.controller';
import { LogisticsService } from './logistics.service';

@Module({
    imports: [PrismaModule],
    controllers: [LogisticsController],
    providers: [LogisticsService, OptionalAuthGuard],
    exports: [LogisticsService],
})
export class LogisticsModule {}
