import { Controller, Get, Param, Post, Body, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@ApiTags('Tenant')
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @ApiOperation({ summary: 'Self-serve onboarding for a new Tenant (Organization)' })
  async createTenant(@Body() createTenantDto: CreateTenantDto) {
    const tenant = await this.tenantService.createTenant(createTenantDto);
    return { message: 'Tenant successfully created along with Admin user', tenant };
  }

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
