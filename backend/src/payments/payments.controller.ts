import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  ChargeStaffAccountDto,
  CloseShiftDto,
  OpenShiftDto,
  ProcessPaymentDto,
  ProcessSplitPaymentDto,
} from './dto/payments.dto';
import { PaymentsService } from './payments.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('process')
  @HttpCode(200)
  processPayment(@Body() dto: ProcessPaymentDto) {
    return this.paymentsService.processPayment(dto);
  }

  @Post('split')
  @HttpCode(200)
  processSplitPayment(@Body() dto: ProcessSplitPaymentDto) {
    return this.paymentsService.processSplitPayment(dto);
  }

  @Roles('owner', 'manager')
  @Get('staff-accounts')
  getAllStaffAccounts() {
    return this.paymentsService.getAllStaffAccounts();
  }

  @Get('staff-accounts/:id')
  getStaffAccountBalance(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.getStaffAccountBalance(id);
  }

  @Roles('owner', 'manager')
  @Post('staff-accounts/charge')
  @HttpCode(200)
  chargeStaffAccount(@Body() dto: ChargeStaffAccountDto) {
    return this.paymentsService.chargeStaffAccount(dto);
  }

  @Roles('owner', 'manager')
  @Post('shifts/open')
  @HttpCode(201)
  openShift(@Body() dto: OpenShiftDto) {
    return this.paymentsService.openShift(dto);
  }

  @Roles('owner', 'manager')
  @Post('shifts/close')
  @HttpCode(200)
  closeShift(@Body() dto: CloseShiftDto) {
    return this.paymentsService.closeShift(dto);
  }

  @Get('shifts/current')
  getCurrentShift() {
    return this.paymentsService.getCurrentShift();
  }

  @Get('shifts/history')
  getShiftHistory(@Query('limit') limit?: string) {
    return this.paymentsService.getShiftHistory(
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Roles('owner')
  @Post('refund/:id')
  @HttpCode(200)
  refundTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string; refundedBy: string },
  ) {
    return this.paymentsService.refundTransaction(
      id,
      body.reason,
      body.refundedBy,
    );
  }
}
