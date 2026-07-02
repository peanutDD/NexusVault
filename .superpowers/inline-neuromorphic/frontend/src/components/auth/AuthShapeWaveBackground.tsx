import ShapeWaveBackground from "../common/ShapeWaveBackground";

export default function AuthShapeWaveBackground() {
  return (
    <ShapeWaveBackground
      className="opacity-[var(--auth-shape-wave-opacity)]"
      testId="auth-shape-wave-background"
      tokenPrefix="--auth-shape-wave"
      transparentBackground
    />
  );
}
