import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.cookies?.Authentication;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'super-secret-default-key'),
      passReqToCallback: true,
    });
  }

  async validate(request: Request, payload: any) {
    // Check if the JWT tenant matches the request's tenant context from headers
    if (payload.tenant_id !== (request as any).tenantId?.toString()) {
      throw new UnauthorizedException('Token tenant mismatch');
    }
    return { userId: payload.sub, email: payload.email, role: payload.role, tenant_id: payload.tenant_id };
  }
}
