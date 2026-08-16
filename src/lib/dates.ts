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

/**
 * Inverse of nyDateStringToUtcDate — reads a `@db.Date` column's
 * UTC-midnight Date back out as "YYYY-MM-DD". Do NOT use toNyDateString
 * for this: these values are already UTC-midnight encodings of the
 * intended calendar date, not real instants to reinterpret in NY time
 * (doing so would shift the displayed date back by a day).
 */
export function utcDateToDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
