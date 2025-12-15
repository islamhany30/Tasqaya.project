import { Controller, Get, UseGuards } from '@nestjs/common';
import { CarService } from './Car.service';
import { AdminAuthGuard } from 'src/Auth/Auth.roles';

@Controller('cars')
export class CarController {
  constructor(private readonly carService: CarService) {}

  @Get("/allcars")
  @UseGuards(AdminAuthGuard)
  findAll() {
    return this.carService.findAll();
  }
}
