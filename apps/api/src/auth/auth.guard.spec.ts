import { type ExecutionContext } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import type { Claims } from './claims.type';

const ENV_KEYS = [
  'SIGFARM_AUTH_ISSUER',
  'SIGFARM_AUTH_AUDIENCE',
  'SIGFARM_AUTH_JWKS_URL',
] as const;

const defaultEnv = {
  SIGFARM_AUTH_ISSUER: 'https://auth.sigfarmintelligence.com',
  SIGFARM_AUTH_AUDIENCE: 'sigfarm-apps',
  SIGFARM_AUTH_JWKS_URL:
    'https://api-auth.sigfarmintelligence.com/.well-known/jwks.json',
};

function applyAuthEnv() {
  process.env.SIGFARM_AUTH_ISSUER = defaultEnv.SIGFARM_AUTH_ISSUER;
  process.env.SIGFARM_AUTH_AUDIENCE = defaultEnv.SIGFARM_AUTH_AUDIENCE;
  process.env.SIGFARM_AUTH_JWKS_URL = defaultEnv.SIGFARM_AUTH_JWKS_URL;
}

function buildExecutionContext(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as ExecutionContext;
}

function sampleClaims(): Claims {
  return {
    sub: '00000000-0000-4000-8000-000000000001',
    sid: 'sid:test',
    amr: 'entra',
    email: 'auth-guard@test.sigfarm.local',
    emailVerified: true,
    globalStatus: 'active',
    apps: [],
    ver: 1,
  };
}

describe('AuthGuard', () => {
  const originalEnv: Partial<
    Record<(typeof ENV_KEYS)[number], string | undefined>
  > = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
    }
    applyAuthEnv();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it('throws when required SIGFARM auth env vars are missing', () => {
    delete process.env.SIGFARM_AUTH_ISSUER;

    expect(() => new AuthGuard()).toThrow(
      'Missing SIGFARM_AUTH_ISSUER, SIGFARM_AUTH_AUDIENCE or SIGFARM_AUTH_JWKS_URL',
    );
  });

  it('stores validated claims on request when delegated guard accepts', async () => {
    const guard = new AuthGuard() as unknown as {
      delegate: { canActivate: (ctx: ExecutionContext) => Promise<boolean> };
      canActivate: (ctx: ExecutionContext) => Promise<boolean>;
    };
    const req = { sigfarmAuthClaims: sampleClaims() } as Record<
      string,
      unknown
    >;
    const delegateCanActivate = jest.fn().mockResolvedValue(true);
    guard.delegate = { canActivate: delegateCanActivate };

    const accepted = await guard.canActivate(buildExecutionContext(req));

    expect(accepted).toBe(true);
    expect(delegateCanActivate).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual(req.sigfarmAuthClaims);
  });

  it('returns false when delegated guard rejects', async () => {
    const guard = new AuthGuard() as unknown as {
      delegate: { canActivate: (ctx: ExecutionContext) => Promise<boolean> };
      canActivate: (ctx: ExecutionContext) => Promise<boolean>;
    };
    const req = { sigfarmAuthClaims: sampleClaims() } as Record<
      string,
      unknown
    >;
    guard.delegate = { canActivate: jest.fn().mockResolvedValue(false) };

    const accepted = await guard.canActivate(buildExecutionContext(req));

    expect(accepted).toBe(false);
    expect(req.user).toBeUndefined();
  });
});
