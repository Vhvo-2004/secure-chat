import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateGroupDto } from './dto/create-group.dto';
import { Group, GroupDocument } from './schemas/group.schema';

@Injectable()
export class GroupsService {
  constructor(@InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>) {}

  async create(dto: CreateGroupDto): Promise<Group> {
    const membersSet = new Set(dto.members.map((id) => id));
    membersSet.add(dto.creator);
    const members = Array.from(membersSet).map((id) => new Types.ObjectId(id));
    const created = new this.groupModel({
      name: dto.name,
      creator: new Types.ObjectId(dto.creator),
      members,
      keyFingerprint: dto.keyFingerprint ?? null,
    });
    const saved = await created.save();
    return this.toPlain(saved);
  }

  async findAll(): Promise<Group[]> {
    const docs = await this.groupModel.find().sort({ createdAt: -1 }).exec();
    return docs.map((doc) => this.toPlain(doc));
  }

  async findForUser(userId: string): Promise<Group[]> {
    const docs = await this.groupModel
      .find({ members: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
    return docs.map((doc) => this.toPlain(doc));
  }

  async findOne(id: string): Promise<Group> {
    const group = await this.groupModel.findById(id).exec();
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    return this.toPlain(group);
  }

  private toPlain(group: GroupDocument): Group {
    return group.toJSON() as unknown as Group;
  }
}
