import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from '../../entities/Cart.entity';
import { CartItem } from '../../entities/CartItem.entity';
import { Product } from '../../entities/Products.entity';
import { User } from 'src/entities/user.entity';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private cartRepo: Repository<Cart>,
    @InjectRepository(CartItem) private cartItemRepo: Repository<CartItem>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(User) private userrepo: Repository<User>
  ) {}

  async addToCart(userId: number, productId: number, quantity: number) {
    let cart = await this.cartRepo.findOne({ where: { user: { id: userId } } });
    if (!cart) {
      cart = await this.cartRepo.save({
        user: { id: userId },
        totalPrice: 0,
      });
    }

    const product = await this.productRepo.findOne({ where: { id: productId } });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const price = product.price;
    const subtotal = price * quantity;

    await this.cartItemRepo.save({
      cart: { id: cart.id },
      product: { id: productId },
      quantity,
      price,
    });

    cart.totalPrice = cart.totalPrice + subtotal;

    await this.cartRepo.save(cart);

    return {
      message: 'Product added to cart successfully',
      cartId: cart.id,
      itemAdded: {
        productId,
        quantity,
        price,
        subtotal
      },
      totalPriceAfterUpdate: cart.totalPrice,
    };
  }

  async updateCartItem(userId: number, cartItemId: number, quantity: number) {
  const cartItem = await this.cartItemRepo.findOne({
    where: { id: cartItemId },
    relations: ['cart', 'product'],
  });

  if (!cartItem) throw new NotFoundException('CartItem not found');

  if (cartItem.cart.user.id !== userId) {
    throw new ForbiddenException('You cannot modify this cart item');
  }

  const oldSubtotal = cartItem.price * cartItem.quantity;
  const newSubtotal = cartItem.price * quantity;

  cartItem.quantity = quantity;
  await this.cartItemRepo.save(cartItem);

  cartItem.cart.totalPrice = cartItem.cart.totalPrice - oldSubtotal + newSubtotal;
  await this.cartRepo.save(cartItem.cart);

  return {
    message: 'Cart item updated successfully',
    cartItem: {
      id: cartItem.id,
      productId: cartItem.product.id,
      quantity: cartItem.quantity,
      price: cartItem.price,
      subtotal: newSubtotal,
    },
    totalPrice: cartItem.cart.totalPrice,
  };
  }

  async getCartByUser(userId: number) {
    const cart = await this.cartRepo.findOne({
      where: { user: { id: userId } },
      relations: ['cartitems', 'cartitems.product'],
    });

    if (!cart) {
      return {
        message: 'Cart is empty',
        cart: null,
      };
    }

    const items = cart.cartitems.map(item => ({
      cartItemId: item.id,
      productId: item.product.id,
      productName: item.product.name,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.price * item.quantity,
    }));

    return {
      cartId: cart.id,
      totalPrice: cart.totalPrice,
      items,
    };
  }

  async removeCartItem(userId: number, cartItemId: number) {
  const cartItem = await this.cartItemRepo.findOne({
    where: { id: cartItemId },
    relations: ['cart', 'product']
  });

  if (!cartItem) throw new NotFoundException('CartItem not found');

  if (cartItem.cart.user.id !== userId) {
    throw new ForbiddenException('You cannot delete this cart item');
  }

  const subtotal = cartItem.price * cartItem.quantity;
  cartItem.cart.totalPrice = cartItem.cart.totalPrice - subtotal;

  await this.cartItemRepo.remove(cartItem);

  await this.cartRepo.save(cartItem.cart);

  return {
    message: 'Cart item removed successfully',
    totalPrice: cartItem.cart.totalPrice,
  };
  }

  async clearCart(userId: number) {
  const cart = await this.cartRepo.findOne({
    where: { user: { id: userId } },
    relations: ['cartitems'],
  });

  if (!cart || cart.cartitems.length === 0) {
    return {
      message: 'Cart is already empty',
    };
  }

  await this.cartItemRepo.remove(cart.cartitems);

  cart.totalPrice = 0;
  await this.cartRepo.save(cart);

  return {
    message: 'Cart cleared successfully',
  };
  }



}
