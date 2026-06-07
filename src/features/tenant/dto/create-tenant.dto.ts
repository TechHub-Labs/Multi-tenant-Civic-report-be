import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Lagos State Public Works' })
  @IsString()
  @IsNotEmpty()
  organization_name: string;

  @ApiProperty({ example: 'lagos-public-works', description: 'Unique subdomain/slug for the tenant' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 'Admin' })
  @IsString()
  @IsNotEmpty()
  admin_first_name: string;

  @ApiProperty({ example: 'User' })
  @IsString()
  @IsNotEmpty()
  admin_last_name: string;

  @ApiProperty({ example: 'admin@lagos.gov.ng' })
  @IsEmail()
  admin_email: string;

  @ApiProperty({ example: 'supersecret123' })
  @IsString()
  @MinLength(8)
  admin_password: string;
}
