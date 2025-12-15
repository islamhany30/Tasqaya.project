import { Controller, Get, UseGuards } from '@nestjs/common';
import { SupplierService } from './Supplier.service';
import { AdminAuthGuard } from 'src/Auth/Auth.roles';

@Controller('suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Get("/allsuppliers")
  @UseGuards(AdminAuthGuard)
  findAll() {
    return this.supplierService.findAll();
  }
}
