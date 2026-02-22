export function formatSeconds(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export function parseJson(raw, fallbackValue) {
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return fallbackValue;
  }
}

export function sessionKeyForVariant(variantId) {
  return `oge_variant_session_${variantId}`;
}
