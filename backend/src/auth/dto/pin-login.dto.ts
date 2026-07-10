import { IsString, Length, Matches } from 'class-validator';

export class PinLoginDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'PIN must be exactly 6 digits' })
  pin!: string;

  @IsString()
  @Length(1, 255)
  deviceId!: string;
}
