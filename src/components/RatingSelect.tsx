/** 1-5 rating <select>, shared by the manufacturer add/edit forms. Empty = "not rated". */
export function RatingSelect({
  id,
  name,
  defaultValue,
}: {
  id: string;
  name: string;
  defaultValue?: number | null;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue != null ? String(defaultValue) : ""}
      className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
    >
      <option value="">Not rated</option>
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}
