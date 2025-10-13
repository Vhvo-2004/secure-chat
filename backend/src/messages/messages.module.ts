import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { Message, MessageSchema } from './schemas/message.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Group.name, schema: GroupSchema },
    ]),
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
