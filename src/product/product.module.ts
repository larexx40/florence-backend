import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { OptionController } from './option/option.controller';
import { OptionService } from './option/option.service';
import { VariantController } from './variant/variant.controller';
import { VariantService } from './variant/variant.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProductController, OptionController, VariantController],
  providers: [ProductService, OptionService, VariantService],
  exports: [ProductService, OptionService, VariantService],
})
export class ProductModule {}
