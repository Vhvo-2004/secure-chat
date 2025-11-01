import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InviteFriendDto } from './dto/invite-friend.dto';
import { Friendship, FriendshipDocument, FriendshipStatus } from './schemas/friendship.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

export interface FriendshipResponse {
  friendship: Friendship;
  status: FriendshipStatus;
  message?: string;
}

@Injectable()
export class FriendshipsService {
  constructor(
    @InjectModel(Friendship.name) private readonly friendshipModel: Model<FriendshipDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async invite(dto: InviteFriendDto): Promise<FriendshipResponse> {
    const requesterId = this.normalizeObjectId(dto.requesterId, 'Requester id');
    if (!requesterId) {
      throw new BadRequestException('Requester id is required');
    }

    const requester = await this.userModel.findById(requesterId).exec();
    if (!requester) {
      throw new NotFoundException('Requester not found');
    }

    const target = await this.resolveTarget(dto);
    if (!target) {
      throw new NotFoundException('Friend not found');
    }

    const requesterObjectId = requester._id as Types.ObjectId;
    const targetObjectId = target._id as Types.ObjectId;

    if (requesterObjectId.equals(targetObjectId)) {
      throw new BadRequestException('Você não pode convidar a si mesmo.');
    }

    const existing = await this.friendshipModel
      .findOne({
        $or: [
          { requester: requesterObjectId, addressee: targetObjectId },
          { requester: targetObjectId, addressee: requesterObjectId },
        ],
      })
      .exec();

    if (existing) {
      if (existing.status === 'accepted') {
        return {
          friendship: this.toPlain(existing),
          status: 'accepted',
          message: 'Vocês já são amigos.',
        };
      }

      if (existing.status === 'pending') {
        if (existing.requester.equals(targetObjectId) && existing.addressee.equals(requesterObjectId)) {
          existing.status = 'accepted';
          existing.respondedAt = new Date();
          existing.acceptedAt = new Date();
          const saved = await existing.save();
          return {
            friendship: this.toPlain(saved),
            status: 'accepted',
            message: 'Convite aceito automaticamente.',
          };
        }

        if (existing.requester.equals(requesterObjectId)) {
          throw new BadRequestException('Convite já enviado e aguardando resposta.');
        }
      }

      existing.status = 'pending';
      existing.requester = requesterObjectId;
      existing.addressee = targetObjectId;
      existing.respondedAt = null;
      existing.acceptedAt = null;
      const saved = await existing.save();
      return {
        friendship: this.toPlain(saved),
        status: 'pending',
        message: 'Convite reenviado.',
      };
    }

    const created = new this.friendshipModel({
      requester: requesterObjectId,
      addressee: targetObjectId,
      status: 'pending',
    });
    const saved = await created.save();
    return {
      friendship: this.toPlain(saved),
      status: 'pending',
      message: 'Convite enviado.',
    };
  }

  async accept(id: string, userId: string): Promise<Friendship> {
    const friendship = await this.ensureFriendship(id);
    const normalizedUserId = this.normalizeObjectId(userId, 'User id');
    if (!normalizedUserId) {
      throw new BadRequestException('User id is required');
    }
    const userObjectId = new Types.ObjectId(normalizedUserId);

    if (!friendship.addressee.equals(userObjectId) && !friendship.requester.equals(userObjectId)) {
      throw new BadRequestException('Somente participantes podem responder convites.');
    }

    friendship.status = 'accepted';
    friendship.respondedAt = new Date();
    friendship.acceptedAt = new Date();
    const saved = await friendship.save();
    return this.toPlain(saved);
  }

  async decline(id: string, userId: string): Promise<Friendship> {
    const friendship = await this.ensureFriendship(id);
    const normalizedUserId = this.normalizeObjectId(userId, 'User id');
    if (!normalizedUserId) {
      throw new BadRequestException('User id is required');
    }
    const userObjectId = new Types.ObjectId(normalizedUserId);

    if (!friendship.addressee.equals(userObjectId) && !friendship.requester.equals(userObjectId)) {
      throw new BadRequestException('Somente participantes podem responder convites.');
    }

    friendship.status = 'declined';
    friendship.respondedAt = new Date();
    friendship.acceptedAt = null;
    const saved = await friendship.save();
    return this.toPlain(saved);
  }

  async remove(id: string, userId: string): Promise<Friendship> {
    const friendship = await this.ensureFriendship(id);
    const normalizedUserId = this.normalizeObjectId(userId, 'User id');
    if (!normalizedUserId) {
      throw new BadRequestException('User id is required');
    }
    const userObjectId = new Types.ObjectId(normalizedUserId);

    if (!friendship.addressee.equals(userObjectId) && !friendship.requester.equals(userObjectId)) {
      throw new BadRequestException('Somente participantes podem encerrar amizades.');
    }

    friendship.status = 'removed';
    friendship.respondedAt = new Date();
    friendship.acceptedAt = null;
    const saved = await friendship.save();
    return this.toPlain(saved);
  }

  async listForUser(userId: string, status?: FriendshipStatus): Promise<Friendship[]> {
    const normalizedUserId = this.normalizeObjectId(userId, 'User id');
    if (!normalizedUserId) {
      throw new BadRequestException('User id is required');
    }
    const conditions: any = {
      $or: [
        { requester: new Types.ObjectId(normalizedUserId) },
        { addressee: new Types.ObjectId(normalizedUserId) },
      ],
    };
    if (status) {
      conditions.status = status;
    } else {
      conditions.status = { $ne: 'removed' };
    }

    const docs = await this.friendshipModel
      .find(conditions)
      .populate('requester', 'username')
      .populate('addressee', 'username')
      .sort({ updatedAt: -1 })
      .exec();

    return docs.map((doc) => this.toPlain(doc));
  }

  async acceptedFriendIds(userId: string): Promise<Set<string>> {
    const normalizedUserId = this.normalizeObjectId(userId, 'User id');
    if (!normalizedUserId) {
      throw new BadRequestException('User id is required');
    }
    const docs = await this.friendshipModel
      .find({
        status: 'accepted',
        $or: [
          { requester: new Types.ObjectId(normalizedUserId) },
          { addressee: new Types.ObjectId(normalizedUserId) },
        ],
      })
      .select(['requester', 'addressee'])
      .exec();

    const set = new Set<string>();
    for (const doc of docs) {
      const requester = doc.requester.toString();
      const addressee = doc.addressee.toString();
      if (requester === normalizedUserId) {
        set.add(addressee);
      } else {
        set.add(requester);
      }
    }
    return set;
  }

  private async resolveTarget(dto: InviteFriendDto): Promise<UserDocument | null> {
    if (dto.targetId) {
      const normalized = this.normalizeObjectId(dto.targetId, 'Target id');
      if (!normalized) {
        throw new BadRequestException('Target id is invalid');
      }
      return this.userModel.findById(normalized).exec();
    }

    const username = typeof dto.targetUsername === 'string' ? dto.targetUsername.trim() : '';
    if (!username) {
      throw new BadRequestException('Informe o usuário a ser convidado.');
    }
    return this.userModel.findOne({ username }).exec();
  }

  private async ensureFriendship(id: string): Promise<FriendshipDocument> {
    const normalizedId = this.normalizeObjectId(id, 'Friendship id');
    if (!normalizedId) {
      throw new BadRequestException('Friendship id is required');
    }
    const friendship = await this.friendshipModel.findById(normalizedId).exec();
    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }
    return friendship;
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

  private toPlain(doc: FriendshipDocument): Friendship {
    return doc.toJSON() as unknown as Friendship;
  }
}
