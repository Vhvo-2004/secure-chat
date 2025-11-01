export interface CreateGroupDto {
  name: string;
  /**
   * Original APIs expected the creator field to be provided explicitly, but the
   * new frontend only sends the member list. We keep the original property for
   * backwards compatibility while also accepting the new optional creatorId
   * shape.
   */
  creator?: string;
  creatorId?: string;
  members: Array<string | null | undefined>;
  keyFingerprint?: string | null;
}
