import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'removed';

@Schema({ timestamps: true })
export class Friendship {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  requester: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  addressee: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['pending', 'accepted', 'declined', 'removed'],
    default: 'pending',
  })
  status: FriendshipStatus;

  @Prop({ type: Date, default: null })
  respondedAt?: Date | null;

  @Prop({ type: Date, default: null })
  acceptedAt?: Date | null;
}

export type FriendshipDocument = Friendship & Document;

export const FriendshipSchema = SchemaFactory.createForClass(Friendship);

FriendshipSchema.index(
  { requester: 1, addressee: 1 },
  { unique: true },
);

function normalizeRef(ref: any): any {
  if (!ref) {
    return ref;
  }

  if (typeof ref === 'string') {
    return ref;
  }

  if (typeof ref === 'object') {
    const clone: any = { ...ref };
    const rawId = clone._id ?? clone.id;
    if (rawId) {
      clone.id = typeof rawId === 'string' ? rawId : rawId?.toString?.();
    }
    delete clone._id;
    return clone;
  }

  return ref;
}

FriendshipSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_, value) => {
    const ret: any = { ...value };
    ret.id = ret._id?.toString();
    ret.requester = normalizeRef(ret.requester);
    ret.addressee = normalizeRef(ret.addressee);
    delete ret._id;
    return ret;
  },
});
