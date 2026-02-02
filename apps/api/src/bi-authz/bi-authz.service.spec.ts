import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BiAuthzService } from './bi-authz.service';

type PrismaMock = {
  biReportPage: { findMany: jest.Mock };
  biPageGroup: { findMany: jest.Mock };
  biCustomerPageAllowlist: { findMany: jest.Mock };
  biUserPageAllowlist: { findMany: jest.Mock };
};

const basePages = [
  { id: 'p1', pageName: 'Page 1', displayName: null, pageOrder: 1 },
  { id: 'p2', pageName: 'Page 2', displayName: 'Custom 2', pageOrder: 2 },
  { id: 'p3', pageName: 'Page 3', displayName: null, pageOrder: 3 },
];

function createService() {
  const prisma: PrismaMock = {
    biReportPage: { findMany: jest.fn() },
    biPageGroup: { findMany: jest.fn() },
    biCustomerPageAllowlist: { findMany: jest.fn() },
    biUserPageAllowlist: { findMany: jest.fn() },
  };
  const service = new BiAuthzService(prisma as any);
  return { prisma, service };
}

function mockAccess(
  prisma: PrismaMock,
  options: {
    pages: typeof basePages;
    customerGroups?: Array<{ pages: Array<{ pageId: string }> }>;
    userGroups?: Array<{ pages: Array<{ pageId: string }> }>;
    customerAllow?: Array<{ pageId: string }>;
    userAllow?: Array<{ pageId: string }>;
  },
) {
  prisma.biReportPage.findMany.mockResolvedValue(options.pages);
  prisma.biPageGroup.findMany
    .mockResolvedValueOnce(options.customerGroups ?? [])
    .mockResolvedValueOnce(options.userGroups ?? []);
  prisma.biCustomerPageAllowlist.findMany.mockResolvedValue(
    options.customerAllow ?? [],
  );
  prisma.biUserPageAllowlist.findMany.mockResolvedValue(
    options.userAllow ?? [],
  );
}

describe('BiAuthzService.resolveAllowedPagesForAccess', () => {
  it('throws when report pages are not synced', async () => {
    const { prisma, service } = createService();
    mockAccess(prisma, { pages: [] as any });

    await expect(
      service.resolveAllowedPagesForAccess({
        userId: 'u1',
        customerId: 'c1',
        reportRefId: 'r1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when customer has no allowed pages', async () => {
    const { prisma, service } = createService();
    mockAccess(prisma, { pages: basePages });

    await expect(
      service.resolveAllowedPagesForAccess({
        userId: 'u1',
        customerId: 'c1',
        reportRefId: 'r1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns customer allowlist when user has no assignments', async () => {
    const { prisma, service } = createService();
    mockAccess(prisma, {
      pages: basePages,
      customerAllow: [{ pageId: 'p1' }, { pageId: 'p2' }],
    });

    const result = await service.resolveAllowedPagesForAccess({
      userId: 'u1',
      customerId: 'c1',
      reportRefId: 'r1',
    });

    expect(result.pages).toEqual([
      { pageName: 'Page 1', displayName: 'Page 1' },
      { pageName: 'Page 2', displayName: 'Custom 2' },
    ]);
  });

  it('returns intersection between customer and user allowlists', async () => {
    const { prisma, service } = createService();
    mockAccess(prisma, {
      pages: basePages,
      customerAllow: [{ pageId: 'p1' }, { pageId: 'p2' }, { pageId: 'p3' }],
      userAllow: [{ pageId: 'p2' }],
    });

    const result = await service.resolveAllowedPagesForAccess({
      userId: 'u1',
      customerId: 'c1',
      reportRefId: 'r1',
    });

    expect(result.pages).toEqual([
      { pageName: 'Page 2', displayName: 'Custom 2' },
    ]);
  });

  it('prioritizes user groups over allowlist', async () => {
    const { prisma, service } = createService();
    mockAccess(prisma, {
      pages: basePages,
      customerAllow: [{ pageId: 'p1' }, { pageId: 'p2' }],
      userGroups: [{ pages: [{ pageId: 'p2' }] }],
    });

    const result = await service.resolveAllowedPagesForAccess({
      userId: 'u1',
      customerId: 'c1',
      reportRefId: 'r1',
    });

    expect(result.pages).toEqual([
      { pageName: 'Page 2', displayName: 'Custom 2' },
    ]);
  });

  it('uses customer groups over allowlist when groups are active', async () => {
    const { prisma, service } = createService();
    mockAccess(prisma, {
      pages: basePages,
      customerGroups: [{ pages: [{ pageId: 'p1' }, { pageId: 'p3' }] }],
      customerAllow: [{ pageId: 'p1' }, { pageId: 'p2' }, { pageId: 'p3' }],
    });

    const result = await service.resolveAllowedPagesForAccess({
      userId: 'u1',
      customerId: 'c1',
      reportRefId: 'r1',
    });

    expect(result.pages).toEqual([
      { pageName: 'Page 1', displayName: 'Page 1' },
      { pageName: 'Page 3', displayName: 'Page 3' },
    ]);
  });

  it('intersects customer groups with user allowlist', async () => {
    const { prisma, service } = createService();
    mockAccess(prisma, {
      pages: basePages,
      customerGroups: [{ pages: [{ pageId: 'p1' }, { pageId: 'p2' }] }],
      userAllow: [{ pageId: 'p2' }],
    });

    const result = await service.resolveAllowedPagesForAccess({
      userId: 'u1',
      customerId: 'c1',
      reportRefId: 'r1',
    });

    expect(result.pages).toEqual([
      { pageName: 'Page 2', displayName: 'Custom 2' },
    ]);
  });

  it('throws when intersection is empty', async () => {
    const { prisma, service } = createService();
    mockAccess(prisma, {
      pages: basePages,
      customerAllow: [{ pageId: 'p1' }],
      userAllow: [{ pageId: 'p2' }],
    });

    await expect(
      service.resolveAllowedPagesForAccess({
        userId: 'u1',
        customerId: 'c1',
        reportRefId: 'r1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
