import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ChangePinDto } from './dto/update-staff.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService } from './staff.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Roles('owner', 'manager')
  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.staffService.findAll(includeInactive === 'true');
  }

  @Roles('owner', 'manager')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.staffService.findOne(id);
  }

  @Roles('owner')
  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateStaffDto) {
    return this.staffService.create(dto);
  }

  @Roles('owner')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(id, dto);
  }

  @Roles('owner')
  @Delete(':id')
  @HttpCode(204)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.staffService.deactivate(id);
  }

  // Any authenticated staff can change their own PIN
  @Post('change-pin')
  @HttpCode(200)
  changePin(@Body() dto: ChangePinDto) {
    return this.staffService.changePin(dto);
  }
}
