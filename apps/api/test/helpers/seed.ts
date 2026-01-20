import { randomUUID } from "crypto";
import { PrismaService } from "../../src/prisma/prisma.service";

export type SeedData = {
  runId: string;
  datasetId: string;
  workspaceId: string;
  reportId: string;
  app: { id: string; appKey: string };
  role: { id: string; roleKey: string };
  admin: { id: string; entraSub: string; email: string | null };
  activeUser: { id: string; entraSub: string; email: string | null };
  pendingUser: { id: string; entraSub: string; email: string | null };
  disableUser: { id: string; entraSub: string; email: string | null };
  customerA: { id: string; code: string };
  customerB: { id: string; code: string };
  workspace: { id: string; workspaceId: string };
  report: { id: string; reportId: string };
  rlsTarget: { id: string; targetKey: string };
  rlsRule: { id: string };
};

export async function truncateAll(prisma: PrismaService) {
  const sql = `
    TRUNCATE TABLE
      "audit_log",
      "user_app_roles",
      "app_roles",
      "applications",
      "user_customer_memberships",
      "bi_report_permissions",
      "bi_workspace_permissions",
      "bi_reports",
      "bi_workspaces",
      "rls_rule",
      "rls_target",
      "customers",
      "users"
    CASCADE;
  `;
  await prisma.$executeRawUnsafe(sql);
}

export async function seedTestData(prisma: PrismaService): Promise<SeedData> {
  const runId = randomUUID().slice(0, 8);
  const datasetId = randomUUID();
  const workspaceId = randomUUID();
  const reportId = randomUUID();

  const app = await prisma.application.create({
    data: { appKey: "PBI_EMBED", name: "Power BI Embed" },
    select: { id: true, appKey: true },
  });

  const role = await prisma.appRole.create({
    data: {
      applicationId: app.id,
      roleKey: "platform_admin",
      name: "Platform Admin",
    },
    select: { id: true, roleKey: true },
  });

  const admin = await prisma.user.create({
    data: {
      entraSub: `test-admin-${runId}`,
      entraOid: randomUUID(),
      email: `admin-${runId}@example.com`,
      displayName: `Admin ${runId}`,
      status: "active",
      lastLoginAt: new Date(),
    },
    select: { id: true, entraSub: true, email: true },
  });

  await prisma.userAppRole.create({
    data: {
      userId: admin.id,
      applicationId: app.id,
      appRoleId: role.id,
      customerId: null,
    },
  });

  const activeUser = await prisma.user.create({
    data: {
      entraSub: `test-user-${runId}`,
      entraOid: randomUUID(),
      email: `user-${runId}@example.com`,
      displayName: `User ${runId}`,
      status: "active",
      lastLoginAt: new Date(),
    },
    select: { id: true, entraSub: true, email: true },
  });

  const pendingUser = await prisma.user.create({
    data: {
      entraSub: `test-pending-${runId}`,
      entraOid: randomUUID(),
      email: `pending-${runId}@example.com`,
      displayName: `Pending ${runId}`,
      status: "pending",
    },
    select: { id: true, entraSub: true, email: true },
  });

  const disableUser = await prisma.user.create({
    data: {
      entraSub: `test-disable-${runId}`,
      entraOid: randomUUID(),
      email: `disable-${runId}@example.com`,
      displayName: `Disable ${runId}`,
      status: "active",
    },
    select: { id: true, entraSub: true, email: true },
  });

  const customerA = await prisma.customer.create({
    data: { code: `TEST_A_${runId}`, name: `Customer A ${runId}`, status: "active" },
    select: { id: true, code: true },
  });

  const customerB = await prisma.customer.create({
    data: { code: `TEST_B_${runId}`, name: `Customer B ${runId}`, status: "active" },
    select: { id: true, code: true },
  });

  await prisma.userCustomerMembership.create({
    data: {
      userId: activeUser.id,
      customerId: customerA.id,
      role: "admin",
      isActive: true,
    },
  });

  await prisma.userCustomerMembership.create({
    data: {
      userId: disableUser.id,
      customerId: customerA.id,
      role: "viewer",
      isActive: true,
    },
  });

  const workspace = await prisma.biWorkspace.create({
    data: {
      customerId: customerA.id,
      workspaceId,
      workspaceName: `Workspace ${runId}`,
      isActive: true,
    },
    select: { id: true, workspaceId: true },
  });

  const report = await prisma.biReport.create({
    data: {
      workspaceRefId: workspace.id,
      reportId,
      reportName: `Report ${runId}`,
      datasetId,
      isActive: true,
    },
    select: { id: true, reportId: true },
  });

  await prisma.biWorkspacePermission.create({
    data: {
      userId: activeUser.id,
      workspaceRefId: workspace.id,
      canView: true,
    },
  });

  await prisma.biReportPermission.create({
    data: {
      userId: activeUser.id,
      reportRefId: report.id,
      canView: true,
    },
  });

  const targetKey = `target_${runId}`;
  const rlsTarget = await prisma.rlsTarget.create({
    data: {
      datasetId,
      targetKey,
      displayName: `Target ${runId}`,
      factTable: "Fact",
      factColumn: "Column",
      valueType: "text",
      defaultBehavior: "allow",
      status: "active",
    },
    select: { id: true, targetKey: true },
  });

  const rlsRule = await prisma.rlsRule.create({
    data: {
      targetId: rlsTarget.id,
      customerId: customerA.id,
      op: "include",
      valueText: "example",
    },
    select: { id: true },
  });

  return {
    runId,
    datasetId,
    workspaceId,
    reportId,
    app,
    role,
    admin,
    activeUser,
    pendingUser,
    disableUser,
    customerA,
    customerB,
    workspace,
    report,
    rlsTarget,
    rlsRule,
  };
}
