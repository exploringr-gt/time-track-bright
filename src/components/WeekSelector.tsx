import { ChevronLeft, ChevronRight } from "lucide-react";
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

  const label = isThisWeek
    ? "This week"
    : isNextWeek
      ? "Next week"
      : `${fmt(start, "MMM d")} – ${fmt(end, "MMM d, yyyy")}`;

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange(shiftWeek(value, -1))}
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[160px] px-2 text-center text-sm font-medium tabular-nums">
        {label}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange(shiftWeek(value, 1))}
        aria-label="Next week"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
