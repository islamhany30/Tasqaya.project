import { Controller, Get, UseGuards } from '@nestjs/common';
import { BrandService } from './Brand.service';
import { AdminAuthGuard } from 'src/Auth/Auth.roles';

@Controller('brands')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get("/allbrands")
  @UseGuards(AdminAuthGuard)
  getAll() {
    return this.brandService.getAllBrands();
  }
}
