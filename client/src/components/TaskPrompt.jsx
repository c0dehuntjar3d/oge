import { useMemo, useState } from 'react';

const COLLAPSE_LINES = 18;

function normalizeText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\u202f/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

export default function TaskPrompt({ text, html }) {
  const [expanded, setExpanded] = useState(false);

  const normalizedHtml = useMemo(() => String(html || '').trim(), [html]);

  const estimateLines = useMemo(() => {
    if (normalizedHtml) {
      const fromHtml = normalizeText(normalizedHtml.replace(/<[^>]+>/g, '\n'));
      return fromHtml.split('\n').map((line) => line.trim());
    }

    const normalized = normalizeText(text);
    return normalized.split('\n').map((line) => line.trim());
  }, [normalizedHtml, text]);

  const lines = useMemo(() => {
    const normalized = normalizeText(text);
    return normalized.split('\n').map((line) => line.trim());
  }, [text]);

  const shouldCollapse = estimateLines.length > COLLAPSE_LINES;
  const visibleLines = !expanded && shouldCollapse ? lines.slice(0, COLLAPSE_LINES) : lines;

  if (normalizedHtml) {
    return (
      <div>
        <div
          className={`task-text task-html ${!expanded && shouldCollapse ? 'collapsed' : ''}`}
          dangerouslySetInnerHTML={{ __html: normalizedHtml }}
        />

        {shouldCollapse ? (
          <button
            type="button"
            className="text-toggle-btn"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? 'Свернуть текст задания' : 'Показать текст задания полностью'}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="task-text">
      {visibleLines.map((line, idx) =>
        line ? (
          <p key={`line-${idx}`} className="task-line">
            {line}
          </p>
        ) : (
          <div key={`gap-${idx}`} className="task-gap" />
        )
      )}

      {shouldCollapse ? (
        <button
          type="button"
          className="text-toggle-btn"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? 'Свернуть текст задания' : 'Показать текст задания полностью'}
        </button>
      ) : null}
    </div>
  );
}
