import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Group', required: true })
  group: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({ required: true })
  ciphertext: string;

  @Prop({ required: true })
  iv: string;
}

export type MessageDocument = Message & Document;
export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_, value) => {
    const ret: any = { ...value };
    ret.id = ret._id?.toString();
    ret.group = ret.group?.toString?.() ?? ret.group;
    ret.sender = ret.sender?.toString?.() ?? ret.sender;
    delete ret._id;
    return ret;
  },
});
