import type { Webhook } from '@vercel/workflow';
import { Resend } from 'resend';
import { generateRsvpEmailTemplate } from '@/lib/template';

export const requestRsvp = async (email: string, webhook: Webhook<Request>) => {
  'use step';

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    console.log(`[STEP] Sending RSVP email to: ${email}`);

    // Get webhook URL from the workflow environment
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/.well-known/workflow/v1/webhook/${webhook.token}`
      : `http://localhost:3000/.well-known/workflow/v1/webhook/${webhook.token}`;

    console.log(`[STEP] Webhook URL for ${email}: ${baseUrl}`);

    await resend.emails.send({
      from: 'Vercel <birthday-card-generator@vercel.com>',
      to: email,
      subject: "You're Invited to a Birthday Party!",
      html: generateRsvpEmailTemplate(email, webhook.token, baseUrl),
    });

    console.log(`[STEP] RSVP email sent successfully to: ${email}`);
    return { email, success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[STEP] Error sending RSVP emails:', message);
    throw error;
  }
};
