import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    example: 'I noticed this water leak as well, it has started reaching the campus library.',
    description: 'The content of the comment (max 500 characters)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  content: string;
}
