import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { AdminRlsService } from "./admin-rls.service";
import type { AuthedRequest } from "../auth/authed-request.type";

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
  createTarget(@Req() req: AuthedRequest, @Param("datasetId") datasetId: string, @Body() body: CreateTargetInput) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.createTarget(datasetId, body, actorSub);
  }

  @Patch("targets/:targetId")
  updateTarget(@Req() req: AuthedRequest, @Param("targetId") targetId: string, @Body() body: UpdateTargetInput) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.updateTarget(targetId, body, actorSub);
  }

  @Delete("targets/:targetId")
  deleteTarget(@Req() req: AuthedRequest, @Param("targetId") targetId: string) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.deleteTarget(targetId, actorSub);
  }

  @Get("targets/:targetId/rules")
  listRules(@Param("targetId") targetId: string, @Query("customerId") customerId?: string) {
    return this.svc.listRules(targetId, customerId);
  }

  @Post("targets/:targetId/rules")
  createRules(
    @Req() req: AuthedRequest,
    @Param("targetId") targetId: string,
    @Body() body: { items: CreateRuleInput[] },
  ) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.createRules(targetId, body?.items ?? [], actorSub);
  }

  @Delete("rules/:ruleId")
  deleteRule(@Req() req: AuthedRequest, @Param("ruleId") ruleId: string) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.deleteRule(ruleId, actorSub);
  }

  @Post("datasets/:datasetId/refresh")
  refreshDataset(@Req() req: AuthedRequest, @Param("datasetId") datasetId: string) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.refreshDataset(datasetId, actorSub);
  }

  @Get("datasets/:datasetId/refreshes")
  listRefreshes(@Param("datasetId") datasetId: string) {
    return this.svc.listDatasetRefreshes(datasetId);
  }

  @Get("datasets/:datasetId/snapshot")
  snapshot(
    @Req() req: AuthedRequest,
    @Param("datasetId") datasetId: string,
    @Query("format") format?: string,
  ) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.getDatasetSnapshot(datasetId, format, actorSub);
  }
}
