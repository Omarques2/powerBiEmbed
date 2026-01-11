import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { AdminRlsService } from "./admin-rls.service";

type CreateTargetInput = {
  targetKey: string;
  displayName: string;
  factTable: string;
  factColumn: string;
  valueType: "text" | "int" | "uuid";
  defaultBehavior?: "allow" | "deny";
  status?: "draft" | "active";
};

type UpdateTargetInput = Partial<CreateTargetInput>;

type CreateRuleInput = {
  customerId: string;
  op: "include" | "exclude";
  valueText?: string | null;
  valueInt?: number | string | null;
  valueUuid?: string | null;
};

@Controller("admin/rls")
@UseGuards(AuthGuard, PlatformAdminGuard)
export class AdminRlsController {
  constructor(private readonly svc: AdminRlsService) {}

  @Get("datasets/:datasetId/targets")
  listTargets(@Param("datasetId") datasetId: string) {
    return this.svc.listTargets(datasetId);
  }

  @Post("datasets/:datasetId/targets")
  createTarget(@Param("datasetId") datasetId: string, @Body() body: CreateTargetInput) {
    return this.svc.createTarget(datasetId, body);
  }

  @Patch("targets/:targetId")
  updateTarget(@Param("targetId") targetId: string, @Body() body: UpdateTargetInput) {
    return this.svc.updateTarget(targetId, body);
  }

  @Delete("targets/:targetId")
  deleteTarget(@Param("targetId") targetId: string) {
    return this.svc.deleteTarget(targetId);
  }

  @Get("targets/:targetId/rules")
  listRules(@Param("targetId") targetId: string, @Query("customerId") customerId?: string) {
    return this.svc.listRules(targetId, customerId);
  }

  @Post("targets/:targetId/rules")
  createRules(@Param("targetId") targetId: string, @Body() body: { items: CreateRuleInput[] }) {
    return this.svc.createRules(targetId, body?.items ?? []);
  }

  @Delete("rules/:ruleId")
  deleteRule(@Param("ruleId") ruleId: string) {
    return this.svc.deleteRule(ruleId);
  }

  @Post("datasets/:datasetId/refresh")
  refreshDataset(@Param("datasetId") datasetId: string) {
    return this.svc.refreshDataset(datasetId);
  }

  @Get("datasets/:datasetId/refreshes")
  listRefreshes(@Param("datasetId") datasetId: string) {
    return this.svc.listDatasetRefreshes(datasetId);
  }
}
