import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './AllMoudles/user/user/user.module';
import { MailModule } from './Mail/Mail.module';
import { AddressModule } from './AllMoudles/Address/Address.module';
import { SupplierModule } from './AllMoudles/Supplier/Supplier.module';
import { BrandModule } from './AllMoudles/Brand/Brand.module';
import { CarModule } from './AllMoudles/Car/Car.module';
import { CategoryModule } from './AllMoudles/Catigory/Category.module';
import { ProductModule } from './AllMoudles/Products/Product.module';
import { CartModule } from './AllMoudles/Cart/Cart.module';
import { ReviewModule } from './AllMoudles/Review/Review.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:".env.development"
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false
      }),
    }),
    UserModule,
    MailModule,
    AddressModule,
    SupplierModule,
    BrandModule,
    CarModule,
    CategoryModule,
    ProductModule,
    CartModule,
    ReviewModule
  ],
  providers:[
    {
      provide:APP_INTERCEPTOR,
      useClass:ClassSerializerInterceptor
    }
  ]
})
export class AppModule {}
