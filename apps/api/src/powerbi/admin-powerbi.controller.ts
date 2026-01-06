import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { PowerBiService } from "./powerbi.service";
import { PowerBiCatalogSyncService } from "./powerbi-catalog-sync.service";

@Controller("admin/powerbi")
@UseGuards(AuthGuard, PlatformAdminGuard)
export class AdminPowerBiController {
  constructor(
    private readonly pbi: PowerBiService,
    private readonly sync: PowerBiCatalogSyncService,
  ) {}

  // DEBUG: o que o service principal está “vendo” no Power BI
  @Get("remote/workspaces")
  async remoteWorkspaces() {
    return this.pbi.listWorkspaces();
  }

  @Get("remote/reports")
  async remoteReports(@Query("workspaceId") workspaceId: string) {
    return this.pbi.listReports(workspaceId);
  }

  // SYNC: grava catálogo no BD para um customer
  @Post("sync")
  async syncCustomer(@Body() body: {
    customerId: string;
    workspaceIds?: string[];          // opcional: filtra
    deactivateMissing?: boolean;      // opcional: marca como inactive os que sumiram
  }) {
    return this.sync.syncCustomerCatalog({
      customerId: body.customerId,
      workspaceIds: body.workspaceIds,
      deactivateMissing: body.deactivateMissing ?? false,
    });
  }

  @Get("catalog")
  async catalog(@Query("customerId") customerId: string) {
    return this.sync.getCustomerCatalog(customerId);
  }
}
