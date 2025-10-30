import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: true, timestamps: false })
export class OneTimePreKey {
	@Prop({ required: true })
	key: string;

	@Prop({ required: true })
	index: number;

	@Prop({ default: false })
	used: boolean;

	@Prop({ type: String, default: null })
	usedBy?: string | null;

	@Prop({ type: Date, default: null })
	usedAt?: Date | null;
}

export const OneTimePreKeySchema = SchemaFactory.createForClass(OneTimePreKey);

@Schema({ timestamps: true })
export class User {
	@Prop({ required: true, unique: true, trim: true })
	username: string;

	@Prop({ required: true })
	identityKeyBox: string;

	@Prop({ required: true })
	identityKeySign: string;

	@Prop({ required: true })
	signedPreKey: string;

	@Prop({ required: true })
	signedPreKeySignature: string;

	@Prop({ type: [OneTimePreKeySchema], default: [] })
	oneTimePreKeys: OneTimePreKey[];
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.set('toJSON', {
	virtuals: true,
	versionKey: false,
	transform: (_, value) => {
		const ret: any = { ...value };
		ret.id = ret._id?.toString();
		delete ret._id;
		if (Array.isArray(ret.oneTimePreKeys)) {
			ret.oneTimePreKeys = ret.oneTimePreKeys.map((k: any) => ({
				id: k._id?.toString?.() ?? k._id,
				key: k.key,
				index: k.index,
				used: k.used,
				usedBy: k.usedBy,
				usedAt: k.usedAt,
			}));
		}
		return ret;
	},
});
