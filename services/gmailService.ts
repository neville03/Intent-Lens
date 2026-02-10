
export interface GmailProfile {
  email: string;
  picture: string;
}

export interface GmailMessageSummary {
  id: string;
  from: string;
  subject: string;
  body: string;
  timestamp: Date;
}

const GMAIL_BASE_URL = 'https://gmail.googleapis.com/gmail/v1';

export async function getGmailProfile(token: string): Promise<GmailProfile> {
  const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!resp.ok) throw new Error('Failed to fetch profile');
  const data = await resp.json();
  return { email: data.email, picture: data.picture };
}

export async function fetchLatestEmails(token: string): Promise<GmailMessageSummary[]> {
  const listResp = await fetch(`${GMAIL_BASE_URL}/users/me/messages?maxResults=5&q=is:unread`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const listData = await listResp.json();
  
  if (!listData.messages) return [];

  const messages = await Promise.all(listData.messages.map(async (msg: any) => {
    const detailResp = await fetch(`${GMAIL_BASE_URL}/users/me/messages/${msg.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const detail = await detailResp.json();
    
    const headers = detail.payload.headers;
    const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown';
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
    
    // Simple body extraction (look for text/plain snippet)
    const body = detail.snippet || "";

    return {
      id: detail.id,
      from,
      subject,
      body,
      timestamp: new Date(parseInt(detail.internalDate))
    };
  }));

  return messages;
}

export async function sendGmailMessage(token: string, to: string, subject: string, body: string) {
  // Construct RFC822 message
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const messageParts = [
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body
  ];
  const message = messageParts.join('\n');
  const encodedMessage = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const resp = await fetch(`${GMAIL_BASE_URL}/users/me/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: encodedMessage })
  });

  return resp.ok;
}
