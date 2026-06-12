import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ReportStatus } from '../schemas/report.schema';

export class UpdateStatusDto {
  @ApiProperty({ enum: ReportStatus, example: ReportStatus.IN_PROGRESS })
  @IsEnum(ReportStatus)
  @IsNotEmpty()
  status: ReportStatus;

  @ApiPropertyOptional({ example: 'Crew is on site repairing the pavement.' })
  @IsString()
  @IsOptional()
  notes?: string;
}
