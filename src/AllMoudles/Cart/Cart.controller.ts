import { Controller, Post, Body, UseGuards, Req, Put, Param, ParseIntPipe, Get, Delete } from '@nestjs/common';
import { CartService } from './Cart.service';
import { JwtAuthGuard } from 'src/Auth/auth.guards';
import { AddProductDto } from './DTO/AddProduct.dto';
import { UpdateCartItemDto } from './DTO/UpdateProductQuantity.dto';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post('addproduct')
  @UseGuards(JwtAuthGuard)
  addToCart(@Req() req,@Body() dto:AddProductDto) {
    return this.cartService.addToCart(req.user.sub, dto.productId, dto.quantity);
  }

  @Put('item/:cartItemId')
  @UseGuards(JwtAuthGuard)
  updateCartItem(
    @Req() req,
    @Param('cartItemId',ParseIntPipe) cartItemId: number,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateCartItem(req.user.sub, cartItemId, dto.quantity);
  }

  @Get("get-user-cart")
  @UseGuards(JwtAuthGuard)
  getUserCart(@Req() req) {
    return this.cartService.getCartByUser(req.user.sub);
  }

  @Delete('item/:cartItemId')
  @UseGuards(JwtAuthGuard)
  removeCartItem(@Req() req, @Param('cartItemId',ParseIntPipe) cartItemId: number) {
    return this.cartService.removeCartItem(req.user.sub, cartItemId);
  }
}
