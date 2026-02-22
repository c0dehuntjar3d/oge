require('dotenv').config();

const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { all, get, initDb } = require('./db');

const app = express();
const port = Number(process.env.PORT || 3000);
const EXAM_DURATION_SECONDS = 2 * 60 * 60 + 30 * 60;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '2mb' }));

function normalizeAnswer(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, '');
}

function isCorrect(userAnswer, expectedAnswer) {
  return normalizeAnswer(userAnswer) === normalizeAnswer(expectedAnswer);
}

function parseExamNumber(raw) {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

function toAnswersMap(rawAnswers) {
  if (!rawAnswers || typeof rawAnswers !== 'object') {
    return {};
  }

  if (Array.isArray(rawAnswers)) {
    const mapped = {};
    for (const item of rawAnswers) {
      if (!item || typeof item !== 'object') continue;
      const taskId = Number(item.taskId);
      if (!Number.isInteger(taskId)) continue;
      mapped[taskId] = String(item.answer ?? '');
    }
    return mapped;
  }

  return rawAnswers;
}

function parseImagePaths(rawValue) {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === 'string' && item.trim() !== '');
    }
  } catch (_error) {
    return [];
  }

  return [];
}

function hydrateTask(task) {
  if (!task) return null;
  return {
    ...task,
    isCheckable: Boolean(task.isCheckable),
    imagePaths: parseImagePaths(task.imagePaths)
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/meta', async (_req, res, next) => {
  try {
    const taskStats = await get('SELECT MAX(exam_number) AS examTaskCount FROM tasks');
    const variantStats = await get('SELECT COUNT(*) AS variantsCount FROM variants');

    res.json({
      examTaskCount: taskStats?.examTaskCount || 0,
      variantsCount: variantStats?.variantsCount || 0,
      examDurationSeconds: EXAM_DURATION_SECONDS
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/variants', async (_req, res, next) => {
  try {
    const variants = await all(
      `SELECT
        v.id,
        v.title,
        v.source_test_id AS sourceTestId,
        COUNT(t.id) AS taskCount
      FROM variants v
      LEFT JOIN tasks t ON t.variant_id = v.id
      GROUP BY v.id
      ORDER BY v.id`
    );

    res.json({ variants });
  } catch (error) {
    next(error);
  }
});

app.get('/api/tasks/practice', async (req, res, next) => {
  try {
    const examNumber = parseExamNumber(req.query.examNumber);
    const excludeTaskId = Number(req.query.excludeTaskId || 0);

    if (!examNumber) {
      return res.status(400).json({ error: 'Неверный номер задания.' });
    }

    let task = null;
    if (Number.isInteger(excludeTaskId) && excludeTaskId > 0) {
      task = await get(
        `SELECT
          id,
          exam_number AS examNumber,
          variant_id AS variantId,
          prompt,
          prompt_html AS promptHtml,
          is_checkable AS isCheckable,
          image_paths AS imagePaths
         FROM tasks
         WHERE exam_number = ? AND id != ?
         ORDER BY RANDOM()
         LIMIT 1`,
        [examNumber, excludeTaskId]
      );
    }

    if (!task) {
      task = await get(
        `SELECT
          id,
          exam_number AS examNumber,
          variant_id AS variantId,
          prompt,
          prompt_html AS promptHtml,
          is_checkable AS isCheckable,
          image_paths AS imagePaths
         FROM tasks
         WHERE exam_number = ?
         ORDER BY RANDOM()
         LIMIT 1`,
        [examNumber]
      );
    }

    if (!task) {
      return res.status(404).json({ error: 'Задание не найдено.' });
    }

    return res.json({ task: hydrateTask(task) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/check/task', async (req, res, next) => {
  try {
    const taskId = Number(req.body.taskId);
    const userAnswer = String(req.body.answer ?? '');

    if (!Number.isInteger(taskId) || taskId < 1) {
      return res.status(400).json({ error: 'Некорректный taskId.' });
    }

    const task = await get(
      'SELECT id, answer, is_checkable AS isCheckable FROM tasks WHERE id = ?',
      [taskId]
    );

    if (!task) {
      return res.status(404).json({ error: 'Задание не найдено.' });
    }

    if (!task.isCheckable) {
      return res.json({
        taskId,
        checkable: false,
        message: 'Для этого задания автоматическая проверка не предусмотрена.'
      });
    }

    const correct = isCorrect(userAnswer, task.answer);
    return res.json({
      taskId,
      checkable: true,
      correct,
      correctAnswer: task.answer
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/variants/:variantId', async (req, res, next) => {
  try {
    const variantId = Number(req.params.variantId);
    if (!Number.isInteger(variantId) || variantId < 1) {
      return res.status(400).json({ error: 'Некорректный ID варианта.' });
    }

    const variant = await get(
      'SELECT id, title, source_test_id AS sourceTestId FROM variants WHERE id = ?',
      [variantId]
    );

    if (!variant) {
      return res.status(404).json({ error: 'Вариант не найден.' });
    }

    const tasks = await all(
      `SELECT
        id,
        exam_number AS examNumber,
        prompt,
        prompt_html AS promptHtml,
        is_checkable AS isCheckable,
        image_paths AS imagePaths
       FROM tasks
       WHERE variant_id = ?
       ORDER BY exam_number`,
      [variantId]
    );

    return res.json({
      variant,
      tasks: tasks.map(hydrateTask),
      examDurationSeconds: EXAM_DURATION_SECONDS
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/check/variant', async (req, res, next) => {
  try {
    const variantId = Number(req.body.variantId);
    if (!Number.isInteger(variantId) || variantId < 1) {
      return res.status(400).json({ error: 'Некорректный ID варианта.' });
    }

    const answersMap = toAnswersMap(req.body.answers);

    const tasks = await all(
      `SELECT
        id,
        exam_number AS examNumber,
        answer,
        is_checkable AS isCheckable
       FROM tasks
       WHERE variant_id = ?
       ORDER BY exam_number`,
      [variantId]
    );

    if (!tasks.length) {
      return res.status(404).json({ error: 'Вариант не найден или пуст.' });
    }

    const details = tasks.map((task) => {
      const userAnswer = String(answersMap[task.id] ?? '');

      if (!task.isCheckable) {
        return {
          taskId: task.id,
          examNumber: task.examNumber,
          userAnswer,
          correctAnswer: null,
          correct: null,
          isCheckable: false,
          message: 'Проверяется вручную.'
        };
      }

      const correct = isCorrect(userAnswer, task.answer);
      return {
        taskId: task.id,
        examNumber: task.examNumber,
        userAnswer,
        correctAnswer: task.answer,
        correct,
        isCheckable: true
      };
    });

    const score = details.filter((item) => item.isCheckable && item.correct).length;
    const maxScore = details.filter((item) => item.isCheckable).length;
    const manualTasksCount = details.filter((item) => !item.isCheckable).length;

    return res.json({
      variantId,
      maxScore,
      score,
      manualTasksCount,
      details
    });
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    error: 'Внутренняя ошибка сервера.'
  });
});

const publicDir = path.resolve(__dirname, '../public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));

  app.get(/^\/(?!api).*/, (req, res) => {
    const indexFile = path.join(publicDir, 'index.html');
    res.sendFile(indexFile);
  });
}

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`[server] listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('[server] failed to initialize', error);
    process.exit(1);
  });
