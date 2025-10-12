import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Group {
  @Prop({ required: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  creator: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  members: Types.ObjectId[];

  @Prop({ type: String, default: null })
  keyFingerprint?: string | null;
}

export type GroupDocument = Group & Document;
export const GroupSchema = SchemaFactory.createForClass(Group);

GroupSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_, value) => {
    const ret: any = { ...value };
    ret.id = ret._id?.toString();
    ret.creator = ret.creator?.toString?.() ?? ret.creator;
    ret.members = Array.isArray(ret.members)
      ? ret.members.map((m: any) => m?.toString?.() ?? m)
      : ret.members;
    delete ret._id;
    return ret;
  },
});
