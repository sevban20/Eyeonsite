#!/usr/bin/env node
/**
 * CSV'den toplu monitör içe aktarma.
 *
 * Arayüzde monitörler tek tek oluşturuluyor; çok şubeli bir kurulumda bu
 * pratik değil. Bu script Faz 1.5'te gelen API anahtarını kullanarak aynı işi
 * toplu yapar: her lokasyon için (yoksa) bir grup oluşturur, devreleri o gruba
 * bağlar ve istenirse lokasyon (composite) alarmını açar.
 *
 * CSV biçimi (başlık satırı zorunlu, sütun sırası serbest):
 *
 *   lokasyon,ad,host,tip,aralik
 *   Ankara,Türk Telekom,81.212.10.5,PING,60
 *   Ankara,Vodafone Yedek,176.240.11.9,PING,60
 *   İzmir,Türk Telekom,88.230.4.12,PING,60
 *
 * - lokasyon : grup adı. Boş bırakılırsa monitör gruba atanmaz.
 * - ad       : monitör adı. Grup içinde benzersiz olmalı.
 * - host     : IP veya alan adı (HTTP için tam URL).
 * - tip      : HTTP | TCP | PING | HEARTBEAT (varsayılan PING)
 * - aralik   : saniye (varsayılan 60)
 * - port     : yalnızca TCP için
 *
 * Kullanım:
 *
 *   export EYEON_URL=https://eyeon.site
 *   export EYEON_API_KEY=umk_...
 *   node scripts/bulk-import.mjs subeler.csv              # kuru çalışma
 *   node scripts/bulk-import.mjs subeler.csv --apply      # gerçekten oluştur
 *   node scripts/bulk-import.mjs subeler.csv --apply --composite
 *
 * Varsayılan olarak HİÇBİR ŞEY YAZMAZ; ne yapacağını listeler. Yazması için
 * --apply gerekir. Zaten var olan grup ve monitörler atlanır, bu yüzden script
 * yarıda kalırsa aynı dosyayla tekrar çalıştırmak güvenlidir.
 */

const BASE = (process.env.EYEON_URL || '').replace(/\/$/, '');
const KEY = process.env.EYEON_API_KEY || '';
const [, , csvPath, ...flags] = process.argv;
const APPLY = flags.includes('--apply');
const COMPOSITE = flags.includes('--composite');

if (!BASE || !KEY || !csvPath) {
  console.error('Kullanım: EYEON_URL=... EYEON_API_KEY=... node scripts/bulk-import.mjs <csv> [--apply] [--composite]');
  process.exit(1);
}

const api = async (method, path, body) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
};

// Basit CSV ayrıştırıcı: tırnaklı alanları ve tırnak içi virgülü destekler.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

const norm = s => (s || '').trim();

const rows = parseCsv(await (await import('node:fs/promises')).readFile(csvPath, 'utf8'));
if (rows.length < 2) { console.error('CSV boş ya da yalnızca başlık satırı var.'); process.exit(1); }

const header = rows[0].map(h => norm(h).toLowerCase());
const idx = name => header.indexOf(name);
for (const required of ['ad', 'host']) {
  if (idx(required) === -1) { console.error(`CSV'de "${required}" sütunu yok. Bulunan sütunlar: ${header.join(', ')}`); process.exit(1); }
}

const entries = rows.slice(1).map((r, i) => ({
  line: i + 2,
  location: norm(r[idx('lokasyon')]),
  name: norm(r[idx('ad')]),
  host: norm(r[idx('host')]),
  type: (norm(r[idx('tip')]) || 'PING').toUpperCase(),
  interval: parseInt(norm(r[idx('aralik')]) || '60', 10),
  port: norm(r[idx('port')]) ? parseInt(norm(r[idx('port')]), 10) : null,
}));

const problems = [];
for (const e of entries) {
  if (!e.name) problems.push(`satır ${e.line}: ad boş`);
  if (!['HTTP', 'TCP', 'PING', 'HEARTBEAT'].includes(e.type)) problems.push(`satır ${e.line}: geçersiz tip "${e.type}"`);
  if (e.type !== 'HEARTBEAT' && !e.host) problems.push(`satır ${e.line}: host boş`);
  if (e.type === 'TCP' && !e.port) problems.push(`satır ${e.line}: TCP için port gerekli`);
  if (!Number.isInteger(e.interval) || e.interval < 10) problems.push(`satır ${e.line}: aralık en az 10 saniye olmalı`);
}
if (problems.length) { console.error('CSV hataları:\n  ' + problems.join('\n  ')); process.exit(1); }

const workspaces = await api('GET', '/workspaces');
if (!workspaces.length) { console.error('Erişilebilir workspace yok.'); process.exit(1); }
const ws = workspaces[0];
console.log(`Workspace: ${ws.name} (${ws.id})`);

const existingGroups = await api('GET', `/monitor-groups?workspaceId=${ws.id}`);
const existingMonitors = await api('GET', `/monitors?workspaceId=${ws.id}`);
const groupByName = new Map(existingGroups.map(g => [g.name, g]));
const monitorNames = new Set(existingMonitors.map(m => m.name));

const locations = [...new Set(entries.map(e => e.location).filter(Boolean))];
const newLocations = locations.filter(l => !groupByName.has(l));
const newEntries = entries.filter(e => !monitorNames.has(e.name));
const skipped = entries.length - newEntries.length;

console.log(`\nCSV: ${entries.length} satır, ${locations.length} lokasyon`);
console.log(`Oluşturulacak grup   : ${newLocations.length}${newLocations.length ? ' → ' + newLocations.join(', ') : ''}`);
console.log(`Oluşturulacak monitör: ${newEntries.length}`);
if (skipped) console.log(`Atlanacak (aynı adlı monitör zaten var): ${skipped}`);
if (COMPOSITE) console.log(`Lokasyon alarmı: ${locations.length} grupta açılacak (kanalları arayüzden doldurman gerekir)`);

if (!APPLY) {
  console.log('\nKuru çalışma — hiçbir şey yazılmadı. Gerçekten oluşturmak için --apply ekle.');
  process.exit(0);
}

let created = 0, failed = 0;
for (const loc of newLocations) {
  const g = await api('POST', '/monitor-groups', { name: loc, workspaceId: ws.id });
  groupByName.set(loc, g);
  console.log(`grup oluşturuldu: ${loc}`);
}

for (const e of newEntries) {
  const payload = {
    name: e.name,
    workspaceId: ws.id,
    monitorType: e.type,
    interval: e.interval,
    ...(e.type === 'HEARTBEAT' ? {} : { url: e.host }),
    ...(e.port ? { port: e.port } : {}),
    ...(e.location && groupByName.has(e.location) ? { groupId: groupByName.get(e.location).id } : {}),
  };
  try {
    await api('POST', '/monitors', payload);
    created++;
    console.log(`  + ${e.location ? e.location + ' / ' : ''}${e.name}`);
  } catch (err) {
    failed++;
    console.error(`  ! satır ${e.line} (${e.name}): ${err.message}`);
  }
}

if (COMPOSITE) {
  for (const loc of locations) {
    const g = groupByName.get(loc);
    if (!g) continue;
    try {
      await api('PUT', `/monitor-groups/${g.id}`, { compositeEnabled: true, degradedThreshold: 1, suppressMemberAlerts: true });
      console.log(`lokasyon alarmı açıldı: ${loc}`);
    } catch (err) {
      console.error(`  ! ${loc} için lokasyon alarmı açılamadı: ${err.message}`);
    }
  }
}

console.log(`\nBitti. Oluşturulan monitör: ${created}${failed ? `, başarısız: ${failed}` : ''}`);
if (failed) process.exit(1);
