import { ApplicationStatusEnum } from 'src/Enums/application-status.enum';
import { JobListResponseDto } from './JobListResponseDto';

export class ApplicationResponseDto {
  id: number;
  jobPostId: number;
  workerId: number;
  status: ApplicationStatusEnum;
  appliedAt: Date;
  jobPost: JobListResponseDto;
}
