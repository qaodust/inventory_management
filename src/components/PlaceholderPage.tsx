export function PlaceholderPage({
  title,
  phase,
}: {
  title: string;
  phase: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Coming in {phase}. This route exists to confirm the navigation shell
        works end-to-end.
      </p>
    </div>
  );
}
