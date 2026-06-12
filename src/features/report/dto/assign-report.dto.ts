import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty } from 'class-validator';

export class AssignReportDto {
  @ApiProperty({ example: '60c72b2f9b1d8e2568cf9602', description: 'User ID of the technician' })
  @IsMongoId()
  @IsNotEmpty()
  technician_id: string;
}
