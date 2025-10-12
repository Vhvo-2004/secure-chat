export interface CreateGroupDto {
  name: string;
  creator: string;
  members: string[];
  keyFingerprint?: string | null;
}
