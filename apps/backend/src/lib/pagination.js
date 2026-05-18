// VIPOS — Pagination utility for list endpoints.
//
// Standardizes pagination across all list routes:
//  - Parses `page` and `per_page` from query params
//  - Clamps to safe ranges
//  - Returns SQL LIMIT/OFFSET + response metadata
//
// Usage:
//   const { limit, offset, page, perPage } = parsePagination(req.query);
//   const { rows } = await query(`SELECT ... LIMIT $1 OFFSET $2`, [limit, offset]);
//   const total = (await query(`SELECT COUNT(*) ...`)).rows[0].count;
//   res.json(paginatedResponse(rows, total, page, perPage));

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;
const MIN_PER_PAGE = 1;

/**
 * Parse pagination params from query string.
 *
 * @param {object} query - req.query
 * @returns {{ page: number, perPage: number, limit: number, offset: number }}
 */
function parsePagination(query = {}) {
  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) page = DEFAULT_PAGE;

  let perPage = parseInt(query.per_page, 10);
  if (isNaN(perPage) || perPage < MIN_PER_PAGE) perPage = DEFAULT_PER_PAGE;
  if (perPage > MAX_PER_PAGE) perPage = MAX_PER_PAGE;

  const offset = (page - 1) * perPage;

  return { page, perPage, limit: perPage, offset };
}

/**
 * Build a standardized paginated response object.
 *
 * @param {Array} data - The rows for this page
 * @param {number} total - Total row count (from COUNT query)
 * @param {number} page - Current page number
 * @param {number} perPage - Items per page
 * @returns {{ data, page, per_page, total, total_pages }}
 */
function paginatedResponse(data, total, page, perPage) {
  const totalPages = Math.ceil(total / perPage);
  return {
    data,
    page,
    per_page: perPage,
    total: Number(total),
    total_pages: totalPages,
  };
}

module.exports = { parsePagination, paginatedResponse, DEFAULT_PER_PAGE, MAX_PER_PAGE };
