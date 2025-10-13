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
        const providedUri = configService.get<string>('DATABASE_URI');
        if (providedUri) {
          return { uri: providedUri };
        }

        const get = (property: string, fallback: string): string =>
          configService.get<string>(property) ?? fallback;

        const host = get('DATABASE_HOST', 'localhost');
        const port = get('DATABASE_PORT', '27017');
        const dbName = get('DATABASE_NAME', 'chat');
        const authSource = get('DATABASE_AUTH_SOURCE', dbName);
        const user = get('DATABASE_USER', '');
        const password = get('DATABASE_PASSWORD', '');
        const replica = get('DATABASE_REPLICA_NAME', '');

        if (user && password) {
          const encodedUser = encodeURIComponent(user);
          const encodedPass = encodeURIComponent(password);
          return {
            uri: `mongodb://${encodedUser}:${encodedPass}@${host}:${port}/${dbName}?replicaSet=${replica}&authSource=${dbName}`
          };
        }

        return { uri: `mongodb://${host}:${port}/${dbName}`};

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
