import { Module } from '@nestjs/common';
import { CategoryModule } from 'src/category/category.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ProductModule } from 'src/product/product.module';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';

@Module({
  imports: [PrismaModule, CategoryModule, ProductModule],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
