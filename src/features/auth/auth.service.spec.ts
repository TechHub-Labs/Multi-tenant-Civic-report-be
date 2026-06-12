import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Role } from '../user/schemas/user.schema';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userServiceMock: any;
  let jwtServiceMock: any;

  beforeEach(async () => {
    userServiceMock = {
      findByEmailAndTenant: jest.fn(),
      findByIdAndTenant: jest.fn(),
      create: jest.fn(),
    };

    jwtServiceMock = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('getOtp', () => {
    const email = 'john@example.com';
    const tenantId = new Types.ObjectId();

    it('should retrieve the active OTP code after a login request', async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        email,
        password_hash: 'hashedPassword',
      };

      userServiceMock.findByEmailAndTenant.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Trigger login to generate OTP
      await service.login(tenantId, { email, password: 'password123' });

      // Fetch OTP using dev helper
      const otp = service.getOtp(email);
      expect(otp).toBe('123456'); // Hardcoded in development mode
    });

    it('should throw BadRequestException if no OTP is stored for the email', () => {
      expect(() => service.getOtp('nonexistent@example.com')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException and delete record if OTP has expired', () => {
      // Accessing internal store to simulate expired OTP
      const expiredTime = Date.now() - 1000;
      (service as any).otpStore.set(email, {
        code: '123456',
        expires: expiredTime,
        userId: 'some-user-id',
      });

      expect(() => service.getOtp(email)).toThrow(BadRequestException);
      expect((service as any).otpStore.has(email)).toBe(false);
    });
  });
});
