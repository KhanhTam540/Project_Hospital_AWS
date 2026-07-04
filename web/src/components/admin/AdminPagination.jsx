import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const DEFAULT_PAGE_SIZES = Object.freeze([5, 10, 20, 50]);

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function buildVisiblePages(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) pages.push("start-ellipsis");

  for (let page = windowStart; page <= windowEnd; page += 1) {
    pages.push(page);
  }

  if (windowEnd < totalPages - 1) pages.push("end-ellipsis");
  pages.push(totalPages);

  return pages;
}

/**
 * Phân trang phía client cho các trang quản trị.
 * resetKey nên chứa từ khóa tìm kiếm và bộ lọc để tự quay về trang đầu.
 */
export function useAdminPagination(
  items,
  {
    initialPageSize = 10,
    resetKey = "",
  } = {},
) {
  const safeItems = Array.isArray(items) ? items : [];
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalItems = safeItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [resetKey]);

  useEffect(() => {
    setCurrentPage((page) => clamp(page, 1, totalPages));
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return safeItems.slice(startIndex, startIndex + pageSize);
  }, [safeItems, currentPage, pageSize]);

  const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);

  const setPage = (page) => {
    setCurrentPage(clamp(Number(page) || 1, 1, totalPages));
  };

  const setPageSize = (size) => {
    const nextSize = Math.max(1, Number(size) || initialPageSize);
    setPageSizeState(nextSize);
    setCurrentPage(1);
  };

  return {
    pageItems,
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    from,
    to,
    setPage,
    setPageSize,
  };
}

export default function AdminPagination({
  pagination,
  currentPage: currentPageProp,
  pageSize: pageSizeProp,
  totalItems: totalItemsProp,
  totalPages: totalPagesProp,
  from: fromProp,
  to: toProp,
  onPageChange: onPageChangeProp,
  onPageSizeChange: onPageSizeChangeProp,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  itemLabel = "mục",
  className = "",
}) {
  const currentPage = pagination?.currentPage ?? currentPageProp ?? 1;
  const pageSize = pagination?.pageSize ?? pageSizeProp ?? 10;
  const totalItems = pagination?.totalItems ?? totalItemsProp ?? 0;
  const totalPages = pagination?.totalPages ?? totalPagesProp ?? 1;
  const from = pagination?.from ?? fromProp ?? 0;
  const to = pagination?.to ?? toProp ?? 0;
  const onPageChange = pagination?.setPage ?? onPageChangeProp;
  const onPageSizeChange = pagination?.setPageSize ?? onPageSizeChangeProp;

  if (!totalItems) return null;

  const visiblePages = buildVisiblePages(currentPage, totalPages);
  const buttonBase =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div
      className={`flex flex-col gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <span>
          Hiển thị <strong className="text-slate-900">{from}</strong>–
          <strong className="text-slate-900">{to}</strong> trong tổng số{" "}
          <strong className="text-slate-900">{totalItems}</strong> {itemLabel}
        </span>

        <label className="inline-flex items-center gap-2 font-semibold text-slate-600">
          Mỗi trang
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <nav className="flex flex-wrap items-center gap-1" aria-label="Phân trang">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className={`${buttonBase} border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700`}
          aria-label="Trang đầu"
          title="Trang đầu"
        >
          <ChevronFirst size={17} />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`${buttonBase} border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700`}
          aria-label="Trang trước"
          title="Trang trước"
        >
          <ChevronLeft size={17} />
        </button>

        {visiblePages.map((page) =>
          typeof page === "number" ? (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              aria-current={page === currentPage ? "page" : undefined}
              className={`${buttonBase} ${
                page === currentPage
                  ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                  : "border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
              }`}
            >
              {page}
            </button>
          ) : (
            <span
              key={page}
              className="inline-flex h-9 min-w-7 items-center justify-center text-slate-400"
            >
              …
            </span>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`${buttonBase} border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700`}
          aria-label="Trang sau"
          title="Trang sau"
        >
          <ChevronRight size={17} />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={`${buttonBase} border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700`}
          aria-label="Trang cuối"
          title="Trang cuối"
        >
          <ChevronLast size={17} />
        </button>
      </nav>
    </div>
  );
}
