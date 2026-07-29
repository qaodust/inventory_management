"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mobileNavItems } from "@/lib/nav";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-neutral-200 bg-white md:hidden dark:border-neutral-800 dark:bg-neutral-950">
      {mobileNavItems.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center py-2 text-xs font-medium transition-colors ${
              active
                ? "text-neutral-900 dark:text-neutral-100"
                : "text-neutral-500 dark:text-neutral-400"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
