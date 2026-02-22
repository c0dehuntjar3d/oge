const API_BASE = '';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || 'Ошибка запроса.');
  }

  return payload;
}

export function getMeta() {
  return request('/api/meta');
}

export function getVariants() {
  return request('/api/variants');
}

export function getPracticeTask(examNumber, excludeTaskId) {
  const params = new URLSearchParams({ examNumber: String(examNumber) });
  if (excludeTaskId) {
    params.set('excludeTaskId', String(excludeTaskId));
  }
  return request(`/api/tasks/practice?${params.toString()}`);
}

export function checkTask(taskId, answer) {
  return request('/api/check/task', {
    method: 'POST',
    body: JSON.stringify({ taskId, answer })
  });
}

export function getVariant(variantId) {
  return request(`/api/variants/${variantId}`);
}

export function checkVariant(variantId, answers) {
  return request('/api/check/variant', {
    method: 'POST',
    body: JSON.stringify({ variantId, answers })
  });
}
