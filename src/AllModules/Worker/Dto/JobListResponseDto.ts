import { GenderEnum } from 'src/Enums/gender.enum';
import { JobPostStatusEnum } from 'src/Enums/job-post-status.enum';

export class JobListResponseDto {
  id: number;
  eventName: string;
  location: string;
  startDate: Date;
  endDate: Date;
  requiredWorkers: number;
  durationHoursPerDay: number;
  status: JobPostStatusEnum;
  deadline: Date;
  publishedAt: Date;

  workerLevel: {
    id: number;
    levelName: string;
    workerHourlyRate: number;
  };

  genders: GenderEnum[];

  workersApplied?: number;
  hasUserApplied?: boolean;
}
