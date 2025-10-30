import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { GroupsService } from './groups.service';
import type { CreateGroupDto } from './dto/create-group.dto';

@Controller('groups')
export class GroupsController {
	constructor(private readonly groupsService: GroupsService) {}

	@Post()
	create(@Body() body: CreateGroupDto) {
		return this.groupsService.create(body);
	}

	@Get()
	find(@Query('userId') userId?: string) {
		if (userId) {
			return this.groupsService.findForUser(userId);
		}
		return this.groupsService.findAll();
	}

	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.groupsService.findOne(id);
	}
}
