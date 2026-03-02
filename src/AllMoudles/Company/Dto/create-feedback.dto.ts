import { IsEnum, IsInt, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { RatingEnum } from '../../../Enums/Rating.enum';

export class CreateFeedbackDto {

  @IsEnum(RatingEnum, { message: 'Rating must be a number between 1 and 5' })
  @IsNotEmpty()
  Rating: RatingEnum;

  @IsString()
  @IsOptional()
  Comment?: string;
}