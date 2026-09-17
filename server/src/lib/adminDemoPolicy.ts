export function assertAdminDemoEnvironment(input: {
  nodeEnv: string; databaseUrl: string; enabled: boolean; emailNotificationsEnabled: boolean;
}): void {
  if (!input.enabled) { return; }
  if (input.nodeEnv === "production") {
    throw new Error("ADMIN_DEMO_DATA_ALLOWED este interzis în producție. Folosește o instanță demo separată.");
  }
  const database = decodeURIComponent(new URL(input.databaseUrl).pathname.slice(1));
  const dedicated = /(^|[_-])demo([_-]|$)/i.test(database)
    || (input.nodeEnv === "test" && /(^|[_-])(test|testing)([_-]|$)/i.test(database));
  if (!dedicated) {
    throw new Error("Datele demo necesită o bază dedicată cu segmentul demo în nume.");
  }
  if (input.emailNotificationsEnabled) {
    throw new Error("Instanța demo necesită EMAIL_NOTIFICATIONS_ENABLED=false.");
  }
}
