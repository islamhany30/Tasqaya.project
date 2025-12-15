import { IsEnum, IsNotEmpty, IsString, IsNumber } from 'class-validator';
import { ReviewRating } from 'src/Types/Rating';
import { ReviewTitle } from 'src/Types/Title.rating';

export class CreateReviewDto {
  @IsEnum(ReviewTitle)
  @IsNotEmpty()
  title: ReviewTitle;

  @IsString()
  @IsNotEmpty()
  comment: string;

  @IsEnum(ReviewRating)
  @IsNotEmpty()
  rating: ReviewRating;

  @IsNumber()
  @IsNotEmpty()
  productId: number;
}
