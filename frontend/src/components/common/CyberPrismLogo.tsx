import { cn } from "../../utils/cn";

interface CyberPrismLogoProps {
  className?: string;
}

export function CyberPrismLogo({ className }: CyberPrismLogoProps) {
  return (
    <svg
      className={cn("drop-shadow-lg", className)}
      viewBox="0 0 96 96"
      role="img"
      aria-label="Logo"
      data-oid="hvcevhn"
    >
      <defs data-oid="pm9a..u">
        <linearGradient
          id="cp_a"
          x1="0"
          y1="0"
          x2="1"
          y2="1"
          data-oid="b3icp54"
        >
          <stop offset="0" stopColor="#32d6c6" data-oid="4ectbvc" />
          <stop offset="1" stopColor="#46b7ff" data-oid="hh9rg:-" />
        </linearGradient>
        <linearGradient
          id="cp_b"
          x1="1"
          y1="0"
          x2="0"
          y2="1"
          data-oid="46b-crb"
        >
          <stop offset="0" stopColor="#a855f7" data-oid="0led4._" />
          <stop offset="1" stopColor="#ff4fd8" data-oid=":s86ayf" />
        </linearGradient>
        <linearGradient
          id="cp_c"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
          data-oid="a79to9r"
        >
          <stop offset="0" stopColor="#8b5cf6" data-oid="31y6-3_" />
          <stop offset="1" stopColor="#22c55e" data-oid="s_chq6y" />
        </linearGradient>
        <linearGradient
          id="cp_d"
          x1="1"
          y1="0"
          x2="0"
          y2="1"
          data-oid="sd28xi3"
        >
          <stop offset="0" stopColor="#22c55e" data-oid="kdlykz0" />
          <stop offset="1" stopColor="#46b7ff" data-oid=":y8hmz4" />
        </linearGradient>
        <filter
          id="cp_glow"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
          data-oid="hwh9:w7"
        >
          <feGaussianBlur stdDeviation="3" result="blur" data-oid="lm1r9l-" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              0 0 0 0.6 0"
            result="glow"
            data-oid="-awuhvb"
          />

          <feMerge data-oid="dkmg-yl">
            <feMergeNode in="glow" data-oid="mdiw461" />
            <feMergeNode in="SourceGraphic" data-oid="n80ram5" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer neon glow */}
      <g filter="url(#cp_glow)" opacity="0.95" data-oid="y.1_c-b">
        {/* Diamond outline */}
        <polygon
          points="48,10 82,40 48,86 14,40"
          fill="rgba(178,139,255,0.10)"
          data-oid="k.is-7f"
        />

        {/* 4 facets */}
        <polygon
          points="48,10 14,40 48,48"
          fill="url(#cp_a)"
          data-oid="9yfl10b"
        />

        <polygon
          points="48,10 82,40 48,48"
          fill="url(#cp_b)"
          data-oid="u0_3u9o"
        />

        <polygon
          points="14,40 48,86 48,48"
          fill="url(#cp_c)"
          data-oid="2hjegg:"
        />

        <polygon
          points="82,40 48,86 48,48"
          fill="url(#cp_d)"
          data-oid="di9l5k0"
        />

        {/* Highlight */}
        <polygon
          points="48,14 72,39 48,32 24,39"
          fill="rgba(255,255,255,0.22)"
          data-oid="j___icd"
        />

        {/* Inner cut lines */}
        <path
          d="M48 10 L48 86 M14 40 L82 40 M24 39 L48 48 L72 39"
          fill="none"
          stroke="rgba(255,255,255,0.20)"
          strokeWidth="1"
          data-oid="h0vn37l"
        />

        {/* Outer stroke */}
        <polygon
          points="48,10 82,40 48,86 14,40"
          fill="none"
          stroke="rgba(226,232,240,0.85)"
          strokeWidth="1.5"
          data-oid="vx_qa_n"
        />
      </g>
    </svg>
  );
}
