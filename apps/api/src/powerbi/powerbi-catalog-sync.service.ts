import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PowerBiService } from "./powerbi.service";

@Injectable()
export class PowerBiCatalogSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pbi: PowerBiService,
  ) {}

  async syncCustomerCatalog(input: {
    customerId: string;
    workspaceIds?: string[];
    deactivateMissing: boolean;
  }) {
    const customerId = (input.customerId ?? "").trim();
    if (!customerId) throw new BadRequestException("customerId is required");

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, status: true },
    });
    if (!customer) throw new NotFoundException("Customer not found");
    if (customer.status !== "active") throw new BadRequestException("Customer is not active");

    // 1) Puxa workspaces do Power BI (remoto)
    let remoteWorkspaces: Array<{ id: string; name: string | null }> = [];
    try {
      const ws = await this.pbi.listWorkspaces();
      remoteWorkspaces = ws.map((w: any) => ({ id: String(w.id), name: w.name ?? null }));
    } catch (e: any) {
      throw new InternalServerErrorException(`Failed to list workspaces from Power BI: ${e?.message ?? String(e)}`);
    }

    // filtro opcional
    if (input.workspaceIds?.length) {
      const allow = new Set(input.workspaceIds.map(String));
      remoteWorkspaces = remoteWorkspaces.filter(w => allow.has(w.id));
    }

    // 2) Upsert workspaces no BD (para esse customer)
    const upsertedWorkspaceRefIds: Array<{ workspaceId: string; workspaceRefId: string }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const w of remoteWorkspaces) {
        const row = await tx.biWorkspace.upsert({
          where: { customerId_workspaceId: { customerId: customerId, workspaceId: w.id } },
          create: {
            customerId: customerId,
            workspaceId: w.id,
            workspaceName: w.name ?? undefined,
            isActive: true,
          },
          update: {
            workspaceName: w.name ?? undefined,
            isActive: true,
          },
          select: { id: true, workspaceId: true },
        });

        upsertedWorkspaceRefIds.push({ workspaceId: row.workspaceId, workspaceRefId: row.id });
      }

      // Opcional: desativar workspaces que sumiram (somente se NÃO estiver usando filtro)
      if (input.deactivateMissing && !input.workspaceIds?.length) {
        const remoteSet = new Set(remoteWorkspaces.map(w => w.id));
        await tx.biWorkspace.updateMany({
          where: { customerId: customerId, workspaceId: { notIn: Array.from(remoteSet) } },
          data: { isActive: false },
        });
      }
    });

    // 3) Para cada workspace, puxa reports e upsert em bi_reports
    let reportsUpserted = 0;
    let reportsDeactivated = 0;

    for (const ws of upsertedWorkspaceRefIds) {
      let remoteReports: Array<{ id: string; name: string | null; datasetId: string | null }> = [];

      try {
        const rr = await this.pbi.listReports(ws.workspaceId);
        remoteReports = rr.map((r: any) => ({
          id: String(r.id),
          name: r.name ?? null,
          datasetId: r.datasetId ?? null,
        }));
      } catch (e: any) {
        throw new InternalServerErrorException(
          `Failed to list reports for workspace ${ws.workspaceId}: ${e?.message ?? String(e)}`
        );
      }

      await this.prisma.$transaction(async (tx) => {
        for (const r of remoteReports) {
          await tx.biReport.upsert({
            where: { workspaceRefId_reportId: { workspaceRefId: ws.workspaceRefId, reportId: r.id } },
            create: {
              workspaceRefId: ws.workspaceRefId,
              reportId: r.id,
              reportName: r.name ?? undefined,
              datasetId: r.datasetId ?? undefined,
              isActive: true,
            },
            update: {
              reportName: r.name ?? undefined,
              datasetId: r.datasetId ?? undefined,
              isActive: true,
            },
          });
          reportsUpserted += 1;
        }

        if (input.deactivateMissing) {
          const remoteSet = new Set(remoteReports.map(r => r.id));
          const res = await tx.biReport.updateMany({
            where: { workspaceRefId: ws.workspaceRefId, reportId: { notIn: Array.from(remoteSet) } },
            data: { isActive: false },
          });
          reportsDeactivated += res.count;
        }
      });
    }

    return {
      ok: true,
      customerId,
      workspacesSeenRemote: remoteWorkspaces.length,
      workspacesUpserted: upsertedWorkspaceRefIds.length,
      reportsUpserted,
      reportsDeactivated,
    };
  }

  async getCustomerCatalog(customerIdRaw: string) {
    const customerId = (customerIdRaw ?? "").trim();
    if (!customerId) throw new BadRequestException("customerId is required");

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, status: true, code: true, name: true },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const workspaces = await this.prisma.biWorkspace.findMany({
      where: { customerId: customerId },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        workspaceId: true,
        workspaceName: true,
        isActive: true,
        createdAt: true,
        reports: {
          orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
          select: {
            id: true,
            reportId: true,
            reportName: true,
            datasetId: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      customer,
      workspaces: workspaces.map((w) => ({
        workspaceRefId: w.id,
        workspaceId: w.workspaceId,
        name: w.workspaceName ?? String(w.workspaceId),
        isActive: w.isActive,
        createdAt: w.createdAt,
        reports: w.reports.map((r) => ({
          reportRefId: r.id,
          reportId: r.reportId,
          name: r.reportName ?? String(r.reportId),
          datasetId: r.datasetId,
          isActive: r.isActive,
          createdAt: r.createdAt,
        })),
      })),
    };
  }
}
