declare module 'react-markdown' {
  import type { ComponentType, ReactNode } from 'react';

  export interface ReactMarkdownProps {
    children?: ReactNode;
    remarkPlugins?: unknown[];
    rehypePlugins?: unknown[];
    components?: Record<string, ComponentType<any>>;
  }

  const ReactMarkdown: ComponentType<ReactMarkdownProps>;
  export default ReactMarkdown;
}

declare module 'remark-gfm' {
  const remarkGfm: unknown;
  export default remarkGfm;
}

declare module 'rehype-raw' {
  const rehypeRaw: unknown;
  export default rehypeRaw;
}

declare module 'rehype-highlight' {
  const rehypeHighlight: unknown;
  export default rehypeHighlight;
}

