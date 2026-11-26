// Telegram sign-ins have no real email: the backend stores a placeholder
// (tg<id>@telegram.invalid) that should never be shown to people.
export const isPlaceholderEmail = (email) => !!email && email.endsWith('@telegram.invalid');

/** What to show where an email would go: the email, or "Telegram · @username". */
export const contactLabel = (u) => {
  if (!u) return '';
  if (isPlaceholderEmail(u.email)) return u.username ? `Telegram · @${u.username}` : 'Telegram account';
  return u.email || '';
};
