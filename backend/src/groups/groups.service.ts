import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateGroupDto } from './dto/create-group.dto';
import { Group, GroupDocument } from './schemas/group.schema';
import { FriendshipsService } from '../friendships/friendships.service';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly friendshipsService: FriendshipsService,
  ) {}

  async create(dto: CreateGroupDto): Promise<Group> {
    const normalizedMembers = this.normalizeMembers(dto.members ?? []);
    const creatorId = this.resolveCreatorId(dto, normalizedMembers);

    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Group name is required');
    }

    if (normalizedMembers.length === 0) {
      throw new BadRequestException('At least one member is required to create a group');
    }

    const membersSet = new Set<string>(normalizedMembers);
    membersSet.add(creatorId);

    if (membersSet.size < 2) {
      throw new BadRequestException('A group must contain at least two distinct members');
    }

    await this.ensureUsersExist(Array.from(membersSet));

    const friendSet = await this.friendshipsService.acceptedFriendIds(creatorId);
    const otherMembers = normalizedMembers.filter((id) => id !== creatorId);
    const missingFriends = otherMembers.filter((memberId) => !friendSet.has(memberId));
    if (missingFriends.length > 0) {
      throw new BadRequestException('Só é possível criar grupos com amigos aceitos.');
    }

    const members = Array.from(membersSet).map((id) => new Types.ObjectId(id));
    const created = new this.groupModel({
      name: dto.name.trim(),
      creator: new Types.ObjectId(creatorId),
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

  private normalizeMembers(members: Array<string | null | undefined>): string[] {
    return members
      .map((value) => this.normalizeObjectId(value, 'Member id'))
      .filter((value): value is string => Boolean(value));
  }

  private resolveCreatorId(dto: CreateGroupDto, members: string[]): string {
    const candidate = dto.creator ?? dto.creatorId ?? members[0];
    const normalized = this.normalizeObjectId(candidate, 'Creator id');
    if (!normalized) {
      throw new BadRequestException('Creator id is required');
    }
    return normalized;
  }

  private async ensureUsersExist(ids: string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(ids));
    const objectIds = uniqueIds.map((id) => new Types.ObjectId(id));
    const count = await this.userModel.countDocuments({ _id: { $in: objectIds } }).exec();
    if (count !== uniqueIds.length) {
      throw new BadRequestException('Um ou mais participantes não existem.');
    }
  }

  private normalizeObjectId(value: unknown, context: string): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const raw = Array.isArray(value) ? value[0] : value;
    const candidate = typeof raw === 'string' ? raw : raw?.toString?.();
    const trimmed = candidate?.trim?.() ?? '';

    if (!trimmed) {
      return null;
    }

    if (!Types.ObjectId.isValid(trimmed)) {
      throw new BadRequestException(`${context} is not a valid identifier`);
    }

    return trimmed;
  }
}
