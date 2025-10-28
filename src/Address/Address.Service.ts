import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from 'src/entities/Address.entity';
import { AddAddressDto } from './dto/addAddress.dto';
import { User } from '../entities/user.entity';
import { UpdateAddressDto } from './dto/Update.address.dto';

@Injectable()
export class AddressService {
  constructor(
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async addAddress(userId: number, dto: AddAddressDto): Promise<Address> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const address = this.addressRepo.create({
      ...dto,
      user,
    });

    return await this.addressRepo.save(address);
  }

   async updateAddress(userId: number, dto: UpdateAddressDto): Promise<Address> {
    const address = await this.addressRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });

    if (!address) {
      throw new NotFoundException('Address not found for this user');
    }

    Object.assign(address, dto);

    return await this.addressRepo.save(address);
  }

  async removeByTargetUserId(targetUserId: number): Promise<{ message: string }> {
  const user = await this.userRepo.findOne({ where: { id: targetUserId } });
  if (!user) {
    throw new NotFoundException('User not found');
  }

  const address = await this.addressRepo.findOne({
    where: { user: { id: targetUserId } },
  });

  if (!address) {
    throw new NotFoundException('This user has no address');
  }

  await this.addressRepo.remove(address);

  return { message: 'Address deleted successfully' };
}


  async getAddressByUserId(userId: number): Promise<Address> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    const address = await this.addressRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });

    if (!address) {
      throw new NotFoundException('This user has no address');
    }

    return address;
  }

}
