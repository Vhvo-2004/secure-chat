import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RequestBundleDto } from './dto/request-bundle.dto';
import { ShareGroupKeyDto } from './dto/share-group-key.dto';
import { GroupKeyShare, GroupKeyShareDocument } from './schemas/group-key-share.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';

@Injectable()
export class KeyExchangeService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(GroupKeyShare.name) private readonly shareModel: Model<GroupKeyShareDocument>,
  ) {}

  async requestBundle(dto: RequestBundleDto) {
    const { receiverId, initiatorId } = dto;
    const user = await this.userModel.findById(receiverId).exec();
    if (!user) {
      throw new NotFoundException('Receiver not found');
    }

    const available = user.oneTimePreKeys.find((item) => !item.used);
    if (available) {
      available.used = true;
      available.usedBy = initiatorId ?? null;
      available.usedAt = new Date();
      await user.save();
    }

    const response = {
      identityKeyBox: user.identityKeyBox,
      identityKeySign: user.identityKeySign,
      signedPreKey: user.signedPreKey,
      signature: user.signedPreKeySignature,
      oneTimePreKey: available ? { key: available.key, index: available.index } : null,
    };

    return response;
  }

  async shareGroupKey(dto: ShareGroupKeyDto): Promise<GroupKeyShare> {
    const group = await this.groupModel.findById(dto.groupId).exec();
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    const sender = await this.userModel.findById(dto.senderId).exec();
    if (!sender) {
      throw new NotFoundException('Sender not found');
    }
    const receiver = await this.userModel.findById(dto.receiverId).exec();
    if (!receiver) {
      throw new NotFoundException('Receiver not found');
    }

    const created = new this.shareModel({
      group: new Types.ObjectId(dto.groupId),
      sender: new Types.ObjectId(dto.senderId),
      receiver: new Types.ObjectId(dto.receiverId),
      packet: dto.packet,
      encryptedGroupKey: dto.encryptedGroupKey,
      keyIv: dto.keyIv ?? null,
      keyAad: dto.keyAad ?? null,
    });

    return created.save();
  }

  async pendingShares(userId: string) {
    const docs = await this.shareModel
      .find({ receiver: new Types.ObjectId(userId), consumed: false })
      .populate('sender', 'username')
      .populate('group', 'name keyFingerprint')
      .sort({ createdAt: -1 })
      .exec();

    return docs.map((doc) => doc.toJSON());
  }

  async markConsumed(shareId: string) {
    const share = await this.shareModel.findById(shareId).exec();
    if (!share) {
      throw new NotFoundException('Share not found');
    }
    if (!share.consumed) {
      share.consumed = true;
      share.consumedAt = new Date();
      await this.groupModel
        .updateOne(
          { _id: share.group },
          { $addToSet: { members: share.receiver } },
          { timestamps: false },
        )
        .exec();
    }
    const saved = await share.save();
    return saved.toJSON();
  }
}
