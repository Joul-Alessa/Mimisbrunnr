import { useEffect, useState } from 'react';
import { getStudyQueue, submitReview } from '../api/study';
import { listFields } from '../api/knowledgeFields';

function cardPrompt(card) {
  if (card.type === 'plain') return card.content;
  if (card.type === 'front_back') return card.front;
  if (card.type === 'cloze') return card.cloze_text;
  return '(custom card)';
}

function cardAnswer(card) {
  if (card.type === 'front_back') return card.back;
  return null;
}

export default function StudyPage() {
  const [fields, setFields] = useState([]);
  const [fieldId, setFieldId] = useState('');
  const [includeSubfields, setIncludeSubfields] = useState(true);
  const [queue, setQueue] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    listFields().then(setFields).catch((err) => setError(err.message));
  }, []);

  async function loadQueue() {
    setError(null);
    try {
      const data = await getStudyQueue({ fieldId: fieldId || undefined, includeSubfields });
      setQueue(data);
      setRevealed(false);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId, includeSubfields]);

  const current = queue[0];

  async function handleReview(status) {
    if (!current) return;
    setError(null);
    try {
      await submitReview(current.id, status);
      setQueue((prev) => prev.slice(1));
      setRevealed(false);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Study</h2>
      {error && <p className="error">{error}</p>}

      <div className="study-filters">
        <select value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
          <option value="">All fields</option>
          {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <label>
          <input
            type="checkbox"
            checked={includeSubfields}
            onChange={(e) => setIncludeSubfields(e.target.checked)}
          />
          Include subfields
        </label>
        <button type="button" onClick={loadQueue}>Refresh queue</button>
      </div>

      {!current && <p>No cards due right now.</p>}

      {current && (
        <div className="study-card">
          <p className="prompt">{cardPrompt(current)}</p>

          {cardAnswer(current) && !revealed && (
            <button type="button" onClick={() => setRevealed(true)}>Reveal answer</button>
          )}
          {cardAnswer(current) && revealed && <p className="answer">{cardAnswer(current)}</p>}

          <div className="review-buttons">
            <button type="button" onClick={() => handleReview('hard')}>Hard</button>
            <button type="button" onClick={() => handleReview('medium')}>Medium</button>
            <button type="button" onClick={() => handleReview('easy')}>Easy</button>
          </div>

          <p className="queue-count">{queue.length} card(s) left in this batch</p>
        </div>
      )}
    </div>
  );
}
