// apps/web/src/features/admin/api/types.ts

export type Paged<T> = {
  page: number;
  pageSize: number;
  total: number;
  rows: T[];
};
