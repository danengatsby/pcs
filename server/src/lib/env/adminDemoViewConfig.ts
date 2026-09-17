export function readAdminDemoDatabaseUrl(
  raw: string | undefined,
  primaryDatabaseUrl: string,
  nodeEnv: string,
): string {
  const value = raw?.trim() ?? "";
  if (!value) { return ""; }
  try {
    const url = new URL(value);
    const database = decodeURIComponent(url.pathname.slice(1));
    const primaryDatabase = decodeURIComponent(new URL(primaryDatabaseUrl).pathname.slice(1));
    if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || !/(^|[_-])demo([_-]|$)/i.test(database)
      || database === primaryDatabase
      || (nodeEnv === "test" && !/(^|[_-])(test|testing)([_-]|$)/i.test(database))) {
      throw new Error("invalid");
    }
    return value;
  } catch {
    throw new Error("ADMIN_DEMO_DATABASE_URL necesită o bază demo separată; în teste trebuie să fie și o bază de test.");
  }
}
