const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

const storePath = os.homedir() + '/.po-ai/credentials.json';
const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
const jiraCred = store.find(c => c.key === 'jira-main');
if (!jiraCred) { console.log('No jira creds'); process.exit(1); }

const KEY_LENGTH = 32;
const secret = process.env.PO_AI_MASTER_KEY || 'po-ai-default-master-key-change-in-prod';
const salt = Buffer.from('po-ai-credential-store-salt-v1');
const masterKey = crypto.pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, 'sha256');
const iv = Buffer.from(jiraCred.data.iv, 'hex');
const authTag = Buffer.from(jiraCred.data.authTag, 'hex');
const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
decipher.setAuthTag(authTag);
let decrypted = decipher.update(jiraCred.data.encrypted, 'hex', 'utf8');
decrypted += decipher.final('utf8');
const creds = JSON.parse(decrypted);

const auth = Buffer.from(creds.email + ':' + creds.apiToken).toString('base64');
const url = new URL('/rest/api/3/field', creds.baseUrl);
const req = https.request({
  hostname: url.hostname,
  path: url.pathname,
  method: 'GET',
  headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json' }
}, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    const fields = JSON.parse(data);
    const targets = ['tribu', 'chapter', 'squad', 'tipo de iniciativa', 'año', 'centro de costos', 'avance esperado', 'avance real'];
    const matches = fields.filter(f => targets.some(t => (f.name || '').toLowerCase().includes(t)));
    matches.forEach(f => console.log(f.id + ' -> ' + f.name));
  });
});
req.end();
