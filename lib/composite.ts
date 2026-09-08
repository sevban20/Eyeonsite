/**
 * Faz 3.5 — Lokasyon (grup) seviyesinde composite alarm mantığı.
 *
 * Problem: bir lokasyonun iki internet devresi varsa, her devre kendi
 * monitörüdür ve her biri kendi başına alarm üretir. Bu, en kritik anda
 * (ikisi birden düştüğünde) iki ayrı "down" bildirimi üretir ve hiçbiri
 * "lokasyon tamamen offline" demez. Oysa tek devre düşmesi ile tüm
 * devrelerin düşmesi operasyonel olarak bambaşka olaylardır: birincisi
 * mesai içinde ISP'ye ticket, ikincisi gece telefon çalması demektir.
 *
 * Bu modül grup üyelerinin durumundan grubun durumunu türetir ve durum
 * değişiminde hangi aksiyonun tetikleneceğine karar verir. Tamamen saf
 * fonksiyonlardır — veritabanı, ağ veya zaman bağımlılığı yoktur — böylece
 * eşik davranışı server.ts'i çalıştırmadan test edilebilir.
 */

export type CompositeStatus = 'up' | 'degraded' | 'down';

/** Tetiklenecek aksiyon. 'none' = durum değişmedi, bildirim yok. */
export type CompositeAction = 'none' | 'degraded' | 'down' | 'recovered';

/** Bildirimin hangi kanal setinden gideceği. */
export type ChannelSet = 'degraded' | 'down';

export interface CompositeMember {
  name?: string;
  /** Monitörün yaşam döngüsü durumu: 'up' | 'paused' | 'maintenance' */
  status?: string | null;
  /** Son ölçüm sonucu: 'up' | 'down' | 'degraded' | 'maintenance' */
  currentStatus?: string | null;
}

/**
 * Değerlendirmeye katılan üyeler. Duraklatılmış ve bakım penceresindeki
 * monitörler sayılmaz — aksi halde planlı bakım, lokasyonu "tamamen down"
 * gösterip gece yarısı gereksiz alarm üretirdi.
 */
export function countableMembers<T extends CompositeMember>(members: T[]): T[] {
  return members.filter(
    (m) => m.status !== 'paused' && m.currentStatus !== 'maintenance' && m.status !== 'maintenance'
  );
}

/**
 * Grubun bileşik durumunu hesaplar.
 *
 * - Sayılabilir üye yoksa `null` döner (değerlendirme yapılmaz; grup boş veya
 *   tamamı bakımda demektir).
 * - Sayılabilir üyelerin **tamamı** down ise → 'down'.
 * - Down sayısı `degradedThreshold`'a ulaştıysa (ama hepsi değilse) → 'degraded'.
 * - Aksi halde → 'up'.
 *
 * Tek üyeli grupta o üye düşerse sonuç 'down' olur; 'degraded' hiç üretilmez.
 * Bu bilinçlidir: tek devreli lokasyonda "kısmi kesinti" diye bir şey yoktur.
 */
export function evaluateGroupStatus(
  members: CompositeMember[],
  degradedThreshold = 1
): CompositeStatus | null {
  const countable = countableMembers(members);
  if (countable.length === 0) return null;

  const downCount = countable.filter((m) => m.currentStatus === 'down').length;
  if (downCount === 0) return 'up';
  if (downCount >= countable.length) return 'down';

  const threshold = Math.max(1, Math.floor(degradedThreshold) || 1);
  return downCount >= threshold ? 'degraded' : 'up';
}

/**
 * Önceki ve yeni duruma bakarak tetiklenecek aksiyonu belirler.
 * Kenar tetiklemelidir: durum aynı kaldığı sürece tekrar bildirim gitmez.
 */
export function compositeTransition(
  previous: CompositeStatus,
  next: CompositeStatus
): CompositeAction {
  if (previous === next) return 'none';
  if (next === 'down') return 'down';
  if (next === 'degraded') return 'degraded';
  return 'recovered';
}

/**
 * Aksiyonun hangi kanal setinden gönderileceği.
 *
 * Toparlanma bildirimi, **çıkılan** durumun kanal setine gider: kimi
 * uyandırdıysak "her şey normale döndü"yü de ona söyleriz.
 */
export function channelSetFor(
  action: CompositeAction,
  previous: CompositeStatus
): ChannelSet | null {
  if (action === 'down') return 'down';
  if (action === 'degraded') return 'degraded';
  if (action === 'recovered') return previous === 'down' ? 'down' : 'degraded';
  return null;
}

/** Down durumdaki üyelerin adları — bildirim metnindeki detay için. */
export function downMemberNames(members: CompositeMember[]): string[] {
  return countableMembers(members)
    .filter((m) => m.currentStatus === 'down')
    .map((m) => m.name || 'unnamed');
}

/**
 * Bildirim metninin "Reason" satırı. Hangi devrenin düştüğünü tek bakışta
 * görebilmek için üye adlarını da içerir.
 */
export function compositeReason(
  action: CompositeAction,
  members: CompositeMember[]
): string {
  const countable = countableMembers(members);
  const down = downMemberNames(members);

  if (action === 'down') {
    return `All ${countable.length} member(s) are down: ${down.join(', ')}`;
  }
  if (action === 'degraded') {
    return `${down.length}/${countable.length} member(s) down: ${down.join(', ')}`;
  }
  if (action === 'recovered') {
    return `All ${countable.length} member(s) are back up`;
  }
  return '';
}
