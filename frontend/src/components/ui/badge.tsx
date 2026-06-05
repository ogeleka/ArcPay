import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { badge: string; dot: string }> = {
  pending:  { badge: "bg-yellow-100 text-yellow-800", dot: "bg-yellow-500" },
  paid:     { badge: "bg-green-100  text-green-800",  dot: "bg-green-500"  },
  released: { badge: "bg-blue-100   text-blue-800",   dot: "bg-blue-500"   },
  refunded: { badge: "bg-gray-100   text-gray-700",   dot: "bg-gray-400"   },
  expired:  { badge: "bg-red-100    text-red-700",    dot: "bg-red-400"    },
};

interface BadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: BadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? { badge: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
      cfg.badge,
      className
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      {status}
    </span>
  );
}
