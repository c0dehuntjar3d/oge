const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const seedData = require('./seed-data.json');

const DATA_DIR = path.resolve(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'app.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function runCallback(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

async function createSchema() {
  await run('PRAGMA foreign_keys = OFF');
  await run('DROP TABLE IF EXISTS tasks');
  await run('DROP TABLE IF EXISTS variants');
  await run('DROP TABLE IF EXISTS users');
  await run('PRAGMA foreign_keys = ON');

  await run(`
    CREATE TABLE IF NOT EXISTS variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      source_test_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      variant_id INTEGER NOT NULL,
      exam_number INTEGER NOT NULL,
      source_problem_id INTEGER,
      prompt TEXT NOT NULL,
      prompt_html TEXT NOT NULL DEFAULT '',
      answer TEXT,
      is_checkable INTEGER NOT NULL DEFAULT 1,
      image_paths TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE CASCADE
    )
  `);

  await run('CREATE INDEX IF NOT EXISTS idx_tasks_variant ON tasks (variant_id, exam_number)');
  await run('CREATE INDEX IF NOT EXISTS idx_tasks_exam_number ON tasks (exam_number)');
}

async function seedVariantsIfEmpty() {
  for (const variant of seedData.variants) {
    const insertVariant = await run(
      'INSERT INTO variants (title, source_test_id) VALUES (?, ?)',
      [variant.title, variant.sourceTestId]
    );

    const variantId = insertVariant.lastID;
    for (const task of variant.tasks) {
      await run(
        `INSERT INTO tasks (
          variant_id,
          exam_number,
          source_problem_id,
          prompt,
          prompt_html,
          answer,
          is_checkable,
          image_paths
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          variantId,
          task.examNumber,
          task.sourceProblemId,
          task.prompt,
          task.promptHtml || '',
          task.answer ?? null,
          task.isCheckable ? 1 : 0,
          JSON.stringify(task.imagePaths || [])
        ]
      );
    }
  }

  console.log('[db] Seeded variants and tasks from sdamgia');
}

async function initDb() {
  await createSchema();
  await seedVariantsIfEmpty();
}

module.exports = {
  db,
  run,
  get,
  all,
  initDb,
  DB_PATH
};
