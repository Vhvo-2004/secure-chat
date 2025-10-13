export interface CreateMessageDto {
  groupId: string;
  senderId: string;
  ciphertext: string;
  iv: string;
}
