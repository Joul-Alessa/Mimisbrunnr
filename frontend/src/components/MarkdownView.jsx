import { marked } from '../lib/markdown';

export default function MarkdownView({ content, className = '' }) {
  if (!content) return null;
  return (
    <div
      className={`markdown-preview ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: marked.parse(content) }}
    />
  );
}
