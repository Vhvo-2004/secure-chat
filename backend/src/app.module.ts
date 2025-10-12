import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { GroupsModule } from './groups/groups.module';
import { KeyExchangeModule } from './key-exchange/key-exchange.module';
import { MessagesModule } from './messages/messages.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const get_prop = (property: string): string => configService.get<string>(property) ?? "";

        const host = get_prop('DATABASE_HOST');
        const port = get_prop('DATABASE_PORT');
        const user = get_prop('DATABASE_USER');
        const pass = encodeURIComponent(get_prop('DATABASE_PASSWORD'));
        const dbName = get_prop('DATABASE_NAME');
        return {
          uri: `mongodb://${user}:${pass}@${host}:${port}/${dbName}?authSource=${dbName}`};
      },
      inject: [ConfigService]
    }),
    UsersModule,
    GroupsModule,
    KeyExchangeModule,
    MessagesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
