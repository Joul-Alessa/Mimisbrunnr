import { useState } from 'react';
import { marked } from '../lib/markdown';

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
