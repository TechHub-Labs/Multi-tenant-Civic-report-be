import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './core/database/database.module';
import { TenantModule } from './features/tenant/tenant.module';
import { TenantMiddleware } from './core/tenant/tenant.middleware';
import { UserModule } from './features/user/user.module';
import { AuthModule } from './features/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    TenantModule,
    UserModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'tenants/:slug/config', method: RequestMethod.GET },
        { path: 'tenants', method: RequestMethod.POST }
      )
      .forRoutes('*');
  }
}
