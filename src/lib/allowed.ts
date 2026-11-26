export function isAllowedEmail(email: string | null | undefined) {
  const list = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return false;
  return !!email && list.includes(email.trim().toLowerCase());
}
