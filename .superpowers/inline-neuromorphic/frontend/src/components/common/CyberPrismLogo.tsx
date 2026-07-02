import type { SVGProps } from "react";
import { cn } from "../../utils/cn";

type PixelTone = keyof typeof PIXEL_PALETTE;

interface CyberPrismLogoProps extends SVGProps<SVGSVGElement> {
  className?: string;
}

const PIXEL_PALETTE = {
  B: "rgb(0, 52, 206)",
  D: "rgb(0, 0, 152)",
  H: "rgb(52, 102, 249)",
  F: "rgb(239, 198, 136)",
  S: "rgb(151, 71, 8)",
  W: "rgb(245, 239, 249)",
  G: "rgb(178, 178, 178)",
  L: "rgb(220, 231, 237)",
  Q: "rgb(128, 128, 128)",
  K: "rgb(1, 0, 0)",
  M: "rgb(151, 1, 0)",
  R: "rgb(253, 0, 7)",
} as const;

const PIXEL_ROWS = [
  "........BBBBBB.................",
  "....BBBBBBBBBBBB...............",
  "..DDDDBBBBBDDBBBBB....D........",
  "....DDDDDBBDFDBHBBBB.DD........",
  ".......DDDDSFFDBHHBBBDD........",
  "........DBDSFFFBHHHBBBD........",
  ".......BBBDSSBBHHWHHBBB........",
  "....BBBBBBBBBBHHBBHHHBB........",
  "..BBBBBBBHHHHHHDGGLHHBBB.......",
  ".BBBBBBBBBHWHHDQLWWBHHBB.......",
  "BDDDDDDDBBBHBHDGGGWLBHBD.......",
  "DDDDDDDDDDBBBBDGKGWGBHHD.......",
  ".....DDDDDBBBBBGKQWWLDDG.......",
  ".......DDDDBBBBHKGWWWQKQQ....GW",
  "......BBDDDDBSFFGWWWWSGK....GWW",
  ".....BBBBDDDSFWSFFLLFFKK...GWW.",
  "....BBBDDDDDSFFSFFFFFFS..LGWW..",
  "...BBDDDDDDDDSSSSFFFSS..LWWGWW.",
  "...BD....DDDDDDSSSSS....LWGWWW.",
  "........DDDDDDDDDDD.....LWQWWG.",
  "........SSSFFSDBSFWS...LGLWQGG.",
  "......SSFFFSSDBSFWWWSS.SLGLWG..",
  "......SFSSSDDDBSFFWFSSSSFGG....",
  "......SSFFSQDDBSFFFF.SFF.......",
  "......QQSFSGDDDBSFFB...........",
  ".....QLQQSGWQDDDBBBB...........",
  ".....QGLLWWQQWDBBWDB...........",
  "......QQGLQMMWDDBWDB...........",
  "........QQMMMMWWDDBB...........",
  ".......KKMMMMWWDBBB............",
  ".......KMRRMMWWDBQ.............",
  "......KK..RMQGGWWGQ............",
  "......KMRRGMWQQQGGQ............",
  ".....KMRRRMGWKMRRMK............",
  ".....KMRRRRMKMGWWWWK...........",
  ".....KKMRWRMKGRRRRMG...........",
  ".....KKMMRRMKMMRRWRMK..........",
  "......KKMMMMKMMMRRRMK..........",
  ".......KKMM..KKKKKKKK..........",
] as const;

const PIXEL_WIDTH = Math.max(...PIXEL_ROWS.map((row) => row.length));
const PIXEL_HEIGHT = PIXEL_ROWS.length;

export function CyberPrismLogo({
  className,
  ...svgProps
}: CyberPrismLogoProps) {
  return (
    <svg
      {...svgProps}
      className={cn("pixel-logo", className)}
      viewBox={`0 0 ${PIXEL_WIDTH} ${PIXEL_HEIGHT}`}
      role="img"
      aria-label="Logo"
      data-testid="pixel-logo"
      shapeRendering="crispEdges"
    >
      <title>Logo</title>
      {PIXEL_ROWS.map((row, y) =>
        Array.from(row).map((tone, x) => {
          if (tone === ".") return null;

          return (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="1"
              height="1"
              fill={PIXEL_PALETTE[tone as PixelTone]}
            />
          );
        }),
      )}
    </svg>
  );
}
