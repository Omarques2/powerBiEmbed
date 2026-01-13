// apps/api/src/admin-users/admin-customers.controller.ts
import { Body, Controller, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { AdminUsersService } from "./admin-users.service";
import type { AuthedRequest } from "../auth/authed-request.type";
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  UpdateCustomerStatusDto,
} from "./dto/admin-customers.dto";

@Controller("admin/customers")
@UseGuards(AuthGuard, PlatformAdminGuard)
export class AdminCustomersController {
  constructor(private readonly svc: AdminUsersService) {}

  @Post()
  create(
    @Req() req: AuthedRequest,
    @Body() body: CreateCustomerDto,
  ) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.createCustomer(
      { code: body.code, name: body.name, status: body.status },
      actorSub,
    );
  }

  @Put(":customerId")
  update(
    @Req() req: AuthedRequest,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Body() body: UpdateCustomerDto,
  ) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.updateCustomer(customerId, { code: body.code, name: body.name }, actorSub);
  }

  @Post(":customerId/status")
  setStatus(
    @Req() req: AuthedRequest,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Body() body: UpdateCustomerStatusDto,
  ) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.setCustomerStatus(customerId, body.status, actorSub);
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
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Param("workspaceRefId", ParseUUIDPipe) workspaceRefId: string,
  ) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.unlinkWorkspaceFromCustomer(customerId, workspaceRefId, actorSub);
  }
}
