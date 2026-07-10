import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { ClockOutDto } from './dto/clock-out.dto';
import { PinLoginDto } from './dto/pin-login.dto';
import { WebAuthnLoginDto } from './dto/webauthn-login.dto';
import { WebAuthnRegistrationDto } from './dto/webauthn-registration.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login/pin')
  @HttpCode(200)
  loginWithPin(@Body() dto: PinLoginDto) {
    return this.authService.loginWithPin(dto);
  }

  @Public()
  @Post('login/biometric')
  @HttpCode(200)
  loginWithWebAuthn(@Body() dto: WebAuthnLoginDto) {
    return this.authService.loginWithWebAuthn(dto);
  }

  @Roles('owner', 'manager')
  @Post('webauthn/register')
  @HttpCode(201)
  registerWebAuthn(@Body() dto: WebAuthnRegistrationDto) {
    return this.authService.registerWebAuthn(dto);
  }

  @Post('clock-out')
  @HttpCode(200)
  clockOut(@Body() dto: ClockOutDto) {
    return this.authService.clockOut(dto);
  }

  @Roles('owner', 'manager')
  @Get('sessions/active')
  getActiveSessions() {
    return this.authService.getActiveSessions();
  }
}
