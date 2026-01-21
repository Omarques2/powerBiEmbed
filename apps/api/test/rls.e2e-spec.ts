import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthGuard } from '../src/auth/auth.guard';
import { PlatformAdminGuard } from '../src/auth/platform-admin.guard';
import { applyGlobals } from './helpers/e2e-utils';

describe('Admin RLS (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;

  const datasetId = randomUUID();
  const workspaceId = randomUUID();
  const reportId = randomUUID();
  const targetKey = `target_${randomUUID().slice(0, 8)}`;
  const customerCode = `TEST_RLS_${Date.now()}`;

  let customerId: string;
  let userId: string;
  let workspaceRefId: string;
  let reportRefId: string;
  let targetId: string;
  let createdRuleId: string | null = null;
  let createdUserRuleId: string | null = null;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PlatformAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    applyGlobals(app);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('DROP VIEW IF EXISTS "sec_rls_base"');
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "sec_rls_base"');

    const customer = await prisma.customer.create({
      data: { code: customerCode, name: 'RLS Test Customer', status: 'active' },
      select: { id: true },
    });
    customerId = customer.id;

    const user = await prisma.user.create({
      data: {
        entraSub: `test-rls-${Date.now()}`,
        entraOid: randomUUID(),
        email: `rls-${Date.now()}@example.com`,
        displayName: 'RLS User',
        status: 'active',
      },
      select: { id: true },
    });
    userId = user.id;

    const workspace = await prisma.biWorkspace.create({
      data: {
        workspaceId,
        workspaceName: 'RLS Workspace',
        isActive: true,
      },
      select: { id: true },
    });
    workspaceRefId = workspace.id;

    const report = await prisma.biReport.create({
      data: {
        workspaceRefId: workspaceRefId,
        reportId,
        reportName: 'RLS Report',
        datasetId,
        isActive: true,
      },
      select: { id: true },
    });
    reportRefId = report.id;
  });

  afterAll(async () => {
    if (targetId) {
      await prisma.rlsRule.deleteMany({ where: { targetId: targetId } });
      await prisma.rlsTarget.deleteMany({ where: { id: targetId } });
    }
    if (reportRefId) {
      await prisma.biReport.deleteMany({ where: { id: reportRefId } });
    }
    if (workspaceRefId) {
      await prisma.biWorkspace.deleteMany({ where: { id: workspaceRefId } });
    }
    if (customerId) {
      await prisma.customer.deleteMany({ where: { id: customerId } });
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    if (prisma) {
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  it('creates target', async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/rls/datasets/${datasetId}/targets`)
      .send({
        targetKey,
        displayName: 'Instituicao Financeira',
        factTable: 'Fact',
        factColumn: 'Col',
        valueType: 'text',
        defaultBehavior: 'allow',
        status: 'active',
      })
      .expect(201);

    expect(res.body?.data?.id).toBeTruthy();
    targetId = res.body.data.id;
  });

  it('rejects duplicate targetKey', async () => {
    await request(app.getHttpServer())
      .post(`/admin/rls/datasets/${datasetId}/targets`)
      .send({
        targetKey,
        displayName: 'Instituicao Financeira',
        factTable: 'Fact',
        factColumn: 'Col',
        valueType: 'text',
      })
      .expect(400);
  });

  it('rejects invalid rule payload with multiple values', async () => {
    await request(app.getHttpServer())
      .post(`/admin/rls/targets/${targetId}/rules`)
      .send({
        items: [{ customerId, op: 'include', valueText: 'Audax', valueInt: 3 }],
      })
      .expect(400);
  });

  it('rejects rules with both customerId and userId', async () => {
    await request(app.getHttpServer())
      .post(`/admin/rls/targets/${targetId}/rules`)
      .send({
        items: [
          {
            customerId,
            userId,
            op: 'include',
            valueText: 'Audax',
          },
        ],
      })
      .expect(400);
  });

  it('rejects unknown customerId', async () => {
    await request(app.getHttpServer())
      .post(`/admin/rls/targets/${targetId}/rules`)
      .send({
        items: [
          { customerId: randomUUID(), op: 'include', valueText: 'Audax' },
        ],
      })
      .expect(400);
  });

  it('rejects unknown userId', async () => {
    await request(app.getHttpServer())
      .post(`/admin/rls/targets/${targetId}/rules`)
      .send({
        items: [{ userId: randomUUID(), op: 'include', valueText: 'Audax' }],
      })
      .expect(400);
  });

  it('creates rule and rejects duplicate rule', async () => {
    const first = await request(app.getHttpServer())
      .post(`/admin/rls/targets/${targetId}/rules`)
      .send({
        items: [{ customerId, op: 'include', valueText: 'Audax' }],
      })
      .expect(201);

    createdRuleId = first.body?.data?.created?.[0]?.id ?? null;

    await request(app.getHttpServer())
      .post(`/admin/rls/targets/${targetId}/rules`)
      .send({
        items: [{ customerId, op: 'include', valueText: 'Audax' }],
      })
      .expect(400);
  });

  it('creates user rule and rejects duplicate user rule', async () => {
    const first = await request(app.getHttpServer())
      .post(`/admin/rls/targets/${targetId}/rules`)
      .send({
        items: [{ userId, op: 'include', valueText: 'UserScope' }],
      })
      .expect(201);

    createdUserRuleId = first.body?.data?.created?.[0]?.id ?? null;

    await request(app.getHttpServer())
      .post(`/admin/rls/targets/${targetId}/rules`)
      .send({
        items: [{ userId, op: 'include', valueText: 'UserScope' }],
      })
      .expect(400);
  });

  it('rejects invalid customerId on listRules', async () => {
    await request(app.getHttpServer())
      .get(`/admin/rls/targets/${targetId}/rules`)
      .query({ customerId: 'not-uuid' })
      .expect(400);
  });

  it('deletes rule', async () => {
    if (!createdRuleId) return;
    await request(app.getHttpServer())
      .delete(`/admin/rls/rules/${createdRuleId}`)
      .expect(200);
    createdRuleId = null;
  });

  it('deletes user rule', async () => {
    if (!createdUserRuleId) return;
    await request(app.getHttpServer())
      .delete(`/admin/rls/rules/${createdUserRuleId}`)
      .expect(200);
    createdUserRuleId = null;
  });
});
