import { memo, useId } from "react";
import { cn } from "../../utils/cn";

type MacFolderIconProps = React.SVGProps<SVGSVGElement>;

/**
 * macOS Finder 风格文件夹图标（近似复刻：蓝色渐变 + 高光 + 圆角）
 * 说明：Web 端无法直接使用系统 Finder 图标资源，这里用自绘 SVG 做视觉接近。
 */
export const MacFolderIcon = memo(function MacFolderIcon({
  className,
  ...props
}: MacFolderIconProps) {
  // useId 可能包含 ':'，某些浏览器在 svg url(#id) 引用时会失效导致变黑
  const uid = useId().replace(/:/g, "");
  const gBase = `macFolderBase-${uid}`;
  const gTop = `macFolderTop-${uid}`;
  const gHi = `macFolderHi-${uid}`;

  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-5 w-5", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
      data-oid="b2fnzk3"
    >
      <defs data-oid="ba9svvv">
        <linearGradient
          id={gTop}
          x1="3"
          y1="6"
          x2="21"
          y2="6"
          gradientUnits="userSpaceOnUse"
          data-oid="b18dcnm"
        >
          <stop stopColor="#A5F3FC" stopOpacity="0.95" data-oid="48d6e70" />
          <stop
            offset="1"
            stopColor="#60A5FA"
            stopOpacity="0.95"
            data-oid="-651i8a"
          />
        </linearGradient>
        <linearGradient
          id={gBase}
          x1="3"
          y1="10"
          x2="21"
          y2="20"
          gradientUnits="userSpaceOnUse"
          data-oid="84xramn"
        >
          <stop stopColor="#7DD3FC" stopOpacity="0.95" data-oid="idie1wd" />
          <stop
            offset="1"
            stopColor="#2563EB"
            stopOpacity="0.95"
            data-oid="m1larzj"
          />
        </linearGradient>
        <radialGradient
          id={gHi}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(7 9) rotate(35) scale(10 6)"
          data-oid="7sejapm"
        >
          <stop stopColor="#FFFFFF" stopOpacity="0.55" data-oid="x.0xu7d" />
          <stop
            offset="1"
            stopColor="#FFFFFF"
            stopOpacity="0"
            data-oid="pj8vkyi"
          />
        </radialGradient>
      </defs>

      {/* folder tab */}
      <path
        d="M4.8 6.2c0-1.02.83-1.85 1.85-1.85h3.5c.52 0 1.01.22 1.36.6l.9 1.0c.26.3.64.47 1.04.47h3.9c1.02 0 1.85.83 1.85 1.85v1.1H4.8V6.2Z"
        fill={`url(#${gTop})`}
        data-oid="pt.ls:u"
      />

      {/* folder body */}
      <path
        d="M3.8 10.1c0-1.1.9-2 2-2h12.4c1.1 0 2 .9 2 2v7.3c0 1.36-1.1 2.46-2.46 2.46H6.26C4.9 19.86 3.8 18.76 3.8 17.4v-7.3Z"
        fill={`url(#${gBase})`}
        data-oid="et_m_--"
      />

      {/* highlight */}
      <path
        d="M4.6 10.4c.2-1 1.08-1.75 2.12-1.75h11.0c.9 0 1.7.56 2.02 1.4"
        stroke={`url(#${gHi})`}
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.9"
        data-oid="9z41zk0"
      />

      {/* subtle border */}
      <path
        d="M3.8 10.1c0-1.1.9-2 2-2h12.4c1.1 0 2 .9 2 2v7.3c0 1.36-1.1 2.46-2.46 2.46H6.26C4.9 19.86 3.8 18.76 3.8 17.4v-7.3Z"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="0.9"
        data-oid="rx-:yt4"
      />
    </svg>
  );
});
