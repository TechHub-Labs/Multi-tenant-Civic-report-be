import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TenantService } from './tenant.service';

@ApiTags('Tenant')
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get(':slug/config')
  @ApiOperation({ summary: 'Get public tenant configuration by slug' })
  @ApiParam({ name: 'slug', description: 'The unique slug of the tenant' })
  @ApiResponse({ status: 200, description: 'Return tenant configuration for frontend hydration.' })
  @ApiResponse({ status: 404, description: 'Tenant not found.' })
  async getTenantConfig(@Param('slug') slug: string) {
    const tenant = await this.tenantService.getTenantBySlug(slug);
    
    // We only return public information needed for hydration
    return {
      slug: tenant.slug,
      name: tenant.name,
      theme_config: tenant.theme_config,
      categories: tenant.categories,
      join_mode: tenant.join_settings.mode,
    };
  }
}
