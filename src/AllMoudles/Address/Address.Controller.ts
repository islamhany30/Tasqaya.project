import { Controller, Patch, Body, Request, UseGuards, Post, Delete, Req, Param, ParseIntPipe, Get } from '@nestjs/common';
import { AddressService } from './Address.Service';
import { AddAddressDto } from './dto/addAddress.dto';
import { JwtAuthGuard } from 'src/Auth/auth.guards'; 
import { UpdateAddressDto } from './dto/Update.address.dto';
import { AdminAuthGuard } from 'src/Auth/Auth.roles';

@Controller('api/address')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @UseGuards(JwtAuthGuard)
  @Post('/add')
  async addAddress(@Body() dto: AddAddressDto, @Request() req) {
    const userId = req.user.id; 
    const address = await this.addressService.addAddress(userId, dto);
    return { message: 'Address added successfully', address };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('update')
  async updateAddress(@Body() dto: UpdateAddressDto, @Request() req) {
    const userId = req.user.id;
    const address = await this.addressService.updateAddress(userId, dto);
    return { message: 'Address updated successfully', address };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete')
  async removeMyAddress(@Req() req: any): Promise<any> {
    const userId: number = req.user.id;
    return this.addressService.removeByTargetUserId(userId);
  }

  @UseGuards(AdminAuthGuard)
  @Delete('/:userid/delete')
  async removeAddressByAdmin(@Param('userId', ParseIntPipe) userId: number): Promise<any> {
     return this.addressService.removeByTargetUserId(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/userdata')
  async getMyAddress(@Req() req) {
    const userId = req.user.id;
    return await this.addressService.getAddressByUserId(userId);
  }

  @UseGuards(AdminAuthGuard)
  @Get(':userId/userdata')
  async getUserAddress(@Param('userId', ParseIntPipe) userId: number) {
    return await this.addressService.getAddressByUserId(userId);
  }
}
