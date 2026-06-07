import { Controller, Post, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import type { TenantDocument } from '../tenant/schemas/tenant.schema';

@ApiTags('Authentication')
@ApiHeader({ 
  name: 'x-tenant-slug', 
  description: 'The unique slug of the tenant organization (Required for all auth requests)', 
  required: true 
})
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user under a tenant' })
  async register(
    @CurrentTenant() tenant: TenantDocument,
    @Body() registerDto: RegisterDto,
  ) {
    const user = await this.authService.register(tenant, registerDto);
    return { message: 'Registration successful', userId: user._id };
  }

  @Post('login')
  @ApiOperation({ summary: 'Request OTP for login' })
  async login(
    @CurrentTenant() tenant: TenantDocument,
    @Body() loginDto: LoginDto,
  ) {
    return this.authService.login(tenant._id, loginDto);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP and issue JWT cookie' })
  async verifyOtp(
    @CurrentTenant() tenant: TenantDocument,
    @Body() verifyOtpDto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token } = await this.authService.verifyOtp(tenant._id, verifyOtpDto.email, verifyOtpDto.code);
    
    res.cookie('Authentication', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    return { message: 'Logged in successfully' };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Log out and clear cookie' })
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('Authentication');
    return { message: 'Logged out successfully' };
  }
}
