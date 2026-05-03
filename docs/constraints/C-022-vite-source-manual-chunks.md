# C-022: Do not manual-chunk app source by directory

Status: active

Vite `manualChunks` may group third-party vendor dependencies, but app source
modules should normally be split by their real dynamic import graph.

Do not force broad source directories such as `src/pages`, `src/components/files`,
or `src/components/files/preview` into named manual chunks.

Reason: route and dialog components already use `React.lazy`. Directory-based
source chunks can create circular chunks and pull preview-only code into the
common file-list path.
