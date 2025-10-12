import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class GroupKeyShare {
  @Prop({ type: Types.ObjectId, ref: 'Group', required: true })
  group: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  receiver: Types.ObjectId;

  @Prop({ type: Object, required: true })
  packet: Record<string, any>;

  @Prop({ required: true })
  encryptedGroupKey: string;

  @Prop({ default: null })
  keyIv?: string | null;

  @Prop({ default: null })
  keyAad?: string | null;

  @Prop({ default: false })
  consumed: boolean;

  @Prop({ type: Date, default: null })
  consumedAt?: Date | null;
}

export type GroupKeyShareDocument = GroupKeyShare & Document;
export const GroupKeyShareSchema = SchemaFactory.createForClass(GroupKeyShare);

GroupKeyShareSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_, value) => {
    const ret: any = { ...value };
    ret.id = ret._id?.toString();
    ret.group = ret.group?.toString?.() ?? ret.group;
    ret.sender = ret.sender?.toString?.() ?? ret.sender;
    ret.receiver = ret.receiver?.toString?.() ?? ret.receiver;
    delete ret._id;
    return ret;
  },
});
