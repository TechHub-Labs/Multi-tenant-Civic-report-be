import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TenantDocument, JoinMode } from '../tenant/schemas/tenant.schema';
import { UserDocument } from '../user/schemas/user.schema';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // In-memory store for OTPs (Placeholder until a real service like Twilio/SendGrid is integrated)
  private otpStore = new Map<string, { code: string; expires: number; userId: string }>();

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async register(tenant: TenantDocument, registerDto: RegisterDto): Promise<UserDocument> {
    const { mode, allowed_domains, active_invite_tokens } = tenant.join_settings;

    // Validate registration modes
    if (mode === JoinMode.DOMAIN_RESTRICTED) {
      const emailDomain = '@' + registerDto.email.split('@')[1];
      if (!allowed_domains.includes(emailDomain)) {
        throw new BadRequestException(`Email domain ${emailDomain} is not allowed for this tenant`);
      }
    } else if (mode === JoinMode.INVITE_ONLY) {
      const tokenObj = active_invite_tokens.find(t => t.token === registerDto.invite_token);
      if (!tokenObj || new Date(tokenObj.expiresAt) < new Date()) {
        throw new BadRequestException('Invalid or expired invite token');
      }
    }

    const salt = await bcrypt.genSalt();
    const password_hash = await bcrypt.hash(registerDto.password, salt);

    return this.userService.create({
      tenant_id: tenant._id as any,
      first_name: registerDto.first_name,
      last_name: registerDto.last_name,
      middle_name: registerDto.middle_name,
      email: registerDto.email,
      password_hash,
    });
  }

  async login(tenantId: any, loginDto: LoginDto): Promise<{ message: string; email: string }> {
    const user = await this.userService.findByEmailAndTenant(loginDto.email, tenantId);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    // Store OTP against user email
    this.otpStore.set(user.email, { code: otp, expires, userId: user._id.toString() });

    // Console logging OTP as requested
    this.logger.log(`\n===================================\n[OTP FOR ${user.email}]: ${otp}\n===================================`);

    return { message: 'OTP sent successfully. Please verify to continue.', email: user.email };
  }

  async verifyOtp(tenantId: any, email: string, code: string): Promise<{ access_token: string }> {
    const record = this.otpStore.get(email);
    if (!record) {
      throw new BadRequestException('No pending OTP found for this email');
    }

    if (Date.now() > record.expires) {
      this.otpStore.delete(email);
      throw new BadRequestException('OTP has expired');
    }

    if (record.code !== code) {
      throw new UnauthorizedException('Invalid OTP');
    }

    // Clear OTP after successful verification
    this.otpStore.delete(email);

    const user = await this.userService.findByIdAndTenant(record.userId, tenantId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const payload = { sub: user._id, email: user.email, role: user.role, tenant_id: tenantId };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
