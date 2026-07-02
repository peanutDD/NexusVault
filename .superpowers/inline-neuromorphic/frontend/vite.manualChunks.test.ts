import { describe, expect, it } from 'vitest';
import { manualChunkName } from './vite.manualChunks';

describe('manualChunkName', () => {
  it('keeps heavyweight preview/runtime dependencies out of vendor-other', () => {
    expect(manualChunkName('/repo/node_modules/pdfjs-dist/build/pdf.mjs')).toBe('vendor-pdfjs');
    expect(manualChunkName('/repo/node_modules/hls.js/dist/hls.mjs')).toBe('vendor-hls');
    expect(manualChunkName('/repo/node_modules/three/build/three.module.js')).toBe('vendor-three');
    expect(manualChunkName('/repo/node_modules/@sentry/react/build/index.js')).toBe('vendor-sentry');
  });

  it('keeps core app dependencies in stable vendor chunks', () => {
    expect(manualChunkName('/repo/node_modules/react/index.js')).toBe('react-vendor');
    expect(manualChunkName('/repo/node_modules/@tanstack/react-query/build/index.js')).toBe(
      'query-vendor',
    );
  });
});
