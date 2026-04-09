import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ShippingAddressController } from './shipping-address.controller';
import { ShippingAddressService } from './shipping-address.service';

@Module({
    imports: [PrismaModule],
    controllers: [ShippingAddressController],
    providers: [ShippingAddressService],
    exports: [ShippingAddressService],
})
export class ShippingAddressModule {}
