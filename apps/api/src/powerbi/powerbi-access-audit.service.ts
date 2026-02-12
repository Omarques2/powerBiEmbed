import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const REPORT_EMBED_VIEWED_ACTION = 'REPORT_EMBED_VIEWED';
const REPORT_EMBED_VIEWED_DEDUPE_WINDOW_MS = 60 * 1000;

type RegisterReportEmbedViewedInput = {
  userId: string;
  workspaceId: string;
  reportId: string;
  reportRefId: string;
  customerId: string;
  datasetId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class PowerBiAccessAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async registerReportEmbedViewed(
    input: RegisterReportEmbedViewedInput,
  ): Promise<void> {
    const dedupeSince = new Date(
      Date.now() - REPORT_EMBED_VIEWED_DEDUPE_WINDOW_MS,
    );

    try {
      const recent = await this.prisma.auditLog.findFirst({
        where: {
          action: REPORT_EMBED_VIEWED_ACTION,
          actorUserId: input.userId,
          entityType: 'BI_REPORT',
          entityId: input.reportRefId,
          createdAt: { gte: dedupeSince },
        },
        select: { id: true },
      });

      if (recent) return;

      await this.prisma.auditLog.create({
        data: {
          actorUserId: input.userId,
          action: REPORT_EMBED_VIEWED_ACTION,
          entityType: 'BI_REPORT',
          entityId: input.reportRefId,
          ip: input.ip ?? undefined,
          userAgent: input.userAgent ?? undefined,
          afterData: {
            source: 'powerbi/embed-config',
            workspaceId: input.workspaceId,
            reportId: input.reportId,
            reportRefId: input.reportRefId,
            customerId: input.customerId,
            datasetId: input.datasetId ?? null,
          },
        },
      });
    } catch {
      // best effort only: analytics event must not block embed flow.
    }
  }
}
