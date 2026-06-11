import type { Request } from 'express';

export function getPagination(query: Request['query']) {
  const page = Math.max(parseInt(String(query['page'] ?? '1'), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(query['limit'] ?? '10'), 10) || 10, 1), 100);
  const skip = (page - 1) * limit;
  const isPaginated = Boolean(query['page'] || query['limit']);

  return { page, limit, skip, isPaginated };
}

export function paginatedResponse<T>(params: {
  page: number;
  limit: number;
  totalResults: number;
  data: T[];
}) {
  return {
    currentPage: params.page,
    totalPages: Math.ceil(params.totalResults / params.limit),
    totalResults: params.totalResults,
    data: params.data,
  };
}
