const nodemailer = require('nodemailer');
const logger = require('./logger');

const createTransporter = () => {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const service = process.env.EMAIL_SERVICE;
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!user || !pass) {
    return null;
  }

  if (service) {
    return nodemailer.createTransport({
      service,
      auth: { user, pass },
    });
  }

  if (host) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  // Default to gmail service if user & pass provided without custom host
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
};

const sendOtpEmail = async (email, otp, username = 'Developer') => {
  const transporter = createTransporter();

  if (!transporter) {
    logger.warn(`SMTP credentials not configured. Running in simulation mode for recipient: '${email}'`, null, 'MAILER');
    console.log(`
┌──────────────────────────────────────────────────────────┐
│  [CodeCollab OTP Service - Simulation Mode]              │
│  SMTP credentials not configured in .env                 │
│  Recipient: ${email.padEnd(45)}│
│  Verification Code: ${otp}                                │
│  Validity: 10 minutes                                    │
│  (Configure SMTP_USER & SMTP_PASS in .env for emails)    │
└──────────────────────────────────────────────────────────┘
`);
    return { success: true, simulated: true, otp };
  }

  const fromName = process.env.EMAIL_FROM_NAME || 'CodeCollab';
  const fromEmail = process.env.SMTP_USER || process.env.EMAIL_USER;
  const from = process.env.EMAIL_FROM || `"${fromName}" <${fromEmail}>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CodeCollab Verification Code</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0b0c10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0b0c10; padding: 40px 15px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #12141c; border-radius: 16px; border: 1px solid #1f2433; box-shadow: 0 10px 40px rgba(0,0,0,0.4); overflow: hidden;">
              <!-- Header -->
              <tr>
                <td style="padding: 36px 36px 20px 36px; text-align: center; border-bottom: 1px solid #1a2030;">
                  <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                    <span style="color: #3b82f6;">Code</span>Collab
                  </h1>
                  <p style="margin: 6px 0 0 0; font-size: 13px; color: #8892b0;">
                    Real-time Cloud Coding & Collaboration
                  </p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding: 32px 36px;">
                  <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: #ffffff; text-align: center;">
                    Verify your email address
                  </h2>
                  <p style="margin: 0 0 28px 0; font-size: 14px; line-height: 1.6; color: #94a3b8; text-align: center;">
                    Hi <strong style="color: #f1f5f9;">${username}</strong>,<br/>
                    Thank you for signing up! Enter the 6-digit verification code below to verify your email and activate your account.
                  </p>

                  <!-- OTP Box -->
                  <div style="text-align: center; margin: 0 0 28px 0;">
                    <div style="display: inline-block; background-color: #090a0f; border: 2px solid #3b82f6; border-radius: 12px; padding: 16px 28px; box-shadow: 0 0 25px rgba(59, 130, 246, 0.25);">
                      <span style="font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace; font-size: 34px; font-weight: 700; color: #60a5fa; letter-spacing: 10px; margin-left: 10px;">${otp}</span>
                    </div>
                  </div>

                  <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.5; color: #64748b; text-align: center;">
                    ⏳ This code will expire in <strong style="color: #cbd5e1;">10 minutes</strong>.
                  </p>
                  <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #475569; text-align: center;">
                    If you didn't create a CodeCollab account, please disregard this email.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 36px 28px 36px; text-align: center; border-top: 1px solid #1a2030; background-color: #0e1017;">
                  <p style="margin: 0; font-size: 12px; color: #475569;">
                    © ${new Date().getFullYear()} CodeCollab. Secure collaborative workspace.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const info = await transporter.sendMail({
    from,
    to: email,
    subject: `${otp} is your CodeCollab verification code`,
    text: `Hi ${username},\n\nYour CodeCollab 6-digit email verification code is: ${otp}\n\nThis code will expire in 10 minutes.\nIf you did not request this code, you can ignore this email.`,
    html,
  });

  logger.info(`Verification email sent successfully to '${email}'. MessageId: ${info.messageId}`, null, 'MAILER');
  return { success: true, messageId: info.messageId };
};

module.exports = {
  sendOtpEmail,
};
