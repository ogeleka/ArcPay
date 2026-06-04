import { cn } from "@/lib/utils";

const STATUS_CLASSES: Record<string, string> = {
  pending:  "bg-yellow-100 text-yellow-800",
  paid:     "bg-green-100  text-green-800",
  released: "bg-blue-100   text-blue-800",
  refunded: "bg-gray-100   text-gray-700",
  expired:  "bg-red-100    text-red-700",
};

interface BadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: BadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
      STATUS_CLASSES[status] ?? "bg-gray-100 text-gray-600",
      className
    )}>
      {status}
    </span>
  );
}
