import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { FriendshipsService } from './friendships.service';
import { InviteFriendDto } from './dto/invite-friend.dto';
import { RespondFriendDto } from './dto/respond-friend.dto';
import type { FriendshipStatus } from './schemas/friendship.schema';

@Controller('friends')
export class FriendshipsController {
  constructor(private readonly friendshipsService: FriendshipsService) {}

  @Get()
  list(@Query('userId') userId: string, @Query('status') status?: string) {
    return this.friendshipsService.listForUser(userId, status as FriendshipStatus | undefined);
  }

  @Post('invite')
  invite(@Body() body: InviteFriendDto) {
    return this.friendshipsService.invite(body);
  }

  @Post(':id/accept')
  accept(@Param('id') id: string, @Body() body: RespondFriendDto) {
    return this.friendshipsService.accept(id, body.userId);
  }

  @Post(':id/decline')
  decline(@Param('id') id: string, @Body() body: RespondFriendDto) {
    return this.friendshipsService.decline(id, body.userId);
  }

  @Post(':id/remove')
  remove(@Param('id') id: string, @Body() body: RespondFriendDto) {
    return this.friendshipsService.remove(id, body.userId);
  }
}
