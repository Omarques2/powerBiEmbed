import { Body, Controller, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { AdminUsersService } from "./admin-users.service";
import type { AuthedRequest } from "../auth/authed-request.type";

@Controller("admin/customers")
@UseGuards(AuthGuard, PlatformAdminGuard)
export class AdminCustomersController {
  constructor(private readonly svc: AdminUsersService) {}

  @Post()
  createCustomer(
    @Req() req: AuthedRequest,
    @Body() body: { code: string; name: string; status?: string },
  ) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.createCustomer(body, actorSub);
  }

  @Patch(":customerId")
  updateCustomer(
    @Req() req: AuthedRequest,
    @Param("customerId") customerId: string,
    @Body() body: { code?: string; name?: string },
  ) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.updateCustomer(customerId, body, actorSub);
  }

  @Post(":customerId/status")
  setStatus(
    @Req() req: AuthedRequest,
    @Param("customerId") customerId: string,
    @Body() body: { status: string },
  ) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.setCustomerStatus(customerId, body?.status, actorSub);
  }

  /**
   * Unlink (revogar) um workspace do customer de forma consistente:
   * - bi_workspaces.is_active = false
   * - bi_reports.is_active = false (do workspace)
   * - revoga permissões (workspace + reports) de usuários com membership ativo no customer
   * - audit_log
   */
  @Post(":customerId/workspaces/:workspaceRefId/unlink")
  unlinkWorkspace(
    @Req() req: AuthedRequest,
    @Param("customerId") customerId: string,
    @Param("workspaceRefId") workspaceRefId: string,
  ) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.unlinkWorkspaceFromCustomer(customerId, workspaceRefId, actorSub);
  }
}
