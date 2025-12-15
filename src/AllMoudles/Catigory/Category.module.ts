import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from 'src/entities/Category.entity';
import { CategoryService } from './Category.services';
import { CategoryController } from './Category.controller';
import { User } from 'src/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Category,User])],
  controllers: [CategoryController],
  providers: [CategoryService],
})
export class CategoryModule {}
