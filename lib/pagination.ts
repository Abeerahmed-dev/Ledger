export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

/** Hard cap for list queries that merge or group in application code. */
export const LIST_QUERY_CAP = 500;

export function parsePageParam(value: string | undefined, defaultPage = 1): number {
  const page = parseInt(value || String(defaultPage), 10);
  return Number.isFinite(page) && page > 0 ? page : defaultPage;
}

export function parsePageSizeParam(value: string | undefined): number {
  const size = parseInt(value || String(DEFAULT_PAGE_SIZE), 10);
  if (!Number.isFinite(size) || size < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(size, MAX_PAGE_SIZE);
}

export function getSkip(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export function buildPaginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}

/** Slice an in-memory list after filters — for pages that merge multiple sources. */
export function paginateArray<T>(items: T[], page: number, pageSize: number): { items: T[]; meta: PaginationMeta } {
  const total = items.length;
  const skip = getSkip(page, pageSize);
  return {
    items: items.slice(skip, skip + pageSize),
    meta: buildPaginationMeta(page, pageSize, total),
  };
}
