import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { AdminUsersService } from './admin-users.service';
import { AdminAccessMetricsQueryDto } from './dto/admin-metrics.dto';

@Controller('admin/metrics')
@UseGuards(AuthGuard, PlatformAdminGuard)
export class AdminMetricsController {
  constructor(private readonly svc: AdminUsersService) {}

  @Get('access')
  getAccess(@Query() query: AdminAccessMetricsQueryDto) {
    return this.svc.getAccessMetrics({
      window: query.window,
      bucket: query.bucket,
      from: query.from?.trim() || undefined,
      to: query.to?.trim() || undefined,
      timezone: query.timezone?.trim() || undefined,
      topLimit: query.topLimit,
    });
  }
}
