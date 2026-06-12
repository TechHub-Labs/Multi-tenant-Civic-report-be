import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report, ReportDocument, ReportStatus } from './schemas/report.schema';
import { UserService } from '../user/user.service';
import { Role } from '../user/schemas/user.schema';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { isPointInGeofence } from '../../core/utils/geofence.util';

@Injectable()
export class ReportService {
  constructor(
    @InjectModel(Report.name) private readonly reportModel: Model<ReportDocument>,
    private readonly userService: UserService,
  ) {}

  async createReport(tenant: any, user: any, createReportDto: CreateReportDto): Promise<ReportDocument> {
    // 1. Verify that the category exists in the tenant's allowed categories
    const normalizedCategory = createReportDto.category.trim();
    const isCategoryAllowed = tenant.categories.some(
      (cat: string) => cat.toLowerCase() === normalizedCategory.toLowerCase(),
    );
    if (!isCategoryAllowed) {
      throw new BadRequestException(
        `Category '${createReportDto.category}' is not allowed for this tenant. Allowed categories: ${tenant.categories.join(', ')}`,
      );
    }

    // 2. Validate coordinates against tenant geofence if configured
    if (tenant.geofence_polygon) {
      const isInside = isPointInGeofence(
        [createReportDto.longitude, createReportDto.latitude],
        tenant.geofence_polygon,
      );
      if (!isInside) {
        throw new BadRequestException('The coordinates supplied lie outside the geofence boundary of this organization.');
      }
    }

    // 3. Create the report
    const newReport = new this.reportModel({
      tenant_id: tenant._id,
      reporter_id: new Types.ObjectId(user.userId),
      title: createReportDto.title,
      description: createReportDto.description,
      category: normalizedCategory,
      location: {
        type: 'Point',
        coordinates: [createReportDto.longitude, createReportDto.latitude],
      },
      media_urls: createReportDto.media_urls || [],
      status: ReportStatus.SUBMITTED,
      is_anonymous: createReportDto.is_anonymous || false,
      timeline: [
        {
          status: ReportStatus.SUBMITTED,
          notes: 'Report submitted by citizen.',
          updated_by: new Types.ObjectId(user.userId),
          updated_at: new Date(),
        },
      ],
    });

    return newReport.save();
  }

  async findAll(
    tenantId: string | Types.ObjectId,
    user: any,
    filters?: { status?: ReportStatus; category?: string; assigned_to?: string },
  ): Promise<ReportDocument[]> {
    const query: any = { tenant_id: new Types.ObjectId(tenantId.toString()) };

    // Apply role-based visibility restrictions
    if (user.role === Role.CITIZEN) {
      query.reporter_id = new Types.ObjectId(user.userId);
    } else if (user.role === Role.TECHNICIAN) {
      query.assigned_to = new Types.ObjectId(user.userId);
    }

    // Apply additional filters
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.category) {
      query.category = { $regex: new RegExp(`^${filters.category}$`, 'i') };
    }
    if (filters?.assigned_to && user.role === Role.ADMIN) {
      query.assigned_to = new Types.ObjectId(filters.assigned_to);
    }

    return this.reportModel
      .find(query)
      .sort({ createdAt: -1 })
      .populate('reporter_id', 'first_name last_name email')
      .populate('assigned_to', 'first_name last_name email')
      .exec();
  }

  async findOne(id: string, tenantId: string | Types.ObjectId): Promise<ReportDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid report ID format');
    }

    const report = await this.reportModel
      .findOne({
        _id: new Types.ObjectId(id),
        tenant_id: new Types.ObjectId(tenantId.toString()),
      })
      .populate('reporter_id', 'first_name last_name email')
      .populate('assigned_to', 'first_name last_name email')
      .exec();

    if (!report) {
      throw new NotFoundException(`Report with ID '${id}' not found`);
    }

    return report;
  }

  async assignReport(
    id: string,
    tenantId: string | Types.ObjectId,
    technicianId: string,
    adminUser: any,
  ): Promise<ReportDocument> {
    const report = await this.findOne(id, tenantId);

    // Validate technician exists and belongs to the same tenant
    const technician = await this.userService.findByIdAndTenant(technicianId, tenantId);
    if (!technician) {
      throw new NotFoundException('Technician not found in this tenant');
    }
    if (technician.role !== Role.TECHNICIAN) {
      throw new BadRequestException('Assigned user must be a technician');
    }

    report.assigned_to = technician._id as any;
    report.status = ReportStatus.ASSIGNED;
    report.timeline.push({
      status: ReportStatus.ASSIGNED,
      notes: `Assigned to technician: ${technician.first_name} ${technician.last_name}`,
      updated_by: new Types.ObjectId(adminUser.userId),
      updated_at: new Date(),
    });

    return report.save();
  }

  async updateStatus(
    id: string,
    tenantId: string | Types.ObjectId,
    updateStatusDto: UpdateStatusDto,
    user: any,
  ): Promise<ReportDocument> {
    const report = await this.findOne(id, tenantId);

    // Enforce role transition boundary checks
    if (user.role === Role.TECHNICIAN) {
      if (!report.assigned_to || report.assigned_to.toString() !== user.userId) {
        throw new ForbiddenException('You cannot update status on a report not assigned to you');
      }
      
      const allowedTechStatuses = [ReportStatus.IN_PROGRESS, ReportStatus.RESOLVED];
      if (!allowedTechStatuses.includes(updateStatusDto.status)) {
        throw new BadRequestException(
          `Technicians are only permitted to transition status to: ${allowedTechStatuses.join(', ')}`,
        );
      }
    }

    report.status = updateStatusDto.status;
    report.timeline.push({
      status: updateStatusDto.status,
      notes: updateStatusDto.notes || `Status transitioned to ${updateStatusDto.status}`,
      updated_by: new Types.ObjectId(user.userId),
      updated_at: new Date(),
    });

    return report.save();
  }

  async findCommunityFeed(
    tenantId: string | Types.ObjectId,
    user: any,
    filters?: { status?: ReportStatus; category?: string; sortBy?: 'newest' | 'upvotes' },
  ): Promise<any[]> {
    const query: any = { tenant_id: new Types.ObjectId(tenantId.toString()) };

    // Apply basic query filters
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.category) {
      query.category = { $regex: new RegExp(`^${filters.category}$`, 'i') };
    }

    const reports = await this.reportModel
      .find(query)
      .sort({ createdAt: -1 })
      .populate('reporter_id', 'first_name last_name email role')
      .populate('assigned_to', 'first_name last_name email')
      .populate('comments.user_id', 'first_name last_name role')
      .exec();

    let plainReports = reports.map(r => r.toObject());

    // Privacy logic: Mask identity for citizens if report is anonymous
    if (user.role === Role.CITIZEN) {
      plainReports = plainReports.map((report: any) => {
        if (report.is_anonymous) {
          report.reporter_id = {
            first_name: 'Anonymous',
            last_name: 'Citizen',
            role: Role.CITIZEN,
          };
        }
        return report;
      });
    }

    // Sort by priority (upvotes) if requested
    if (filters?.sortBy === 'upvotes') {
      plainReports.sort((a, b) => (b.upvotes?.length || 0) - (a.upvotes?.length || 0));
    }

    return plainReports;
  }

  async toggleUpvote(id: string, tenantId: string | Types.ObjectId, userId: string): Promise<ReportDocument> {
    const report = await this.findOne(id, tenantId);
    const userObjId = new Types.ObjectId(userId);

    const index = report.upvotes.findIndex(voteId => voteId.toString() === userId);
    if (index > -1) {
      report.upvotes.splice(index, 1);
    } else {
      report.upvotes.push(userObjId);
    }

    return report.save();
  }

  async addComment(
    id: string,
    tenantId: string | Types.ObjectId,
    userId: string,
    content: string,
  ): Promise<ReportDocument> {
    const report = await this.findOne(id, tenantId);
    const userObjId = new Types.ObjectId(userId);

    report.comments.push({
      user_id: userObjId,
      content,
    } as any);

    const savedReport = await report.save();
    return this.reportModel.populate(savedReport, {
      path: 'comments.user_id',
      select: 'first_name last_name role',
    });
  }
}
