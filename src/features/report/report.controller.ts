import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiParam, ApiQuery, ApiResponse, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { AssignReportDto } from './dto/assign-report.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { Role } from '../user/schemas/user.schema';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { ReportStatus } from './schemas/report.schema';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from '../../core/cloudinary/cloudinary.service';

@ApiTags('Reports')
@ApiHeader({
  name: 'x-tenant-slug',
  description: 'The unique slug of the tenant organization (Required for all request paths)',
  required: true,
})
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload an image file to Cloudinary (Any authenticated user)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'The file has been successfully uploaded.' })
  @ApiResponse({ status: 400, description: 'No file uploaded or upload failed.' })
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const uploadResult = await this.cloudinaryService.uploadFile(file);
    return {
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
    };
  }

  @Post()
  @Roles(Role.CITIZEN, Role.ADMIN)
  @ApiOperation({ summary: 'Submit a new civic report (Citizen or Admin)' })
  @ApiResponse({ status: 201, description: 'The report has been successfully created.' })
  @ApiResponse({ status: 400, description: 'Invalid category or coordinates outside geofence.' })
  async createReport(
    @CurrentTenant() tenant: any,
    @CurrentUser() user: any,
    @Body() createReportDto: CreateReportDto,
  ) {
    return this.reportService.createReport(tenant, user, createReportDto);
  }

  @Get()
  @Roles(Role.CITIZEN, Role.TECHNICIAN, Role.ADMIN)
  @ApiOperation({ summary: 'Get a dashboard list of reports matching the user role and optional filters' })
  @ApiQuery({ name: 'status', enum: ReportStatus, required: false })
  @ApiQuery({ name: 'category', type: String, required: false })
  @ApiQuery({ name: 'assigned_to', type: String, required: false, description: 'Filter by technician ID (Admin only)' })
  async getReports(
    @CurrentTenant() tenant: any,
    @CurrentUser() user: any,
    @Query('status') status?: ReportStatus,
    @Query('category') category?: string,
    @Query('assigned_to') assignedTo?: string,
  ) {
    return this.reportService.findAll(tenant._id, user, {
      status,
      category,
      assigned_to: assignedTo,
    });
  }

  @Get('community')
  @Roles(Role.CITIZEN, Role.TECHNICIAN, Role.ADMIN)
  @ApiOperation({ summary: 'Get the community feed of reports with automatic anonymity masking' })
  @ApiQuery({ name: 'status', enum: ReportStatus, required: false })
  @ApiQuery({ name: 'category', type: String, required: false })
  @ApiQuery({ name: 'sortBy', enum: ['newest', 'upvotes'], required: false, description: 'Sort order: newest (default) or upvotes (priority)' })
  async getCommunityFeed(
    @CurrentTenant() tenant: any,
    @CurrentUser() user: any,
    @Query('status') status?: ReportStatus,
    @Query('category') category?: string,
    @Query('sortBy') sortBy?: 'newest' | 'upvotes',
  ) {
    return this.reportService.findCommunityFeed(tenant._id, user, {
      status,
      category,
      sortBy,
    });
  }

  @Get(':id')
  @Roles(Role.CITIZEN, Role.TECHNICIAN, Role.ADMIN)
  @ApiOperation({ summary: 'Get details of a single report' })
  @ApiParam({ name: 'id', description: 'Report Mongoose ObjectId' })
  @ApiResponse({ status: 200, description: 'Return report details.' })
  @ApiResponse({ status: 404, description: 'Report not found.' })
  async getReportById(@CurrentTenant() tenant: any, @Param('id') id: string) {
    return this.reportService.findOne(id, tenant._id);
  }

  @Patch(':id/assign')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Assign a report to a technician (Admin only)' })
  @ApiParam({ name: 'id', description: 'Report Mongoose ObjectId' })
  @ApiResponse({ status: 200, description: 'Report successfully assigned.' })
  @ApiResponse({ status: 400, description: 'User assigned is not a valid technician.' })
  @ApiResponse({ status: 404, description: 'Report or technician not found.' })
  async assignReport(
    @CurrentTenant() tenant: any,
    @Param('id') id: string,
    @Body() assignReportDto: AssignReportDto,
    @CurrentUser() user: any,
  ) {
    return this.reportService.assignReport(id, tenant._id, assignReportDto.technician_id, user);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Update report status (Admin or Assigned Technician only)' })
  @ApiParam({ name: 'id', description: 'Report Mongoose ObjectId' })
  @ApiResponse({ status: 200, description: 'Status successfully updated.' })
  @ApiResponse({ status: 400, description: 'Invalid status transition.' })
  @ApiResponse({ status: 403, description: 'Forbidden action.' })
  @ApiResponse({ status: 404, description: 'Report not found.' })
  async updateStatus(
    @CurrentTenant() tenant: any,
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.reportService.updateStatus(id, tenant._id, updateStatusDto, user);
  }

  @Post(':id/upvote')
  @Roles(Role.CITIZEN, Role.TECHNICIAN, Role.ADMIN)
  @ApiOperation({ summary: 'Toggle upvote / priority vote on a report' })
  @ApiParam({ name: 'id', description: 'Report Mongoose ObjectId' })
  async toggleUpvote(
    @CurrentTenant() tenant: any,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.reportService.toggleUpvote(id, tenant._id, user.userId);
  }

  @Post(':id/comments')
  @Roles(Role.CITIZEN, Role.TECHNICIAN, Role.ADMIN)
  @ApiOperation({ summary: 'Post a public comment on a report' })
  @ApiParam({ name: 'id', description: 'Report Mongoose ObjectId' })
  async addComment(
    @CurrentTenant() tenant: any,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    return this.reportService.addComment(id, tenant._id, user.userId, createCommentDto.content);
  }
}
