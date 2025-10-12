import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateMessageDto } from './dto/create-message.dto';
import { Message, MessageDocument } from './schemas/message.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
  ) {}

  async create(dto: CreateMessageDto): Promise<Message> {
    const group = await this.groupModel.findById(dto.groupId).exec();
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    const isMember = group.members.some((member) => member.toString() === dto.senderId);
    if (!isMember) {
      throw new NotFoundException('Sender is not part of the group');
    }
    const created = new this.messageModel({
      group: new Types.ObjectId(dto.groupId),
      sender: new Types.ObjectId(dto.senderId),
      ciphertext: dto.ciphertext,
      iv: dto.iv,
    });
    return created.save();
  }

  async list(groupId: string): Promise<Message[]> {
    const messages = await this.messageModel
      .find({ group: new Types.ObjectId(groupId) })
      .sort({ createdAt: 1 })
      .lean({ virtuals: true })
      .exec();
    return messages;
  }
}
