import * as React from 'react';
import { cn } from '@/lib/utils';

export type CardProps = React.HTMLAttributes<HTMLDivElement>;
export type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;
export type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement>;
export type CardDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;
export type CardContentProps = React.HTMLAttributes<HTMLDivElement>;
export type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('panel-surface rounded-3xl border border-border/80 bg-card text-card-foreground', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardHeaderProps) {
  return <div className={cn('flex flex-col gap-2 p-5 sm:p-6', className)} {...props} />;
}

export function CardTitle({ className, ...props }: CardTitleProps) {
  return <h3 className={cn('text-xl font-semibold text-foreground', className)} {...props} />;
}

export function CardDescription({ className, ...props }: CardDescriptionProps) {
  return <p className={cn('text-base leading-relaxed text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: CardContentProps) {
  return <div className={cn('px-5 pb-5 sm:px-6 sm:pb-6', className)} {...props} />;
}

export function CardFooter({ className, ...props }: CardFooterProps) {
  return <div className={cn('flex items-center gap-3 px-5 pb-5 sm:px-6 sm:pb-6', className)} {...props} />;
}
