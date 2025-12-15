import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto  {
    @IsString()
    @IsOptional()
    firstName?: string;
    
    @IsString()
    @IsOptional()
    lastName?: string;

    @IsNumber()
    @IsOptional()
    age?: number;

    @IsOptional()
    @IsEnum(['male', 'female'])
    gender?: 'male' | 'female';
    
}

