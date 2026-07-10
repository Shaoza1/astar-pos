import { IsString, IsUUID, Length } from 'class-validator';

export class ClockOutDto {
  @IsUUID()
  sessionId!: string;

  @IsString()
  @Length(1, 255)
  deviceId!: string;
}
