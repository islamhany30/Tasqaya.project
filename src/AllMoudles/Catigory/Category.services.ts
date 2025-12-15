import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from 'src/entities/Category.entity';
import { CreateCategoryDto } from './Dto/addCategory.dto';
import { UpdateCategoryDto } from './Dto/updateCategroy.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async createCategory(dto: CreateCategoryDto): Promise<Category> {
    const newCategory = this.categoryRepository.create({
      name: dto.name,
    });

    return await this.categoryRepository.save(newCategory);
  }

  async getAllCategories(): Promise<Category[]> {
  return await this.categoryRepository.find({});
  }

  async getCategoryById(id: number): Promise<Category> {
  const category = await this.categoryRepository.findOne({
    where: { id },
  });

  if (!category) {
    throw new Error(`Category with ID ${id} not found`);
  }

  return category;
  }

  async updateCategory(id: number, dto: UpdateCategoryDto): Promise<Category> {
  const category = await this.categoryRepository.findOne({ where: { id } });

  if (!category) {
    throw new NotFoundException(`Category with ID ${id} not found`);
  }

  if (dto.name) category.name = dto.name;

  return await this.categoryRepository.save(category);
  }

  async deleteCategory(id: number): Promise<{ message: string }> {
  const category = await this.categoryRepository.findOne({ where: { id } });

  if (!category) {
    throw new NotFoundException(`Category with ID ${id} not found`);
  }

  await this.categoryRepository.remove(category);

  return { message: `Category with ID ${id} has been deleted successfully.` };
  }


}
