import nodemailer from 'nodemailer';

const smtpHost = process.env['SMTP_HOST'];
const smtpPort = Number(process.env['SMTP_PORT'] ?? 587);
const smtpUser = process.env['SMTP_USER'];
const smtpPass = process.env['SMTP_PASS'];
const mailFrom = process.env['MAIL_FROM'] ?? 'Steakz Enterprise <no-reply@steakz.local>';

const transporter = smtpHost
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: process.env['SMTP_SECURE'] === 'true',
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    })
  : null;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatStatus(status: string) {
  return status.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

// Generates an elegant, restaurant-branded HTML receipt/update email
function orderEmailHtml(params: {
  customerName: string;
  orderId: string;
  branchName: string;
  status: string;
  totalPrice: number;
}) {
  const statusLabel = formatStatus(params.status);

  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px;">
      <h2 style="margin: 0 0 16px; color: #b91c1c;">Steakz Order Update</h2>
      <p>Hello ${escapeHtml(params.customerName)},</p>
      <p>The status of your order at our <strong>${escapeHtml(params.branchName)}</strong> branch has been updated.</p>
      
      <div style="margin: 24px 0; padding: 16px; background: #f9fafb; border-radius: 6px;">
        <p style="margin: 0 0 8px;"><strong>Order ID:</strong> ${escapeHtml(params.orderId)}</p>
        <p style="margin: 0 0 8px;"><strong>Total Amount:</strong> £${params.totalPrice.toFixed(2)}</p>
        <p style="margin: 0;"><strong>Current Tracking Status:</strong> 
          <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; background: #fee2e2; color: #991b1b; font-weight: 700; font-size: 14px;">
            ${escapeHtml(statusLabel)}
          </span>
        </p>
      </div>
      
      <p>Thank you for dining with us! If you have any questions, please contact your local branch directly.</p>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px; text-align: center;">This is an automated notification from the Steakz Management Information System.</p>
    </div>
  `;
}

/**
 * Dispatches an automated tracking update email directly to a customer
 */
export async function sendOrderUpdateEmail(params: {
  to: string;
  customerName: string;
  orderId: string;
  branchName: string;
  status: string;
  totalPrice: number;
}) {
  if (!transporter) {
    console.warn('⚠️ SMTP_HOST is not configured. Skipping order notification dispatch.');
    return;
  }

  try {
    await transporter.sendMail({
      from: mailFrom,
      to: params.to,
      subject: `Steakz Order Status Update: ${formatStatus(params.status)}`,
      html: orderEmailHtml(params),
    });
    console.log(`✉️ Notification email sent to ${params.to} for Order #${params.orderId}`);
  } catch (error) {
    console.error('❌ Failed to send order notification email:', error);
  }
}

/**
 * Dispatches an automated reservation update email directly to a customer
 */
export async function sendReservationUpdateEmail(params: {
  to: string;
  customerName: string;
  reservationId: string;
  branchName: string;
  status: string;
  reservationTime: Date;
}) {
  if (!transporter) {
    console.warn('⚠️ SMTP_HOST is not configured. Skipping reservation notification dispatch.');
    return;
  }

  const statusLabel = formatStatus(params.status);
  const dateStr = params.reservationTime.toLocaleString();

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px;">
      <h2 style="margin: 0 0 16px; color: #b91c1c;">Steakz Reservation Update</h2>
      <p>Hello ${escapeHtml(params.customerName)},</p>
      <p>The status of your reservation at our <strong>${escapeHtml(params.branchName)}</strong> branch has been updated.</p>
      
      <div style="margin: 24px 0; padding: 16px; background: #f9fafb; border-radius: 6px;">
        <p style="margin: 0 0 8px;"><strong>Reservation ID:</strong> ${escapeHtml(params.reservationId)}</p>
        <p style="margin: 0 0 8px;"><strong>Date & Time:</strong> ${dateStr}</p>
        <p style="margin: 0;"><strong>Status:</strong> 
          <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; background: #fee2e2; color: #991b1b; font-weight: 700; font-size: 14px;">
            ${escapeHtml(statusLabel)}
          </span>
        </p>
      </div>
      
      <p>We look forward to serving you! If you have any questions, please contact the branch.</p>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px; text-align: center;">This is an automated notification from Steakz.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: mailFrom,
      to: params.to,
      subject: `Steakz Reservation Status: ${statusLabel}`,
      html,
    });
    console.log(`✉️ Reservation notification email sent to ${params.to}`);
  } catch (error) {
    console.error('❌ Failed to send reservation notification email:', error);
  }
}