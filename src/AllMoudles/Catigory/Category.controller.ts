import { Controller, Post, Body, UseGuards, Get, Param, ParseIntPipe, Put, Delete } from '@nestjs/common';
import { CategoryService } from './Category.services';
import { CreateCategoryDto } from './Dto/addCategory.dto';
import { AdminAuthGuard } from 'src/Auth/Auth.roles';
import { UpdateCategoryDto } from './Dto/updateCategroy.dto';
import { JwtAuthGuard } from 'src/Auth/auth.guards';

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @UseGuards(AdminAuthGuard)
  @Post('add')
  async addCategory(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.createCategory(createCategoryDto);
  }
  
  @UseGuards(JwtAuthGuard)
  @Get('all')
  async getAllCategories() {
    return this.categoryService.getAllCategories();
  }

  @UseGuards(AdminAuthGuard)
  @Get(':id')
  async getCategory(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.getCategoryById(id);
  }

  @UseGuards(AdminAuthGuard)
  @Put(':id')
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoryService.updateCategory(id, updateCategoryDto);
  }

  @UseGuards(AdminAuthGuard)
  @Delete(':id')
  async deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.deleteCategory(id);
  }
}
