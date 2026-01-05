import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const ALLOWED_ROLES = new Set(["owner", "admin", "member", "viewer"]);

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listPending() {
    // Pendentes = status pending OR (status active mas sem membership ativa)
    // Para simplificar, foque em status pending primeiro.
    return this.prisma.users.findMany({
      where: { status: "pending" },
      orderBy: { created_at: "desc" },
      select: { id: true, email: true, display_name: true, created_at: true, last_login_at: true, status: true },
    });
  }

  async activateUser(userId: string, customerId: string, role: string, grantCustomerWorkspaces = true) {
    if (!ALLOWED_ROLES.has(role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }

    const user = await this.prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException("User not found");

    const customer = await this.prisma.customers.findUnique({ where: { id: customerId }, select: { id: true, status: true } });
    if (!customer) throw new NotFoundException("Customer not found");
    if (customer.status !== "active") throw new BadRequestException("Customer is not active");

    return this.prisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { id: userId },
        data: { status: "active" },
      });

      await tx.user_customer_memberships.upsert({
        where: { user_id_customer_id: { user_id: userId, customer_id: customerId } },
        create: { user_id: userId, customer_id: customerId, role: role as any, is_active: true },
        update: { role: role as any, is_active: true },
      });

      if (grantCustomerWorkspaces) {
        const workspaces = await tx.bi_workspaces.findMany({
          where: { customer_id: customerId, is_active: true },
          select: { id: true },
        });

        if (workspaces.length) {
          await tx.bi_workspace_permissions.createMany({
            data: workspaces.map((ws) => ({
              user_id: userId,
              workspace_ref_id: ws.id,
              can_view: true,
            })),
            skipDuplicates: true,
          });
        }
      }

      return { ok: true };
    });
  }

  async disableUser(userId: string) {
    const user = await this.prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException("User not found");

    return this.prisma.$transaction(async (tx) => {
      await tx.users.update({ where: { id: userId }, data: { status: "disabled" } });

      // opcional: inativar memberships
      await tx.user_customer_memberships.updateMany({
        where: { user_id: userId },
        data: { is_active: false },
      });

      // opcional: remover acesso direto a workspaces/reports
      await tx.bi_workspace_permissions.updateMany({
        where: { user_id: userId },
        data: { can_view: false },
      });
      await tx.bi_report_permissions.updateMany({
        where: { user_id: userId },
        data: { can_view: false },
      });

      return { ok: true };
    });
  }
}
