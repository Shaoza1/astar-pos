import { IsString, Length } from 'class-validator';

export class WebAuthnLoginDto {
  @IsString()
  credentialId!: string;

  @IsString()
  authenticatorData!: string;

  @IsString()
  clientDataJSON!: string;

  @IsString()
  signature!: string;

  @IsString()
  @Length(1, 255)
  deviceId!: string;
}
