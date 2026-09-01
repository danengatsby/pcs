function readDatabaseName(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, "")).trim();
  } catch {
    return "";
  }
}

export function assertSafeTestDatabase(input: {
  nodeEnv: string;
  databaseUrl: string;
  testDatabaseUrl: string;
}): void {
  if (input.nodeEnv !== "test") {
    return;
  }

  if (!input.testDatabaseUrl || input.databaseUrl !== input.testDatabaseUrl) {
    throw new Error(
      "Testele care modifica DB necesita TEST_DATABASE_URL explicit; baza aplicatiei nu poate fi folosita ca fallback."
    );
  }

  const databaseName = readDatabaseName(input.databaseUrl);
  if (!/(^|[_-])(test|testing)([_-]|$)/i.test(databaseName)) {
    throw new Error(
      "TEST_DATABASE_URL trebuie sa indice o baza al carei nume contine segmentul 'test' sau 'testing'."
    );
  }
}
