import { Resend } from 'resend';
import { generateRsvpEmailTemplate } from '@/lib/template';

export const requestRsvp = async (email: string, url: string) => {
  'use step';

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    console.log(`[STEP] Sending RSVP email to: ${email}`);

    console.log(`[STEP] Webhook URL for ${email}: ${url}`);

    await resend.emails.send({
      from: 'Vercel <birthday-card-generator@vercel.com>',
      to: email,
      subject: "You're Invited to a Birthday Party!",
      html: generateRsvpEmailTemplate(email, url),
    });

    console.log(`[STEP] RSVP email sent successfully to: ${email}`);
    return { email, success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[STEP] Error sending RSVP emails:', message);
    throw error;
  }
};
