import { Controller, ForbiddenException, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthedRequest } from "../auth/authed-request.type";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";

@Controller("admin/bootstrap")
@UseGuards(AuthGuard)
export class AdminBootstrapController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  @Post("platform-admin")
  async bootstrapPlatformAdmin(@Req() req: AuthedRequest) {
    const bootstrapToken = process.env.BOOTSTRAP_TOKEN;
    if (!bootstrapToken) {
      throw new ForbiddenException("BOOTSTRAP_TOKEN is not configured");
    }

    const headerToken = String(req.headers["x-bootstrap-token"] ?? "");
    if (headerToken !== bootstrapToken) {
      throw new ForbiddenException("Invalid bootstrap token");
    }

    const claims = req.user ?? {};
    if (!claims?.sub) throw new ForbiddenException("Missing subject claim");

    // 1) Upsert usuário a partir do token
    const user = await this.usersService.upsertFromClaims(claims);

    // 2) Sobe status para active (quebra o paradoxo)
    await this.prisma.users.update({
      where: { id: user.id },
      data: { status: "active" },
    });

    // 3) Seed application + role
    const app = await this.prisma.applications.upsert({
      where: { app_key: "PBI_EMBED" },
      create: { app_key: "PBI_EMBED", name: "Power BI Embed" },
      update: { name: "Power BI Embed" },
      select: { id: true },
    });

    const role = await this.prisma.app_roles.upsert({
      where: { application_id_role_key: { application_id: app.id, role_key: "platform_admin" } },
      create: { application_id: app.id, role_key: "platform_admin", name: "Platform Admin" },
      update: { name: "Platform Admin" },
      select: { id: true },
    });

    // 4) Atribui role para o usuário (customer_id null)
    const existing = await this.prisma.user_app_roles.findFirst({
    where: {
        user_id: user.id,
        application_id: app.id,
        app_role_id: role.id,
        customer_id: null,
    },
    select: { id: true },
    });

    if (!existing) {
    await this.prisma.user_app_roles.create({
        data: {
        user_id: user.id,
        application_id: app.id,
        customer_id: null,
        app_role_id: role.id,
        },
    });
    }

    // 5) Audita
    await this.prisma.audit_log.create({
      data: {
        actor_user_id: user.id,
        action: "PLATFORM_ADMIN_BOOTSTRAPPED",
        entity_type: "users",
        entity_id: user.id,
        after_data: {
          application: "PBI_EMBED",
          role: "platform_admin",
        },
      },
    });

    return { ok: true };
  }
}
