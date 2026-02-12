import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/authed-request.type';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private pickIp(req: AuthedRequest): string | null {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (Array.isArray(forwarded) && forwarded.length) {
      return String(forwarded[0] ?? '').split(',')[0]?.trim() || null;
    }
    if (typeof forwarded === 'string' && forwarded.trim().length) {
      return forwarded.split(',')[0]?.trim() || null;
    }
    return req.ip ? String(req.ip) : null;
  }

  private pickUserAgent(req: AuthedRequest): string | null {
    const userAgent = req.headers?.['user-agent'];
    if (Array.isArray(userAgent) && userAgent.length) {
      return String(userAgent[0] ?? null);
    }
    return typeof userAgent === 'string' ? userAgent : null;
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async me(@Req() req: AuthedRequest) {
    const claims = req.user;
    if (!claims) return { status: 'pending' };

    const user = await this.usersService.upsertFromClaims(claims, {
      ip: this.pickIp(req),
      userAgent: this.pickUserAgent(req),
      source: 'users/me',
    });

    // Opcional: carregar memberships (para informar o usuário)
    const memberships = await this.usersService.listActiveMemberships(user.id);
    const isPlatformAdmin = await this.usersService.isPlatformAdmin(user.id);

    const hasCustomer = memberships.length > 0;

    // Status efetivo (se disabled, bloqueia sempre)
    const effectiveStatus =
      user.status === 'disabled'
        ? 'disabled'
        : user.status === 'active' && (hasCustomer || isPlatformAdmin)
          ? 'active'
          : 'pending';

    return {
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      status: effectiveStatus,
      rawStatus: user.status, // útil para debug
      isPlatformAdmin,
      memberships: memberships.map((m) => ({
        customerId: m.customerId,
        role: m.role,
        isActive: m.isActive,
      })),
    };
  }
}
