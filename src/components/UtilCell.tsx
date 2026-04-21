import { cn } from "@/lib/utils";
import { utilColor } from "@/lib/calc";

const COLOR: Record<"good" | "warn" | "over", string> = {
  good: "bg-util-good/15 text-util-good",
  warn: "bg-util-warn/15 text-util-warn",
  over: "bg-util-over/15 text-util-over",
};

export function UtilCell({ pct, label }: { pct: number; label?: string }) {
  const c = utilColor(pct);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
        COLOR[c],
      )}
    >
      {pct}% {label}
    </span>
  );
}

export function UtilBar({ pct }: { pct: number }) {
  const c = utilColor(pct);
  const width = Math.min(pct, 150);
  const barColor =
    c === "over" ? "bg-util-over" : c === "warn" ? "bg-util-warn" : "bg-util-good";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full transition-all", barColor)}
        style={{ width: `${(width / 150) * 100}%` }}
      />
    </div>
  );
}
