import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { AddPreKeysDto } from './dto/add-prekeys.dto';
import { OneTimePreKey, User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async create(payload: CreateUserDto): Promise<User> {
    const { username, oneTimePreKeys = [], ...rest } = payload;
    const normalizedPreKeys = oneTimePreKeys.map((item) => this.mapPreKey(item));
    const existing = await this.userModel.findOne({ username }).exec();

    if (existing) {
      existing.identityKeyBox = rest.identityKeyBox;
      existing.identityKeySign = rest.identityKeySign;
      existing.signedPreKey = rest.signedPreKey;
      existing.signedPreKeySignature = rest.signedPreKeySignature;
      existing.oneTimePreKeys = normalizedPreKeys;
      const updated = await existing.save();
      return this.toPlain(updated);
    }

    const created = new this.userModel({
      username,
      ...rest,
      oneTimePreKeys: normalizedPreKeys,
    });
    const saved = await created.save();
    return this.toPlain(saved);
  }

  async findAll(): Promise<User[]> {
    const docs = await this.userModel.find().sort({ username: 1 }).exec();
    return docs.map((doc) => this.toPlain(doc));
  }

  async findOne(id: string): Promise<User> {
    const doc = await this.userModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException('User not found');
    }
    return this.toPlain(doc);
  }

  async findByUsername(username: string): Promise<User | null> {
    const doc = await this.userModel.findOne({ username }).exec();
    return doc ? this.toPlain(doc) : null;
  }

  async addPreKeys(id: string, payload: AddPreKeysDto): Promise<User> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const incoming = payload.oneTimePreKeys.map((item) => this.mapPreKey(item));
    const existingIndexes = new Set(user.oneTimePreKeys.map((k) => k.index));
    const filtered = incoming.filter((item) => !existingIndexes.has(item.index));
    user.oneTimePreKeys.push(...filtered);
    const saved = await user.save();
    return this.toPlain(saved);
  }

  async reservePreKey(userId: string, consumerId?: string): Promise<{ user: User; preKey: OneTimePreKey | null }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const available = user.oneTimePreKeys.find((item) => !item.used);
    if (!available) {
      return { user: user.toJSON() as unknown as User, preKey: null };
    }
    available.used = true;
    available.usedBy = consumerId ?? null;
    available.usedAt = new Date();
    await user.save();
    const plainUser = user.toJSON() as unknown as User;
    const plainPreKey = plainUser.oneTimePreKeys.find((item) => item.index === available.index) ?? null;
    return { user: plainUser, preKey: plainPreKey as OneTimePreKey | null };
  }

  private mapPreKey(item: { index: number; key: string }): OneTimePreKey {
    return {
      key: item.key,
      index: item.index,
      used: false,
      usedBy: null,
      usedAt: null,
    } as OneTimePreKey;
  }

  private toPlain(user: UserDocument): User {
    return user.toJSON() as unknown as User;
  }
}
