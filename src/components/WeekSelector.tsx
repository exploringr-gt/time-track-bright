import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { weekRange, shiftWeek, fmt } from "@/lib/dates";
import { cn } from "@/lib/utils";

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
  const [open, setOpen] = useState(false);

  const isThisWeek = start.getTime() === tw.start.getTime();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(shiftWeek(value, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant={isThisWeek ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onChange(today)}
        >
          This week
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(shiftWeek(value, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <CalIcon className="h-4 w-4" />
            {fmt(start, "MMM d")} – {fmt(end, "MMM d, yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => {
              if (d) onChange(d);
              setOpen(false);
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
