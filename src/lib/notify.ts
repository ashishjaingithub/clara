import { google } from 'googleapis'

function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI ?? 'urn:ietf:wg:oauth:2.0:oob',
  )
  client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return client
}

export function isGmailConfigured(): boolean {
  return !!(
    process.env.GMAIL_REFRESH_TOKEN &&
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET
  )
}

/**
 * Internals object — lets tests spy on sendGmailMessage without ES module binding issues.
 * Call via `notify._internals.sendGmailMessage(raw)` in production code.
 */
export const _internals = {
  async sendGmailMessage(raw: string): Promise<void> {
    const gmail = google.gmail({ version: 'v1', auth: getOAuth2Client() })
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    })
  },
}

export async function notifyLeadCaptured(params: {
  businessName: string
  hubspotCompanyId: string
  visitorName: string
  visitorContact: string
  visitorMessage?: string
  sessionId: string
  baseUrl: string
}): Promise<void> {
  const to = process.env.OPERATOR_EMAIL ?? process.env.GMAIL_USER
  const from = process.env.GMAIL_USER

  if (!isGmailConfigured() || !to || !from) {
    process.stdout.write(
      `[Clara] Lead captured (email not configured): ${params.visitorName} for ${params.businessName}\n`,
    )
    return
  }

  const subject = `New lead from ${params.businessName} demo — ${params.visitorName}`
  const htmlBody = `
    <h2>New lead captured</h2>
    <p><strong>Business:</strong> ${params.businessName} (${params.hubspotCompanyId})</p>
    <p><strong>Visitor:</strong> ${params.visitorName}</p>
    <p><strong>Contact:</strong> ${params.visitorContact}</p>
    ${params.visitorMessage ? `<p><strong>Message:</strong> ${params.visitorMessage}</p>` : ''}
    <p><a href="${params.baseUrl}/demo/${params.sessionId}">View demo session &rarr;</a></p>
    <hr>
    <small>Clara AI Receptionist</small>
  `

  const raw = [
    `From: Clara <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    htmlBody,
  ].join('\r\n')

  try {
    await _internals.sendGmailMessage(Buffer.from(raw).toString('base64url'))
  } catch (err) {
    // Never fail lead capture because email failed
    process.stderr.write(
      `[Clara] Email notification failed: ${err instanceof Error ? err.message : String(err)}\n`,
    )
  }
}
