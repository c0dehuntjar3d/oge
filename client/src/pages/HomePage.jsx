import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMeta } from '../api';

export default function HomePage() {
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getMeta()
      .then((payload) => {
        if (!cancelled) {
          setMeta(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMeta({ examTaskCount: 15, variantsCount: 10, examDurationSeconds: 9000 });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="container page-grid">
      <section className="hero panel">
        <p className="eyebrow">Подготовка к ОГЭ</p>
        <h1>Тренируй информатику по реальным вариантам</h1>
        <p className="hero-text">
          Платформа содержит варианты с заданиями из раздела ОГЭ по информатике. Доступны
          тренажер по номеру задания и полноценный режим решения варианта с лимитом 2 часа 30
          минут.
        </p>
        <div className="hero-badges">
          <span>{meta?.variantsCount ?? 10} вариантов</span>
          <span>{meta?.examTaskCount ?? 15} заданий в варианте</span>
          <span>Таймер 2:30</span>
        </div>
        <div className="hero-actions">
          <Link to="/practice" className="btn btn-primary">
            Тренироваться
          </Link>
          <Link to="/variant" className="btn btn-secondary">
            Решить полный вариант
          </Link>
        </div>
      </section>

      <section className="panel info-grid">
        <article>
          <h3>Режим 1: тренажер</h3>
          <p>Выбираешь номер задания, решаешь сколько угодно раз, сразу видишь правильный ответ.</p>
        </article>
        <article>
          <h3>Режим 2: полный вариант</h3>
          <p>
            Решаешь целиком вариант с таймером 2 часа 30 минут, по кнопке проверки получаешь
            результат.
          </p>
        </article>
      </section>
    </main>
  );
}
