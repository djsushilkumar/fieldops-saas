import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const variantStyles = {
      primary: 'bg-primary text-primary-foreground hover:opacity-90 active:opacity-95',
      accent: 'bg-accent text-accent-foreground hover:opacity-90 active:opacity-95',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-slate-200 active:bg-slate-300',
      destructive: 'bg-error text-error-foreground hover:opacity-90 active:opacity-95',
      ghost: 'bg-transparent text-text hover:bg-slate-100 active:bg-slate-200',
    };

    const sizeStyles = {
      sm: 'h-8 px-3 text-xs rounded-sm',
      md: 'h-10 px-4 text-sm rounded-md',
      lg: 'h-12 px-6 text-base rounded-md',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading && (
          <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
