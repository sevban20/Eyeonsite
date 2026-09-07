// Thin wrapper around the AuditLog table. Kept fire-and-forget-safe: a
// logging failure must never break the request it's attached to.
export interface AuditEvent {
  userId?: string | null;
  workspaceId?: string | null;
  action: string; // e.g. "auth.login", "monitor.delete", "admin.user.block"
  targetType?: string | null; // e.g. "Monitor", "User", "Workspace"
  targetId?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function makeAuditLogger(prisma: any, log: (msg: string) => void) {
  return async function logAudit(event: AuditEvent): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: event.userId ?? null,
          workspaceId: event.workspaceId ?? null,
          action: event.action,
          targetType: event.targetType ?? null,
          targetId: event.targetId ?? null,
          ip: event.ip ?? null,
          metadata: event.metadata ? JSON.stringify(event.metadata) : null
        }
      });
    } catch (err: any) {
      // Never let audit logging take down the request path
      log(`WARN: audit log write failed for action "${event.action}": ${err?.message || err}`);
    }
  };
}

export function requestIp(req: any): string | null {
  return (req.headers?.['x-forwarded-for']?.toString().split(',')[0].trim()) || req.ip || req.socket?.remoteAddress || null;
}
