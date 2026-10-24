/**
 * HTTP monitorlerinde "hangi durum kodlari basarili sayilir" ayari.
 *
 * Varsayilan davranis 400'un altindaki her kodu basarili saymaktir. Ama bazi
 * servislerin saglik kontrolu icin ayri bir ucu yoktur ve kok adrese dogrudan
 * erisildiginde 404 doner — sunucu ayakta ve dogru calisiyor olmasina ragmen.
 * Bu gibi durumlarda monitorun surekli "down" demesi, alarmlari anlamsiz
 * gurultuye cevirir.
 *
 * Bicim: virgulle ayrilmis kodlar ve araliklar. Ornek: "200-299,404"
 */

export type StatusRange = [number, number];

const MIN_CODE = 100;
const MAX_CODE = 599;

/**
 * Spec metnini araliklara cevirir.
 * Gecersiz ya da bos spec icin null doner — cagiran varsayilan davranisa doner.
 */
export function parseStatusCodeSpec(spec: string | null | undefined): StatusRange[] | null {
  if (typeof spec !== 'string') return null;
  const trimmed = spec.trim();
  if (!trimmed) return null;

  const ranges: StatusRange[] = [];
  for (const rawPart of trimmed.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;

    const match = part.match(/^(\d{3})(?:\s*-\s*(\d{3}))?$/);
    if (!match) return null;

    let from = parseInt(match[1], 10);
    let to = match[2] === undefined ? from : parseInt(match[2], 10);
    if (from < MIN_CODE || from > MAX_CODE || to < MIN_CODE || to > MAX_CODE) return null;
    // Ters yazilmis aralik ("299-200") reddedilmek yerine duzeltilir; kullanici
    // niyeti acik ve sessizce varsayilana donmek daha kafa karistirici olurdu.
    if (from > to) [from, to] = [to, from];

    ranges.push([from, to]);
  }

  return ranges.length > 0 ? ranges : null;
}

/** Spec sozdizimsel olarak gecerli mi (API dogrulamasi icin). */
export function isValidStatusCodeSpec(spec: string | null | undefined): boolean {
  if (spec === null || spec === undefined || spec.trim() === '') return true; // bos = varsayilan
  return parseStatusCodeSpec(spec) !== null;
}

/**
 * Bir durum kodu kabul edilmeli mi?
 * Spec yoksa ya da bozuksa varsayilana donulur: 400'un altindaki her kod basarili.
 */
export function isStatusAccepted(code: number, spec?: string | null): boolean {
  const ranges = parseStatusCodeSpec(spec);
  if (!ranges) return code < 400;
  return ranges.some(([from, to]) => code >= from && code <= to);
}
