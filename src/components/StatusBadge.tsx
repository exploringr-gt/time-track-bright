import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type TaskStatus } from "@/lib/types";

const STATUS_CLASS: Record<TaskStatus, string> = {
  not_started: "bg-status-not-started/15 text-status-not-started border-status-not-started/30",
  in_progress: "bg-status-in-progress/15 text-status-in-progress border-status-in-progress/30",
  
  complete: "bg-status-complete/15 text-status-complete border-status-complete/30",
  cancelled: "bg-status-cancelled/15 text-status-cancelled border-status-cancelled/30",
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STATUS_CLASS[status], className)}
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}
