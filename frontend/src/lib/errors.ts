/** Pulls `message` out of a JSON error body; request errors carry the raw body. */
export const readError = (error: unknown, fallback: string) => {
  if (!(error instanceof Error)) return fallback;
  try {
    return (JSON.parse(error.message) as { message?: string }).message ?? fallback;
  } catch {
    return error.message || fallback;
  }
};
