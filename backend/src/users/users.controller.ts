import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { AddPreKeysDto } from './dto/add-prekeys.dto';

@Controller('users')
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Post()
	create(@Body() body: CreateUserDto) {
		return this.usersService.create(body);
	}

	@Get()
	findAll() {
		return this.usersService.findAll();
	}

	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.usersService.findOne(id);
	}

	@Post(':id/one-time-pre-keys')
	addPreKeys(@Param('id') id: string, @Body() body: AddPreKeysDto) {
		return this.usersService.addPreKeys(id, body);
	}
}
