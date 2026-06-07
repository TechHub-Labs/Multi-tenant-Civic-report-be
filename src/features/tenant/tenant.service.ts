import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Tenant, TenantDocument, JoinMode } from './schemas/tenant.schema';
import { UserService } from '../user/user.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { Role } from '../user/schemas/user.schema';

@Injectable()
export class TenantService {
  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
    private readonly userService: UserService,
  ) {}

  async createTenant(createTenantDto: CreateTenantDto) {
    const existingTenant = await this.tenantModel.findOne({ slug: createTenantDto.slug }).exec();
    if (existingTenant) {
      throw new ConflictException(`Tenant slug '${createTenantDto.slug}' is already taken`);
    }

    const tenant = new this.tenantModel({
      name: createTenantDto.organization_name,
      slug: createTenantDto.slug,
      theme_config: {
        primaryColor: '#3498db', // Default theme
        logoUrl: 'https://via.placeholder.com/150', // Default logo
      },
      categories: ['General', 'Maintenance', 'Plumbing', 'Electrical'],
      join_settings: {
        mode: JoinMode.OPEN,
      },
    });

    const savedTenant = await tenant.save();

    const salt = await bcrypt.genSalt();
    const password_hash = await bcrypt.hash(createTenantDto.admin_password, salt);

    await this.userService.create({
      tenant_id: savedTenant._id as any,
      first_name: createTenantDto.admin_first_name,
      last_name: createTenantDto.admin_last_name,
      email: createTenantDto.admin_email,
      password_hash,
      role: Role.ADMIN,
    });

    return savedTenant;
  }

  async getTenantBySlug(slug: string): Promise<TenantDocument> {
    const tenant = await this.tenantModel.findOne({ slug }).exec();
    if (!tenant) {
      throw new NotFoundException(`Tenant with slug '${slug}' not found`);
    }
    return tenant;
  }
}
