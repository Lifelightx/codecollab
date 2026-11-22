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

const sendAuditAlertEmail = async ({ action, actor, ip, spaceName, details, timestamp }) => {
  const transporter = createTransporter();
  const selfEmail = process.env.SMTP_USER || process.env.EMAIL_USER;

  if (!transporter || !selfEmail) {
    logger.warn(`SMTP credentials not configured. Running audit email simulation for: ${action}`, null, 'MAILER');
    console.log(`
┌──────────────────────────────────────────────────────────┐
│  [CodeCollab Audit Alert - Simulation Mode]              │
│  Self Recipient: ${(selfEmail || 'Not configured').padEnd(40)}│
│  Action: ${action.padEnd(48)}│
│  Codespace: ${spaceName.padEnd(45)}│
│  Actor: ${String(actor?.username || 'Guest').padEnd(49)}│
│  IP: ${String(ip).padEnd(52)}│
│  Details: ${String(details).slice(0, 46).padEnd(47)}│
└──────────────────────────────────────────────────────────┘
`);
    return { success: true, simulated: true };
  }

  const fromName = process.env.EMAIL_FROM_NAME || 'CodeCollab Alerts';
  const from = process.env.EMAIL_FROM || `"${fromName}" <${selfEmail}>`;

  const actorName = actor?.username || actor?.name || 'Guest (Anonymous)';
  const actorEmail = actor?.email || 'N/A';
  const actorRole = actor?.role || (actor?.username === 'admin' ? 'admin' : 'guest');

  let badgeColor = '#3b82f6'; // blue for create
  if (action === 'FILE_UPLOADED') badgeColor = '#10b981'; // green
  if (action === 'FILE_DELETED') badgeColor = '#ef4444'; // red

  const subject = `[CodeCollab Alert] ${action}: in '${spaceName}' by ${actorName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background-color: #0b0c10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; color: #f1f5f9;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0b0c10; padding: 30px 10px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #12141c; border-radius: 12px; border: 1px solid #1f2433; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
              <tr>
                <td style="padding: 24px 28px; border-bottom: 1px solid #1a2030; background-color: #161922;">
                  <span style="display: inline-block; padding: 4px 12px; border-radius: 6px; background-color: ${badgeColor}; color: #ffffff; font-weight: bold; font-size: 13px; letter-spacing: 0.5px;">
                    ${action}
                  </span>
                  <h2 style="margin: 12px 0 4px 0; color: #ffffff; font-size: 20px;">Workspace Activity Alert</h2>
                  <p style="margin: 0; color: #94a3b8; font-size: 13px;">Codespace: <strong style="color: #60a5fa;">${spaceName}</strong></p>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 28px;">
                  <table width="100%" cellpadding="8" cellspacing="0" style="font-size: 14px; color: #cbd5e1; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #1e2433;">
                      <td style="width: 140px; color: #64748b; font-weight: 600;">Action:</td>
                      <td><strong style="color: ${badgeColor};">${action}</strong></td>
                    </tr>
                    <tr style="border-bottom: 1px solid #1e2433;">
                      <td style="color: #64748b; font-weight: 600;">Performed By:</td>
                      <td><strong style="color: #f1f5f9;">${actorName}</strong> (${actorEmail}) <span style="font-size: 12px; color: #94a3b8;">[Role: ${actorRole}]</span></td>
                    </tr>
                    <tr style="border-bottom: 1px solid #1e2433;">
                      <td style="color: #64748b; font-weight: 600;">Client IP:</td>
                      <td><code style="background-color: #1e2433; padding: 2px 6px; border-radius: 4px; color: #38bdf8;">${ip}</code></td>
                    </tr>
                    <tr style="border-bottom: 1px solid #1e2433;">
                      <td style="color: #64748b; font-weight: 600;">Codespace:</td>
                      <td><strong>${spaceName}</strong></td>
                    </tr>
                    <tr style="border-bottom: 1px solid #1e2433;">
                      <td style="color: #64748b; font-weight: 600;">Details:</td>
                      <td>${details}</td>
                    </tr>
                    <tr>
                      <td style="color: #64748b; font-weight: 600;">Timestamp:</td>
                      <td style="color: #94a3b8;">${timestamp || new Date().toISOString()}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 16px 28px; background-color: #0e1017; border-top: 1px solid #1a2030; text-align: center; font-size: 12px; color: #475569;">
                  CodeCollab Security & Audit Notification System (Self Notification)
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from,
      to: selfEmail,
      subject,
      text: `[CodeCollab Alert] ${action}\n\nSpace: ${spaceName}\nBy: ${actorName} (${actorEmail}) [${actorRole}]\nIP: ${ip}\nDetails: ${details}\nTimestamp: ${timestamp || new Date().toISOString()}`,
      html,
    });
    logger.info(`Audit alert email sent to self ('${selfEmail}'). MessageId: ${info.messageId}`, null, 'MAILER');
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error(`Failed to send audit alert email: ${err.message}`, err, 'MAILER');
    return { success: false, error: err.message };
  }
};

module.exports = {
  sendOtpEmail,
  sendAuditAlertEmail,
};
