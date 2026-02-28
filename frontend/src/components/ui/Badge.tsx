import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'primary' | 'success' | 'alert' | 'warning' | 'default';
    pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'default',
    pulse = false,
    className,
    ...props
}) => {
    const variants = {
        primary: 'text-primary bg-primary/10 border-primary/30',
        success: 'text-success bg-success/10 border-success/30',
        alert: 'text-alert bg-alert/10 border-alert/30',
        warning: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
        default: 'text-slate-400 bg-slate-700/50 border-slate-600'
    };

    return (
        <span
            className={twMerge(
                clsx(
                    "px-1.5 py-0.5 text-[10px] font-bold font-mono rounded border uppercase flex items-center gap-1.5 w-fit",
                    variants[variant],
                    pulse && "animate-pulse"
                ),
                className
            )}
            {...props}
        >
            {pulse && (
                <span className={clsx(
                    "size-1.5 rounded-full",
                    variant === 'primary' ? 'bg-primary' :
                        variant === 'success' ? 'bg-success' :
                            variant === 'alert' ? 'bg-alert' :
                                variant === 'warning' ? 'bg-orange-400' : 'bg-slate-400'
                )}></span>
            )}
            {children}
        </span>
    );
};
