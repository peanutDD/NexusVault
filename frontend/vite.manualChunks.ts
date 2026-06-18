export function manualChunkName(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;

  if (id.includes('pdfjs-dist')) {
    return 'vendor-pdfjs';
  }
  if (id.includes('hls.js')) {
    return 'vendor-hls';
  }
  if (id.includes('three')) {
    return 'vendor-three';
  }
  if (id.includes('@tanstack/react-virtual')) {
    return 'vendor-virtual';
  }
  if (id.includes('zip.js') || id.includes('jszip')) {
    return 'vendor-zip';
  }
  if (id.includes('@sentry')) {
    return 'vendor-sentry';
  }

  if (
    id.includes('/react/') ||
    id.includes('/react-dom/') ||
    id.includes('/scheduler/') ||
    id.includes('/use-sync-external-store/')
  ) {
    return 'react-vendor';
  }
  if (
    id.includes('react-router-dom') ||
    id.includes('react-router') ||
    id.includes('@remix-run/router')
  ) {
    return 'router-vendor';
  }
  if (id.includes('zustand')) {
    return 'state-vendor';
  }
  if (
    id.includes('@tanstack/react-query') ||
    id.includes('@tanstack/query-core') ||
    id.includes('@tanstack/react-query-devtools')
  ) {
    return 'query-vendor';
  }
  if (
    id.includes('react-hook-form') ||
    id.includes('@hookform/resolvers') ||
    id.includes('/zod/')
  ) {
    return 'form-vendor';
  }
  if (id.includes('lucide-react') || id.includes('framer-motion')) {
    return 'ui-vendor';
  }
  if (
    id.includes('axios') ||
    id.includes('date-fns') ||
    id.includes('clsx') ||
    id.includes('tailwind-merge')
  ) {
    return 'utils-vendor';
  }

  return 'vendor-other';
}
