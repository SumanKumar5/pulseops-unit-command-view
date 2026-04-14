interface BadgeProps {
  children: React.ReactNode;
  variant?:
    | "acuity1"
    | "acuity2"
    | "acuity3"
    | "acuity4"
    | "acuity5"
    | "critical"
    | "high"
    | "medium"
    | "success"
    | "muted"
    | "blue";
  className?: string;
}

const VARIANTS: Record<NonNullable<BadgeProps["variant"]>, string> = {
  acuity1: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  acuity2: "bg-sky-500/20 text-sky-300 border border-sky-500/30",
  acuity3: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  acuity4: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  acuity5: "bg-red-500/20 text-red-300 border border-red-500/30",
  critical: "bg-red-500/20 text-red-300 border border-red-500/30",
  high: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  medium: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  success: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  muted: "bg-slate-700/50 text-slate-400 border border-slate-600/30",
  blue: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
};

export function Badge({
  children,
  variant = "muted",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
