import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * Einheitlicher leerer Listen-/Bereichszustand (de-DE, BA14).
 */
export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  className,
}: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 px-8 py-12 text-sm text-muted-foreground",
        className,
      )}
      role="status"
    >
      <p className="text-base font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-prose leading-relaxed">{description}</p>
      ) : null}
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className={cn(buttonVariants({ size: "sm" }), "mt-3")}
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
