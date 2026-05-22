import { Button } from "@/components/ui/button";
import { weekRange, shiftWeek, fmt } from "@/lib/dates";

export function WeekSelector({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const { start, end } = weekRange(value);
  const today = new Date();
  const tw = weekRange(today);
  const nw = weekRange(shiftWeek(today, 1));

  const isThisWeek = start.getTime() === tw.start.getTime();
  const isNextWeek = start.getTime() === nw.start.getTime();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
        <Button
          variant={isThisWeek ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onChange(today)}
        >
          This week
        </Button>
        <Button
          variant={isNextWeek ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onChange(shiftWeek(today, 1))}
        >
          Next week
        </Button>
      </div>
      <span className="text-sm text-muted-foreground tabular-nums">
        {fmt(start, "MMM d")} – {fmt(end, "MMM d, yyyy")}
      </span>
    </div>
  );
}
