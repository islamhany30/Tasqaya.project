import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  Get,
  Req,
  Param,
  ParseIntPipe,
  Put,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateProductDto } from './DTO/AddProduct.dto';
import { ProductService } from './Product.Service';
import { diskStorage } from 'multer';
import path, { extname } from 'path';
import { AdminAuthGuard } from 'src/Auth/Auth.roles';
import { JwtAuthGuard } from 'src/Auth/auth.guards';
import { UpdateProductDto } from './DTO/UpdateProduct.dto';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post('add-product')
  @UseGuards(AdminAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: path.join(process.cwd(), 'Uploads', 'Profile-Pictures'),
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
        limits: {
        fileSize: 4 * 1024 * 1024, 
        }
    }),
  )
  async addProduct(
    @Body() createProductDto: CreateProductDto,
    @UploadedFile() image: Express.Multer.File,
  ) {
    if (!image) {
      throw new BadRequestException('Image file is required');
    }
    if (image) {
      createProductDto.image = image.filename;
    }
    return this.productService.createProduct(createProductDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("/alldata")
  async getAllProducts(@Req() req) {
    return await this.productService.findAll(req.user.roles);
  }

  @UseGuards(JwtAuthGuard)
  @Get('by-car/:carId')
  async getProductsByCar(@Param('carId') carId: number) {
    return this.productService.findByCar(carId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('by-car-and-category/:carId/:categoryId')
  async getProductsByCarAndCategory(
    @Param('carId',ParseIntPipe) carId: number,
    @Param('categoryId',ParseIntPipe) categoryId: number,
  ) {
    return this.productService.findByCarAndCategory(carId, categoryId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getProductById(@Param('id',ParseIntPipe) id: number) {
    return this.productService.findOneProduct(id);
  }

  @UseGuards(AdminAuthGuard)
  @Put(':id/update')
  async updateProduct(
    @Param('id',ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ) 
  {
    return this.productService.update(id, updateProductDto);
  }

  @UseGuards(AdminAuthGuard)
  @Delete(':id/delete')
  async deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return await this.productService.deleteProduct(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('count-by-category')
  async getCountByCategory() {
    return await this.productService.countByCategory();
  }




}
