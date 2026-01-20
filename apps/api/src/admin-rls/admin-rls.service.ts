import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { RlsRule } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RlsRefreshService } from "./rls-refresh.service";
import { buildSnapshotCsv, RlsSnapshot, RlsSnapshotRule, RlsSnapshotTarget } from "./rls-snapshot";

type ValueType = "text" | "int" | "uuid";
type DefaultBehavior = "allow" | "deny";
type TargetStatus = "draft" | "active";
type RuleOp = "include" | "exclude";

type CreateTargetInput = {
  targetKey: string;
  displayName: string;
  factTable: string;
  factColumn: string;
  valueType: ValueType;
  defaultBehavior?: DefaultBehavior;
  status?: TargetStatus;
};

type UpdateTargetInput = Partial<CreateTargetInput>;

type CreateRuleInput = {
  customerId: string;
  op: RuleOp;
  valueText?: string | null;
  valueInt?: number | string | null;
  valueUuid?: string | null;
};

const TARGET_KEY_RE = /^[a-z][a-z0-9_]*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VALUE_TYPES = new Set<ValueType>(["text", "int", "uuid"]);
const DEFAULT_BEHAVIORS = new Set<DefaultBehavior>(["allow", "deny"]);
const TARGET_STATUSES = new Set<TargetStatus>(["draft", "active"]);
const RULE_OPS = new Set<RuleOp>(["include", "exclude"]);


function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

function ensureUuid(name: string, value: string): string {
  const v = (value ?? "").trim();
  if (!v) throw new BadRequestException(`${name} is required`);
  if (!isUuid(v)) throw new BadRequestException(`${name} must be a UUID`);
  return v;
}

function ensureText(name: string, value: string, max = 120): string {
  const v = (value ?? "").trim();
  if (!v) throw new BadRequestException(`${name} is required`);
  if (v.length > max) throw new BadRequestException(`${name} is too long`);
  return v;
}

function normalizeTargetKey(key: string): string {
  return (key ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

function ensureTargetKey(key: string): string {
  const v = normalizeTargetKey(key);
  if (!v) throw new BadRequestException("targetKey is required");
  if (!TARGET_KEY_RE.test(v)) throw new BadRequestException("targetKey must be snake_case ascii");
  return v;
}

function isPrismaNotFound(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

function isPrismaUnique(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

@Injectable()
export class AdminRlsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshSvc: RlsRefreshService,
  ) {}

  async listTargets(datasetIdRaw: string) {
    const datasetId = ensureUuid("datasetId", datasetIdRaw);
    const rows = await this.prisma.rlsTarget.findMany({
      where: { datasetId: datasetId },
      orderBy: { createdAt: "asc" },
    });
    return { items: rows.map((row) => this.toTargetDto(row)) };
  }

  async createTarget(datasetIdRaw: string, input: CreateTargetInput, actorSub?: string | null) {
    const datasetId = ensureUuid("datasetId", datasetIdRaw);
    const targetKey = ensureTargetKey(input?.targetKey);
    const displayName = ensureText("displayName", input?.displayName);
    const factTable = ensureText("factTable", input?.factTable, 200);
    const factColumn = ensureText("factColumn", input?.factColumn, 200);
    const valueType = String(input?.valueType ?? "").trim() as ValueType;
    if (!VALUE_TYPES.has(valueType)) throw new BadRequestException("valueType is invalid");

    const defaultBehavior = (input?.defaultBehavior ?? "allow") as DefaultBehavior;
    if (!DEFAULT_BEHAVIORS.has(defaultBehavior)) throw new BadRequestException("defaultBehavior is invalid");

    const status = (input?.status ?? "draft") as TargetStatus;
    if (!TARGET_STATUSES.has(status)) throw new BadRequestException("status is invalid");

    const existing = await this.prisma.rlsTarget.findFirst({
      where: { datasetId: datasetId, targetKey: targetKey },
      select: { id: true },
    });
    if (existing) throw new BadRequestException("targetKey already exists for dataset");

    const actorUserId = await this.resolveActorUserId(actorSub ?? null);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.rlsTarget.create({
          data: {
            datasetId: datasetId,
            targetKey: targetKey,
            displayName: displayName,
            factTable: factTable,
            factColumn: factColumn,
            valueType: valueType,
            defaultBehavior: defaultBehavior,
            status,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: actorUserId,
            action: "RLS_TARGET_CREATED",
            entityType: "rls_target",
            entityId: row.id,
            afterData: this.toTargetDto(row),
          },
        });

        return row;
      });
      return this.toTargetDto(created);
    } catch (err) {
      if (isPrismaUnique(err)) throw new BadRequestException("targetKey already exists for dataset");
      throw err;
    }
  }

  async updateTarget(targetIdRaw: string, input: UpdateTargetInput, actorSub?: string | null) {
    const targetId = ensureUuid("targetId", targetIdRaw);
    const target = await this.prisma.rlsTarget.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException("Target not found");

    const patch: Record<string, unknown> = {};

    if (input?.targetKey !== undefined) {
      const nextKey = ensureTargetKey(input.targetKey);
      if (nextKey !== target.targetKey) {
        const existing = await this.prisma.rlsTarget.findFirst({
          where: { datasetId: target.datasetId, targetKey: nextKey },
          select: { id: true },
        });
        if (existing) throw new BadRequestException("targetKey already exists for dataset");
        patch.targetKey = nextKey;
      }
    }

    if (input?.displayName !== undefined) patch.displayName = ensureText("displayName", input.displayName);
    if (input?.factTable !== undefined) patch.factTable = ensureText("factTable", input.factTable, 200);
    if (input?.factColumn !== undefined) patch.factColumn = ensureText("factColumn", input.factColumn, 200);

    if (input?.valueType !== undefined) {
      const valueType = String(input.valueType ?? "").trim() as ValueType;
      if (!VALUE_TYPES.has(valueType)) throw new BadRequestException("valueType is invalid");
      if (valueType !== target.valueType) {
        const rulesCount = await this.prisma.rlsRule.count({ where: { targetId: target.id } });
        if (rulesCount > 0) {
          throw new BadRequestException("valueType cannot change while rules exist");
        }
        patch.valueType = valueType;
      }
    }

    if (input?.defaultBehavior !== undefined) {
      const defaultBehavior = String(input.defaultBehavior ?? "").trim() as DefaultBehavior;
      if (!DEFAULT_BEHAVIORS.has(defaultBehavior)) throw new BadRequestException("defaultBehavior is invalid");
      patch.defaultBehavior = defaultBehavior;
    }

    if (input?.status !== undefined) {
      const status = String(input.status ?? "").trim() as TargetStatus;
      if (!TARGET_STATUSES.has(status)) throw new BadRequestException("status is invalid");
      patch.status = status;
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException("No changes provided");
    }

    const actorUserId = await this.resolveActorUserId(actorSub ?? null);
    const before = this.toTargetDto(target);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const row = await tx.rlsTarget.update({ where: { id: targetId }, data: patch });
        await tx.auditLog.create({
          data: {
            actorUserId: actorUserId,
            action: "RLS_TARGET_UPDATED",
            entityType: "rls_target",
            entityId: row.id,
            beforeData: before,
            afterData: this.toTargetDto(row),
          },
        });
        return row;
      });
      return this.toTargetDto(updated);
    } catch (err) {
      if (isPrismaUnique(err)) throw new BadRequestException("targetKey already exists for dataset");
      if (isPrismaNotFound(err)) throw new NotFoundException("Target not found");
      throw err;
    }
  }

  async deleteTarget(targetIdRaw: string, actorSub?: string | null) {
    const targetId = ensureUuid("targetId", targetIdRaw);
    const actorUserId = await this.resolveActorUserId(actorSub ?? null);
    try {
      await this.prisma.$transaction(async (tx) => {
        const row = await tx.rlsTarget.delete({ where: { id: targetId } });
        await tx.auditLog.create({
          data: {
            actorUserId: actorUserId,
            action: "RLS_TARGET_DELETED",
            entityType: "rls_target",
            entityId: row.id,
            beforeData: this.toTargetDto(row),
          },
        });
      });
      return { ok: true };
    } catch (err) {
      if (isPrismaNotFound(err)) throw new NotFoundException("Target not found");
      throw err;
    }
  }

  async listRules(targetIdRaw: string, customerIdRaw?: string) {
    const targetId = ensureUuid("targetId", targetIdRaw);
    const target = await this.prisma.rlsTarget.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!target) throw new NotFoundException("Target not found");

    const where: { targetId: string; customerId?: string } = { targetId: targetId };
    if (customerIdRaw) where.customerId = ensureUuid("customerId", customerIdRaw);

    const rows = await this.prisma.rlsRule.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });
    return { items: rows.map((row) => this.toRuleDto(row)) };
  }

  async createRules(targetIdRaw: string, items: CreateRuleInput[], actorSub?: string | null) {
    const targetId = ensureUuid("targetId", targetIdRaw);
    const target = await this.prisma.rlsTarget.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException("Target not found");

    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException("items is required");
    }

    const normalized = items.map((item, idx) => this.normalizeRuleItem(item, idx, target.valueType as ValueType));
    const seen = new Set<string>();
    for (const rule of normalized) {
      const key = `${rule.customerId}|${rule.op}|${rule.valueText ?? ""}|${rule.valueInt ?? ""}|${rule.valueUuid ?? ""}`;
      if (seen.has(key)) {
        throw new BadRequestException("Duplicate rule in request payload");
      }
      seen.add(key);
    }

    const customerIds = Array.from(new Set(normalized.map((x) => x.customerId)));
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true },
    });
    if (customers.length !== customerIds.length) {
      const found = new Set(customers.map((c) => c.id));
      const missing = customerIds.filter((id) => !found.has(id));
      throw new BadRequestException(`Unknown customerId(s): ${missing.join(", ")}`);
    }

    const actorUserId = await this.resolveActorUserId(actorSub ?? null);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const rows: RlsRule[] = [];
        for (const rule of normalized) {
          const row = await tx.rlsRule.create({
            data: {
              targetId: target.id,
              customerId: rule.customerId,
              op: rule.op,
              valueText: rule.valueText,
              valueInt: rule.valueInt,
              valueUuid: rule.valueUuid,
            },
          });
          rows.push(row);
        }

        const uniqueCustomerIds = Array.from(new Set(rows.map((r) => r.customerId)));
        await tx.auditLog.create({
          data: {
            actorUserId: actorUserId,
            action: "RLS_RULE_CREATED",
            entityType: "rls_rule",
            entityId: null,
            afterData: {
              targetId: target.id,
              count: rows.length,
              ruleIds: rows.map((r) => r.id),
              customerIds: uniqueCustomerIds,
            },
          },
        });

        return rows;
      });
      return { created: created.map((row) => this.toRuleDto(row)) };
    } catch (err) {
      if (isPrismaUnique(err)) {
        throw new BadRequestException("Duplicate rule detected");
      }
      throw err;
    }
  }

  async deleteRule(ruleIdRaw: string, actorSub?: string | null) {
    const ruleId = ensureUuid("ruleId", ruleIdRaw);
    const actorUserId = await this.resolveActorUserId(actorSub ?? null);
    try {
      await this.prisma.$transaction(async (tx) => {
        const row = await tx.rlsRule.delete({ where: { id: ruleId } });
        await tx.auditLog.create({
          data: {
            actorUserId: actorUserId,
            action: "RLS_RULE_DELETED",
            entityType: "rls_rule",
            entityId: row.id,
            beforeData: this.toRuleDto(row),
          },
        });
      });
      return { ok: true };
    } catch (err) {
      if (isPrismaNotFound(err)) throw new NotFoundException("Rule not found");
      throw err;
    }
  }

  async refreshDataset(datasetIdRaw: string, actorSub?: string | null) {
    const datasetId = ensureUuid("datasetId", datasetIdRaw);
    const workspaceId = await this.resolveWorkspaceIdForDataset(datasetId);
    const actorUserId = await this.resolveActorUserId(actorSub ?? null);
    const result = await this.refreshSvc.requestRefresh(workspaceId, datasetId);
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actorUserId,
        action: "RLS_REFRESH_REQUESTED",
        entityType: "rls_dataset",
        entityId: datasetId,
        afterData: {
          status: result.status,
          pending: result.pending ?? false,
          scheduledAt: result.scheduledAt ?? null,
          scheduledInMs: result.scheduledInMs ?? null,
        },
      },
    });
    return result;
  }

  async listDatasetRefreshes(datasetIdRaw: string) {
    const datasetId = ensureUuid("datasetId", datasetIdRaw);
    const workspaceId = await this.resolveWorkspaceIdForDataset(datasetId);
    const items = await this.refreshSvc.listRefreshes(workspaceId, datasetId);
    return { items };
  }

  async getDatasetSnapshot(datasetIdRaw: string, formatRaw?: string, actorSub?: string | null) {
    const datasetId = ensureUuid("datasetId", datasetIdRaw);
    const format = (formatRaw ?? "json").trim().toLowerCase();
    if (format !== "json" && format !== "csv") {
      throw new BadRequestException("format must be json or csv");
    }

    const targets = await this.prisma.rlsTarget.findMany({
      where: { datasetId: datasetId },
      orderBy: { createdAt: "asc" },
    });

    if (!targets.length) {
      const catalogRow = await this.prisma.biReport.findFirst({
        where: { datasetId: datasetId },
        select: { id: true },
      });
      if (!catalogRow) throw new NotFoundException("Dataset not found");
    }

    const targetIds = targets.map((t) => t.id);
    const rules = targetIds.length
      ? await this.prisma.rlsRule.findMany({
          where: { targetId: { in: targetIds } },
          include: { customer: { select: { code: true, name: true } } },
          orderBy: { createdAt: "asc" },
        })
      : [];

    const snapshotTargets: RlsSnapshotTarget[] = targets.map((t) => ({
      id: t.id,
      datasetId: t.datasetId,
      targetKey: t.targetKey,
      displayName: t.displayName,
      factTable: t.factTable,
      factColumn: t.factColumn,
      valueType: t.valueType,
      defaultBehavior: t.defaultBehavior,
      status: t.status,
      createdAt: t.createdAt?.toISOString ? t.createdAt.toISOString() : String(t.createdAt),
    }));

    const targetById = new Map<string, RlsSnapshotTarget>();
    snapshotTargets.forEach((t) => targetById.set(t.id, t));

    const snapshotRules: RlsSnapshotRule[] = rules.map((r) => {
      const target = targetById.get(r.targetId);
      return {
        id: r.id,
        targetId: r.targetId,
        targetKey: target?.targetKey ?? null,
        targetDisplayName: target?.displayName ?? null,
        customerId: r.customerId,
        customerCode: r.customer?.code ?? null,
        customerName: r.customer?.name ?? null,
        op: r.op,
        valueText: r.valueText,
        valueInt: r.valueInt,
        valueUuid: r.valueUuid,
        createdAt: r.createdAt?.toISOString ? r.createdAt.toISOString() : String(r.createdAt),
      };
    });

    const snapshot: RlsSnapshot = {
      datasetId,
      generatedAt: new Date().toISOString(),
      targets: snapshotTargets,
      rules: snapshotRules,
    };

    const actorUserId = await this.resolveActorUserId(actorSub ?? null);
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actorUserId,
        action: "RLS_SNAPSHOT_EXPORTED",
        entityType: "rls_dataset",
        entityId: datasetId,
        afterData: {
          format,
          targets: snapshotTargets.length,
          rules: snapshotRules.length,
        },
      },
    });

    if (format === "csv") {
      return {
        content: buildSnapshotCsv(snapshot),
        filename: `rls_snapshot_${datasetId}.csv`,
        contentType: "text/csv",
        generatedAt: snapshot.generatedAt,
      };
    }

    return snapshot;
  }

  private normalizeRuleItem(item: CreateRuleInput, index: number, valueType: ValueType) {
    const customerId = ensureUuid("customerId", item?.customerId);
    const op = String(item?.op ?? "").trim() as RuleOp;
    if (!RULE_OPS.has(op)) throw new BadRequestException(`items[${index}].op is invalid`);

    const valueTextProvided = item.valueText !== undefined && item.valueText !== null;
    const valueIntProvided = item.valueInt !== undefined && item.valueInt !== null;
    const valueUuidProvided = item.valueUuid !== undefined && item.valueUuid !== null;
    const providedCount = Number(valueTextProvided) + Number(valueIntProvided) + Number(valueUuidProvided);
    if (providedCount !== 1) {
      throw new BadRequestException(`items[${index}] must provide exactly one value field`);
    }

    let valueText: string | null = null;
    let valueInt: number | null = null;
    let valueUuid: string | null = null;

    if (valueType === "text") {
      if (!valueTextProvided) throw new BadRequestException(`items[${index}].valueText is required`);
      valueText = String(item.valueText ?? "").trim();
      if (!valueText) throw new BadRequestException(`items[${index}].valueText is required`);
    } else if (valueType === "int") {
      if (!valueIntProvided) throw new BadRequestException(`items[${index}].valueInt is required`);
      const n = typeof item.valueInt === "string" ? Number(item.valueInt.trim()) : Number(item.valueInt);
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        throw new BadRequestException(`items[${index}].valueInt must be an integer`);
      }
      valueInt = n;
    } else {
      if (!valueUuidProvided) throw new BadRequestException(`items[${index}].valueUuid is required`);
      const v = String(item.valueUuid ?? "").trim();
      if (!isUuid(v)) throw new BadRequestException(`items[${index}].valueUuid must be a UUID`);
      valueUuid = v;
    }

    return { customerId, op, valueText, valueInt, valueUuid };
  }

  private async resolveActorUserId(actorSub: string | null): Promise<string | null> {
    if (!actorSub) return null;
    const actor = await this.prisma.user.findUnique({
      where: { entraSub: actorSub },
      select: { id: true },
    });
    return actor?.id ?? null;
  }

  private toTargetDto(row: any) {
    return {
      id: row.id,
      datasetId: row.datasetId,
      targetKey: row.targetKey,
      displayName: row.displayName,
      factTable: row.factTable,
      factColumn: row.factColumn,
      valueType: row.valueType,
      defaultBehavior: row.defaultBehavior,
      status: row.status,
      createdAt: row.createdAt?.toISOString ? row.createdAt.toISOString() : row.createdAt,
    };
  }

  private toRuleDto(row: any) {
    return {
      id: row.id,
      targetId: row.targetId,
      customerId: row.customerId,
      op: row.op,
      valueText: row.valueText,
      valueInt: row.valueInt,
      valueUuid: row.valueUuid,
      createdAt: row.createdAt?.toISOString ? row.createdAt.toISOString() : row.createdAt,
    };
  }

  private async resolveWorkspaceIdForDataset(datasetId: string) {
    const row = await this.prisma.biReport.findFirst({
      where: {
        datasetId: datasetId,
        workspace: { isActive: true },
      },
      select: {
        workspace: {
          select: { workspaceId: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const workspaceId = row?.workspace?.workspaceId;
    if (!workspaceId) {
      throw new NotFoundException("Dataset not found in catalog");
    }
    return workspaceId;
  }
}
