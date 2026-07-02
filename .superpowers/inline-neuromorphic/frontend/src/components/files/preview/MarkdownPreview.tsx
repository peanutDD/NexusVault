import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import "highlight.js/styles/github-dark.css";
import { createMarkdownComponents } from "./markdownPreviewComponents";
import {
  markdownSanitizeSchema,
  slugifyHeading,
} from "./markdownPreviewUtils";

interface MarkdownPreviewProps {
  content: string;
}

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const headingCounts = new Map<string, number>();
  const getHeadingId = (text: string) => {
    const base = slugifyHeading(text);
    const count = headingCounts.get(base) ?? 0;
    headingCounts.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        rehypeRaw,
        rehypeSanitize(markdownSanitizeSchema),
        [rehypeHighlight, { detect: true, ignoreMissing: true }],
      ]}
      components={createMarkdownComponents(getHeadingId)}
    >
      {content}
    </ReactMarkdown>
  );
}
