import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MessagesService } from './messages.service';
import type { CreateMessageDto } from './dto/create-message.dto';

@Controller('groups/:groupId/messages')
export class MessagesController {
	constructor(private readonly messagesService: MessagesService) {}

	@Post()
	create(
		@Param('groupId') groupId: string,
		@Body() body: Omit<CreateMessageDto, 'groupId'>,
	) {
		return this.messagesService.create({
			groupId,
			senderId: body.senderId,
			ciphertext: body.ciphertext,
			iv: body.iv,
		});
	}

	@Get()
	list(@Param('groupId') groupId: string) {
		return this.messagesService.list(groupId);
	}
}
