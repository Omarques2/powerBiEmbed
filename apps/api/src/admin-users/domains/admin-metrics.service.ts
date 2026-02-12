import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminMetricBucket,
  AdminMetricWindow,
} from '../dto/admin-metrics.dto';
import { PermissionsRepository } from '../repositories/permissions.repository';

const LOGIN_SUCCESS_ACTION = 'AUTH_LOGIN_SUCCEEDED';
const LOGIN_FAILED_ACTION = 'AUTH_LOGIN_FAILED';
const REPORT_VIEW_ACTION = 'REPORT_EMBED_VIEWED';
const DEFAULT_WINDOW: AdminMetricWindow = '24h';
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 45_000;
const ACTIVE_NOW_WINDOW_MS = 15 * 60 * 1000;

type AccessMetricsInput = {
  window?: AdminMetricWindow;
  bucket?: AdminMetricBucket;
  from?: string;
  to?: string;
  timezone?: string;
  topLimit?: number;
};

type ResolvedInput = {
  from: Date;
  to: Date;
  window: AdminMetricWindow;
  bucket: AdminMetricBucket;
  timezone: string;
  topLimit: number;
};

type SeriesRow = {
  bucket_start: Date | string;
  value: number;
};

type TopUserRow = {
  user_id: string | null;
  email: string | null;
  display_name: string | null;
  login_count: number;
  last_login_at: Date | null;
};

type TopCustomerRow = {
  customer_id: string | null;
  customer_code: string | null;
  customer_name: string | null;
  access_count: number;
  unique_users: number;
  last_access_at: Date | null;
};

type TopReportRow = {
  report_ref_id: string | null;
  report_id: string | null;
  report_name: string | null;
  workspace_id: string | null;
  workspace_name: string | null;
  access_count: number;
  unique_users: number;
  unique_customers: number;
  last_access_at: Date | null;
};

type CountRow = {
  value: number;
};

@Injectable()
export class AdminMetricsService {
  private readonly cache = new Map<
    string,
    { expiresAt: number; data: Record<string, unknown> }
  >();

  constructor(private readonly permissions: PermissionsRepository) {}

  async getAccessMetrics(input: AccessMetricsInput) {
    const resolved = this.resolveInput(input);
    const key = this.cacheKey(resolved);
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) return cached.data;

    const prisma = this.permissions.root();
    const activeSince = new Date(now - ACTIVE_NOW_WINDOW_MS);

    const [
      activeNow,
      uniqueRows,
      failedRows,
      uniqueCustomersRows,
      uniqueReportsRows,
      seriesRows,
      reportViewSeriesRows,
      topRows,
      customerRows,
      reportRows,
      recentRows,
    ] = await Promise.all([
        prisma.user.count({
          where: {
            status: 'active',
            lastLoginAt: { gte: activeSince },
          },
        }),
        prisma.$queryRaw<CountRow[]>`
          SELECT COUNT(DISTINCT a.actor_user_id)::int AS value
          FROM "audit_log" a
          WHERE a.action = ${LOGIN_SUCCESS_ACTION}
            AND a.created_at >= ${resolved.from}
            AND a.created_at < ${resolved.to}
            AND a.actor_user_id IS NOT NULL
        `,
        prisma.$queryRaw<CountRow[]>`
          SELECT COUNT(*)::int AS value
          FROM "audit_log" a
          WHERE a.action = ${LOGIN_FAILED_ACTION}
            AND a.created_at >= ${resolved.from}
            AND a.created_at < ${resolved.to}
        `,
        prisma.$queryRaw<CountRow[]>`
          SELECT COUNT(DISTINCT NULLIF(a.after_data->>'customerId', ''))::int AS value
          FROM "audit_log" a
          WHERE a.action = ${REPORT_VIEW_ACTION}
            AND a.created_at >= ${resolved.from}
            AND a.created_at < ${resolved.to}
        `,
        prisma.$queryRaw<CountRow[]>`
          SELECT COUNT(DISTINCT a.entity_id)::int AS value
          FROM "audit_log" a
          WHERE a.action = ${REPORT_VIEW_ACTION}
            AND a.created_at >= ${resolved.from}
            AND a.created_at < ${resolved.to}
            AND a.entity_id IS NOT NULL
        `,
        this.querySeriesByAction(prisma, resolved, LOGIN_SUCCESS_ACTION),
        this.querySeriesByAction(prisma, resolved, REPORT_VIEW_ACTION),
        prisma.$queryRaw<TopUserRow[]>`
          SELECT
            a.actor_user_id AS user_id,
            u.email AS email,
            u.display_name AS display_name,
            COUNT(*)::int AS login_count,
            MAX(a.created_at) AS last_login_at
          FROM "audit_log" a
          LEFT JOIN "users" u ON u.id = a.actor_user_id
          WHERE a.action = ${LOGIN_SUCCESS_ACTION}
            AND a.created_at >= ${resolved.from}
            AND a.created_at < ${resolved.to}
            AND a.actor_user_id IS NOT NULL
          GROUP BY a.actor_user_id, u.email, u.display_name
          ORDER BY login_count DESC, last_login_at DESC
          LIMIT ${resolved.topLimit}
        `,
        prisma.$queryRaw<TopCustomerRow[]>`
          SELECT
            NULLIF(a.after_data->>'customerId', '') AS customer_id,
            c.code AS customer_code,
            c.name AS customer_name,
            COUNT(*)::int AS access_count,
            COUNT(DISTINCT a.actor_user_id)::int AS unique_users,
            MAX(a.created_at) AS last_access_at
          FROM "audit_log" a
          LEFT JOIN "customers" c
            ON c.id = CASE
              WHEN NULLIF(a.after_data->>'customerId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              THEN CAST(NULLIF(a.after_data->>'customerId', '') AS uuid)
              ELSE NULL
            END
          WHERE a.action = ${REPORT_VIEW_ACTION}
            AND a.created_at >= ${resolved.from}
            AND a.created_at < ${resolved.to}
            AND NULLIF(a.after_data->>'customerId', '') IS NOT NULL
          GROUP BY
            NULLIF(a.after_data->>'customerId', ''),
            c.code,
            c.name
          ORDER BY access_count DESC, last_access_at DESC
          LIMIT ${resolved.topLimit}
        `,
        prisma.$queryRaw<TopReportRow[]>`
          SELECT
            a.entity_id AS report_ref_id,
            r.report_id AS report_id,
            r.report_name AS report_name,
            w.workspace_id AS workspace_id,
            w.workspace_name AS workspace_name,
            COUNT(*)::int AS access_count,
            COUNT(DISTINCT a.actor_user_id)::int AS unique_users,
            COUNT(DISTINCT NULLIF(a.after_data->>'customerId', ''))::int AS unique_customers,
            MAX(a.created_at) AS last_access_at
          FROM "audit_log" a
          LEFT JOIN "bi_reports" r ON r.id = a.entity_id
          LEFT JOIN "bi_workspaces" w ON w.id = r.workspace_ref_id
          WHERE a.action = ${REPORT_VIEW_ACTION}
            AND a.created_at >= ${resolved.from}
            AND a.created_at < ${resolved.to}
            AND a.entity_id IS NOT NULL
          GROUP BY
            a.entity_id,
            r.report_id,
            r.report_name,
            w.workspace_id,
            w.workspace_name
          ORDER BY access_count DESC, last_access_at DESC
          LIMIT ${resolved.topLimit}
        `,
        prisma.auditLog.findMany({
          where: {
            action: {
              in: [LOGIN_SUCCESS_ACTION, LOGIN_FAILED_ACTION, REPORT_VIEW_ACTION],
            },
            createdAt: {
              gte: resolved.from,
              lt: resolved.to,
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            action: true,
            createdAt: true,
            actorUserId: true,
            entityType: true,
            entityId: true,
            ip: true,
            userAgent: true,
            afterData: true,
            actor: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
          },
        }),
      ]);

    const loginSeries = seriesRows.map((row) => ({
      bucketStart:
        row.bucket_start instanceof Date
          ? row.bucket_start.toISOString()
          : new Date(String(row.bucket_start)).toISOString(),
      value: Number(row.value ?? 0),
    }));
    const reportViewSeries = reportViewSeriesRows.map((row) => ({
      bucketStart:
        row.bucket_start instanceof Date
          ? row.bucket_start.toISOString()
          : new Date(String(row.bucket_start)).toISOString(),
      value: Number(row.value ?? 0),
    }));

    const totalLoginsWindow = loginSeries.reduce(
      (acc, row) => acc + row.value,
      0,
    );
    const reportViewsWindow = reportViewSeries.reduce(
      (acc, row) => acc + row.value,
      0,
    );
    const rangeHours = Math.max(
      (resolved.to.getTime() - resolved.from.getTime()) / (60 * 60 * 1000),
      1,
    );

    const data = {
      range: {
        from: resolved.from.toISOString(),
        to: resolved.to.toISOString(),
        window: resolved.window,
        bucket: resolved.bucket,
        timezone: resolved.timezone,
      },
      kpis: {
        activeNow,
        totalLoginsWindow,
        uniqueLoginsWindow: Number(uniqueRows[0]?.value ?? 0),
        avgLoginsPerHour:
          Math.round((totalLoginsWindow / rangeHours) * 100) / 100,
        failedAuthWindow: Number(failedRows[0]?.value ?? 0),
        reportViewsWindow,
        uniqueCustomersWindow: Number(uniqueCustomersRows[0]?.value ?? 0),
        uniqueReportsWindow: Number(uniqueReportsRows[0]?.value ?? 0),
      },
      series: {
        loginsByBucket: loginSeries,
        reportViewsByBucket: reportViewSeries,
      },
      topUsers: topRows.map((row) => ({
        userId: row.user_id,
        email: row.email,
        displayName: row.display_name,
        loginCount: Number(row.login_count ?? 0),
        lastLoginAt: row.last_login_at ? row.last_login_at.toISOString() : null,
      })),
      breakdowns: {
        byCustomer: customerRows.map((row) => ({
          customerId: row.customer_id,
          customerCode: row.customer_code,
          customerName: row.customer_name,
          accessCount: Number(row.access_count ?? 0),
          uniqueUsers: Number(row.unique_users ?? 0),
          lastAccessAt: row.last_access_at
            ? row.last_access_at.toISOString()
            : null,
        })),
        byReport: reportRows.map((row) => ({
          reportRefId: row.report_ref_id,
          reportId: row.report_id,
          reportName: row.report_name,
          workspaceId: row.workspace_id,
          workspaceName: row.workspace_name,
          accessCount: Number(row.access_count ?? 0),
          uniqueUsers: Number(row.unique_users ?? 0),
          uniqueCustomers: Number(row.unique_customers ?? 0),
          lastAccessAt: row.last_access_at ? row.last_access_at.toISOString() : null,
        })),
      },
      recentAuthEvents: recentRows.map((row) => ({
        id: row.id,
        action: row.action,
        createdAt: row.createdAt.toISOString(),
        actorUserId: row.actorUserId,
        entityType: row.entityType,
        entityId: row.entityId,
        ip: row.ip,
        userAgent: row.userAgent,
        afterData: row.afterData ?? null,
        actor: row.actor
          ? {
              id: row.actor.id,
              email: row.actor.email,
              displayName: row.actor.displayName,
            }
          : null,
      })),
    };

    this.cache.set(key, {
      expiresAt: now + CACHE_TTL_MS,
      data,
    });

    return data;
  }

  private cacheKey(input: ResolvedInput): string {
    return [
      input.from.toISOString(),
      input.to.toISOString(),
      input.window,
      input.bucket,
      input.timezone,
      input.topLimit,
    ].join('|');
  }

  private resolveInput(input: AccessMetricsInput): ResolvedInput {
    const timezone = this.validateTimezone(input.timezone ?? DEFAULT_TIMEZONE);
    const topLimit = this.resolveTopLimit(input.topLimit);

    const window = input.window ?? DEFAULT_WINDOW;
    const hasFrom = Boolean(input.from?.trim());
    const hasTo = Boolean(input.to?.trim());

    let from: Date;
    let to: Date;

    if (hasFrom || hasTo) {
      if (!hasFrom || !hasTo) {
        throw new BadRequestException('from and to must be provided together');
      }
      from = new Date(input.from as string);
      to = new Date(input.to as string);
      if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
        throw new BadRequestException('from/to must be valid ISO dates');
      }
    } else {
      to = new Date();
      from = new Date(to.getTime() - this.windowToMs(window));
    }

    if (from.getTime() >= to.getTime()) {
      throw new BadRequestException('from must be lower than to');
    }

    const rangeMs = to.getTime() - from.getTime();
    if (rangeMs > MAX_RANGE_MS) {
      throw new BadRequestException('date range exceeds maximum of 90 days');
    }

    const bucket =
      input.bucket ??
      (rangeMs <= 7 * 24 * 60 * 60 * 1000 ? 'hour' : 'day');

    if (bucket === 'hour' && rangeMs > 31 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(
        'hour bucket supports ranges up to 31 days',
      );
    }

    return {
      from,
      to,
      window,
      bucket,
      timezone,
      topLimit,
    };
  }

  private resolveTopLimit(input?: number): number {
    if (!Number.isFinite(input)) return 10;
    return Math.max(1, Math.min(50, Number(input)));
  }

  private validateTimezone(input: string): string {
    try {
      // Valida timezone IANA sem custo adicional de dependência externa.
      new Intl.DateTimeFormat('en-US', { timeZone: input }).format(new Date());
      return input;
    } catch {
      throw new BadRequestException('invalid timezone');
    }
  }

  private windowToMs(window: AdminMetricWindow): number {
    switch (window) {
      case '1h':
        return 1 * 60 * 60 * 1000;
      case '6h':
        return 6 * 60 * 60 * 1000;
      case '24h':
        return 24 * 60 * 60 * 1000;
      case '7d':
        return 7 * 24 * 60 * 60 * 1000;
      case '30d':
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  private async querySeriesByAction(
    prisma: ReturnType<PermissionsRepository['root']>,
    input: ResolvedInput,
    action: string,
  ): Promise<SeriesRow[]> {
    if (input.bucket === 'hour') {
      return prisma.$queryRaw<SeriesRow[]>`
        WITH bounds AS (
          SELECT
            date_trunc('hour', timezone(${input.timezone}, ${input.from})) AS start_local,
            date_trunc('hour', timezone(${input.timezone}, ${input.to})) AS end_local
        ),
        buckets AS (
          SELECT generate_series(
            (SELECT start_local FROM bounds),
            (SELECT end_local FROM bounds),
            interval '1 hour'
          ) AS bucket_local
        ),
        counts AS (
          SELECT
            date_trunc('hour', timezone(${input.timezone}, a.created_at)) AS bucket_local,
            COUNT(*)::int AS value
          FROM "audit_log" a
          WHERE a.action = ${action}
            AND a.created_at >= ${input.from}
            AND a.created_at < ${input.to}
          GROUP BY 1
        )
        SELECT
          (b.bucket_local AT TIME ZONE ${input.timezone}) AS bucket_start,
          COALESCE(c.value, 0)::int AS value
        FROM buckets b
        LEFT JOIN counts c ON c.bucket_local = b.bucket_local
        ORDER BY b.bucket_local ASC
      `;
    }

    return prisma.$queryRaw<SeriesRow[]>`
      WITH bounds AS (
        SELECT
          date_trunc('day', timezone(${input.timezone}, ${input.from})) AS start_local,
          date_trunc('day', timezone(${input.timezone}, ${input.to})) AS end_local
      ),
      buckets AS (
        SELECT generate_series(
          (SELECT start_local FROM bounds),
          (SELECT end_local FROM bounds),
          interval '1 day'
        ) AS bucket_local
      ),
      counts AS (
        SELECT
          date_trunc('day', timezone(${input.timezone}, a.created_at)) AS bucket_local,
          COUNT(*)::int AS value
        FROM "audit_log" a
        WHERE a.action = ${action}
          AND a.created_at >= ${input.from}
          AND a.created_at < ${input.to}
        GROUP BY 1
      )
      SELECT
        (b.bucket_local AT TIME ZONE ${input.timezone}) AS bucket_start,
        COALESCE(c.value, 0)::int AS value
      FROM buckets b
      LEFT JOIN counts c ON c.bucket_local = b.bucket_local
      ORDER BY b.bucket_local ASC
    `;
  }
}
