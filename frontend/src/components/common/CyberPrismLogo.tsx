import { cn } from '../../utils/cn';

interface CyberPrismLogoProps {
  className?: string;
}

export function CyberPrismLogo({ className }: CyberPrismLogoProps) {
  return (
    <svg
      className={cn('drop-shadow-lg', className)}
      viewBox="0 0 96 96"
      role="img"
      aria-label="Logo"
    >
      <defs>
        <linearGradient id="cp_a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#32d6c6" />
          <stop offset="1" stopColor="#46b7ff" />
        </linearGradient>
        <linearGradient id="cp_b" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a855f7" />
          <stop offset="1" stopColor="#ff4fd8" />
        </linearGradient>
        <linearGradient id="cp_c" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#22c55e" />
        </linearGradient>
        <linearGradient id="cp_d" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22c55e" />
          <stop offset="1" stopColor="#46b7ff" />
        </linearGradient>
        <filter id="cp_glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              0 0 0 0.6 0"
            result="glow"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer neon glow */}
      <g filter="url(#cp_glow)" opacity="0.95">
        {/* Diamond outline */}
        <polygon
          points="48,10 82,40 48,86 14,40"
          fill="rgba(178,139,255,0.10)"
        />

        {/* 4 facets */}
        <polygon points="48,10 14,40 48,48" fill="url(#cp_a)" />
        <polygon points="48,10 82,40 48,48" fill="url(#cp_b)" />
        <polygon points="14,40 48,86 48,48" fill="url(#cp_c)" />
        <polygon points="82,40 48,86 48,48" fill="url(#cp_d)" />

        {/* Highlight */}
        <polygon
          points="48,14 72,39 48,32 24,39"
          fill="rgba(255,255,255,0.22)"
        />

        {/* Inner cut lines */}
        <path
          d="M48 10 L48 86 M14 40 L82 40 M24 39 L48 48 L72 39"
          fill="none"
          stroke="rgba(255,255,255,0.20)"
          strokeWidth="1"
        />

        {/* Outer stroke */}
        <polygon
          points="48,10 82,40 48,86 14,40"
          fill="none"
          stroke="rgba(226,232,240,0.85)"
          strokeWidth="1.5"
        />
      </g>
    </svg>
  );
}

