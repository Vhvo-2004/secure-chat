import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { KeyExchangeService } from './key-exchange.service';
import type { RequestBundleDto } from './dto/request-bundle.dto';
import type { ShareGroupKeyDto } from './dto/share-group-key.dto';

@Controller('key-exchange')
export class KeyExchangeController {
	constructor(private readonly keyExchangeService: KeyExchangeService) {}

	@Post('request')
	requestBundle(@Body() body: RequestBundleDto) {
		return this.keyExchangeService.requestBundle(body);
	}

	@Post('share')
	share(@Body() body: ShareGroupKeyDto) {
		return this.keyExchangeService.shareGroupKey(body);
	}

	@Get('pending/:userId')
	pending(@Param('userId') userId: string) {
		return this.keyExchangeService.pendingShares(userId);
	}

	@Post('pending/:shareId/consume')
	consume(@Param('shareId') shareId: string) {
		return this.keyExchangeService.markConsumed(shareId);
	}
}
