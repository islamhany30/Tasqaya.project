import { IsInt, IsPositive, Min } from 'class-validator';

export class AddProductDto {
  @IsInt()
  @IsPositive()
  productId: number;

  @IsInt()
  @IsPositive()
  @Min(1)
  quantity: number;
}
