import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { AdminUsersService } from "./admin-users.service";

@Controller("admin/audit")
@UseGuards(AuthGuard, PlatformAdminGuard)
export class AdminAuditController {
  constructor(private readonly svc: AdminUsersService) {}

  @Get()
  list(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("action") action?: string,
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string,
    @Query("actorUserId") actorUserId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.svc.listAuditLogs({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 50,
      action: action?.trim() || undefined,
      entityType: entityType?.trim() || undefined,
      entityId: entityId?.trim() || undefined,
      actorUserId: actorUserId?.trim() || undefined,
      from: from?.trim() || undefined,
      to: to?.trim() || undefined,
    });
  }
}
