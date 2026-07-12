import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { SubmitActualCountsDto } from './dto/submit-actual-counts.dto';
import { ReportingService } from './reporting.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reporting')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  // ── Variance ─────────────────────────────────────────────────────────────

  @Post('variance/submit')
  @Roles('owner', 'manager')
  submitActualCounts(@Body() dto: SubmitActualCountsDto) {
    return this.reportingService.submitActualCounts(dto);
  }

  @Get('variance/:shiftId')
  getVarianceReport(
    @Param('shiftId') shiftId: string,
    @Query('filter') filter: 'all' | 'shortages' | 'overs' = 'all',
  ) {
    return this.reportingService.getVarianceReport(shiftId, filter);
  }

  @Get('variance/:shiftId/print')
  getPrintableVarianceReport(
    @Param('shiftId') shiftId: string,
    @Query('filter') filter: 'all' | 'shortages' | 'overs' = 'all',
  ) {
    return this.reportingService.getPrintableVarianceReport(shiftId, filter);
  }

  // ── Sales ─────────────────────────────────────────────────────────────────

  @Get('sales/summary')
  getSalesSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportingService.getSalesSummary(startDate, endDate);
  }

  @Get('sales/daily/:date')
  getDailySummary(@Param('date') date: string) {
    return this.reportingService.getDailySummary(date);
  }

  // ── Charts ────────────────────────────────────────────────────────────────

  @Get('charts')
  getChartData(@Query('days') days?: string) {
    return this.reportingService.getChartData(days ? parseInt(days, 10) : 7);
  }

  // ── Deliveries ────────────────────────────────────────────────────────────

  @Post('deliveries')
  @Roles('owner', 'manager')
  recordDelivery(@Body() dto: CreateDeliveryDto) {
    return this.reportingService.recordDelivery(dto);
  }

  @Get('deliveries/discrepancies')
  getDeliveryDiscrepancies(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportingService.getDeliveryDiscrepancies(startDate, endDate);
  }

  @Get('deliveries')
  getDeliveries(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportingService.getDeliveries(startDate, endDate);
  }

  @Get('deliveries/:id')
  getDeliveryById(@Param('id') id: string) {
    return this.reportingService.getDeliveryById(id);
  }

  @Patch('deliveries/:id/verify')
  @Roles('owner', 'manager')
  verifyDelivery(
    @Param('id') id: string,
    @Body('verifiedBy') verifiedBy: string,
  ) {
    return this.reportingService.verifyDelivery(id, verifiedBy);
  }

  @Patch('deliveries/:id/dispute')
  @Roles('owner', 'manager')
  disputeDelivery(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Body('disputedBy') disputedBy: string,
  ) {
    return this.reportingService.disputeDelivery(id, reason, disputedBy);
  }
}
