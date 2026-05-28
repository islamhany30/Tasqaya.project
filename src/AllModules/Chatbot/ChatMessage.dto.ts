import { IsString, IsNotEmpty, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Message is required' })
  message: string;

  @IsArray()
  @IsOptional()
  history?: { role: 'user' | 'assistant'; content: string }[];
}