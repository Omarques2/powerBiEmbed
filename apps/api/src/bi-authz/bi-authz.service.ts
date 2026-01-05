import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BiAuthzService {
  constructor(private readonly prisma: PrismaService) {}

  async listAllowedWorkspaces(userId: string) {
    const rows = await this.prisma.bi_workspace_permissions.findMany({
      where: { user_id: userId, can_view: true },
      include: { bi_workspaces: true },
    });

    return rows.map(r => ({
      workspaceId: r.bi_workspaces.workspace_id,
      name: r.bi_workspaces.workspace_name ?? String(r.bi_workspaces.workspace_id),
      customerId: r.bi_workspaces.customer_id,
    }));
  }

  async listAllowedReports(userId: string, workspaceId: string) {
    // 1) verifica permissão no workspace
    const ws = await this.prisma.bi_workspace_permissions.findFirst({
      where: {
        user_id: userId,
        can_view: true,
        bi_workspaces: { workspace_id: workspaceId },
      },
      include: { bi_workspaces: true },
    });
    if (!ws) throw new ForbiddenException('No access to workspace');

    // 2) por simplicidade: liberar todos os reports do workspace
    const reports = await this.prisma.bi_reports.findMany({
      where: {
        workspace_ref_id: ws.bi_workspaces.id,
        is_active: true,
      },
      select: {
        report_id: true,
        report_name: true,
        dataset_id: true,
      },
    });

    return reports.map(r => ({
      id: r.report_id,
      name: r.report_name ?? String(r.report_id),
      datasetId: r.dataset_id,
      workspaceId,
    }));
  }

  async assertCanViewReport(userId: string, workspaceId: string, reportId: string) {
    // versão simples: se pode ver o workspace, pode ver o report
    const ok = await this.prisma.bi_workspace_permissions.findFirst({
      where: {
        user_id: userId,
        can_view: true,
        bi_workspaces: { workspace_id: workspaceId },
      },
    });
    if (!ok) throw new ForbiddenException('No access to workspace/report');
  }
}
