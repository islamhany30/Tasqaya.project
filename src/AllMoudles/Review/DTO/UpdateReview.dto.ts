import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ReviewRating } from 'src/Types/Rating';
import { ReviewTitle } from 'src/Types/Title.rating';

export class UpdateReviewDto {
  @IsEnum(ReviewTitle)
  @IsOptional()
  title?: ReviewTitle;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsEnum(ReviewRating)
  @IsOptional()
  rating?: ReviewRating;
}
