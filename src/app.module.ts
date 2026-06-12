import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './core/database/database.module';
import { TenantModule } from './features/tenant/tenant.module';
import { TenantMiddleware } from './core/tenant/tenant.middleware';
import { UserModule } from './features/user/user.module';
import { AuthModule } from './features/auth/auth.module';
import { ReportModule } from './features/report/report.module';

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
    ReportModule,
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
        { path: 'tenants', method: RequestMethod.POST },
        { path: '/', method: RequestMethod.GET },
        { path: 'favicon.ico', method: RequestMethod.GET },
        { path: 'api/docs', method: RequestMethod.GET },
        { path: 'api/docs/(.*)', method: RequestMethod.GET }
      )
      .forRoutes('*');
  }
}
