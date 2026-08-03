import Link from "next/link";
import { moreNavItems } from "@/lib/nav";
import { signOutAction } from "@/lib/actions/sign-out";

export default function MorePage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="mb-2 text-2xl font-semibold">More</h1>
      <ul className="flex flex-col divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {moreNavItems.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex min-h-11 items-center px-4 py-3 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-col divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        <Link
          href="/account"
          className="flex min-h-11 items-center px-4 py-3 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900"
        >
          Account
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex min-h-11 w-full items-center px-4 py-3 text-left text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
