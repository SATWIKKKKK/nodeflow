/**
 * Transactional email through Resend. With no RESEND_API_KEY the message is
 * logged instead of sent, so local development still shows the reset link.
 */

const FROM = process.env.NOESIS_EMAIL_FROM ?? "Noesis <onboarding@resend.dev>";

export const emailsEnabled = () => Boolean(process.env.RESEND_API_KEY);

/** The address learners land on; used to build links inside emails. */
export const appUrl = () => {
  const configured = process.env.NOESIS_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return production ? `https://${production}` : "http://localhost:5173";
};

export const sendEmail = async (to: string, subject: string, text: string): Promise<boolean> => {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email not sent: no RESEND_API_KEY] to=${to} subject=${subject}\n${text}`);
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, text })
    });
    if (!response.ok) {
      console.error(`Resend refused the message (${response.status}): ${(await response.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Could not reach Resend:", error instanceof Error ? error.message : error);
    return false;
  }
};
