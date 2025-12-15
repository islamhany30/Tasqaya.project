import { Body, Controller, Post, UseGuards, Req, Get, ParseIntPipe, Param, Put, Delete } from '@nestjs/common';
import { CreateReviewDto } from './DTO/AddReview.dto';
import { ReviewService } from './Review.service';
import { JwtAuthGuard } from 'src/Auth/auth.guards';
import { AdminAuthGuard } from 'src/Auth/Auth.roles';
import { UpdateReviewDto } from './DTO/UpdateReview.dto';

@Controller('api/reviews')
export class ReviewController {
  constructor(private reviewService: ReviewService) {}

  @UseGuards(JwtAuthGuard)
  @Post("Add-product")
  async addReview(@Body() dto: CreateReviewDto, @Req() req) {
    const user = req.user;
    return this.reviewService.addReview(dto, user.sub);
  }

  @UseGuards(AdminAuthGuard)
  @Get("Get-all-reviews")
  async getAllReviews() {
    return this.reviewService.getAllReviews();
  }

  @UseGuards(JwtAuthGuard)
  @Get("product/:productId")
  async getUserReview(
      @Param("productId",ParseIntPipe) productId: number,
      @Req() req
  ){
    const userId = req.user.sub; 
    return this.reviewService.getUserReview(userId, productId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('product/:productId/reviews')
  async getProductReviews(@Param('productId',ParseIntPipe) productId: number) {
    return this.reviewService.getProductReviews(productId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('get-review/:reviewid')
  async getSingleReview(@Param('reviewid',ParseIntPipe) reviewId: number) {
   return this.reviewService.getSingleReview(reviewId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('update/:reviewid')
  async updateReview(
    @Param('reviewid') reviewId: number,
    @Body() dto: UpdateReviewDto,
    @Req() req
    ) {
    const userId = req.user.sub;
    return this.reviewService.updateReview(reviewId, userId, dto);
  }
  
  @UseGuards(JwtAuthGuard)
  @Delete('delete/:reviewid')
    async deleteReview(@Param('reviewid',ParseIntPipe) reviewId: number, @Req() req) {
    return this.reviewService.deleteReview(reviewId, req.user);
  }



}
