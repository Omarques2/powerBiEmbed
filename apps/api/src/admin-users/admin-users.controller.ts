// apps/api/src/admin-users/admin-users.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  Patch,
  Delete,
  Query,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { AdminUsersService } from "./admin-users.service";
import type { AuthedRequest } from "../auth/authed-request.type";
import { ParseUUIDPipe } from "@nestjs/common";

type MembershipRole = "owner" | "admin" | "member" | "viewer";

@Controller("admin/users")
@UseGuards(AuthGuard, PlatformAdminGuard)
export class AdminUsersController {
  constructor(private readonly svc: AdminUsersService) {}

  @Get("pending")
  listPending() {
    return this.svc.listPending();
  }

  @Post(":userId/activate")
  activate(
    @Req() req: AuthedRequest,
    @Param("userId") userId: string,
    @Body() body: { customerId: string; role: string; grantCustomerWorkspaces?: boolean },
  ) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;

    return this.svc.activateUser(
      userId,
      body.customerId,
      body.role,
      body.grantCustomerWorkspaces ?? true,
      actorSub,
    );
  }

  @Post(":userId/disable")
  disable(@Req() req: AuthedRequest, @Param("userId") userId: string) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.disableUser(userId, actorSub);
  }

  // -----------------------------
  // NOVO: criar/upsert membership
  // -----------------------------
  @Post(":userId/memberships")
  upsertMembership(
    @Req() req: AuthedRequest,
    @Param("userId") userId: string,
    @Body()
    body: {
      customerId: string;
      role: MembershipRole;
      isActive?: boolean;
      grantCustomerWorkspaces?: boolean;
      revokeCustomerPermissions?: boolean;
      ensureUserActive?: boolean; // se quiser reativar user.status automaticamente
    },
  ) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.upsertUserMembership(userId, body, actorSub);
  }

  // -----------------------------
  // NOVO: editar membership
  // -----------------------------
  @Patch(":userId/memberships/:customerId")
  patchMembership(
    @Req() req: AuthedRequest,
    @Param("userId") userId: string,
    @Param("customerId") customerId: string,
    @Body()
    body: {
      role?: MembershipRole;
      isActive?: boolean;
      grantCustomerWorkspaces?: boolean;
      revokeCustomerPermissions?: boolean;
    },
  ) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.patchUserMembership(userId, customerId, body, actorSub);
  }

  // -----------------------------
  // NOVO: remover membership
  // -----------------------------
  @Delete(":userId/memberships/:customerId")
  removeMembership(
    @Req() req: AuthedRequest,
    @Param("userId") userId: string,
    @Param("customerId") customerId: string,
    @Query("revokeCustomerPermissions") revokeCustomerPermissions?: string,
  ) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    const revoke = revokeCustomerPermissions === "true" || revokeCustomerPermissions === "1";
    return this.svc.removeUserMembership(userId, customerId, revoke, actorSub);
  }

  // -----------------------------
  // NOVO: transferir customer
  // -----------------------------
  @Post(":userId/transfer")
  transferMembership(
    @Req() req: AuthedRequest,
    @Param("userId") userId: string,
    @Body()
    body: {
      fromCustomerId: string;
      toCustomerId: string;
      toRole: MembershipRole;
      deactivateFrom?: boolean; // default true
      revokeFromCustomerPermissions?: boolean; // default true
      grantToCustomerWorkspaces?: boolean; // default false
      toIsActive?: boolean; // default true
    },
  ) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.transferUserMembership(userId, body, actorSub);
  }

  @Get("active")
  listActive(
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.svc.listActiveUsers({
      q,
      page: Number(page ?? 1),
      pageSize: Number(pageSize ?? 25),
    });
  }

  @Get(":userId")
  getById(@Param("userId") userId: string) {
    return this.svc.getUserById(userId);
  }
}
