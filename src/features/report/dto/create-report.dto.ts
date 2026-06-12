import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ example: 'Pothole on Main Street' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Large pothole blocking the right lane near the traffic light.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'Maintenance' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: -1.2921, description: 'Longitude between -180 and 180' })
  @IsLongitude()
  longitude: number;

  @ApiProperty({ example: 36.8219, description: 'Latitude between -90 and 90' })
  @IsLatitude()
  latitude: number;

  @ApiPropertyOptional({ type: [String], example: ['https://example.com/pothole.jpg'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  media_urls?: string[];

  @ApiPropertyOptional({ example: false, default: false, description: 'Toggle to mask name/email in public feeds' })
  @IsBoolean()
  @IsOptional()
  is_anonymous?: boolean;
}
