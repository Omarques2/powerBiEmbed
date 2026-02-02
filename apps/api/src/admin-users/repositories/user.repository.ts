import { Injectable } from '@nestjs/common';
import type { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  listPending() {
    return this.client().user.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        lastLoginAt: true,
        status: true,
      },
    });
  }

  findById(userId: string) {
    return this.client().user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        lastLoginAt: true,
        status: true,
      },
    });
  }

  findForStatus(userId: string) {
    return this.client().user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, email: true, displayName: true },
    });
  }

  findBySub(entraSub: string) {
    return this.client().user.findUnique({
      where: { entraSub },
      select: { id: true },
    });
  }

  findByEmail(email: string) {
    return this.client().user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true, status: true },
    });
  }

  findByEmailForLink(email: string, tx?: Prisma.TransactionClient) {
    return this.client(tx).user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: {
        id: true,
        email: true,
        status: true,
        entraSub: true,
        displayName: true,
      },
    });
  }

  createPreRegistered(
    tx: Prisma.TransactionClient,
    input: {
      entraSub: string;
      email: string;
      displayName?: string | null;
      status?: UserStatus;
    },
  ) {
    return this.client(tx).user.create({
      data: {
        entraSub: input.entraSub,
        email: input.email,
        displayName: input.displayName ?? undefined,
        status: input.status ?? 'active',
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        status: true,
        entraSub: true,
      },
    });
  }

  updateIdentity(
    tx: Prisma.TransactionClient,
    userId: string,
    input: {
      entraSub?: string;
      entraOid?: string | null;
      email?: string | null;
      displayName?: string | null;
      lastLoginAt?: Date;
    },
  ) {
    return this.client(tx).user.update({
      where: { id: userId },
      data: {
        entraSub: input.entraSub ?? undefined,
        entraOid: input.entraOid ?? undefined,
        email: input.email ?? undefined,
        displayName: input.displayName ?? undefined,
        lastLoginAt: input.lastLoginAt ?? undefined,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        status: true,
        entraSub: true,
      },
    });
  }

  updateStatus(
    tx: Prisma.TransactionClient,
    userId: string,
    status: UserStatus,
  ) {
    return this.client(tx).user.update({
      where: { id: userId },
      data: { status },
    });
  }

  disableMemberships(tx: Prisma.TransactionClient, userId: string) {
    return this.client(tx).userCustomerMembership.updateMany({
      where: { userId },
      data: { isActive: false },
    });
  }

  enableMemberships(tx: Prisma.TransactionClient, userId: string) {
    return this.client(tx).userCustomerMembership.updateMany({
      where: { userId },
      data: { isActive: true },
    });
  }

  count(where: Prisma.UserWhereInput) {
    return this.client().user.count({ where });
  }

  listActive(where: Prisma.UserWhereInput, page: number, pageSize: number) {
    return this.client().user.findMany({
      where,
      orderBy: [{ lastLoginAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        lastLoginAt: true,
        status: true,
      },
    });
  }

  listPlatformAdmins(userIds: string[]) {
    return this.client().userAppRole.findMany({
      where: {
        userId: { in: userIds },
        customerId: null,
        application: { appKey: 'PBI_EMBED' },
        appRole: { roleKey: 'platform_admin' },
      },
      select: { userId: true },
    });
  }
}
