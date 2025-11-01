import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

interface RoutedMessage {
  to?: string | null;
  event?: string;
  payload?: Record<string, any> | null;
  message?: string;
  [key: string]: unknown;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private onlineUsers = new Map<string, string>();

  handleConnection(client: Socket) {
    const userId = this.resolveUserId(client);
    if (userId) {
      this.trackUserConnection(userId, client);
      this.logger.debug(`Cliente ${client.id} conectado como ${userId}`);
    } else {
      this.logger.debug(`Cliente ${client.id} conectado sem identificação inicial.`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.onlineUsers.delete(userId);
      this.logger.debug(`Cliente desconectado e removido do mapa: ${userId}`);
    } else {
      this.logger.debug(`Cliente desconectado sem identificação: ${client.id}`);
    }
  }

  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() payload: RoutedMessage,
    @ConnectedSocket() client: Socket,
  ): void {
    const fromUser = client.data.userId ?? this.resolveUserId(client);
    const enriched = {
      ...payload,
      from: fromUser ?? null,
      timestamp: new Date().toISOString(),
    };

    if (payload?.to) {
      this.sendMessageToUser(payload.to, enriched);
      return;
    }

    const event = payload?.event ?? 'message';
    this.server.emit(event, enriched);
  }

  @SubscribeMessage('identify')
  handleIdentify(
    @MessageBody() userId: string,
    @ConnectedSocket() client: Socket,
  ): void {
    if (typeof userId !== 'string' || userId.trim() === '') return;

    this.trackUserConnection(userId, client);
    this.logger.debug(`Cliente ${client.id} identificado como usuário: ${userId}`);
  }

  sendMessageToUser(recipientId: string, message: any) {
    const socketId = this.onlineUsers.get(recipientId);
    if (socketId) {
      this.logger.debug(`Enviando mensagem para ${recipientId} no socket ${socketId}`);
      this.server.to(socketId).emit('newMessage', message);
    } else {
      this.logger.debug(`Usuário ${recipientId} está offline.`);
    }
  }

  private trackUserConnection(userId: string, client: Socket) {
    this.onlineUsers.set(userId, client.id);
    client.data.userId = userId;
    client.join(`user:${userId}`);
  }

  private resolveUserId(client: Socket): string | null {
    const authUser = client.handshake?.auth?.userId;
    const queryUser = client.handshake?.query?.userId;
    const candidate = this.pickFirstString(authUser) ?? this.pickFirstString(queryUser);
    const trimmed = candidate?.trim?.() ?? '';
    return trimmed ? trimmed : null;
  }

  private pickFirstString(value: unknown): string | null {
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value) && value.length > 0) {
      const [first] = value;
      return typeof first === 'string' ? first : null;
    }
    return null;
  }
}
