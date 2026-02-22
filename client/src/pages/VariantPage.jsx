import { useEffect, useMemo, useRef, useState } from 'react';
import { checkVariant, getVariant, getVariants } from '../api';
import TaskPrompt from '../components/TaskPrompt';
import { formatSeconds, parseJson, sessionKeyForVariant } from '../utils';

export default function VariantPage() {
  const [variants, setVariants] = useState([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [variantData, setVariantData] = useState(null);
  const [session, setSession] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    getVariants()
      .then((payload) => {
        if (cancelled) return;
        const loadedVariants = payload.variants || [];
        setVariants(loadedVariants);
        if (loadedVariants.length > 0) {
          setSelectedVariantId(String(loadedVariants[0].id));
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session || result) {
      return undefined;
    }

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [session, result]);

  const secondsLeft = useMemo(() => {
    if (!session || !variantData) return 0;
    const elapsed = Math.floor((now - session.startAt) / 1000);
    return Math.max(0, variantData.examDurationSeconds - elapsed);
  }, [now, session, variantData]);

  const unansweredCount = useMemo(() => {
    if (!variantData || !session) return 0;

    return variantData.tasks.reduce((count, task) => {
      const raw = session.answers[task.id];
      if (String(raw ?? '').trim() === '') {
        return count + 1;
      }
      return count;
    }, 0);
  }, [variantData, session]);

  useEffect(() => {
    if (!session || !variantData || result || submitting) {
      return;
    }

    if (secondsLeft <= 0 && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      submitVariant(true);
    }
  }, [secondsLeft, session, variantData, result, submitting]);

  function updateSession(nextSession) {
    setSession(nextSession);
    const key = sessionKeyForVariant(nextSession.variantId);
    localStorage.setItem(key, JSON.stringify(nextSession));
  }

  async function startVariant() {
    if (!selectedVariantId) {
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    autoSubmittedRef.current = false;

    try {
      const variantId = Number(selectedVariantId);
      const payload = await getVariant(variantId);
      setVariantData(payload);

      const key = sessionKeyForVariant(variantId);
      const raw = localStorage.getItem(key);
      const cached = parseJson(raw, null);

      const nowTs = Date.now();
      const isCachedValid =
        cached &&
        typeof cached === 'object' &&
        cached.variantId === variantId &&
        Number.isInteger(cached.startAt) &&
        nowTs - cached.startAt < payload.examDurationSeconds * 1000;

      const nextSession = isCachedValid
        ? { variantId, startAt: cached.startAt, answers: cached.answers || {} }
        : { variantId, startAt: nowTs, answers: {} };

      localStorage.setItem(key, JSON.stringify(nextSession));
      setSession(nextSession);
      setNow(nowTs);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitVariant(isAutomatic = false) {
    if (!session || !variantData) {
      return;
    }

    if (!isAutomatic && unansweredCount > 0) {
      const confirmSubmit = window.confirm(
        `Есть ${unansweredCount} незаполненных ответов. Проверить вариант сейчас?`
      );
      if (!confirmSubmit) {
        return;
      }
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = await checkVariant(session.variantId, session.answers);
      setResult(payload);
      localStorage.removeItem(sessionKeyForVariant(session.variantId));
      setSession(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetAttempt() {
    if (!selectedVariantId) {
      return;
    }

    const variantId = Number(selectedVariantId);
    localStorage.removeItem(sessionKeyForVariant(variantId));
    setSession(null);
    setResult(null);
    setVariantData(null);
    autoSubmittedRef.current = false;
  }

  return (
    <main className="container page-grid">
      <section className="panel">
        <h1>Полный вариант ОГЭ</h1>
        <p className="page-subtitle">
          Выбери вариант, запусти попытку и решай задания в течение 2 часов 30 минут. Прогресс
          хранится в браузере, поэтому можно обновить страницу и продолжить.
        </p>

        <label htmlFor="variant-select" className="label">
          Вариант
        </label>
        <select
          id="variant-select"
          className="input"
          value={selectedVariantId}
          onChange={(event) => setSelectedVariantId(event.target.value)}
          disabled={Boolean(session)}
        >
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.title} (#{variant.id})
            </option>
          ))}
        </select>

        {!session && !result ? (
          <div className="row-actions">
            <button type="button" className="btn btn-primary" onClick={startVariant} disabled={loading}>
              {loading ? 'Загрузка...' : 'Начать решать вариант'}
            </button>
          </div>
        ) : null}

        {session && variantData ? (
          <>
            <div className={`timer-box ${secondsLeft < 300 ? 'danger' : ''}`}>
              До конца попытки: <b>{formatSeconds(secondsLeft)}</b>
            </div>

            <div className="tasks-list">
              {variantData.tasks.map((task) => (
                <article key={task.id} className="task-card">
                  <div className="task-meta">Задание {task.examNumber}</div>
                  {!task.isCheckable ? (
                    <p className="task-note">Это задание второй части: проверяется вручную.</p>
                  ) : null}
                  <TaskPrompt text={task.prompt} html={task.promptHtml} />
                  {!task.promptHtml && Array.isArray(task.imagePaths) && task.imagePaths.length > 0 ? (
                    <div className="task-images">
                      {task.imagePaths.map((imagePath, idx) => (
                        <img
                          key={`${task.id}-image-${idx + 1}`}
                          src={imagePath}
                          alt={`Иллюстрация к заданию ${task.examNumber} (${idx + 1})`}
                          className="task-image"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  ) : null}
                  <label className="label" htmlFor={`answer-${task.id}`}>
                    Ответ
                  </label>
                  <input
                    id={`answer-${task.id}`}
                    className="input"
                    value={String(session.answers[task.id] ?? '')}
                    onChange={(event) => {
                      const nextAnswers = {
                        ...session.answers,
                        [task.id]: event.target.value
                      };
                      updateSession({
                        ...session,
                        answers: nextAnswers
                      });
                    }}
                    placeholder="Введите ответ"
                    autoComplete="off"
                  />
                </article>
              ))}
            </div>

            <div className="row-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => submitVariant(false)}
                disabled={submitting}
              >
                {submitting ? 'Проверка...' : 'Проверить вариант'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetAttempt}>
                Сбросить попытку
              </button>
            </div>
          </>
        ) : null}

        {result ? (
          <section className="result-full panel-subsection">
            <h2>
              Результат: {result.score} / {result.maxScore}
            </h2>
            {result.manualTasksCount ? (
              <p className="muted">
                Заданий второй части (ручная проверка): {result.manualTasksCount}
              </p>
            ) : null}

            <div className="result-list">
              {result.details.map((item) => (
                <div
                  key={item.taskId}
                  className={`result-item ${
                    item.isCheckable ? (item.correct ? 'ok' : 'fail') : 'manual'
                  }`}
                >
                  <span>#{item.examNumber}</span>
                  {item.isCheckable ? (
                    <>
                      <span>{item.correct ? 'Верно' : 'Ошибка'}</span>
                      <span>
                        Твой ответ: <b>{item.userAnswer || '—'}</b>
                      </span>
                      <span>
                        Правильный: <b>{item.correctAnswer}</b>
                      </span>
                    </>
                  ) : (
                    <>
                      <span>Ручная проверка</span>
                      <span>
                        Твой ответ: <b>{item.userAnswer || '—'}</b>
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="row-actions">
              <button type="button" className="btn btn-primary" onClick={startVariant}>
                Начать новую попытку
              </button>
            </div>
          </section>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}
      </section>
    </main>
  );
}
