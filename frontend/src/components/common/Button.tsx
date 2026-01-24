import { type ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variants: Record<Variant, string> = {
  primary:
    'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500',
  secondary: 'bg-gray-700 text-white hover:bg-gray-600 focus:ring-gray-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  ghost: 'bg-transparent text-gray-400 hover:text-white focus:ring-gray-500',
};

const base =
  'px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
}

export default function Button({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled ?? loading}
      className={cn(base, variants[variant], fullWidth && 'w-full', className)}
      {...rest}
    >
      {loading ? '加载中…' : children}
    </button>
  );
}
