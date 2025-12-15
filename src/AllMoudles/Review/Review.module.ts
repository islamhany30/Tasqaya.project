import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from '../../entities/Review.entity';
import { ReviewService } from './Review.service';
import { ReviewController } from './Review.controller';
import { Product } from '../../entities/Products.entity';
import { User } from 'src/entities/user.entity';
import { ModerationService } from './Moderation.service';

@Module({
  imports: [TypeOrmModule.forFeature([Review, Product,User])],
  controllers: [ReviewController],
  providers: [ReviewService,ModerationService]
})
export class ReviewModule {}
