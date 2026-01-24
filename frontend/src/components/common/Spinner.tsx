import { cn } from '../../utils/cn';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-5 h-5 border-2',
  md: 'w-10 h-10 border-2',
  lg: 'w-16 h-16 border-4',
} as const;

export default function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span
      className={cn(
        sizeClasses[size],
        'border-gray-600 border-t-purple-400 rounded-full animate-spin',
        className
      )}
      aria-hidden
      role="status"
      aria-label="加载中"
    />
  );
}
