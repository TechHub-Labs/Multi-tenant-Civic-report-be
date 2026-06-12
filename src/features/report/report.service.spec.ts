import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ReportService } from './report.service';
import { Report, ReportStatus } from './schemas/report.schema';
import { UserService } from '../user/user.service';
import { Role } from '../user/schemas/user.schema';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';

const mockReport = (customData?: any) => {
  const id = new Types.ObjectId();
  const tenantId = new Types.ObjectId();
  const reporterId = new Types.ObjectId();
  const reportObj = {
    _id: id,
    tenant_id: tenantId,
    reporter_id: reporterId,
    title: 'Water leak',
    description: 'Pipe burst on main street',
    category: 'Plumbing',
    location: { type: 'Point', coordinates: [10, 20] },
    status: ReportStatus.SUBMITTED,
    media_urls: [],
    timeline: [
      {
        status: ReportStatus.SUBMITTED,
        notes: 'Report submitted by citizen.',
        updated_by: reporterId,
        updated_at: new Date(),
      },
    ],
    save: jest.fn().mockImplementation(function (this: any) {
      return Promise.resolve(this);
    }),
    ...customData,
  };
  return reportObj;
};

// Helper for Mocking Mongoose Queries Chaining
const createQueryMock = (returnValue: any) => {
  const query: any = {
    sort: jest.fn().mockImplementation(() => query),
    populate: jest.fn().mockImplementation(() => query),
    exec: jest.fn().mockResolvedValue(returnValue),
  };
  return query;
};

describe('ReportService', () => {
  let service: ReportService;
  let reportModelMock: any;
  let userServiceMock: any;

  beforeEach(async () => {
    reportModelMock = jest.fn().mockImplementation(function (this: any, data: any) {
      Object.assign(this, data);
      this.save = jest.fn().mockResolvedValue(this);
      return this;
    });

    reportModelMock.find = jest.fn();
    reportModelMock.findOne = jest.fn();

    userServiceMock = {
      findByIdAndTenant: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        {
          provide: getModelToken(Report.name),
          useValue: reportModelMock,
        },
        {
          provide: UserService,
          useValue: userServiceMock,
        },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  describe('createReport', () => {
    const mockTenant = {
      _id: new Types.ObjectId(),
      name: 'Lagos State',
      slug: 'lagos',
      categories: ['Maintenance', 'Plumbing'],
      geofence_polygon: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
          ],
        ],
      },
    };

    const mockUser = { userId: new Types.ObjectId().toString(), role: Role.CITIZEN };

    it('should successfully create a report if category and coordinates are valid', async () => {
      const dto = {
        title: 'Leaky Pipe',
        description: 'Water everywhere',
        category: 'Plumbing',
        longitude: 5,
        latitude: 5,
        media_urls: [],
      };

      const result = await service.createReport(mockTenant, mockUser, dto);
      expect(result).toBeDefined();
      expect(result.title).toBe(dto.title);
      expect(result.category).toBe('Plumbing');
      expect(result.status).toBe(ReportStatus.SUBMITTED);
      expect(result.timeline.length).toBe(1);
    });

    it('should throw BadRequestException if category is not allowed by tenant', async () => {
      const dto = {
        title: 'Pothole',
        description: 'On road',
        category: 'Roadworks', // Invalid category
        longitude: 5,
        latitude: 5,
      };

      await expect(service.createReport(mockTenant, mockUser, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if coordinates are outside tenant geofence', async () => {
      const dto = {
        title: 'Leaky Pipe',
        description: 'Water everywhere',
        category: 'Plumbing',
        longitude: 15, // Outside geofence (0-10)
        latitude: 15, // Outside geofence (0-10)
      };

      await expect(service.createReport(mockTenant, mockUser, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    const tenantId = new Types.ObjectId();

    it('should return all tenant reports for Admin', async () => {
      const adminUser = { userId: new Types.ObjectId().toString(), role: Role.ADMIN };
      const reportsList = [mockReport(), mockReport()];

      reportModelMock.find.mockReturnValue(createQueryMock(reportsList));

      const result = await service.findAll(tenantId, adminUser);
      expect(result).toHaveLength(2);
      expect(reportModelMock.find).toHaveBeenCalledWith({ tenant_id: tenantId });
    });

    it('should filter reports by reporter_id for Citizen', async () => {
      const citizenUser = { userId: new Types.ObjectId().toString(), role: Role.CITIZEN };
      const reportsList = [mockReport({ reporter_id: new Types.ObjectId(citizenUser.userId) })];

      reportModelMock.find.mockReturnValue(createQueryMock(reportsList));

      const result = await service.findAll(tenantId, citizenUser);
      expect(result).toHaveLength(1);
      expect(reportModelMock.find).toHaveBeenCalledWith({
        tenant_id: tenantId,
        reporter_id: new Types.ObjectId(citizenUser.userId),
      });
    });

    it('should filter reports by assigned_to for Technician', async () => {
      const techUser = { userId: new Types.ObjectId().toString(), role: Role.TECHNICIAN };
      const reportsList = [mockReport({ assigned_to: new Types.ObjectId(techUser.userId) })];

      reportModelMock.find.mockReturnValue(createQueryMock(reportsList));

      const result = await service.findAll(tenantId, techUser);
      expect(result).toHaveLength(1);
      expect(reportModelMock.find).toHaveBeenCalledWith({
        tenant_id: tenantId,
        assigned_to: new Types.ObjectId(techUser.userId),
      });
    });
  });

  describe('assignReport', () => {
    const tenantId = new Types.ObjectId();
    const adminUser = { userId: new Types.ObjectId().toString(), role: Role.ADMIN };

    it('should assign a report to a valid technician', async () => {
      const report = mockReport({ tenant_id: tenantId });
      const technician = {
        _id: new Types.ObjectId(),
        role: Role.TECHNICIAN,
        first_name: 'John',
        last_name: 'Tech',
      };

      reportModelMock.findOne.mockReturnValue(createQueryMock(report));
      userServiceMock.findByIdAndTenant.mockResolvedValue(technician);

      const result = await service.assignReport(
        report._id.toString(),
        tenantId,
        technician._id.toString(),
        adminUser,
      );

      expect(result.assigned_to).toEqual(technician._id);
      expect(result.status).toBe(ReportStatus.ASSIGNED);
      expect(result.timeline).toHaveLength(2); // Initial submitted + assigned
      expect(result.timeline[1].status).toBe(ReportStatus.ASSIGNED);
    });

    it('should throw BadRequestException if assigned user is not a technician', async () => {
      const report = mockReport({ tenant_id: tenantId });
      const citizen = {
        _id: new Types.ObjectId(),
        role: Role.CITIZEN,
        first_name: 'Mary',
        last_name: 'Citizen',
      };

      reportModelMock.findOne.mockReturnValue(createQueryMock(report));
      userServiceMock.findByIdAndTenant.mockResolvedValue(citizen);

      await expect(
        service.assignReport(report._id.toString(), tenantId, citizen._id.toString(), adminUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus', () => {
    const tenantId = new Types.ObjectId();

    it('should allow Admin to update status of any report to any status', async () => {
      const report = mockReport({ tenant_id: tenantId });
      const adminUser = { userId: new Types.ObjectId().toString(), role: Role.ADMIN };

      reportModelMock.findOne.mockReturnValue(createQueryMock(report));

      const result = await service.updateStatus(
        report._id.toString(),
        tenantId,
        { status: ReportStatus.REJECTED, notes: 'Invalid report' },
        adminUser,
      );

      expect(result.status).toBe(ReportStatus.REJECTED);
      expect(result.timeline[1].notes).toBe('Invalid report');
    });

    it('should allow assigned Technician to update status to in_progress or resolved', async () => {
      const techUserId = new Types.ObjectId();
      const report = mockReport({ tenant_id: tenantId, assigned_to: techUserId });
      const techUser = { userId: techUserId.toString(), role: Role.TECHNICIAN };

      reportModelMock.findOne.mockReturnValue(createQueryMock(report));

      const result = await service.updateStatus(
        report._id.toString(),
        tenantId,
        { status: ReportStatus.IN_PROGRESS, notes: 'Started work' },
        techUser,
      );

      expect(result.status).toBe(ReportStatus.IN_PROGRESS);
    });

    it('should forbid unassigned Technician from updating status', async () => {
      const report = mockReport({ tenant_id: tenantId, assigned_to: new Types.ObjectId() });
      const otherTechUser = { userId: new Types.ObjectId().toString(), role: Role.TECHNICIAN };

      reportModelMock.findOne.mockReturnValue(createQueryMock(report));

      await expect(
        service.updateStatus(
          report._id.toString(),
          tenantId,
          { status: ReportStatus.IN_PROGRESS },
          otherTechUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should prevent Technician from updating status to submitted or assigned', async () => {
      const techUserId = new Types.ObjectId();
      const report = mockReport({ tenant_id: tenantId, assigned_to: techUserId });
      const techUser = { userId: techUserId.toString(), role: Role.TECHNICIAN };

      reportModelMock.findOne.mockReturnValue(createQueryMock(report));

      await expect(
        service.updateStatus(
          report._id.toString(),
          tenantId,
          { status: ReportStatus.SUBMITTED },
          techUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
