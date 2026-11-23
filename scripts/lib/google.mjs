// GSC／GA4 API 共用認證。兩條路，token 都不印出來：
//   1. GOOGLE_SA_KEY_JSON 有值（雲端 Claude session）：用服務帳號金鑰簽 JWT 換 token
//   2. 否則（本機）：用 gcloud 使用者 token 模擬 GOOGLE_SA_EMAIL，不下載金鑰
import { execFileSync } from 'node:child_process';
import { createSign } from 'node:crypto';

export const SCOPES = [
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/analytics.readonly',
];

const b64url = (s) => Buffer.from(s).toString('base64url');

async function tokenFromKey(json) {
  let key;
  try { key = JSON.parse(json); } catch { throw new Error('GOOGLE_SA_KEY_JSON 不是合法 JSON（要放金鑰檔全文）'); }
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: key.client_email, scope: SCOPES.join(' '), aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  let sig;
  try { sig = createSign('RSA-SHA256').update(`${head}.${claim}`).sign(key.private_key, 'base64url'); }
  catch (e) { throw new Error(`GOOGLE_SA_KEY_JSON 的 private_key 無法簽章（${e.message}）`); }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`金鑰換 token 失敗：${JSON.stringify(j).slice(0, 300)}`);
  return { token: j.access_token, account: key.client_email };
}

async function tokenFromGcloud(sa) {
  if (!sa) throw new Error('沒有 GOOGLE_SA_KEY_JSON，也沒有 GOOGLE_SA_EMAIL。設定方式見 CLAUDE.md「流量資料」。');
  let userToken;
  try { userToken = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { throw new Error('拿不到 gcloud token。本機先跑 `gcloud auth login`；雲端 session 要設 GOOGLE_SA_KEY_JSON。'); }
  const r = await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${sa}:generateAccessToken`, {
    method: 'POST',
    headers: { authorization: `Bearer ${userToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ scope: SCOPES, lifetime: '3600s' }),
  });
  const j = await r.json();
  if (!j.accessToken) throw new Error(`模擬服務帳號失敗：${JSON.stringify(j).slice(0, 300)}`);
  return { token: j.accessToken, account: sa };
}

export const googleAuth = () =>
  process.env.GOOGLE_SA_KEY_JSON ? tokenFromKey(process.env.GOOGLE_SA_KEY_JSON) : tokenFromGcloud(process.env.GOOGLE_SA_EMAIL);

export function client(token) {
  return async (url, body, method) => {
    const r = await fetch(url, {
      method: method ?? (body ? 'POST' : 'GET'),
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await r.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 300) }; }
    return { status: r.status, ...json };
  };
}

// GSC 資料有 2–3 天延遲：期間不含今天
export function period(days = 28) {
  const iso = (d) => d.toISOString().slice(0, 10);
  return { start: iso(new Date(Date.now() - days * 864e5)), end: iso(new Date(Date.now() - 864e5)) };
}
