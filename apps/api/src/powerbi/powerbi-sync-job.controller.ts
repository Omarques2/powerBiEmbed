import { Controller, ForbiddenException, Headers, Post } from '@nestjs/common';
import { PowerBiPagesService } from './powerbi-pages.service';

@Controller('internal/powerbi')
export class PowerBiSyncJobController {
  constructor(private readonly pages: PowerBiPagesService) {}

  @Post('pages/sync-all')
  async syncAllPages(@Headers('x-job-token') token?: string) {
    const expected = process.env.PBI_SYNC_JOB_TOKEN;
    if (!expected) {
      throw new ForbiddenException('PBI_SYNC_JOB_TOKEN is not configured');
    }
    if (!token || token !== expected) {
      throw new ForbiddenException('Invalid job token');
    }

    return this.pages.syncAllReportPages();
  }
}
