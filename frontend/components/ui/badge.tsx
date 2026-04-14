import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
  {
    variants: {
      variant: {
        default: 'border-border bg-secondary text-secondary-foreground',
        outline: 'border-border bg-background/30 text-muted-foreground',
        success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
        warning: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
        destructive: 'border-destructive/20 bg-destructive/10 text-red-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, className }))} {...props} />;
}
