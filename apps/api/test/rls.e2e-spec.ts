import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { randomUUID } from "crypto";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { AuthGuard } from "../src/auth/auth.guard";
import { PlatformAdminGuard } from "../src/auth/platform-admin.guard";

describe("Admin RLS (e2e)", () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;

  const datasetId = randomUUID();
  const targetKey = `target_${randomUUID().slice(0, 8)}`;
  const customerCode = `TEST_RLS_${Date.now()}`;

  let customerId: string;
  let targetId: string;
  let createdRuleId: string | null = null;

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
    await app.init();

    prisma = app.get(PrismaService);

    const customer = await prisma.customers.create({
      data: { code: customerCode, name: "RLS Test Customer", status: "active" },
      select: { id: true },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    if (targetId) {
      await prisma.rls_rule.deleteMany({ where: { target_id: targetId } });
      await prisma.rls_target.deleteMany({ where: { id: targetId } });
    }
    if (customerId) {
      await prisma.customers.deleteMany({ where: { id: customerId } });
    }
    if (prisma) {
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  it("creates target", async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/rls/datasets/${datasetId}/targets`)
      .send({
        targetKey,
        displayName: "Instituicao Financeira",
        factTable: "Fact",
        factColumn: "Col",
        valueType: "text",
        defaultBehavior: "allow",
        status: "active",
      })
      .expect(201);

    expect(res.body?.id).toBeTruthy();
    targetId = res.body.id;
  });

  it("rejects duplicate targetKey", async () => {
    await request(app.getHttpServer())
      .post(`/admin/rls/datasets/${datasetId}/targets`)
      .send({
        targetKey,
        displayName: "Instituicao Financeira",
        factTable: "Fact",
        factColumn: "Col",
        valueType: "text",
      })
      .expect(400);
  });

  it("rejects invalid rule payload with multiple values", async () => {
    await request(app.getHttpServer())
      .post(`/admin/rls/targets/${targetId}/rules`)
      .send({
        items: [
          { customerId, op: "include", valueText: "Audax", valueInt: 3 },
        ],
      })
      .expect(400);
  });

  it("rejects unknown customerId", async () => {
    await request(app.getHttpServer())
      .post(`/admin/rls/targets/${targetId}/rules`)
      .send({
        items: [
          { customerId: randomUUID(), op: "include", valueText: "Audax" },
        ],
      })
      .expect(400);
  });

  it("creates rule and rejects duplicate rule", async () => {
    const first = await request(app.getHttpServer())
      .post(`/admin/rls/targets/${targetId}/rules`)
      .send({
        items: [
          { customerId, op: "include", valueText: "Audax" },
        ],
      })
      .expect(201);

    createdRuleId = first.body?.created?.[0]?.id ?? null;

    await request(app.getHttpServer())
      .post(`/admin/rls/targets/${targetId}/rules`)
      .send({
        items: [
          { customerId, op: "include", valueText: "Audax" },
        ],
      })
      .expect(400);
  });

  it("rejects invalid customerId on listRules", async () => {
    await request(app.getHttpServer())
      .get(`/admin/rls/targets/${targetId}/rules`)
      .query({ customerId: "not-uuid" })
      .expect(400);
  });

  it("deletes rule", async () => {
    if (!createdRuleId) return;
    await request(app.getHttpServer())
      .delete(`/admin/rls/rules/${createdRuleId}`)
      .expect(200);
    createdRuleId = null;
  });
});
