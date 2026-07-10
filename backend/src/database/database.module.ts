import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('databaseUrl'),
        // synchronize: false — schema is managed exclusively through numbered SQL migrations
        synchronize: false,
        // migrationsRun: false — migrations are applied manually, never on startup
        migrationsRun: false,
        logging: config.get<string>('nodeEnv') === 'development',
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
