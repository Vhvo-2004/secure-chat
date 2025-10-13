import { SubscribeMessage, WebSocketGateway,
         WebSocketServer, OnGatewayConnection,
         OnGatewayDisconnect, MessageBody
 } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';


@WebSocketGateway({
  cors: {
    origin: '*',
  }
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private onlineUsers = new Map<string, string>();

  handleConnection(client: Socket) {
    throw new Error('Method not implemented.');
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.onlineUsers.delete(userId);
      console.log(`Cliente desconectado e removido do mapa: ${userId}`);
    } else {
      console.log(`Cliente desconectado sem identificação: ${client.id}`);
    }
  }

  @SubscribeMessage('message')
  handleMessage(client: any, payload: any): string {
    return 'Hello world!';
  }

  @SubscribeMessage('identify')
  handleIdentify(
    @MessageBody() userId: string,
    client: Socket,
  ): void {
    if (typeof userId !== 'string' || userId.trim() === '') return;

    this.onlineUsers.set(userId, client.id);

    client.data.userId = userId; 

    console.log(`Cliente ${client.id} identificado como usuário: ${userId}`);
  }

  sendMessageToUser(recipientId: string, message: any) {
    const socketId = this.onlineUsers.get(recipientId);
    if (socketId) {
      console.log(`Enviando mensagem para ${recipientId} no socket ${socketId}`);
      this.server.to(socketId).emit('newMessage', message);
    } else {
      console.log(`Usuário ${recipientId} está offline.`);
    }
  }
}
