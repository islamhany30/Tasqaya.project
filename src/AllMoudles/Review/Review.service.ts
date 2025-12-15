import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../../entities/Review.entity';
import { CreateReviewDto } from './DTO/AddReview.dto';
import { User } from '../../entities/user.entity';
import { Product } from '../../entities/Products.entity';
import { UpdateReviewDto } from './DTO/UpdateReview.dto';
import { Payload } from 'src/Types/Payload';
import { UserRole } from 'src/Types/Enum.userrole';
import { ModerationService } from './Moderation.service';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review)
    private reviewRepo: Repository<Review>,

    @InjectRepository(Product)
    private productRepo: Repository<Product>,

    @InjectRepository(User)
    private userrpeo: Repository<User>,

    private readonly moderationService: ModerationService,

  ) {}

  async addReview(dto: CreateReviewDto, userId: number) {
  const product = await this.productRepo.findOne({
    where: { id: dto.productId },
  });

  if (!product) {
    throw new NotFoundException('Product not found');
  }

  const moderation = await this.moderationService.checkText(dto.comment);

  if (moderation.flagged) {
    throw new BadRequestException(
      `Your comment violates our content policy. Reason: ${moderation.reason || 'Inappropriate content detected'}`,
    );
  }

  const review = this.reviewRepo.create({
    title: dto.title,
    comment: dto.comment,
    rating: dto.rating,
    product,
    user: { id: userId } as any, // أو لو عندك User entity كامل: await this.userRepo.findOne({ where: { id: userId } })
  });

  return await this.reviewRepo.save(review);
}


  async getAllReviews() {
  return await this.reviewRepo.find({
    relations: {
      user: true,
      product: true,
    },
    select: {
      id: true,
      title: true,
      comment: true,
      rating: true,
      createdAt: true,
      user: {
        id: true,
        firstName: true,
        lastName:true     
      },
      product: {
        id: true,
        name: true,     
      },
    },
    order: { createdAt: "DESC" },
  });
  }

  async getUserReview(userId: number, productId: number) {
  const review = await this.reviewRepo.findOne({
    where: {
      user: { id: userId },
      product: { id: productId },
    },
    relations: {
      user: true,
      product: true,
    },
    select: {
      id: true,
      title: true,
      comment: true,
      rating: true,
      createdAt: true,
      user: { id: true, firstName: true,lastName:true },
      product: { id: true, name: true },
    },
  });

  if (!review) {
    throw new NotFoundException("Review not found for this product");
  }

  return review;
  }

  async getProductReviews(productId: number) {
  const reviews = await this.reviewRepo.find({
    where: { product: { id: productId } },
    relations: { user: true, product: true },
    select: {
      id: true,
      title: true,
      comment: true,
      rating: true,
      createdAt: true,
      user: {
        id: true,
        firstName: true,
        lastName:true
      },
      product: {
        id: true,
        name: true,
      },
    },
    order: { createdAt: 'DESC' }, 
  });

  if (!reviews || reviews.length === 0) {
    throw new NotFoundException('No reviews found for this product');
  }

  return reviews;
  }

  async getSingleReview(reviewId: number) {
  const review = await this.reviewRepo.findOne({
    where: { id: reviewId },
    relations: { user: true, product: true },
    select: {
      id: true,
      title: true,
      comment: true,
      rating: true,
      createdAt: true,
      user: {
        id: true,
        firstName: true,
        lastName:true
      },
      product: {
        id: true,
        name: true,
      },
    },
  });

  if (!review) throw new NotFoundException('Review not found');
  return review;
  }

  async updateReview(reviewId: number, userId: number, dto: UpdateReviewDto) {
  const review = await this.reviewRepo.findOne({
    where: { id: reviewId },
    relations: { user: true },
  });

  if (!review) throw new NotFoundException('Review not found');

  if (review.user.id !== userId) {
    throw new ForbiddenException('You cannot update this review');
  }

  Object.assign(review, dto);

  return this.reviewRepo.save(review);
  }

  async deleteReview(reviewId: number, payload: Payload) {
  const review = await this.reviewRepo.findOne({
    where: { id: reviewId },
    relations: { user: true },
  });

  if (!review) throw new NotFoundException('Review not found');

  if (review.user.id !== payload.sub  && payload.role !== UserRole.ADMIN ) {
    throw new ForbiddenException('You cannot delete this review');
  }

  await this.reviewRepo.remove(review);

  return { message: 'Review deleted successfully' };
  }





}
