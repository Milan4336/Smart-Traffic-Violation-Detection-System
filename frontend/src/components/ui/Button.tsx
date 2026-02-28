import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'alert' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    className,
    ...props
}) => {
    const baseStyles = "inline-flex items-center justify-center font-bold font-display uppercase tracking-wider transition-all rounded focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
        primary: "bg-primary/20 text-primary hover:bg-primary hover:text-black border border-primary/50 shadow-neon",
        alert: "bg-alert/20 text-alert hover:bg-alert hover:text-white border border-alert/50 shadow-neon-alert",
        outline: "bg-transparent text-white hover:bg-white/10 border border-white/20",
        ghost: "bg-transparent text-slate-400 hover:text-white hover:bg-white/5 border border-transparent",
    };

    const sizes = {
        sm: "text-[10px] py-1 px-2 gap-1",
        md: "text-xs py-2 px-4 gap-2",
        lg: "text-sm py-3 px-6 gap-2"
    };

    return (
        <button
            className={twMerge(clsx(baseStyles, variants[variant], sizes[size]), className)}
            {...props}
        >
            {children}
        </button>
    );
};
