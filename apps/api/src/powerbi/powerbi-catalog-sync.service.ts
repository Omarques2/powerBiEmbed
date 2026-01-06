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

    const customer = await this.prisma.customers.findUnique({
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
        const row = await tx.bi_workspaces.upsert({
          where: { customer_id_workspace_id: { customer_id: customerId, workspace_id: w.id } },
          create: {
            customer_id: customerId,
            workspace_id: w.id,
            workspace_name: w.name ?? undefined,
            is_active: true,
          },
          update: {
            workspace_name: w.name ?? undefined,
            is_active: true,
          },
          select: { id: true, workspace_id: true },
        });

        upsertedWorkspaceRefIds.push({ workspaceId: row.workspace_id, workspaceRefId: row.id });
      }

      // Opcional: desativar workspaces que sumiram (somente se NÃO estiver usando filtro)
      if (input.deactivateMissing && !input.workspaceIds?.length) {
        const remoteSet = new Set(remoteWorkspaces.map(w => w.id));
        await tx.bi_workspaces.updateMany({
          where: { customer_id: customerId, workspace_id: { notIn: Array.from(remoteSet) } },
          data: { is_active: false },
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
          await tx.bi_reports.upsert({
            where: { workspace_ref_id_report_id: { workspace_ref_id: ws.workspaceRefId, report_id: r.id } },
            create: {
              workspace_ref_id: ws.workspaceRefId,
              report_id: r.id,
              report_name: r.name ?? undefined,
              dataset_id: r.datasetId ?? undefined,
              is_active: true,
            },
            update: {
              report_name: r.name ?? undefined,
              dataset_id: r.datasetId ?? undefined,
              is_active: true,
            },
          });
          reportsUpserted += 1;
        }

        if (input.deactivateMissing) {
          const remoteSet = new Set(remoteReports.map(r => r.id));
          const res = await tx.bi_reports.updateMany({
            where: { workspace_ref_id: ws.workspaceRefId, report_id: { notIn: Array.from(remoteSet) } },
            data: { is_active: false },
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

    const customer = await this.prisma.customers.findUnique({
      where: { id: customerId },
      select: { id: true, status: true, code: true, name: true },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const workspaces = await this.prisma.bi_workspaces.findMany({
      where: { customer_id: customerId },
      orderBy: [{ is_active: "desc" }, { created_at: "asc" }],
      select: {
        id: true,
        workspace_id: true,
        workspace_name: true,
        is_active: true,
        created_at: true,
        bi_reports: {
          orderBy: [{ is_active: "desc" }, { created_at: "asc" }],
          select: {
            id: true,
            report_id: true,
            report_name: true,
            dataset_id: true,
            is_active: true,
            created_at: true,
          },
        },
      },
    });

    return {
      customer,
      workspaces: workspaces.map((w) => ({
        workspaceRefId: w.id,
        workspaceId: w.workspace_id,
        name: w.workspace_name ?? String(w.workspace_id),
        isActive: w.is_active,
        createdAt: w.created_at,
        reports: w.bi_reports.map((r) => ({
          reportRefId: r.id,
          reportId: r.report_id,
          name: r.report_name ?? String(r.report_id),
          datasetId: r.dataset_id,
          isActive: r.is_active,
          createdAt: r.created_at,
        })),
      })),
    };
  }
}
