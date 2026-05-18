// VIPOS — pure helpers used by the signup page (PR-2).
// Lives in /utils so the React component file stays exclusively
// component-only (keeps Fast Refresh happy and lint clean).

export function slugify(input) {
  if (typeof input !== 'string') return '';
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining marks
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

export function scorePassword(pw) {
  if (typeof pw !== 'string' || pw.length === 0) return { score: 0, label: '' };
  let score = 0;
  if (pw.length >= 6) score += 1;
  if (pw.length >= 10) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  const label = score <= 1 ? 'Lemah' : score <= 2 ? 'Cukup' : score <= 3 ? 'Kuat' : 'Sangat kuat';
  return { score: Math.min(score, 4), label };
}
