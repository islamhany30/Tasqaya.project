import { IsInt, IsNotEmpty } from 'class-validator';

export class CreateApplicationDto {
  @IsNotEmpty({ message: 'jobPostId is required' })
  @IsInt({ message: 'jobPostId must be an integer' })
  jobPostId: number;
}
