/** Shared count and controls; pages are zero-based at the state boundary. */
export default function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
  label,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  label: string;
}) {
  const last = Math.max(0, Math.ceil(total / pageSize) - 1);
  const current = Math.max(0, Math.min(page, last));
  return (
    <>
      <span>
        {total
          ? `${current * pageSize + 1}–${Math.min((current + 1) * pageSize, total)} of ${total}`
          : `0 ${label}`}
      </span>
      <button
        type="button"
        disabled={current === 0}
        onClick={() => onPageChange(current - 1)}
      >
        Previous
      </button>
      <button
        type="button"
        disabled={current === last}
        onClick={() => onPageChange(current + 1)}
      >
        Next
      </button>
    </>
  );
}
