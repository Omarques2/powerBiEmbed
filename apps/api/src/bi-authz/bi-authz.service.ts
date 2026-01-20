import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BiAuthzService {
  constructor(private readonly prisma: PrismaService) {}

  async listAllowedWorkspaces(userId: string) {
    const rows = await this.prisma.biWorkspacePermission.findMany({
      where: {
        userId: userId,
        canView: true,
        workspace: {
          isActive: true,
          customer: { status: 'active' },
        },
      },
      include: {
        workspace: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((r) => ({
      workspaceId: r.workspace.workspaceId,
      name: r.workspace.workspaceName ?? String(r.workspace.workspaceId),
      customerId: r.workspace.customerId,
    }));
  }

  async listAllowedReports(userId: string, workspaceId: string) {
    // 1) valida acesso ao workspace + workspace ativo + customer ativo
    const wsPerm = await this.prisma.biWorkspacePermission.findFirst({
      where: {
        userId: userId,
        canView: true,
        workspace: {
          workspaceId: workspaceId,
          isActive: true,
          customer: { status: 'active' },
        },
      },
      include: { workspace: true },
    });

    if (!wsPerm) throw new ForbiddenException('No access to workspace');

    // 2) permissões por report (canView=true) + report ativo
    const perms = await this.prisma.biReportPermission.findMany({
      where: {
        userId: userId,
        canView: true,
        report: {
          workspaceRefId: wsPerm.workspace.id,
          isActive: true,
          workspace: {
            isActive: true,
            customer: { status: 'active' },
          },
        },
      },
      select: {
        report: {
          select: {
            reportId: true,
            reportName: true,
            datasetId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return perms.map((p) => ({
      id: p.report.reportId,
      name: p.report.reportName ?? String(p.report.reportId),
      datasetId: p.report.datasetId,
      workspaceId,
    }));
  }

  async getWorkspaceCustomerId(userId: string, workspaceId: string) {
    const wsPerm = await this.prisma.biWorkspacePermission.findFirst({
      where: {
        userId: userId,
        canView: true,
        workspace: {
          workspaceId: workspaceId,
          isActive: true,
          customer: { status: 'active' },
        },
      },
      select: {
        workspace: { select: { customerId: true } },
      },
    });

    if (!wsPerm?.workspace?.customerId) {
      throw new ForbiddenException('No access to workspace');
    }

    return wsPerm.workspace.customerId;
  }

  async assertCanViewReport(userId: string, workspaceId: string, reportId: string) {
    const ok = await this.prisma.biReportPermission.findFirst({
      where: {
        userId: userId,
        canView: true,
        report: {
          reportId: reportId,
          isActive: true,
          workspace: {
            workspaceId: workspaceId,
            isActive: true,
            customer: { status: 'active' },
          },
        },
      },
      select: { id: true },
    });

    if (!ok) throw new ForbiddenException('No access to workspace/report');
  }
}
