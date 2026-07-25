export interface DateGroup<T> {
  label: string;
  items: T[];
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Groups a list of items (already sorted newest-first) by the calendar
// day their createdAt falls on, labeling the most recent two days as
// "Today" and "Yesterday" and everything else with a readable date.
export function groupByDate<T extends { createdAt: string }>(
  items: T[]
): DateGroup<T>[] {
  const groups: DateGroup<T>[] = [];
  const today = startOfDay(new Date());
  const yesterday = today - 24 * 60 * 60 * 1000;

  for (const item of items) {
    const itemDay = startOfDay(new Date(item.createdAt));

    let label: string;
    if (itemDay === today) {
      label = "Today";
    } else if (itemDay === yesterday) {
      label = "Yesterday";
    } else {
      label = new Date(item.createdAt).toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    const existingGroup = groups.find((g) => g.label === label);
    if (existingGroup) {
      existingGroup.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }

  return groups;
}

// "all" shows everything (grouped by day). "today"/"yesterday" narrow to
// that single day. Any other value is treated as a "yyyy-mm-dd" date
// string from a date picker, narrowing to that specific day.
export type DateFilterValue = "all" | "today" | "yesterday" | string;

export function filterOrdersByDate<T extends { createdAt: string }>(
  items: T[],
  filter: DateFilterValue
): T[] {
  if (filter === "all") return items;

  const today = startOfDay(new Date());
  const yesterday = today - 24 * 60 * 60 * 1000;

  let targetTs: number;
  if (filter === "today") {
    targetTs = today;
  } else if (filter === "yesterday") {
    targetTs = yesterday;
  } else {
    const [y, m, d] = filter.split("-").map(Number);
    if (!y || !m || !d) return items;
    targetTs = new Date(y, m - 1, d).getTime();
  }

  return items.filter((item) => startOfDay(new Date(item.createdAt)) === targetTs);
}