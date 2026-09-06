import { useEffect, useState } from 'react';
import {
  listStudySessions,
  getOpenStudySession,
  getStudySession,
  startStudySession,
  endStudySession,
  getNextStudyCard,
  submitSessionReview,
  generateForSessionCard,
} from '../api/study';
import { listFields } from '../api/knowledgeFields';
import { listResources } from '../api/resources';
import MarkdownView from '../components/MarkdownView';

const RESOURCE_TYPE_LABELS = {
  youtube: 'YouTube',
  book: 'Book',
  article: 'Article',
  ai: 'AI',
  other: 'Other',
};

function getResourceTypeLabel(type) {
  return RESOURCE_TYPE_LABELS[type] || type;
}

function cardPrompt(card) {
  if (!card) return '';
  if (card.type === 'plain') return card.content;
  if (card.type === 'front_back') return card.front;
  if (card.type === 'cloze') return card.cloze_text;
  return '(custom card)';
}

function cardAnswer(card) {
  if (card.type === 'front_back') return card.back;
  return null;
}

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString();
}

export default function StudyPage() {
  const [fields, setFields] = useState([]);
  const [resources, setResources] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [openSession, setOpenSession] = useState(null);
  const [error, setError] = useState(null);

  const [scopeType, setScopeType] = useState('all');
  const [scopeFieldId, setScopeFieldId] = useState('');
  const [includeSubfields, setIncludeSubfields] = useState(true);
  const [scopeResourceId, setScopeResourceId] = useState('');

  const [activeSession, setActiveSession] = useState(null);
  const [progress, setProgress] = useState(null);
  const [currentCard, setCurrentCard] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [generated, setGenerated] = useState(null);

  const [viewingSession, setViewingSession] = useState(null);

  async function refreshSessions() {
    try {
      setSessions(await listStudySessions());
    } catch (err) {
      setError(err.message);
    }
  }

  async function refreshAll() {
    setError(null);
    try {
      const [fieldsData, resourcesData, sessionsData, open] = await Promise.all([
        listFields(),
        listResources(),
        listStudySessions(),
        getOpenStudySession(),
      ]);
      setFields(fieldsData);
      setResources(resourcesData);
      setSessions(sessionsData);
      setOpenSession(open);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  async function loadNextCard(sessionId) {
    const card = await getNextStudyCard(sessionId);
    setCurrentCard(card);
    setRevealed(false);
    setGenerated(null);
  }

  async function enterSession(session) {
    setError(null);
    try {
      const detail = await getStudySession(session.id);
      setActiveSession(session);
      setOpenSession(null);
      setProgress({
        total_cards_in_scope: detail.total_cards_in_scope,
        reviewed_card_count: detail.reviewed_card_count,
        all_reviewed: detail.all_reviewed,
      });
      await loadNextCard(session.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleStartSession(e) {
    e.preventDefault();
    setError(null);
    try {
      const payload = { scope_type: scopeType };
      if (scopeType === 'field') {
        payload.scope_field_id = scopeFieldId;
        payload.include_subfields = includeSubfields;
      }
      if (scopeType === 'resource') {
        payload.scope_resource_id = scopeResourceId;
      }
      const session = await startStudySession(payload);
      setOpenSession(null);
      await enterSession(session);
      await refreshSessions();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleResumeSession() {
    if (!openSession) return;
    await enterSession(openSession);
  }

  async function handleEndSession() {
    if (!activeSession) return;
    setError(null);
    try {
      await endStudySession(activeSession.id);
    } catch (err) {
      setError(err.message);
    }
    setActiveSession(null);
    setCurrentCard(null);
    setProgress(null);
    setOpenSession(null);
    await refreshSessions();
  }

  async function handleReview(status) {
    if (!currentCard || !activeSession) return;
    setError(null);
    try {
      const updatedProgress = await submitSessionReview(activeSession.id, currentCard.id, status);
      setProgress(updatedProgress);
      await loadNextCard(activeSession.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerate() {
    if (!currentCard || !activeSession) return;
    setError(null);
    try {
      setGenerated(await generateForSessionCard(activeSession.id, currentCard.id, 'random'));
    } catch (err) {
      setError(err.message);
    }
  }

  async function openSessionDetail(sessionId) {
    setError(null);
    try {
      setViewingSession(await getStudySession(sessionId));
    } catch (err) {
      setError(err.message);
    }
  }

  function closeSessionDetail() {
    setViewingSession(null);
  }

  const canStart =
    scopeType === 'all' ||
    (scopeType === 'field' && scopeFieldId) ||
    (scopeType === 'resource' && scopeResourceId);

  return (
    <div>
      <h2>Study</h2>
      {error && <p className="error">{error}</p>}

      {openSession && (
        <div className="study-open-banner">
          <p className="hint">
            Open session since {formatDateTime(openSession.started_at)} — {openSession.scope_description}
          </p>
          <button type="button" onClick={handleResumeSession}>Continue session</button>
        </div>
      )}

      <form className="study-filters" onSubmit={handleStartSession}>
        <select value={scopeType} onChange={(e) => setScopeType(e.target.value)}>
          <option value="all">All cards</option>
          <option value="field">Knowledge field</option>
          <option value="resource">Resource</option>
        </select>

        {scopeType === 'field' && (
          <>
            <select value={scopeFieldId} onChange={(e) => setScopeFieldId(e.target.value)}>
              <option value="">Select a field...</option>
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
          </>
        )}

        {scopeType === 'resource' && (
          <select value={scopeResourceId} onChange={(e) => setScopeResourceId(e.target.value)}>
            <option value="">Select a resource...</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>[{getResourceTypeLabel(r.type)}] {r.title}</option>
            ))}
          </select>
        )}

        <button type="submit" disabled={!canStart}>Start new session</button>
      </form>

      <h3>Session history</h3>
      <ul className="list">
        {sessions.map((s) => (
          <li key={s.id} className="list-item">
            <span>
              {formatDateTime(s.started_at)} — {s.scope_description} — {s.reviewed_card_count}/{s.total_cards_in_scope} cards
              {!s.ended_at && ' (open)'}
            </span>
            <button type="button" onClick={() => openSessionDetail(s.id)}>View</button>
          </li>
        ))}
        {sessions.length === 0 && <p className="hint">No study sessions yet.</p>}
      </ul>

      {activeSession && (
        <div className="modal-overlay" onClick={handleEndSession}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Session started {formatDateTime(activeSession.started_at)}</h3>
            <p className="hint">{activeSession.scope_description}</p>

            {progress && (
              <p className="hint">
                {progress.reviewed_card_count} / {progress.total_cards_in_scope} cards reviewed at least once
                {progress.all_reviewed && ' — you\'ve gone through all of them. Keep going or end the session.'}
              </p>
            )}

            {!currentCard && <p>No cards in this scope.</p>}

            {currentCard && (
              <div className="study-card">
                <MarkdownView className="prompt" content={cardPrompt(currentCard)} />

                {cardAnswer(currentCard) && !revealed && (
                  <button type="button" onClick={() => setRevealed(true)}>Reveal answer</button>
                )}
                {cardAnswer(currentCard) && revealed && (
                  <MarkdownView className="answer" content={cardAnswer(currentCard)} />
                )}

                <div className="review-buttons">
                  <button type="button" onClick={() => handleReview('hard')}>Hard</button>
                  <button type="button" onClick={() => handleReview('medium')}>Medium</button>
                  <button type="button" onClick={() => handleReview('easy')}>Easy</button>
                </div>

                {currentCard.type === 'plain' && (
                  <div className="generate-section">
                    <button type="button" onClick={handleGenerate}>Generate (LLM)</button>
                    {generated && (
                      <pre className="generated">{generated.mode}: {generated.generated_content}</pre>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="danger" onClick={handleEndSession}>End session</button>
            </div>
          </div>
        </div>
      )}

      {viewingSession && (
        <div className="modal-overlay" onClick={closeSessionDetail}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Session {formatDateTime(viewingSession.started_at)}</h3>
            <p className="hint">
              {viewingSession.scope_description} — {viewingSession.reviewed_card_count}/{viewingSession.total_cards_in_scope} cards
              {viewingSession.ended_at ? ` — ended ${formatDateTime(viewingSession.ended_at)}` : ' — still open'}
            </p>
            <ul className="list">
              {viewingSession.reviews.map((r) => (
                <li key={r.id} className="list-item">
                  <span>
                    <strong>[{r.status}]</strong> {formatDateTime(r.reviewed_at)} —{' '}
                    {r.card ? (cardPrompt(r.card) || '').slice(0, 80) : `Card #${r.card_id} (deleted)`}
                  </span>
                </li>
              ))}
              {viewingSession.reviews.length === 0 && <p className="hint">No cards were reviewed in this session.</p>}
            </ul>
            <div className="modal-actions">
              <button type="button" onClick={closeSessionDetail}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
