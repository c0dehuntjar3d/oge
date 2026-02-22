import { useEffect, useMemo, useState } from 'react';
import { checkTask, getMeta, getPracticeTask } from '../api';
import TaskPrompt from '../components/TaskPrompt';

export default function PracticePage() {
  const [meta, setMeta] = useState({ examTaskCount: 15 });
  const [examNumber, setExamNumber] = useState(1);
  const [task, setTask] = useState(null);
  const [answer, setAnswer] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [loadingTask, setLoadingTask] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const examNumberOptions = useMemo(() => {
    const count = Number(meta?.examTaskCount || 15);
    return Array.from({ length: count }, (_, idx) => idx + 1);
  }, [meta]);

  async function loadTask(targetExamNumber, excludeTaskId) {
    setLoadingTask(true);
    setError('');

    try {
      const payload = await getPracticeTask(targetExamNumber, excludeTaskId);
      setTask(payload.task);
      setAnswer('');
      setCheckResult(null);
    } catch (requestError) {
      setError(requestError.message);
      setTask(null);
    } finally {
      setLoadingTask(false);
    }
  }

  useEffect(() => {
    getMeta()
      .then((payload) => {
        setMeta(payload);
        if (payload.examTaskCount > 0) {
          setExamNumber(1);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadTask(examNumber, null);
  }, [examNumber]);

  async function onCheckTask(event) {
    event.preventDefault();

    if (!task) return;

    setChecking(true);
    setError('');

    try {
      const payload = await checkTask(task.id, answer);
      setCheckResult(payload);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="container page-grid">
      <section className="panel">
        <h1>Тренажер по номеру задания</h1>
        <p className="page-subtitle">
          Выбери номер задания и решай его много раз. Таймер в этом режиме не используется.
        </p>

        <label className="label" htmlFor="exam-number">
          Номер задания
        </label>
        <select
          id="exam-number"
          className="input"
          value={examNumber}
          onChange={(event) => setExamNumber(Number(event.target.value))}
        >
          {examNumberOptions.map((number) => (
            <option key={number} value={number}>
              Задание {number}
            </option>
          ))}
        </select>

        {loadingTask ? <p className="muted">Загрузка задания...</p> : null}

        {task ? (
          <article className="task-card">
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

            <form className="answer-form" onSubmit={onCheckTask}>
              <label className="label" htmlFor="practice-answer">
                Твой ответ
              </label>
              <input
                id="practice-answer"
                className="input"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Введите ответ"
              />
              <div className="row-actions">
                <button type="submit" className="btn btn-primary" disabled={checking}>
                  {checking ? 'Проверка...' : 'Проверить ответ'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => loadTask(examNumber, task.id)}
                  disabled={loadingTask}
                >
                  Другое задание этого номера
                </button>
              </div>
            </form>

            {checkResult ? (
              checkResult.checkable === false ? (
                <div className="result-box info">
                  <p>{checkResult.message}</p>
                </div>
              ) : (
                <div className={`result-box ${checkResult.correct ? 'ok' : 'fail'}`}>
                  <p>{checkResult.correct ? 'Верно!' : 'Неверно.'}</p>
                  <p>
                    Правильный ответ: <b>{checkResult.correctAnswer}</b>
                  </p>
                </div>
              )
            ) : null}
          </article>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}
      </section>
    </main>
  );
}
