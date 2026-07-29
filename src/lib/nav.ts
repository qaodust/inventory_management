export type NavItem = {
  label: string;
  href: string;
};

// PC sidebar: all 6 top-level sections (design.md "Information Architecture").
export const mainNavItems: NavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Shipments", href: "/shipments" },
  { label: "Manufacturers", href: "/manufacturers" },
  { label: "Sales", href: "/sales" },
  { label: "Reports", href: "/reports" },
];

// Mobile bottom nav: limited to 4 slots for thumb reach, "More" covers the rest.
export const mobileNavItems: NavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Sales", href: "/sales" },
  { label: "Shipments", href: "/shipments" },
  { label: "More", href: "/more" },
];

// Linked from the mobile "More" page.
export const moreNavItems: NavItem[] = [
  { label: "Products", href: "/products" },
  { label: "Manufacturers", href: "/manufacturers" },
  { label: "Reports", href: "/reports" },
];
