import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { InventoryModule } from './inventory/inventory.module';

@Module({
  imports: [
    // isGlobal means every module can inject ConfigService without re-importing
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    InventoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
