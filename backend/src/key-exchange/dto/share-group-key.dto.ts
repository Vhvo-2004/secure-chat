export interface ShareGroupKeyDto {
  groupId: string;
  senderId: string;
  receiverId: string;
  packet: Record<string, any>;
  encryptedGroupKey: string;
  keyIv?: string | null;
  keyAad?: string | null;
}
