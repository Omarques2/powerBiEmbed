import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PowerBiService } from './powerbi.service';

type PageGroupRow = {
  id: string;
  name: string;
  isActive: boolean;
  pageIds: string[];
};

@Injectable()
export class PowerBiPagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pbi: PowerBiService,
  ) {}

  async syncReportPages(reportRefId: string) {
    const report = await this.prisma.biReport.findUnique({
      where: { id: reportRefId },
      select: {
        id: true,
        reportId: true,
        workspace: { select: { workspaceId: true } },
      },
    });
    if (!report) throw new NotFoundException('Report not found');

    const remote = await this.pbi.listReportPages(
      report.workspace.workspaceId,
      report.reportId,
    );

    const remotePages = remote
      .map((p, idx) => ({
        pageName: String(p.name ?? '').trim(),
        displayName: p.displayName ?? p.name ?? null,
        pageOrder:
          typeof (p as { order?: number | null }).order === 'number'
            ? ((p as { order?: number | null }).order ?? idx)
            : idx,
      }))
      .filter((p) => p.pageName);

    const remoteNames = remotePages.map((p) => p.pageName);

    let upserted = 0;
    let deactivated = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const p of remotePages) {
        await tx.biReportPage.upsert({
          where: {
            reportRefId_pageName: {
              reportRefId: report.id,
              pageName: p.pageName,
            },
          },
          create: {
            reportRefId: report.id,
            pageName: p.pageName,
            displayName: p.displayName ?? undefined,
            pageOrder: p.pageOrder,
            isActive: true,
          },
          update: {
            displayName: p.displayName ?? undefined,
            pageOrder: p.pageOrder,
            isActive: true,
          },
        });
        upserted += 1;
      }

      if (remoteNames.length > 0) {
        const res = await tx.biReportPage.updateMany({
          where: {
            reportRefId: report.id,
            pageName: { notIn: remoteNames },
          },
          data: { isActive: false },
        });
        deactivated = res.count;
      }
    });

    if (remotePages.length > 0) {
      await this.backfillDefaultAccessForReport(report.id);
    }

    return {
      ok: true,
      reportRefId: report.id,
      pagesUpserted: upserted,
      pagesDeactivated: deactivated,
      remoteCount: remotePages.length,
    };
  }

  async syncAllReportPages() {
    const reports = await this.prisma.biReport.findMany({
      select: { id: true, reportName: true },
      orderBy: [{ createdAt: 'asc' }],
    });

    let success = 0;
    let failed = 0;
    const errors: {
      reportRefId: string;
      reportName?: string | null;
      message: string;
    }[] = [];

    for (const report of reports) {
      try {
        await this.syncReportPages(report.id);
        success += 1;
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        errors.push({
          reportRefId: report.id,
          reportName: report.reportName ?? null,
          message,
        });
      }
    }

    return {
      ok: failed === 0,
      total: reports.length,
      success,
      failed,
      errors,
    };
  }

  private async backfillDefaultAccessForReport(reportRefId: string) {
    const pages = await this.prisma.biReportPage.findMany({
      where: { reportRefId: reportRefId, isActive: true },
      select: { id: true },
    });
    if (!pages.length) return;

    const customers = await this.prisma.biCustomerReportPermission.findMany({
      where: {
        reportRefId: reportRefId,
        canView: true,
        customer: { status: 'active' },
      },
      select: { customerId: true },
    });
    if (!customers.length) return;

    for (const { customerId } of customers) {
      const [activeGroups, allowExists] = await Promise.all([
        this.prisma.biCustomerPageGroup.findMany({
          where: {
            customerId: customerId,
            isActive: true,
            group: { reportRefId: reportRefId, isActive: true },
          },
          select: { groupId: true },
        }),
        this.prisma.biCustomerPageAllowlist.findFirst({
          where: { customerId: customerId, page: { reportRefId: reportRefId } },
          select: { id: true },
        }),
      ]);

      const groupIds = Array.from(new Set(activeGroups.map((g) => g.groupId)));
      const hasGroups = groupIds.length > 0;

      if (!hasGroups && !allowExists) {
        await this.prisma.biCustomerPageAllowlist.createMany({
          data: pages.map((p) => ({ customerId: customerId, pageId: p.id })),
          skipDuplicates: true,
        });
      }

      const memberships = await this.prisma.userCustomerMembership.findMany({
        where: {
          customerId: customerId,
          isActive: true,
          user: { status: 'active' },
        },
        select: { userId: true },
      });
      if (!memberships.length) continue;

      const userIds = memberships.map((m) => m.userId);
      const [userAllow, userGroups] = await Promise.all([
        this.prisma.biUserPageAllowlist.findMany({
          where: {
            userId: { in: userIds },
            page: { reportRefId: reportRefId },
          },
          select: { userId: true },
        }),
        this.prisma.biUserPageGroup.findMany({
          where: {
            userId: { in: userIds },
            group: { reportRefId: reportRefId },
          },
          select: { userId: true },
        }),
      ]);

      const assignedUsers = new Set([
        ...userAllow.map((u) => u.userId),
        ...userGroups.map((u) => u.userId),
      ]);
      const targetUserIds = userIds.filter((id) => !assignedUsers.has(id));
      if (!targetUserIds.length) continue;

      if (hasGroups) {
        const rows = targetUserIds.flatMap((userId) =>
          groupIds.map((groupId) => ({ userId, groupId, isActive: true })),
        );
        await this.prisma.biUserPageGroup.createMany({
          data: rows,
          skipDuplicates: true,
        });
      } else {
        const rows = targetUserIds.flatMap((userId) =>
          pages.map((p) => ({ userId, pageId: p.id })),
        );
        await this.prisma.biUserPageAllowlist.createMany({
          data: rows,
          skipDuplicates: true,
        });
      }
    }
  }

  private async getReportGroupPageMap(
    tx: Prisma.TransactionClient,
    reportRefId: string,
  ) {
    const groups = await tx.biPageGroup.findMany({
      where: { reportRefId: reportRefId, isActive: true },
      select: { id: true, pages: { select: { pageId: true } } },
    });
    return new Map(groups.map((g) => [g.id, g.pages.map((p) => p.pageId)]));
  }

  private collectGroupPageIds(
    groupMap: Map<string, string[]>,
    groupIds: Iterable<string>,
  ) {
    const pageIds: string[] = [];
    for (const groupId of groupIds) {
      const pages = groupMap.get(groupId);
      if (pages?.length) pageIds.push(...pages);
    }
    return pageIds;
  }

  private async getCustomerEffectivePageSet(
    tx: Prisma.TransactionClient,
    reportRefId: string,
    customerId: string,
    groupMap: Map<string, string[]>,
  ) {
    const [groupLinks, allow] = await Promise.all([
      tx.biCustomerPageGroup.findMany({
        where: {
          customerId: customerId,
          isActive: true,
          group: { reportRefId: reportRefId, isActive: true },
        },
        select: { groupId: true },
      }),
      tx.biCustomerPageAllowlist.findMany({
        where: {
          customerId: customerId,
          page: { reportRefId: reportRefId, isActive: true },
        },
        select: { pageId: true },
      }),
    ]);

    const activeGroupIds = new Set(groupLinks.map((g) => g.groupId));
    const hasGroups = activeGroupIds.size > 0;
    const allowIds = allow.map((p) => p.pageId);
    const pageIds = hasGroups
      ? this.collectGroupPageIds(groupMap, activeGroupIds)
      : allowIds;

    return {
      hasGroups,
      activeGroupIds,
      pageSet: new Set(pageIds),
    };
  }

  private async getUserEffectivePageSet(
    tx: Prisma.TransactionClient,
    reportRefId: string,
    userId: string,
    groupMap: Map<string, string[]>,
  ) {
    const [groupLinks, allow] = await Promise.all([
      tx.biUserPageGroup.findMany({
        where: {
          userId: userId,
          isActive: true,
          group: { reportRefId: reportRefId, isActive: true },
        },
        select: { groupId: true },
      }),
      tx.biUserPageAllowlist.findMany({
        where: { userId: userId, page: { reportRefId: reportRefId } },
        select: { pageId: true },
      }),
    ]);

    const hasGroups = groupLinks.length > 0;
    const allowIds = allow.map((p) => p.pageId);
    const pageIds = hasGroups
      ? this.collectGroupPageIds(
          groupMap,
          groupLinks.map((g) => g.groupId),
        )
      : allowIds;

    return {
      hasGroups,
      hasAllow: allowIds.length > 0,
      pageSet: new Set(pageIds),
    };
  }

  private setsEqual(a: Set<string>, b: Set<string>) {
    if (a.size !== b.size) return false;
    for (const value of a) {
      if (!b.has(value)) return false;
    }
    return true;
  }

  private async syncUserPageAccessForCustomerReport(
    tx: Prisma.TransactionClient,
    reportRefId: string,
    customerId: string,
    beforeCustomerSet: Set<string>,
    afterCustomer: {
      hasGroups: boolean;
      activeGroupIds: Set<string>;
      pageSet: Set<string>;
    },
    groupMap: Map<string, string[]>,
  ) {
    const memberships = await tx.userCustomerMembership.findMany({
      where: {
        customerId: customerId,
        isActive: true,
        user: { status: 'active' },
      },
      select: { userId: true },
    });
    if (!memberships.length) return { usersSynced: 0 };

    const userIds = memberships.map((m) => m.userId);
    let usersSynced = 0;

    for (const userId of userIds) {
      const userState = await this.getUserEffectivePageSet(
        tx,
        reportRefId,
        userId,
        groupMap,
      );

      const userHasAssignments = userState.hasGroups || userState.hasAllow;
      const shouldSync =
        !userHasAssignments ||
        this.setsEqual(userState.pageSet, beforeCustomerSet);

      if (!shouldSync) continue;

      if (afterCustomer.hasGroups) {
        const groupIds = Array.from(afterCustomer.activeGroupIds);

        await tx.biUserPageAllowlist.deleteMany({
          where: { userId: userId, page: { reportRefId: reportRefId } },
        });

        if (groupIds.length) {
          await tx.biUserPageGroup.createMany({
            data: groupIds.map((groupId) => ({
              userId: userId,
              groupId,
              isActive: true,
            })),
            skipDuplicates: true,
          });
        }

        await tx.biUserPageGroup.deleteMany({
          where: {
            userId: userId,
            group: { reportRefId: reportRefId },
            ...(groupIds.length ? { groupId: { notIn: groupIds } } : {}),
          },
        });
      } else {
        const pageIds = Array.from(afterCustomer.pageSet);

        await tx.biUserPageGroup.deleteMany({
          where: { userId: userId, group: { reportRefId: reportRefId } },
        });

        if (pageIds.length) {
          await tx.biUserPageAllowlist.createMany({
            data: pageIds.map((pageId) => ({ userId: userId, pageId })),
            skipDuplicates: true,
          });
        }

        await tx.biUserPageAllowlist.deleteMany({
          where: {
            userId: userId,
            page: { reportRefId: reportRefId },
            ...(pageIds.length ? { pageId: { notIn: pageIds } } : {}),
          },
        });
      }

      usersSynced += 1;
    }

    return { usersSynced };
  }

  listReportPages(reportRefId: string) {
    return this.prisma.biReportPage.findMany({
      where: { reportRefId: reportRefId },
      orderBy: [{ pageOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        pageName: true,
        displayName: true,
        pageOrder: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async listPageGroups(reportRefId: string): Promise<PageGroupRow[]> {
    const groups = await this.prisma.biPageGroup.findMany({
      where: { reportRefId: reportRefId },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        isActive: true,
        pages: { select: { pageId: true } },
      },
    });
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      isActive: g.isActive,
      pageIds: g.pages.map((p) => p.pageId),
    }));
  }

  async createPageGroup(input: {
    reportRefId: string;
    name: string;
    pageIds?: string[];
  }) {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException('name is required');

    const pageIds = (input.pageIds ?? []).filter(Boolean);
    const validPages = pageIds.length
      ? await this.prisma.biReportPage.findMany({
          where: { id: { in: pageIds }, reportRefId: input.reportRefId },
          select: { id: true },
        })
      : [];

    if (pageIds.length !== validPages.length) {
      throw new BadRequestException('pageIds must belong to the report');
    }

    return this.prisma.$transaction(async (tx) => {
      const group = await tx.biPageGroup.create({
        data: {
          reportRefId: input.reportRefId,
          name: name,
          isActive: true,
        },
      });

      if (pageIds.length) {
        await tx.biPageGroupPage.createMany({
          data: pageIds.map((pageId) => ({ groupId: group.id, pageId })),
        });
      }

      return { id: group.id };
    });
  }

  updatePageGroup(
    groupId: string,
    input: { name?: string; isActive?: boolean },
  ) {
    const data: { name?: string; isActive?: boolean } = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new BadRequestException('name is required');
      data.name = name;
    }
    if (input.isActive !== undefined) data.isActive = input.isActive;

    return this.prisma.biPageGroup.update({
      where: { id: groupId },
      data: data,
      select: { id: true, name: true, isActive: true },
    });
  }

  async setPageGroupPages(groupId: string, pageIds: string[]) {
    const group = await this.prisma.biPageGroup.findUnique({
      where: { id: groupId },
      select: { reportRefId: true },
    });
    if (!group) throw new NotFoundException('Group not found');

    const cleanIds = pageIds.filter(Boolean);
    const valid = cleanIds.length
      ? await this.prisma.biReportPage.findMany({
          where: { id: { in: cleanIds }, reportRefId: group.reportRefId },
          select: { id: true },
        })
      : [];
    if (cleanIds.length !== valid.length) {
      throw new BadRequestException('pageIds must belong to the report');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.biPageGroupPage.deleteMany({ where: { groupId: groupId } });
      if (cleanIds.length) {
        await tx.biPageGroupPage.createMany({
          data: cleanIds.map((pageId) => ({ groupId: groupId, pageId })),
        });
      }
    });

    return { ok: true };
  }

  async deletePageGroup(groupId: string) {
    await this.prisma.biPageGroup.delete({ where: { id: groupId } });
    return { ok: true };
  }

  async getCustomerPageAccess(customerId: string, reportRefId: string) {
    const pages = await this.listReportPages(reportRefId);
    const groups = await this.listPageGroups(reportRefId);

    const allow = await this.prisma.biCustomerPageAllowlist.findMany({
      where: { customerId: customerId, page: { reportRefId: reportRefId } },
      select: { pageId: true },
    });
    const groupLinks = await this.prisma.biCustomerPageGroup.findMany({
      where: { customerId: customerId, group: { reportRefId: reportRefId } },
      select: { groupId: true, isActive: true },
    });
    const groupById = new Map(groupLinks.map((g) => [g.groupId, g.isActive]));
    const activeGroupIds = new Set(
      groupLinks.filter((g) => g.isActive).map((g) => g.groupId),
    );

    const groupPageIds = groups
      .filter((g) => activeGroupIds.has(g.id))
      .flatMap((g) => g.pageIds);
    const allowSet = new Set(allow.map((p) => p.pageId));
    const hasGroupAssignments = activeGroupIds.size > 0;
    const effectiveSet = hasGroupAssignments ? new Set(groupPageIds) : allowSet;

    return {
      pages: pages.map((p) => ({
        ...p,
        canView: effectiveSet.has(p.id),
      })),
      groups: groups.map((g) => ({
        ...g,
        assigned: groupById.get(g.id) ?? false,
      })),
    };
  }

  async getUserPageAccess(userId: string, reportRefId: string) {
    const pages = await this.listReportPages(reportRefId);
    const groups = await this.listPageGroups(reportRefId);

    const allow = await this.prisma.biUserPageAllowlist.findMany({
      where: { userId: userId, page: { reportRefId: reportRefId } },
      select: { pageId: true },
    });
    const groupLinks = await this.prisma.biUserPageGroup.findMany({
      where: { userId: userId, group: { reportRefId: reportRefId } },
      select: { groupId: true, isActive: true },
    });
    const groupById = new Map(groupLinks.map((g) => [g.groupId, g.isActive]));
    const activeGroupIds = new Set(
      groupLinks.filter((g) => g.isActive).map((g) => g.groupId),
    );

    const groupPageIds = groups
      .filter((g) => activeGroupIds.has(g.id))
      .flatMap((g) => g.pageIds);
    const allowSet = new Set(allow.map((p) => p.pageId));
    const hasGroupAssignments = activeGroupIds.size > 0;
    const effectiveSet = hasGroupAssignments ? new Set(groupPageIds) : allowSet;

    return {
      pages: pages.map((p) => ({
        ...p,
        canView: effectiveSet.has(p.id),
      })),
      groups: groups.map((g) => ({
        ...g,
        assigned: groupById.get(g.id) ?? false,
      })),
    };
  }

  async setCustomerPageGroup(
    customerId: string,
    groupId: string,
    isActive: boolean,
  ) {
    const group = await this.prisma.biPageGroup.findUnique({
      where: { id: groupId },
      select: { reportRefId: true },
    });
    if (!group) throw new NotFoundException('Group not found');

    return this.prisma.$transaction(async (tx) => {
      const groupMap = await this.getReportGroupPageMap(tx, group.reportRefId);
      const beforeCustomer = await this.getCustomerEffectivePageSet(
        tx,
        group.reportRefId,
        customerId,
        groupMap,
      );

      await tx.biCustomerPageGroup.upsert({
        where: { customerId_groupId: { customerId, groupId } },
        create: { customerId, groupId, isActive },
        update: { isActive },
      });

      let clearedAllowlist = 0;
      if (isActive) {
        const res = await tx.biCustomerPageAllowlist.deleteMany({
          where: {
            customerId: customerId,
            page: { reportRefId: group.reportRefId },
          },
        });
        clearedAllowlist = res.count;
      }

      const afterCustomer = await this.getCustomerEffectivePageSet(
        tx,
        group.reportRefId,
        customerId,
        groupMap,
      );
      const synced = await this.syncUserPageAccessForCustomerReport(
        tx,
        group.reportRefId,
        customerId,
        beforeCustomer.pageSet,
        afterCustomer,
        groupMap,
      );

      return { ok: true, clearedAllowlist, usersSynced: synced.usersSynced };
    });
  }

  async setUserPageGroup(userId: string, groupId: string, isActive: boolean) {
    await this.prisma.biUserPageGroup.upsert({
      where: { userId_groupId: { userId, groupId } },
      create: { userId, groupId, isActive },
      update: { isActive },
    });
    return { ok: true };
  }

  async setCustomerPageAllow(
    customerId: string,
    pageId: string,
    canView: boolean,
  ) {
    const page = await this.prisma.biReportPage.findUnique({
      where: { id: pageId },
      select: { reportRefId: true },
    });
    if (!page) throw new NotFoundException('Page not found');

    return this.prisma.$transaction(async (tx) => {
      const groupMap = await this.getReportGroupPageMap(tx, page.reportRefId);
      const beforeCustomer = await this.getCustomerEffectivePageSet(
        tx,
        page.reportRefId,
        customerId,
        groupMap,
      );

      if (beforeCustomer.hasGroups) {
        throw new BadRequestException(
          'Individual pages are disabled while groups are active',
        );
      }

      if (canView) {
        await tx.biCustomerPageAllowlist.upsert({
          where: { customerId_pageId: { customerId, pageId } },
          create: { customerId, pageId },
          update: {},
        });
      } else {
        await tx.biCustomerPageAllowlist.deleteMany({
          where: { customerId, pageId },
        });
      }

      const afterCustomer = await this.getCustomerEffectivePageSet(
        tx,
        page.reportRefId,
        customerId,
        groupMap,
      );
      const synced = await this.syncUserPageAccessForCustomerReport(
        tx,
        page.reportRefId,
        customerId,
        beforeCustomer.pageSet,
        afterCustomer,
        groupMap,
      );

      return { ok: true, usersSynced: synced.usersSynced };
    });
  }

  async setUserPageAllow(
    userId: string,
    pageId: string,
    canView: boolean,
    customerId?: string | null,
  ) {
    const page = await this.prisma.biReportPage.findUnique({
      where: { id: pageId },
      select: { reportRefId: true },
    });
    if (!page) throw new NotFoundException('Page not found');

    return this.prisma.$transaction(async (tx) => {
      if (customerId) {
        const groupMap = await this.getReportGroupPageMap(tx, page.reportRefId);
        const userState = await this.getUserEffectivePageSet(
          tx,
          page.reportRefId,
          userId,
          groupMap,
        );
        const userHasAssignments = userState.hasGroups || userState.hasAllow;
        if (!userHasAssignments) {
          const customerState = await this.getCustomerEffectivePageSet(
            tx,
            page.reportRefId,
            customerId,
            groupMap,
          );
          const seedIds = Array.from(customerState.pageSet);
          if (seedIds.length) {
            await tx.biUserPageAllowlist.createMany({
              data: seedIds.map((id) => ({ userId, pageId: id })),
              skipDuplicates: true,
            });
          }
        }
      }

      if (canView) {
        await tx.biUserPageAllowlist.upsert({
          where: { userId_pageId: { userId, pageId } },
          create: { userId, pageId },
          update: {},
        });
      } else {
        await tx.biUserPageAllowlist.deleteMany({
          where: { userId, pageId },
        });
      }

      return { ok: true };
    });
  }
}
