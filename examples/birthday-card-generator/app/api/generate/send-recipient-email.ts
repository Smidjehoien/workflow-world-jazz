import { Resend } from 'resend';
import { generatePostcardEmailTemplate } from '@/lib/template';

type RsvpReply = {
  email: string;
  reply: string;
};

type RecipientEmailParams = {
  recipientEmail: string;
  cardImage: string;
  cardText: string;
  rsvpReplies: RsvpReply[];
};

export const sendRecipientEmail = async ({
  recipientEmail,
  cardImage,
  cardText,
  rsvpReplies,
}: RecipientEmailParams) => {
  'use step';

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    console.log(`[STEP] Sending birthday card to recipient: ${recipientEmail}`);
    console.log(`[STEP] RSVP replies:`, rsvpReplies);

    // Format RSVP replies for display
    const rsvpSummary = rsvpReplies
      .map(({ email, reply }) => `${email}: ${reply}`)
      .join('\n');

    await resend.emails.send({
      from: 'Vercel <birthday-card-generator@vercel.com>',
      to: recipientEmail,
      subject: 'Happy Birthday!',
      react: generatePostcardEmailTemplate(
        'Happy Birthday',
        `${cardText}\n\nRSVP Replies:\n${rsvpSummary}`,
        'Click here to accept and send it',
        'https://example.com'
      ),
    });

    console.log('[STEP] Birthday card email sent successfully');

    return {
      success: true,
      recipientEmail,
      sentAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[STEP] Error sending recipient email:', message);
    throw error;
  }
};
