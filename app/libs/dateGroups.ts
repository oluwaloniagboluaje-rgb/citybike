export interface DateGroup<T> {
  label: string;
  items: T[];
}

// Groups a list of items (already sorted newest-first) by the calendar
// day their createdAt falls on, labeling the most recent two days as
// "Today" and "Yesterday" and everything else with a readable date.
export function groupByDate<T extends { createdAt: string }>(
  items: T[]
): DateGroup<T>[] {
  const groups: DateGroup<T>[] = [];

  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

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