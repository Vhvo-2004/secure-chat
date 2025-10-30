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

	@Prop({ type: String, default: null })
	keyIv?: string | null;

	@Prop({ type: String, default: null })
	keyAad?: string | null;

	@Prop({ default: false })
	consumed: boolean;

	@Prop({ type: Date, default: null })
	consumedAt?: Date | null;
}

export type GroupKeyShareDocument = GroupKeyShare & Document;
export const GroupKeyShareSchema = SchemaFactory.createForClass(GroupKeyShare);

function normalizeRef(ref: any): any {
	if (!ref) {
		return ref;
	}

	if (typeof ref === 'string') {
		return ref;
	}

	if (typeof ref === 'object') {
		if (typeof ref.toHexString === 'function') {
			return ref.toHexString();
		}

		const cloned: any = { ...ref };
		const rawId = cloned._id ?? cloned.id;
		if (rawId) {
			cloned.id = typeof rawId === 'string' ? rawId : rawId?.toString?.();
		}
		delete cloned._id;

		if (Array.isArray(cloned.members)) {
			cloned.members = cloned.members.map((member: any) =>
				normalizeRef(member),
			);
		}

		if (cloned.creator) {
			cloned.creator = normalizeRef(cloned.creator);
		}

		return cloned;
	}

	return ref;
}

GroupKeyShareSchema.set('toJSON', {
	virtuals: true,
	versionKey: false,
	transform: (_, value) => {
		const ret: any = { ...value };
		ret.id = ret._id?.toString();
		ret.group = normalizeRef(ret.group);
		ret.sender = normalizeRef(ret.sender);
		ret.receiver = normalizeRef(ret.receiver);
		delete ret._id;
		return ret;
	},
});
