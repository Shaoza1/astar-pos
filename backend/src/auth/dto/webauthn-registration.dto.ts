import { IsString, IsUUID, Length } from 'class-validator';

export class WebAuthnRegistrationDto {
  @IsUUID()
  staffId!: string;

  @IsString()
  credentialId!: string;

  @IsString()
  publicKey!: string;

  @IsString()
  @Length(1, 255)
  deviceId!: string;
}
