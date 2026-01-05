import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthedRequest } from "../auth/authed-request.type";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AuthGuard)
  @Get("me")
  async me(@Req() req: AuthedRequest) {
    const claims = req.user;
    if (!claims) return { status: "pending" };

    const user = await this.usersService.upsertFromClaims(claims);

    // Opcional: carregar memberships (para informar o usuário)
    const memberships = await this.usersService.listActiveMemberships(user.id);

    const hasCustomer = memberships.length > 0;

    // Status efetivo (se disabled, bloqueia sempre)
    const effectiveStatus =
      user.status === "disabled"
        ? "disabled"
        : user.status === "active" && hasCustomer
          ? "active"
          : "pending";

    return {
      email: user.email ?? null,
      displayName: user.display_name ?? null,
      status: effectiveStatus,
      rawStatus: user.status, // útil para debug
      memberships: memberships.map(m => ({
        customerId: m.customer_id,
        role: m.role,
        isActive: m.is_active,
      })),
    };
  }
}