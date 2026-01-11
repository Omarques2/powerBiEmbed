import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BiAuthzService {
  constructor(private readonly prisma: PrismaService) {}

  async listAllowedWorkspaces(userId: string) {
    const rows = await this.prisma.bi_workspace_permissions.findMany({
      where: {
        user_id: userId,
        can_view: true,
        bi_workspaces: {
          is_active: true,
          customers: { status: 'active' },
        },
      },
      include: {
        bi_workspaces: true,
      },
      orderBy: { created_at: 'asc' },
    });

    return rows.map((r) => ({
      workspaceId: r.bi_workspaces.workspace_id,
      name: r.bi_workspaces.workspace_name ?? String(r.bi_workspaces.workspace_id),
      customerId: r.bi_workspaces.customer_id,
    }));
  }

  async listAllowedReports(userId: string, workspaceId: string) {
    // 1) valida acesso ao workspace + workspace ativo + customer ativo
    const wsPerm = await this.prisma.bi_workspace_permissions.findFirst({
      where: {
        user_id: userId,
        can_view: true,
        bi_workspaces: {
          workspace_id: workspaceId,
          is_active: true,
          customers: { status: 'active' },
        },
      },
      include: { bi_workspaces: true },
    });

    if (!wsPerm) throw new ForbiddenException('No access to workspace');

    // 2) permissões por report (can_view=true) + report ativo
    const perms = await this.prisma.bi_report_permissions.findMany({
      where: {
        user_id: userId,
        can_view: true,
        bi_reports: {
          workspace_ref_id: wsPerm.bi_workspaces.id,
          is_active: true,
          bi_workspaces: {
            is_active: true,
            customers: { status: 'active' },
          },
        },
      },
      select: {
        bi_reports: {
          select: {
            report_id: true,
            report_name: true,
            dataset_id: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    return perms.map((p) => ({
      id: p.bi_reports.report_id,
      name: p.bi_reports.report_name ?? String(p.bi_reports.report_id),
      datasetId: p.bi_reports.dataset_id,
      workspaceId,
    }));
  }

  async getWorkspaceCustomerId(userId: string, workspaceId: string) {
    const wsPerm = await this.prisma.bi_workspace_permissions.findFirst({
      where: {
        user_id: userId,
        can_view: true,
        bi_workspaces: {
          workspace_id: workspaceId,
          is_active: true,
          customers: { status: 'active' },
        },
      },
      select: {
        bi_workspaces: { select: { customer_id: true } },
      },
    });

    if (!wsPerm?.bi_workspaces?.customer_id) {
      throw new ForbiddenException('No access to workspace');
    }

    return wsPerm.bi_workspaces.customer_id;
  }

  async assertCanViewReport(userId: string, workspaceId: string, reportId: string) {
    const ok = await this.prisma.bi_report_permissions.findFirst({
      where: {
        user_id: userId,
        can_view: true,
        bi_reports: {
          report_id: reportId,
          is_active: true,
          bi_workspaces: {
            workspace_id: workspaceId,
            is_active: true,
            customers: { status: 'active' },
          },
        },
      },
      select: { id: true },
    });

    if (!ok) throw new ForbiddenException('No access to workspace/report');
  }
}
