export interface CreateUserDto {
  username: string;
  identityKeyBox: string;
  identityKeySign: string;
  signedPreKey: string;
  signedPreKeySignature: string;
  oneTimePreKeys?: Array<{ index: number; key: string }>;
}
