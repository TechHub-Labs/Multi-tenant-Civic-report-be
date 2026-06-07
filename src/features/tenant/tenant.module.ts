import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Tenant, TenantSchema } from './schemas/tenant.schema';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Tenant.name, schema: TenantSchema }]),
    UserModule,
  ],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService, MongooseModule], // Exported for TenantMiddleware to use
})
export class TenantModule {}
