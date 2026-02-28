import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { AuthGuard } from '../../src/auth/auth.guard';
import { PlatformAdminGuard } from '../../src/auth/platform-admin.guard';
import { ActiveUserGuard } from '../../src/auth/active-user.guard';
import { attachCorrelationId } from '../../src/common/http/request-context';
import { EnvelopeInterceptor } from '../../src/common/http/envelope.interceptor';
import { HttpExceptionFilter } from '../../src/common/http/http-exception.filter';
import { PowerBiService } from '../../src/powerbi/powerbi.service';
import { RlsRefreshService } from '../../src/admin-rls/rls-refresh.service';
import type { Claims } from '../../src/auth/claims.type';

export type TestUserClaims = {
  sub: string;
  email?: string;
  globalStatus?: 'pending' | 'active' | 'disabled';
  [key: string]: unknown;
};

const testUsers: Record<string, TestUserClaims> = {};

export function setTestUsers(users: Record<string, TestUserClaims>) {
  Object.assign(testUsers, users);
}

export class HeaderAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const key = String(req.headers['x-test-user'] ?? 'admin');
    const claims = normalizeTestClaims(testUsers[key]);
    if (claims) req.user = claims;
    return true;
  }
}

function normalizeTestClaims(claims?: TestUserClaims): Claims | null {
  if (!claims?.sub) return null;
  const email = normalizeEmail(claims.email, claims.sub);

  return {
    sub: claims.sub,
    sid: toStringOr(`sid:${claims.sub}`, claims.sid),
    amr: normalizeAmr(claims.amr),
    email,
    emailVerified: toBooleanOr(true, claims.emailVerified),
    globalStatus: claims.globalStatus ?? 'active',
    apps: Array.isArray(claims.apps) ? (claims.apps as Claims['apps']) : [],
    ver: toNumberOr(1, claims.ver),
    iat: toOptionalNumber(claims.iat),
    exp: toOptionalNumber(claims.exp),
    iss: toOptionalString(claims.iss),
    aud: normalizeAudience(claims.aud),
  };
}

function normalizeEmail(rawEmail: unknown, sub: string): string {
  if (typeof rawEmail === 'string' && rawEmail.trim().length > 0) {
    return rawEmail.trim();
  }
  return `${sub}@test.sigfarm.local`;
}

function normalizeAmr(rawAmr: unknown): Claims['amr'] {
  return rawAmr === 'password' ? 'password' : 'entra';
}

function normalizeAudience(rawAud: unknown): Claims['aud'] | undefined {
  if (typeof rawAud === 'string' && rawAud.trim().length > 0) return rawAud;
  if (Array.isArray(rawAud)) {
    const valid = rawAud
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
    return valid.length > 0 ? valid : undefined;
  }
  return undefined;
}

function toStringOr(fallback: string, value: unknown): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function toNumberOr(fallback: number, value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toBooleanOr(fallback: boolean, value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

export function applyGlobals(app: INestApplication) {
  app.use(attachCorrelationId);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
}

export async function createE2eApp(options?: {
  authGuard?: CanActivate;
  platformAdminGuard?: CanActivate;
  activeUserGuard?: CanActivate;
  powerBiService?: Partial<PowerBiService>;
  rlsRefreshService?: Partial<RlsRefreshService>;
}) {
  const moduleBuilder = Test.createTestingModule({ imports: [AppModule] });

  const authGuard = options?.authGuard ?? new HeaderAuthGuard();
  moduleBuilder.overrideGuard(AuthGuard).useValue(authGuard);

  if (options?.platformAdminGuard) {
    moduleBuilder
      .overrideGuard(PlatformAdminGuard)
      .useValue(options.platformAdminGuard);
  }

  if (options?.activeUserGuard) {
    moduleBuilder
      .overrideGuard(ActiveUserGuard)
      .useValue(options.activeUserGuard);
  }

  if (options?.powerBiService) {
    moduleBuilder
      .overrideProvider(PowerBiService)
      .useValue(options.powerBiService);
  }

  if (options?.rlsRefreshService) {
    moduleBuilder
      .overrideProvider(RlsRefreshService)
      .useValue(options.rlsRefreshService);
  }

  const moduleRef = await moduleBuilder.compile();
  const app = moduleRef.createNestApplication();
  applyGlobals(app);
  await app.init();
  return app;
}
