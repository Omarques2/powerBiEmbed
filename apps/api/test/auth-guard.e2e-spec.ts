import {
  Controller,
  Get,
  INestApplication,
  Module,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createServer, type Server } from 'http';
import { generateKeyPairSync, type KeyObject } from 'crypto';
import { exportJWK, SignJWT } from 'jose';
import { AuthGuard } from '../src/auth/auth.guard';
import { applyGlobals } from './helpers/e2e-utils';

const ISSUER = 'https://auth-e2e.sigfarm.local';
const AUDIENCE = 'sigfarm-apps';
const JWKS_PATH = '/.well-known/jwks.json';

@Controller()
class ProtectedController {
  @UseGuards(AuthGuard)
  @Get('protected')
  getProtected(@Req() req: { user?: { sub?: string } }) {
    return { sub: req.user?.sub ?? null };
  }
}

@Module({
  controllers: [ProtectedController],
  providers: [AuthGuard],
})
class GuardE2eModule {}

type SignOptions = {
  key: KeyObject;
  kid: string;
  issuer?: string;
  audience?: string;
  subject?: string;
};

function signToken(options: SignOptions) {
  return new SignJWT({
    sid: 'sid:e2e',
    amr: 'entra',
    email: 'guard-e2e@sigfarm.local',
    emailVerified: true,
    globalStatus: 'active',
    apps: [],
    ver: 1,
  })
    .setProtectedHeader({ alg: 'RS256', kid: options.kid })
    .setSubject(options.subject ?? '11111111-1111-4111-8111-111111111111')
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(options.key);
}

describe('AuthGuard JWT validation (e2e)', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let jwksServer: Server;
  let privateKey: KeyObject;
  let foreignPrivateKey: KeyObject;
  const originalEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const key of [
      'SIGFARM_AUTH_ISSUER',
      'SIGFARM_AUTH_AUDIENCE',
      'SIGFARM_AUTH_JWKS_URL',
    ] as const) {
      originalEnv[key] = process.env[key];
    }

    const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    privateKey = pair.privateKey;
    const publicJwk = await exportJWK(pair.publicKey);
    const jwks = {
      keys: [
        {
          ...publicJwk,
          kid: 'kid-main',
          alg: 'RS256',
          use: 'sig',
        },
      ],
    };

    const foreignPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    foreignPrivateKey = foreignPair.privateKey;

    jwksServer = createServer((req, res) => {
      if (req.url !== JWKS_PATH) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(jwks));
    });
    await new Promise<void>((resolve) =>
      jwksServer.listen(0, '127.0.0.1', () => resolve()),
    );
    const address = jwksServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve JWKS server address');
    }

    process.env.SIGFARM_AUTH_ISSUER = ISSUER;
    process.env.SIGFARM_AUTH_AUDIENCE = AUDIENCE;
    process.env.SIGFARM_AUTH_JWKS_URL = `http://127.0.0.1:${address.port}${JWKS_PATH}`;

    const moduleRef = await Test.createTestingModule({
      imports: [GuardE2eModule],
    }).compile();
    app = moduleRef.createNestApplication();
    applyGlobals(app);
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (jwksServer?.listening) {
      await new Promise<void>((resolve) => jwksServer.close(() => resolve()));
    }
    for (const key of Object.keys(originalEnv)) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('returns 401 when bearer token is missing', async () => {
    const res = await request(app.getHttpServer()).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for malformed bearer token', async () => {
    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for issuer mismatch', async () => {
    const token = await signToken({
      key: privateKey,
      kid: 'kid-main',
      issuer: 'https://wrong-issuer.sigfarm.local',
    });
    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for audience mismatch', async () => {
    const token = await signToken({
      key: privateKey,
      kid: 'kid-main',
      audience: 'wrong-audience',
    });
    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when signature key is outside JWKS', async () => {
    const token = await signToken({
      key: foreignPrivateKey,
      kid: 'kid-foreign',
    });
    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 200 and claims when token is valid', async () => {
    const subject = '22222222-2222-4222-8222-222222222222';
    const token = await signToken({
      key: privateKey,
      kid: 'kid-main',
      subject,
    });
    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.sub).toBe(subject);
  });
});
