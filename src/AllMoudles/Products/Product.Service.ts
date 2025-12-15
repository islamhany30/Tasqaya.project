import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Product } from 'src/entities/Products.entity';
import { CreateProductDto } from './DTO/AddProduct.dto';
import { Brand } from 'src/entities/Brand.entity';
import { Category } from 'src/entities/Category.entity';
import { Supplier } from 'src/entities/supplier.entity';
import { Car } from 'src/entities/Car.entity';
import { UserRole } from 'src/Types/Enum.userrole';
import { UpdateProductDto } from './DTO/UpdateProduct.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Brand) private brandRepo: Repository<Brand>,
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
    @InjectRepository(Car) private carRepo: Repository<Car>
  ) {}

  async createProduct(dto: CreateProductDto) {
    const brand = await this.brandRepo.findOneByOrFail({ id: dto.brandId });
    const category = await this.categoryRepo.findOneByOrFail({ id: dto.categoryId });
    const supplier = await this.supplierRepo.findOneByOrFail({ id: dto.supplierId });
    const cars = await this.carRepo.findBy({ id: In(dto.carIds) });


  const product = this.productRepo.create({
    name: dto.name,
    partNumber: dto.partNumber,
    description: dto.description,
    price: dto.price,
    stock: dto.stock,
    image: dto.image,
    brand:brand,
    category:category,
    supplier:supplier,
    cars:cars
})

    return this.productRepo.save(product);
  }

  async findAll(role:UserRole) {
    return await this.productRepo.find({
          relations: {
            brand: true,
            category: true,
            supplier: true,
            cars: true, 
          },
          order: { createdAt: 'DESC' }
        });
  }

  async findByCar(carId: number) {
  const car = this.carRepo.findOne({where:{id:carId}});
  if(!car)
  {
    throw new NotFoundException(`Car with id ${carId} not found`);
  }
  return await this.productRepo.find({
    relations: {
      brand: true,
      category: true,
      supplier: true,
      cars: true
    },
    where: {
      cars: {
        id: carId
      },
    },
    order: { createdAt: 'DESC' },
  });
  }

  async findByCarAndCategory(carId: number, categoryId: number) {
  const car = this.carRepo.findOne({where:{id:carId}});
  const category = this.carRepo.findOne({where:{id:categoryId}});
  if(!car)
  {
    throw new NotFoundException(`Car with id ${carId} not found`);
  }
  if(!category)
  {
    throw new NotFoundException(`Category with id ${categoryId} not found`);
  }
  return await this.productRepo.find({
    relations: {
      category: true,
      cars: true,
      brand: true,
      supplier: true,
    },
    where: {
      category: { id: categoryId },
      cars: { id: carId },
    },
    order: { createdAt: 'DESC' },
  });
  }

  async findOneProduct(id: number) {
  const product = await this.productRepo.findOne({
    where: { id },
    relations: {
      category: true,
      brand: true,
      supplier: true,
      cars: true,
    },
  });

  if (!product) {
    throw new NotFoundException(`Product with id ${id} not found`);
  }

  return product;
  }

  async update(id: number, updateProductDto: UpdateProductDto) {
  const product = await this.productRepo.findOne({ where: { id } });

  if (!product) {
    throw new NotFoundException(`Product with id ${id} not found`);
  }

  if (updateProductDto.brandId) {
    product.brand = await this.brandRepo.findOneByOrFail({ id: updateProductDto.brandId });
  }
  if (updateProductDto.categoryId) {
    product.category = await this.categoryRepo.findOneByOrFail({ id: updateProductDto.categoryId });
  }
  if (updateProductDto) {
    product.supplier = await this.supplierRepo.findOneByOrFail({ id: updateProductDto.supplierId });
  }
  if (updateProductDto.carIds) {
    product.cars = await this.carRepo.findByIds(updateProductDto.carIds);
  }

  Object.assign(product, updateProductDto);

  return await this.productRepo.save(product);
  }
  
  async deleteProduct(id: number){
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
   await this.productRepo.remove(product);
    return { message: "Product has been deleted successfully" };
  }

  async countByCategory() {
  return await this.productRepo
    .createQueryBuilder('product')
    .leftJoin('product.category', 'category')
    .select('category.name', 'category')
    .addSelect('COUNT(product.id)', 'count')
    .groupBy('category.name')
    .getRawMany();
}









}
