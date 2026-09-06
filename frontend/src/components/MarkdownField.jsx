import { useState } from 'react';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import markedKatex from 'marked-katex-extension';
import 'katex/dist/katex.min.css';

marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
  })
);
marked.use(markedKatex({ throwOnError: false }));

export default function MarkdownField({ value, onChange, placeholder, required }) {
  const [mode, setMode] = useState('write');

  return (
    <div className="markdown-field">
      <div className="markdown-field-tabs">
        <button type="button" className={mode === 'write' ? 'active' : ''} onClick={() => setMode('write')}>
          Write
        </button>
        <button type="button" className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>
          Preview
        </button>
      </div>

      {mode === 'write' ? (
        <textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      ) : (
        <div
          className="markdown-preview"
          dangerouslySetInnerHTML={{ __html: value ? marked.parse(value) : '<p class="hint">Nothing to preview yet.</p>' }}
        />
      )}
    </div>
  );
}
