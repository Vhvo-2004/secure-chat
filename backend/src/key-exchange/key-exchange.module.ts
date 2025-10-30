import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KeyExchangeController } from './key-exchange.controller';
import { KeyExchangeService } from './key-exchange.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import {
	GroupKeyShare,
	GroupKeyShareSchema,
} from './schemas/group-key-share.schema';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: User.name, schema: UserSchema },
			{ name: Group.name, schema: GroupSchema },
			{ name: GroupKeyShare.name, schema: GroupKeyShareSchema },
		]),
	],
	controllers: [KeyExchangeController],
	providers: [KeyExchangeService],
})
export class KeyExchangeModule {}
