import ShapeWaveBackground from "../../common/ShapeWaveBackground";

type FileListShapeWaveBackgroundProps = {
  testId: string;
  theme: "dark" | "light";
};

function isTheme(theme: string) {
  const root = document.documentElement;
  if (theme === "light" && root.classList.contains("neuromorphic")) {
    return false;
  }
  return root.getAttribute("data-theme") === theme;
}

export default function FileListShapeWaveBackground({
  testId,
  theme,
}: FileListShapeWaveBackgroundProps) {
  return (
    <ShapeWaveBackground
      className="opacity-[var(--filelist-shape-wave-opacity)]"
      enabled={() => isTheme(theme)}
      testId={testId}
      tokenPrefix="--filelist-shape-wave"
    />
  );
}
