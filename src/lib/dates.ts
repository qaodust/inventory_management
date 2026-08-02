const NY_TIME_ZONE = "America/New_York";

const nyDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: NY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's business date in America/New_York, as "YYYY-MM-DD". Used to server-set Sale.saleDate — never accept a client-supplied date, per the no-backdating rule. */
export function nyTodayDateString(): string {
  return toNyDateString(new Date());
}

/** Converts any instant to its America/New_York calendar date, as "YYYY-MM-DD". */
export function toNyDateString(date: Date): string {
  return nyDateFormatter.format(date);
}

/**
 * Converts a "YYYY-MM-DD" string into a Date for a `@db.Date` column.
 * Always constructs explicit UTC midnight — never pass the string
 * straight to `new Date(s)` or use `new Date(y, m, d)`, both of which
 * are sensitive to the server process's local timezone and would
 * silently shift the date by up to a day depending on the deploy
 * environment.
 */
export function nyDateStringToUtcDate(dateString: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error(`Expected "YYYY-MM-DD", got: ${dateString}`);
  }
  return new Date(`${dateString}T00:00:00.000Z`);
}
