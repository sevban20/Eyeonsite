/**
 * Sunucu hata mesajlarini arayuz diline cevirir.
 *
 * API, hata metnini Ingilizce doner (log ve API kullanicilari icin). Onceden bu
 * metin oldugu gibi toast'a/forma basiliyordu; Turkce arayuzde "Invalid email or
 * password", "Current password is incorrect" gibi ifadeler goruluyordu. Bilinen
 * mesajlar burada bir ceviri anahtarina eslenir. Taninmayan bir mesaj Turkce
 * arayuzde gosterilmez; cagiranin verdigi Turkce yedek metin kullanilir.
 */
type Rule = [RegExp, string];

const RULES: Rule[] = [
  [/^Invalid email or password/i, 'errors.invalid_credentials'],
  [/^Your account has been blocked/i, 'errors.account_blocked'],
  [/Account locked for (?<n>\d+) minutes/i, 'errors.account_locked'],
  [/Try again in (?<n>\d+) minute/i, 'errors.account_locked_retry'],
  [/^Please verify your email/i, 'errors.email_unverified'],
  [/^Email already exists/i, 'errors.email_exists'],
  [/^(Email and password required|Email required|Email is required)/i, 'errors.email_required'],
  [/^Password must be 8-128/i, 'errors.password_length'],
  [/^Password is required/i, 'errors.password_required'],
  [/^Current password is incorrect/i, 'errors.current_password'],
  [/^Incorrect password/i, 'errors.incorrect_password'],
  [/^Slug already in use/i, 'errors.slug_taken'],
  [/^Only the workspace owner/i, 'errors.owner_only'],
  [/^User not found/i, 'errors.user_not_found'],
  [/^User is already a member/i, 'errors.already_member'],
  [/^User is already the owner/i, 'errors.already_owner'],
  [/(groups? (do|does) not belong|Groups must belong)/i, 'errors.group_workspace'],
  [/monitors do not belong/i, 'errors.monitor_workspace'],
  [/^End time must be after start time/i, 'errors.maintenance_range'],
  [/^Invalid or expired verification token/i, 'errors.verify_token'],
  [/^Invalid or expired reset token/i, 'errors.reset_token'],
  [/^(Session expired|Invalid session)/i, 'errors.session_expired'],
  [/^Invalid code/i, 'errors.invalid_code'],
  [/^2FA is already enabled/i, 'errors.twofa_already'],
  [/^2FA setup has not been started/i, 'errors.twofa_not_started'],
  [/^2FA is not enabled/i, 'errors.twofa_not_enabled'],
  [/^You cannot remove your own admin/i, 'errors.self_admin'],
  [/^You cannot block your own account/i, 'errors.self_block'],
  [/^Workspace name cannot be empty/i, 'errors.workspace_name'],
  [/A valid http\(s\) URL is required/i, 'errors.url_http'],
  [/URL\/host is required/i, 'errors.url_required'],
  [/Enter a bare host name/i, 'errors.url_host'],
  [/^Slug may only contain/i, 'errors.slug_format'],
  [/^slug:/i, 'errors.slug_format'],
  [/^(Forbidden|Forbidden: Admin access required)$/i, 'errors.forbidden'],
  [/^(Not found|Workspace not found|Group not found|Member not found)$/i, 'errors.not_found'],
  [/^Internal server error$/i, 'errors.server'],
  [/^Contact form is not available/i, 'errors.contact_unavailable'],
  [/^You can only (manage|assign|use) (your )?own team/i, 'errors.own_team_only'],
  [/^Only workspace admins can manage teams/i, 'errors.teams_admin_only'],
  [/^Only workspace admins can (edit|delete) tags/i, 'errors.tags_admin_only'],
  [/^A team with this name already exists/i, 'errors.team_exists'],
  [/^A tag with this name already exists/i, 'errors.tag_exists'],
  [/^Team members must belong/i, 'errors.team_members_workspace'],
  [/^Team not found$/i, 'errors.not_found'],
  [/tags do not belong/i, 'errors.tag_workspace'],
  [/channels do not belong/i, 'errors.channel_workspace'],
];

// Dogrulama hatalari "alan: mesaj" bicimindedir (sunucudaki badRequest).
const FIELD_KEYS: Record<string, string> = {
  url: 'errors.fields.url', name: 'errors.fields.name', email: 'errors.fields.email',
  password: 'errors.fields.password', title: 'errors.fields.title', slug: 'errors.fields.slug',
  interval: 'errors.fields.interval', port: 'errors.fields.port', alertEmail: 'errors.fields.alert_email',
  responseTimeThreshold: 'errors.fields.response_threshold', alertThreshold: 'errors.fields.alert_threshold',
  heartbeatGrace: 'errors.fields.heartbeat_grace', acceptedStatusCodes: 'errors.fields.accepted_codes',
  customHeaders: 'errors.fields.custom_headers', expectedKeyword: 'errors.fields.keyword',
  slackWebhook: 'errors.fields.webhook', discordWebhook: 'errors.fields.webhook', teamsWebhook: 'errors.fields.webhook',
  zoomWebhook: 'errors.fields.webhook', genericWebhook: 'errors.fields.webhook', token: 'errors.fields.code',
  message: 'errors.fields.message', subject: 'errors.fields.subject',
  monitorIds: 'errors.fields.monitors', groupIds: 'errors.fields.groups', themeColor: 'errors.fields.color',
  to: 'errors.fields.recipients', chatId: 'errors.fields.chat_id', events: 'errors.fields.events',
  channelIds: 'errors.fields.channels', tagIds: 'errors.fields.tags', memberIds: 'errors.fields.team_members',
};

export function translateApiError(err: any, t: (k: string) => string, language: string, fallbackKey: string): string {
  const raw = err?.response?.data?.error;
  const status = err?.response?.status;

  if (typeof raw === 'string' && raw) {
    for (const [re, key] of RULES) {
      const m = raw.match(re);
      if (m) {
        let text = t(key);
        for (const [k, v] of Object.entries(m.groups || {})) text = text.replace(`{${k}}`, String(v));
        return text;
      }
    }
    const field = raw.match(/^([A-Za-z][\w.]*):\s/);
    if (field) {
      const label = FIELD_KEYS[field[1].split('.')[0]];
      return t('errors.invalid_field').replace('{field}', label ? t(label) : field[1]);
    }
    if (language === 'en') return raw;
  }

  if (status === 429) return t('errors.rate_limited');
  if (err && !err.response) return t('errors.network');
  return t(fallbackKey);
}

/**
 * Kontrol sonucu hata metinleri (pinger'in kaydettigi errorMessage) — olay
 * listelerinde gosterilir. Sistem mesajlari Ingilizce kaydedilir; Turkce
 * arayuzde bilinen kaliplar cevrilir, taninmayan teknik hata oldugu gibi kalir.
 */
const CHECK_RULES: [RegExp, string][] = [
  [/^timeout of (?<n>\d+)ms exceeded/i, 'check_errors.timeout'],
  [/^TCP timeout after (?<n>\d+)ms/i, 'check_errors.timeout'],
  [/^Slow: (?<a>\d+)ms > (?<b>\d+)ms/i, 'check_errors.slow'],
  [/^Keyword missing: (?<k>.*)$/i, 'check_errors.keyword'],
  [/^Heartbeat missed/i, 'check_errors.heartbeat'],
  [/^Host unreachable/i, 'check_errors.unreachable'],
  [/^Blocked: (redirect to )?(a )?private|target resolves to a private/i, 'check_errors.blocked'],
  [/ENOTFOUND/i, 'check_errors.dns_not_found'],
  [/EAI_AGAIN/i, 'check_errors.dns_temporary'],
  [/ECONNREFUSED/i, 'check_errors.refused'],
  [/ECONNRESET|socket hang up/i, 'check_errors.reset'],
  [/EHOSTUNREACH|ENETUNREACH/i, 'check_errors.unreachable'],
  [/certificate has expired|CERT_HAS_EXPIRED/i, 'check_errors.cert_expired'],
  [/self[- ]signed|unable to verify|UNABLE_TO_VERIFY/i, 'check_errors.cert_invalid'],
  [/maxContentLength/i, 'check_errors.too_large'],
];

export function translateCheckError(message: string | null | undefined, t: (k: string) => string, language: string): string {
  if (!message) return '';
  if (language === 'en') return message;
  for (const [re, key] of CHECK_RULES) {
    const m = message.match(re);
    if (m) {
      let text = t(key);
      for (const [k, v] of Object.entries(m.groups || {})) text = text.replace(`{${k}}`, String(v));
      return text;
    }
  }
  return message;
}
