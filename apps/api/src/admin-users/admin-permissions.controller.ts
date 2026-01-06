import { Body, Controller, Get, Param, Put, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { AdminUsersService } from "./admin-users.service";
import type { AuthedRequest } from "../auth/authed-request.type";

@Controller("admin")
@UseGuards(AuthGuard, PlatformAdminGuard)
export class AdminPermissionsController {
  constructor(private readonly svc: AdminUsersService) {}

  @Get("users/active")
  listActive(
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.svc.listActiveUsers({
      q: q?.trim() || undefined,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 25,
    });
  }

  @Get("users/:userId/permissions")
  getPermissions(
    @Param("userId") userId: string,
    @Query("customerId") customerId?: string,
  ) {
    return this.svc.getUserPermissions(userId, customerId?.trim() || null);
  }

  @Put("users/:userId/workspaces/:workspaceRefId")
  async setWorkspacePerm(
    @Req() req: AuthedRequest,
    @Param("userId") userId: string,
    @Param("workspaceRefId") workspaceRefId: string,
    @Body() body: { canView: boolean; grantReports?: boolean },
  ) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.setWorkspacePermission(
      userId,
      workspaceRefId,
      Boolean(body?.canView),
      body?.grantReports ?? true,
      actorSub,
    );
  }

  @Put("users/:userId/reports/:reportRefId")
  async setReportPerm(
    @Req() req: AuthedRequest,
    @Param("userId") userId: string,
    @Param("reportRefId") reportRefId: string,
    @Body() body: { canView: boolean },
  ) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.setReportPermission(userId, reportRefId, Boolean(body?.canView), actorSub);
  }
}
