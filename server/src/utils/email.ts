import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const smtpHost = process.env.SMTP_HOST || 'smtp.xfx.com';
const smtpPort = Number(process.env.SMTP_PORT) || 465;
const smtpUser = process.env.SMTP_USER || 'support@xfx.com';
const smtpPass = process.env.SMTP_PASS || '';

// Create transporter
const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465, // true for 465, false for other ports
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

/**
 * Sends a transaction notification email to a user.
 */
export async function sendEmailNotification(to: string, subject: string, htmlContent: string) {
  if (!smtpPass) {
    console.warn("SMTP_PASS is not configured, skipping email delivery.");
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Xfx ExtremeTrader" <${smtpUser}>`,
      to,
      subject,
      html: htmlContent,
    });
    console.log(`Email successfully sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("Error sending email notification:", error);
  }
}
