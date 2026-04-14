import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-12 w-full rounded-2xl border border-input bg-background/70 px-4 py-3 text-base text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className
      )}
      {...props}
    />
  );
}
