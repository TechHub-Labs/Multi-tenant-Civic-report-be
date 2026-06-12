import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from '../../features/tenant/tenant.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const path = req.path;
    if (path === '/' || path === '/favicon.ico' || path.startsWith('/api/docs')) {
      return next();
    }

    const slug = req.headers['x-tenant-slug'] as string;
    
    if (!slug) {
      throw new BadRequestException('x-tenant-slug header is required');
    }

    // This will throw a NotFoundException if the tenant does not exist
    const tenant = await this.tenantService.getTenantBySlug(slug);

    // Attach tenant to the request object for downstream use
    (req as any).tenant = tenant;
    (req as any).tenantId = tenant._id;

    next();
  }
}
