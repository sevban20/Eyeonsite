import { PrismaClient, Prisma } from '@prisma/client';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { Server } from 'socket.io';
import http from 'http';
import https from 'https';
import tls from 'tls';
import dns from 'dns';
import net from 'net';
import ping from 'ping';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { randomBytes } from 'crypto';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Debug Log Buffer
const debugLogs: string[] = [];
function log(msg: string) {
  const timestamp = new Date().toISOString();
  const formattedMsg = `[${timestamp}] ${msg}`;
  console.log(formattedMsg);
  debugLogs.push(formattedMsg);
  if (debugLogs.length > 100) debugLogs.shift();
}

// --- INPUT VALIDATION SCHEMAS ---
const monitorCreateSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().min(1),
  method: z.enum(['GET', 'POST', 'HEAD', 'PUT', 'DELETE']).default('GET'),
  interval: z.number().int().min(10).max(86400).default(60),
  workspaceId: z.string().uuid(),
  alertEmail: z.string().email().optional().or(z.literal('')),
  slackWebhook: z.string().url().optional().or(z.literal('')),
  telegramChatId: z.string().optional(),
  zoomWebhook: z.string().url().optional().or(z.literal('')),
  discordWebhook: z.string().url().optional().or(z.literal('')),
  teamsWebhook: z.string().url().optional().or(z.literal('')),
  genericWebhook: z.string().url().optional().or(z.literal('')),
  alertThreshold: z.number().int().min(1).max(10).default(2),
  responseTimeThreshold: z.number().int().min(100).max(60000).optional().nullable(),
  notifyOnDegraded: z.boolean().default(false),
  sslCheckEnabled: z.boolean().default(true),
  status: z.string().optional(),
  currentStatus: z.string().optional(),
  monitorType: z.string().default('HTTP'),
  port: z.number().int().optional().nullable(),
  expectedKeyword: z.string().optional().nullable(),
  customHeaders: z.string().optional().nullable(),
  heartbeatGrace: z.number().int().default(5),
  groupId: z.string().uuid().optional().nullable()
});

const monitorUpdateSchema = monitorCreateSchema.partial();

const monitorGroupCreateSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).default('#f97316'),
  workspaceId: z.string().uuid()
});

const monitorGroupUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).optional(),
  collapsed: z.boolean().optional(),
  order: z.number().int().optional()
});

// --- SSL CHECK FUNCTION ---
async function checkSSL(url: string): Promise<{
  valid: boolean;
  expiry: Date | null;
  issuer: string | null;
  subject: string | null;
  daysLeft: number | null;
}> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        return resolve({ valid: false, expiry: null, issuer: null, subject: null, daysLeft: null });
      }
      const port = parseInt(parsed.port) || 443;
      const hostname = parsed.hostname;
      const socket = tls.connect({ host: hostname, port, servername: hostname, rejectUnauthorized: false }, () => {
        try {
          const cert = socket.getPeerCertificate(true);
          socket.end();
          if (!cert || !cert.valid_to) {
            return resolve({ valid: false, expiry: null, issuer: null, subject: null, daysLeft: null });
          }
          const expiry = new Date(cert.valid_to);
          const now = new Date();
          const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const rawIssuer = cert.issuer ? (cert.issuer.O || cert.issuer.CN || null) : null;
          const issuer = rawIssuer ? (Array.isArray(rawIssuer) ? rawIssuer[0] : rawIssuer) : null;
          const rawSubject = cert.subject ? (cert.subject.CN || null) : null;
          const subject = rawSubject ? (Array.isArray(rawSubject) ? rawSubject[0] : rawSubject) : null;
          const valid = socket.authorized || daysLeft > 0;
          resolve({ valid, expiry, issuer: issuer as string | null, subject: subject as string | null, daysLeft });
        } catch {
          socket.end();
          resolve({ valid: false, expiry: null, issuer: null, subject: null, daysLeft: null });
        }
      });
      socket.on('error', () => resolve({ valid: false, expiry: null, issuer: null, subject: null, daysLeft: null }));
      socket.setTimeout(8000, () => { socket.destroy(); resolve({ valid: false, expiry: null, issuer: null, subject: null, daysLeft: null }); });
    } catch {
      resolve({ valid: false, expiry: null, issuer: null, subject: null, daysLeft: null });
    }
  });
}

// --- DNS CHECK FUNCTION ---
async function checkDNS(url: string): Promise<{ resolvedIp: string | null; resolutionTime: number }> {
  return new Promise((resolve) => {
    try {
      const hostname = new URL(url).hostname;
      const start = Date.now();
      dns.lookup(hostname, (err, address) => {
        const resolutionTime = Date.now() - start;
        if (err) return resolve({ resolvedIp: null, resolutionTime });
        resolve({ resolvedIp: address, resolutionTime });
      });
    } catch {
      resolve({ resolvedIp: null, resolutionTime: 0 });
    }
  });
}

// --- TCP CHECK FUNCTION ---
async function checkTCP(host: string, port: number, timeoutMs = 10000): Promise<{ responseTime: number }> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => {
      const responseTime = Date.now() - start;
      socket.destroy();
      resolve({ responseTime });
    });
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`TCP timeout after ${timeoutMs}ms`));
    });
    socket.on('error', (err) => {
      socket.destroy();
      reject(err);
    });
    socket.connect(port, host);
  });
}

async function startServer() {
  log('DEBUG: ENTERING startServer()');
  const app = express();
  app.set('trust proxy', 1); // Trust Nginx/Apache proxy
  const PORT = parseInt(process.env.PORT || '3000');
  const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: ALLOWED_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));

  // Rate limiting
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
  app.use('/api/', limiter);
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
  app.use('/api/auth/', authLimiter);

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: ALLOWED_ORIGIN }
  });

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // Admin Middleware
  const requireAdmin = async (req: any, res: any, next: any) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user || user.role !== 'SYSTEM_ADMIN') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }
      next();
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // --- AUTH HELPERS ---
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCK_DURATION_MINUTES = 30;

  function generateVerifyToken(): string {
    return randomBytes(32).toString('hex');
  }

  async function sendVerificationEmail(email: string, token: string, name?: string | null) {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const verifyUrl = `${appUrl}/verify-email?token=${token}`;
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');

    if (!smtpHost || !smtpUser || !smtpPass) {
      log(`DEBUG: SMTP not configured — verification link: ${verifyUrl}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass }
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:'Inter', -apple-system, sans-serif;color:#fafafa;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#09090b;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#18181b;border:1px solid #27272a;border-radius:24px;overflow:hidden;box-shadow:0 20px 25px -5px rgba(0,0,0,0.3);">
          <!-- Header/Logo -->
          <tr>
            <td align="center" style="padding:40px 40px 20px 40px;">
              <div style="background-color:#f97316;width:48px;height:48px;border-radius:12px;display:inline-block;line-height:48px;text-align:center;box-shadow:0 0 20px rgba(249,115,22,0.2);">
                <span style="color:white;font-size:24px;font-weight:800;">E</span>
              </div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding:0 40px 40px 40px;text-align:center;">
              <h1 style="font-size:24px;font-weight:800;margin:0 0 12px 0;letter-spacing:-0.02em;">Hesabınızı Doğrulayın</h1>
              <p style="color:#a1a1aa;font-size:15px;line-height:24px;margin:0 0 32px 0;">
                Merhaba ${name || 'Kullanıcı'}, Eyeon.site'a hoş geldiniz! Hesabınızı etkinleştirmek için aşağıdaki butona tıklayın.
              </p>
              
              <!-- CTA Button -->
              <a href="${verifyUrl}" style="display:inline-block;background-color:#f97316;color:white;text-decoration:none;padding:16px 32px;border-radius:12px;font-weight:800;font-size:15px;box-shadow:0 10px 15px -3px rgba(249,115,22,0.2);">
                Hesabımı Doğrula
              </a>
              
              <div style="margin-top:32px;padding-top:32px;border-top:1px solid #27272a;">
                <p style="color:#52525b;font-size:13px;margin:0;">
                  Bu link 24 saat geçerlidir. Eğer bu isteği siz yapmadıysanız, bu e-postayı dikkate almayın.
                </p>
              </div>
            </td>
          </tr>
        </table>
        
        <!-- Footer -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:520px;margin-top:20px;">
          <tr>
            <td align="center" style="color:#52525b;font-size:12px;padding:20px;">
              &copy; 2026 Eyeon.site. Tüm hakları saklıdır.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject: 'Eyeon.site — E-posta Adresinizi Doğrulayın',
      html,
      text: `Hesabınızı doğrulamak için şu linke tıklayın: ${verifyUrl}`
    });

    log(`DEBUG: Verification email sent to ${email}`);
  }

  async function sendPasswordResetEmail(email: string, token: string, name?: string | null) {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');

    if (!smtpHost || !smtpUser || !smtpPass) {
      log(`DEBUG: SMTP not configured — reset link: ${resetUrl}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass }
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:'Inter', -apple-system, sans-serif;color:#fafafa;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#09090b;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#18181b;border:1px solid #27272a;border-radius:24px;overflow:hidden;box-shadow:0 20px 25px -5px rgba(0,0,0,0.3);">
          <!-- Header/Logo -->
          <tr>
            <td align="center" style="padding:40px 40px 20px 40px;">
              <div style="background-color:#f97316;width:48px;height:48px;border-radius:12px;display:inline-block;line-height:48px;text-align:center;box-shadow:0 0 20px rgba(249,115,22,0.2);">
                <span style="color:white;font-size:24px;font-weight:800;">E</span>
              </div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding:0 40px 40px 40px;text-align:center;">
              <h1 style="font-size:24px;font-weight:800;margin:0 0 12px 0;letter-spacing:-0.02em;">Şifre Sıfırlama</h1>
              <p style="color:#a1a1aa;font-size:15px;line-height:24px;margin:0 0 32px 0;">
                Şifrenizi sıfırlama isteği aldık. Aşağıdaki butona tıklayarak yeni bir şifre belirleyebilirsiniz.
              </p>
              
              <!-- CTA Button -->
              <a href="${resetUrl}" style="display:inline-block;background-color:#f97316;color:white;text-decoration:none;padding:16px 32px;border-radius:12px;font-weight:800;font-size:15px;box-shadow:0 10px 15px -3px rgba(249,115,22,0.2);">
                Şifremi Sıfırla
              </a>
              
              <div style="margin-top:32px;padding-top:32px;border-top:1px solid #27272a;">
                <p style="color:#52525b;font-size:13px;margin:0;">
                  Bu link 1 saat geçerlidir. Eğer bu isteği siz yapmadıysanız, bu e-postayı güvenle silebilirsiniz.
                </p>
              </div>
            </td>
          </tr>
        </table>
        
        <!-- Footer -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:520px;margin-top:20px;">
          <tr>
            <td align="center" style="color:#52525b;font-size:12px;padding:20px;">
              &copy; 2026 Eyeon.site. Tüm hakları saklıdır.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject: 'Eyeon.site — Şifre Sıfırlama İsteği',
      html,
      text: `Şifrenizi sıfırlamak için şu linke tıklayın: ${resetUrl}`
    });
  }

  // --- AUTH ROUTES ---

  // Forgot Password
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });
      
      if (user) {
        const token = generateVerifyToken();
        const expires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

        await prisma.user.update({
          where: { id: user.id },
          data: { resetPasswordToken: token, resetPasswordExpires: expires }
        });

        sendPasswordResetEmail(email, token, user.name).catch(e => log(`DEBUG: Reset email error: ${e.message}`));
      }

      // Always return success for security
      res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to process request' });
    }
  });

  // Reset Password
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

      const user = await prisma.user.findFirst({
        where: {
          resetPasswordToken: token,
          resetPasswordExpires: { gt: new Date() }
        }
      });

      if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });

      const hashedPassword = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpires: null,
          loginAttempts: 0,
          lockUntil: null
        }
      });

      res.json({ message: 'Password reset successful' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  // Register
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) return res.status(400).json({ error: 'Email already exists' });

      const hashedPassword = await bcrypt.hash(password, 12);
      const token = generateVerifyToken();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          emailVerified: false,
          emailVerifyToken: token,
          emailVerifyExpires: expires
        }
      });

      // Create default workspace
      await prisma.workspace.create({
        data: { name: 'My Workspace', userId: user.id }
      });

      // Send verification email (non-blocking)
      sendVerificationEmail(email, token, name).catch(e => log(`DEBUG: Email error: ${e.message}`));

      res.status(201).json({ message: 'Registration successful. Please check your email to verify your account.', email });
    } catch (error: any) {
      log(`DEBUG: Register error: ${error.message}`);
      res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  });

  // Verify Email
  app.get('/api/auth/verify-email', async (req, res) => {
    try {
      const { token } = req.query as { token: string };
      if (!token) return res.status(400).json({ error: 'Token required' });

      const user = await prisma.user.findFirst({
        where: {
          emailVerifyToken: token,
          emailVerifyExpires: { gt: new Date() }
        }
      });

      if (!user) return res.status(400).json({ error: 'Invalid or expired verification token' });

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerifyToken: null,
          emailVerifyExpires: null
        }
      });

      // Create default workspace if it doesn't exist yet (edge case)
      const wsCount = await prisma.workspace.count({ where: { userId: user.id } });
      if (wsCount === 0) {
        await prisma.workspace.create({ data: { name: 'My Workspace', userId: user.id } });
      }

      const jwtToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token: jwtToken, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error: any) {
      log(`DEBUG: Verify email error: ${error.message}`);
      res.status(500).json({ error: 'Verification failed' });
    }
  });

  // Resend Verification Email
  app.post('/api/auth/resend-verification', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email required' });

      const user = await prisma.user.findUnique({ where: { email } });
      // Return generic success even if user not found (security: don't reveal existence)
      if (!user || user.emailVerified) {
        return res.json({ message: 'If that email exists and is unverified, a new link has been sent.' });
      }

      const token = generateVerifyToken();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifyToken: token, emailVerifyExpires: expires }
      });

      sendVerificationEmail(email, token, user.name).catch(e => log(`DEBUG: Resend email error: ${e.message}`));

      res.json({ message: 'If that email exists and is unverified, a new link has been sent.' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to resend verification' });
    }
  });

  // Login (with brute force protection)
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

      const user = await prisma.user.findUnique({ where: { email } });

      // Generic error to prevent user enumeration
      if (!user || !user.password) {
        return res.status(400).json({ error: 'Invalid email or password' });
      }

      // Check if user is blocked
      if (user.isBlocked) {
        return res.status(403).json({ error: 'Your account has been blocked by an administrator.' });
      }

      // Check account lock
      if (user.lockUntil && user.lockUntil > new Date()) {
        const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
        return res.status(429).json({
          error: `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
          lockedUntil: user.lockUntil
        });
      }

      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        // Increment failed attempts
        const newAttempts = (user.loginAttempts || 0) + 1;
        const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS;
        const lockUntil = shouldLock ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000) : null;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            loginAttempts: newAttempts,
            ...(lockUntil ? { lockUntil } : {})
          }
        });

        if (shouldLock) {
          return res.status(429).json({
            error: `Too many failed attempts. Account locked for ${LOCK_DURATION_MINUTES} minutes.`
          });
        }

        const remaining = MAX_LOGIN_ATTEMPTS - newAttempts;
        return res.status(400).json({
          error: `Invalid email or password. ${remaining} attempt(s) remaining before lockout.`
        });
      }

      // Check email verification
      if (!user.emailVerified) {
        return res.status(403).json({
          error: 'Please verify your email address before signing in.',
          unverified: true,
          email: user.email
        });
      }

      // Successful login — reset brute force counters
      await prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: 0, lockUntil: null }
      });

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error: any) {
      log(`DEBUG: Login error: ${error.message}`);
      res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  });

  app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) return res.sendStatus(404);
      res.json({ id: user.id, email: user.email, name: user.name, role: user.role, plan: user.subscriptionPlan, isBlocked: user.isBlocked });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- ADMIN ROUTES ---
  app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const [totalUsers, totalMonitors, activeMonitors, totalWorkspaces] = await Promise.all([
        prisma.user.count(),
        prisma.monitor.count(),
        prisma.monitor.count({ where: { status: 'up' } }),
        prisma.workspace.count()
      ]);
      res.json({ totalUsers, totalMonitors, activeMonitors, totalWorkspaces });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/admin/users', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          role: true,
          isBlocked: true,
          subscriptionPlan: true,
          subscriptionExpires: true,
          _count: {
            select: { workspaces: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/users/:id/block', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { isBlocked } = req.body;
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { isBlocked }
      });
      res.json({ id: user.id, isBlocked: user.isBlocked });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/users/:id/subscription', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { plan, expiresAt } = req.body;
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { 
          subscriptionPlan: plan, 
          subscriptionExpires: expiresAt ? new Date(expiresAt) : null 
        }
      });
      res.json({ id: user.id, subscriptionPlan: user.subscriptionPlan, subscriptionExpires: user.subscriptionExpires });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/users/:id/role', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { role } = req.body;
      // Prevent an admin from removing their own admin status accidentally
      if (req.user.id === req.params.id && role !== 'SYSTEM_ADMIN') {
        return res.status(400).json({ error: 'You cannot remove your own admin privileges.' });
      }

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { role }
      });
      res.json({ id: user.id, role: user.role });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/admin/logs', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      // In a real app, read from a file or DB. Here we return the debug log buffer.
      res.json({ logs: debugLogs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Public Endpoints
  app.get('/api/public/workspaces/:id', async (req, res) => {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: req.params.id }
      });
      if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
      res.json(workspace);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/public/workspaces/:id/monitors', async (req, res) => {
    try {
      const monitors = await prisma.monitor.findMany({
        where: { workspaceId: req.params.id }
      });
      res.json(monitors);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- HELPERS ---
  const checkWorkspaceAccess = async (workspaceId: string, userId: string) => {
    return await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [{ userId }, { members: { some: { userId } } }]
      }
    });
  };

  // Workspaces
  app.get('/api/workspaces', authenticateToken, async (req: any, res) => {
    try {
      const workspaces = await prisma.workspace.findMany({ 
        where: { 
          OR: [{ userId: req.user.id }, { members: { some: { userId: req.user.id } } }]
        } 
      });
      res.json(workspaces);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/user', authenticateToken, async (req: any, res) => {
    try {
      const { name, email, password } = req.body;
      const updateData: any = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (password) {
        updateData.password = await bcrypt.hash(password, 12);
      }
      
      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData
      });
      res.json({ id: user.id, name: user.name, email: user.email });
    } catch (error: any) {
      if (error.code === 'P2002') return res.status(400).json({ error: 'Email already exists' });
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/workspaces/:id', authenticateToken, async (req: any, res) => {
    try {
      const ws = await checkWorkspaceAccess(req.params.id, req.user.id);
      if (!ws) return res.status(404).json({ error: 'Workspace not found' });

      const { name, smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, telegramBotToken } = req.body;
      const updatedWorkspace = await prisma.workspace.update({
        where: { id: req.params.id },
        data: { 
          name, 
          smtpHost, 
          smtpPort: smtpPort ? parseInt(smtpPort) : null, 
          smtpUser, 
          smtpPass, 
          smtpFrom,
          telegramBotToken 
        }
      });
      res.json(updatedWorkspace);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  // Workspace Members
  app.get('/api/workspaces/:id/members', authenticateToken, async (req: any, res) => {
    try {
      const ws = await checkWorkspaceAccess(req.params.id, req.user.id);
      if (!ws) return res.status(404).json({ error: 'Workspace not found' });
      
      const workspace = await prisma.workspace.findUnique({
        where: { id: req.params.id },
        include: {
          user: { select: { id: true, name: true, email: true } }, // Owner
          members: {
            include: { user: { select: { id: true, name: true, email: true } } }
          }
        }
      });
      
      if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

      // Combine owner and members into a unified array
      const membersList = [
        { ...workspace.user, role: 'OWNER', memberId: 'owner' },
        ...workspace.members.map((m: any) => ({ ...m.user, role: m.role, memberId: m.id }))
      ];

      res.json(membersList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/workspaces/:id/members', authenticateToken, async (req: any, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required' });

      const ws = await prisma.workspace.findUnique({ where: { id: req.params.id } });
      if (!ws) return res.status(404).json({ error: 'Workspace not found' });

      // Only OWNER can add members (or we can allow ADMINs too. Let's allow OWNER or ADMIN)
      const hasAccess = await checkWorkspaceAccess(req.params.id, req.user.id);
      if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

      const userToAdd = await prisma.user.findUnique({ where: { email } });
      if (!userToAdd) return res.status(404).json({ error: 'User not found' });

      if (userToAdd.id === ws.userId) return res.status(400).json({ error: 'User is already the owner' });

      const existingMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: req.params.id, userId: userToAdd.id } }
      });
      if (existingMember) return res.status(400).json({ error: 'User is already a member' });

      const newMember = await prisma.workspaceMember.create({
        data: {
          workspaceId: req.params.id,
          userId: userToAdd.id,
          role: 'ADMIN'
        },
        include: { user: { select: { id: true, name: true, email: true } } }
      });

      res.json({ ...newMember.user, role: newMember.role, memberId: newMember.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/workspaces/:id/members/:memberId', authenticateToken, async (req: any, res) => {
    try {
      const ws = await checkWorkspaceAccess(req.params.id, req.user.id);
      if (!ws) return res.status(403).json({ error: 'Forbidden' });

      await prisma.workspaceMember.delete({ where: { id: req.params.memberId } });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Monitor Groups
  app.get('/api/monitor-groups', authenticateToken, async (req: any, res) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      if (!workspaceId) return res.status(400).json({ error: 'Workspace ID required' });
      
      const ws = await checkWorkspaceAccess(workspaceId, req.user.id);
      if (!ws) return res.status(403).json({ error: 'Forbidden' });

      const groups = await prisma.monitorGroup.findMany({ 
        where: { workspaceId },
        orderBy: { order: 'asc' }
      });
      res.json(groups);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/monitor-groups', authenticateToken, async (req: any, res) => {
    try {
      const parsed = monitorGroupCreateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      
      const ws = await checkWorkspaceAccess(parsed.data.workspaceId, req.user.id);
      if (!ws) return res.status(403).json({ error: 'Forbidden' });

      const lastGroup = await prisma.monitorGroup.findFirst({
        where: { workspaceId: parsed.data.workspaceId },
        orderBy: { order: 'desc' }
      });
      const nextOrder = lastGroup ? lastGroup.order + 1 : 0;
      
      const group = await prisma.monitorGroup.create({ 
        data: { ...parsed.data, order: nextOrder } 
      });
      res.json(group);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/monitor-groups/reorder', authenticateToken, async (req: any, res) => {
    try {
      const { groupIds } = req.body; // Array of group IDs in the new order
      if (!Array.isArray(groupIds)) return res.status(400).json({ error: 'Invalid group IDs array' });

      // Assuming all groups belong to the same workspace, check first group
      if (groupIds.length > 0) {
        const group = await prisma.monitorGroup.findUnique({ where: { id: groupIds[0] } });
        if (!group) return res.status(404).json({ error: 'Group not found' });
        const ws = await checkWorkspaceAccess(group.workspaceId, req.user.id);
        if (!ws) return res.status(403).json({ error: 'Forbidden' });
      }

      const updatePromises = groupIds.map((id: string, index: number) =>
        prisma.monitorGroup.update({
          where: { id },
          data: { order: index }
        })
      );
      
      await prisma.$transaction(updatePromises);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/monitor-groups/:id', authenticateToken, async (req: any, res) => {
    try {
      const existing = await prisma.monitorGroup.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Not found' });
      
      const ws = await checkWorkspaceAccess(existing.workspaceId, req.user.id);
      if (!ws) return res.status(403).json({ error: 'Forbidden' });
      
      const parsed = monitorGroupUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      
      const group = await prisma.monitorGroup.update({ where: { id: req.params.id }, data: parsed.data });
      res.json(group);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/monitor-groups/:id', authenticateToken, async (req: any, res) => {
    try {
      const existing = await prisma.monitorGroup.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Not found' });
      
      const ws = await checkWorkspaceAccess(existing.workspaceId, req.user.id);
      if (!ws) return res.status(403).json({ error: 'Forbidden' });
      
      // The relation has onDelete: Cascade for Workspace->MonitorGroup. 
      // For MonitorGroup->Monitor we have onDelete: SetNull. So deleting a group will just unlink the monitors.
      await prisma.monitorGroup.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Monitors
  app.get('/api/monitors', authenticateToken, async (req: any, res) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      if (!workspaceId) return res.status(400).json({ error: 'Workspace ID required' });
      
      const ws = await checkWorkspaceAccess(workspaceId, req.user.id);
      if (!ws) return res.status(403).json({ error: 'Forbidden' });

      const monitors = await prisma.monitor.findMany({ where: { workspaceId } });
      res.json(monitors);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/monitors', authenticateToken, async (req: any, res) => {
    try {
      const parsed = monitorCreateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      
      const ws = await checkWorkspaceAccess(parsed.data.workspaceId, req.user.id);
      if (!ws) return res.status(403).json({ error: 'Forbidden' });
      
      const monitor = await prisma.monitor.create({ data: parsed.data });
      io.emit('monitor-created', monitor);
      res.json(monitor);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/monitors/bulk/action', authenticateToken, async (req: any, res) => {
    try {
      const { ids, action } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No IDs provided' });
      if (!['pause', 'resume', 'delete'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
      
      const userWorkspaces = await prisma.workspace.findMany({ 
        where: { 
          OR: [{ userId: req.user.id }, { members: { some: { userId: req.user.id } } }]
        }, 
        select: { id: true } 
      });
      const wsIds = userWorkspaces.map((w: any) => w.id);
      const ownedMonitors = await prisma.monitor.findMany({ where: { id: { in: ids }, workspaceId: { in: wsIds } }, select: { id: true } });
      const ownedIds = ownedMonitors.map((m: any) => m.id);
      if (ownedIds.length === 0) return res.status(403).json({ error: 'Forbidden' });
      if (action === 'delete') {
        await prisma.monitor.deleteMany({ where: { id: { in: ownedIds } } });
        ownedIds.forEach((id: string) => io.emit('monitor-deleted', id));
      } else {
        const newStatus = action === 'pause' ? 'paused' : 'up';
        await prisma.monitor.updateMany({ where: { id: { in: ownedIds } }, data: { status: newStatus } });
        const updatedMonitors = await prisma.monitor.findMany({ where: { id: { in: ownedIds } } });
        updatedMonitors.forEach((m: any) => io.emit('monitor-updated', m));
      }
      res.json({ success: true, count: ownedIds.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/monitors/:id', authenticateToken, async (req: any, res) => {
    try {
      const monitor = await prisma.monitor.findUnique({ where: { id: req.params.id } });
      if (!monitor) return res.status(404).json({ error: 'Not found' });
      
      const ws = await checkWorkspaceAccess(monitor.workspaceId, req.user.id);
      if (!ws) return res.status(403).json({ error: 'Forbidden' });
      
      res.json(monitor);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/monitors/:id', authenticateToken, async (req: any, res) => {
    try {
      const existing = await prisma.monitor.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Not found' });
      
      const ws = await checkWorkspaceAccess(existing.workspaceId, req.user.id);
      if (!ws) return res.status(403).json({ error: 'Forbidden' });
      
      const parsed = monitorUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const monitor = await prisma.monitor.update({ where: { id: req.params.id }, data: parsed.data });
      io.emit('monitor-updated', monitor);
      res.json(monitor);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/monitors/:id', authenticateToken, async (req: any, res) => {
    try {
      const existing = await prisma.monitor.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Not found' });
      
      const ws = await checkWorkspaceAccess(existing.workspaceId, req.user.id);
      if (!ws) return res.status(403).json({ error: 'Forbidden' });
      
      await prisma.monitor.delete({ where: { id: req.params.id } });
      io.emit('monitor-deleted', req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Alerts
  app.get('/api/alerts', authenticateToken, async (req: any, res) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      if (!workspaceId) return res.status(400).json({ error: 'Workspace ID required' });
      
      const logs = await prisma.pingLog.findMany({
        where: { monitor: { workspaceId } },
        orderBy: { timestamp: 'desc' },
        take: 300,
        include: { monitor: true }
      });
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Logs
  app.get('/api/monitors/:id/logs', authenticateToken, async (req: any, res) => {
    try {
      const logs = await prisma.pingLog.findMany({
        where: { monitorId: req.params.id },
        orderBy: { timestamp: 'desc' },
        take: 50
      });
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Stats
  app.get('/api/monitors/:id/stats', authenticateToken, async (req: any, res) => {
    try {
      const monitorId = req.params.id;
      const periods = [
        { label: '24h', days: 1 },
        { label: '7d', days: 7 },
        { label: '30d', days: 30 }
      ];

      const stats = await Promise.all(periods.map(async (period) => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - period.days);

        const total = await prisma.pingLog.count({
          where: { monitorId, timestamp: { gte: startDate } }
        });

        const up = await prisma.pingLog.count({
          where: { monitorId, timestamp: { gte: startDate }, status: 1 }
        });

        const percentage = total > 0 ? (up / total) * 100 : 100;

        return {
          name: period.label,
          uptime: parseFloat(percentage.toFixed(2))
        };
      }));

      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // History (Last 7 days)
  app.get('/api/monitors/:id/history', authenticateToken, async (req: any, res) => {
    try {
      const monitorId = req.params.id;
      const days = Array.from({ length: 7 }, (_, i) => 6 - i);
      
      const results = await Promise.all(days.map(async (i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(date.getDate() + 1);

        const total = await prisma.pingLog.count({
          where: { 
            monitorId, 
            timestamp: { gte: date, lt: nextDate } 
          }
        });

        const down = await prisma.pingLog.count({
          where: { 
            monitorId, 
            status: 0,
            timestamp: { gte: date, lt: nextDate } 
          }
        });

        let uptime = 100;
        if (total > 0) {
          uptime = ((total - down) / total) * 100;
        } else {
          uptime = -1;
        }

        return { date, uptime, index: i };
      }));

      results.sort((a, b) => b.index - a.index);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Heartbeat Endpoint
  app.get('/api/heartbeat/:id', async (req, res) => {
    try {
      const monitor = await prisma.monitor.findUnique({ where: { id: req.params.id }, include: { workspace: true } });
      if (!monitor || monitor.monitorType !== 'HEARTBEAT') return res.status(404).json({ error: 'Not found' });
      
      const logEntry = await prisma.pingLog.create({ data: { monitorId: monitor.id, status: 1, responseTime: 0, statusCode: 200 } });
      const updated = await prisma.monitor.update({ where: { id: monitor.id }, data: { lastChecked: new Date(), currentStatus: 'up', incidentActive: false, consecutiveFailures: 0 } });
      
      if (monitor.currentStatus !== 'up') {
        await dispatchNotification(monitor, monitor.workspace, 'up', 'Heartbeat received');
      }
      
      io.emit('ping-log', logEntry);
      io.emit('monitor-updated', updated);
      res.json({ success: true, message: 'Heartbeat OK' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Maintenance Windows
  app.get('/api/maintenance-windows', authenticateToken, async (req: any, res) => {
    try {
      const monitorId = req.query.monitorId as string;
      const windows = await prisma.maintenanceWindow.findMany({ where: { monitorId } });
      res.json(windows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/maintenance-windows', authenticateToken, async (req: any, res) => {
    try {
      const { monitorId, startTime, endTime } = req.body;
      const win = await prisma.maintenanceWindow.create({ data: { monitorId, startTime: new Date(startTime), endTime: new Date(endTime) } });
      res.json(win);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  
  app.delete('/api/maintenance-windows/:id', authenticateToken, async (req: any, res) => {
    try {
      await prisma.maintenanceWindow.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Status Pages
  app.get('/api/status-pages', authenticateToken, async (req: any, res) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      const pages = await prisma.publicStatusPage.findMany({ where: { workspaceId }, include: { monitors: true } });
      res.json(pages);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/status-pages', authenticateToken, async (req: any, res) => {
    try {
      const { workspaceId, title, description, slug, monitorIds } = req.body;
      const page = await prisma.publicStatusPage.create({
        data: {
          workspaceId, title, description, slug,
          monitors: { connect: monitorIds.map((id: string) => ({ id })) }
        },
        include: { monitors: true }
      });
      res.json(page);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.put('/api/status-pages/:id', authenticateToken, async (req: any, res) => {
    try {
      const { title, description, slug, monitorIds } = req.body;
      const page = await prisma.publicStatusPage.update({
        where: { id: req.params.id },
        data: {
          title, description, slug,
          monitors: { set: monitorIds.map((id: string) => ({ id })) }
        },
        include: { monitors: true }
      });
      res.json(page);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/status-pages/:id', authenticateToken, async (req: any, res) => {
    try {
      await prisma.publicStatusPage.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/public-status/:slug', async (req, res) => {
    try {
      const page = await prisma.publicStatusPage.findUnique({
        where: { slug: req.params.slug },
        include: { monitors: { select: { id: true, name: true, currentStatus: true, interval: true, url: true, status: true } } }
      });
      if (!page) return res.status(404).json({ error: 'Not found' });

      const monitorIds = page.monitors.map(m => m.id);
      
      if (monitorIds.length > 0) {
        const cutoffDate = new Date();
        cutoffDate.setUTCHours(0, 0, 0, 0);
        cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 90);

        const results = await prisma.$queryRaw<any[]>`
          SELECT 
            "monitorId",
            date_trunc('day', timestamp) AS day,
            count(*)::integer AS total,
            sum(case when status = 0 then 1 else 0 end)::integer AS down,
            sum(case when status = 2 then 1 else 0 end)::integer AS degraded
          FROM "PingLog"
          WHERE "monitorId" IN (${Prisma.join(monitorIds)})
            AND timestamp >= ${cutoffDate}
          GROUP BY "monitorId", day
          ORDER BY day ASC
        `;

        // Generate the last 90 days of date strings in UTC "YYYY-MM-DD"
        const historyDays = 90;
        const dates: string[] = [];
        for (let i = historyDays - 1; i >= 0; i--) {
          const d = new Date();
          d.setUTCHours(0, 0, 0, 0);
          d.setUTCDate(d.getUTCDate() - i);
          dates.push(d.toISOString().split('T')[0]);
        }

        // Map results by monitor and day
        const monitorHistoryMap: Record<string, Record<string, { total: number, down: number, degraded: number }>> = {};
        for (const row of results) {
          const mId = row.monitorId;
          const dayStr = new Date(row.day).toISOString().split('T')[0];
          if (!monitorHistoryMap[mId]) {
            monitorHistoryMap[mId] = {};
          }
          monitorHistoryMap[mId][dayStr] = {
            total: row.total,
            down: row.down,
            degraded: row.degraded
          };
        }

        // Attach history to each monitor
        for (const monitor of page.monitors) {
          const history = dates.map(dateStr => {
            const dayData = monitorHistoryMap[monitor.id]?.[dateStr];
            if (!dayData || dayData.total === 0) {
              return {
                date: dateStr,
                uptime: -1,
                status: 'nodata',
                down: 0
              };
            }
            const { total, down, degraded } = dayData;
            const uptime = parseFloat(((total - down) / total * 100).toFixed(2));
            
            let status = 'up';
            if (down > 0) {
              if (down / total > 0.1) {
                status = 'down';
              } else {
                status = 'partial_down';
              }
            } else if (degraded > 0) {
              status = 'degraded';
            }
            
            return {
              date: dateStr,
              uptime,
              status,
              down
            };
          });

          // Calculate average uptime (excluding nodata)
          const validHistory = history.filter(h => h.uptime > -1);
          const avgUptime = validHistory.length > 0
            ? parseFloat((validHistory.reduce((acc, curr) => acc + curr.uptime, 0) / validHistory.length).toFixed(2))
            : 100;

          (monitor as any).history = history;
          (monitor as any).avgUptime = avgUptime;
        }
      }

      res.json(page);
    } catch (e: any) { 
      log(`DEBUG: Error in public-status API: ${e.message}`);
      res.status(500).json({ error: e.message }); 
    }
  });

  // --- NOTIFICATION ENGINE ---
  async function dispatchNotification(monitor: any, workspace: any, type: 'up' | 'down' | 'degraded' | 'ssl_expiry', reason?: string) {
    let statusText = '🚨 INCIDENT ALERT';
    if (type === 'up') statusText = '✅ RECOVERED';
    if (type === 'degraded') statusText = '⚠️ PERFORMANCE DEGRADATION';
    if (type === 'ssl_expiry') statusText = '🔒 SSL CERTIFICATE EXPIRING';
    const message = `${statusText}\nMonitor: ${monitor.name}\nURL: ${monitor.url}\n${reason ? `Reason: ${reason}\n` : ''}Time: ${new Date().toISOString()}`;

    const dispatchers: Promise<any>[] = [];

    // Telegram
    const botToken = workspace?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    if (monitor.telegramChatId && botToken) {
      dispatchers.push(axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, { chat_id: monitor.telegramChatId, text: message }).then(() => log(`DEBUG: Telegram sent for ${monitor.name}`)).catch((e: any) => log(`DEBUG: Telegram failed: ${e.message}`)));
    }
    // Slack
    if (monitor.slackWebhook) {
      dispatchers.push(axios.post(monitor.slackWebhook, { text: message }).catch((e: any) => log(`DEBUG: Slack failed: ${e.message}`)));
    }
    // Zoom
    if (monitor.zoomWebhook) {
      dispatchers.push(axios.post(monitor.zoomWebhook, { is_markdown_support: true, content: { head: { text: statusText }, body: [{ type: 'message', text: message }] } }).catch((e: any) => log(`DEBUG: Zoom failed: ${e.message}`)));
    }
    // Discord
    if (monitor.discordWebhook) {
      dispatchers.push(axios.post(monitor.discordWebhook, { content: message }).catch((e: any) => log(`DEBUG: Discord failed: ${e.message}`)));
    }
    // Microsoft Teams
    if (monitor.teamsWebhook) {
      dispatchers.push(axios.post(monitor.teamsWebhook, { text: message }).catch((e: any) => log(`DEBUG: Teams failed: ${e.message}`)));
    }
    // Generic Webhook
    if (monitor.genericWebhook) {
      dispatchers.push(axios.post(monitor.genericWebhook, { monitor: monitor.name, url: monitor.url, status: type, reason, timestamp: new Date().toISOString() }).catch((e: any) => log(`DEBUG: Generic webhook failed: ${e.message}`)));
    }
    // Email
    if (monitor.alertEmail && workspace?.smtpHost && workspace?.smtpUser && workspace?.smtpPass) {
      dispatchers.push((async () => {
        try {
          const transporter = nodemailer.createTransport({ host: workspace.smtpHost, port: workspace.smtpPort || 587, secure: workspace.smtpPort === 465, auth: { user: workspace.smtpUser, pass: workspace.smtpPass } });
          await transporter.sendMail({ from: workspace.smtpFrom || workspace.smtpUser, to: monitor.alertEmail, subject: `${statusText}: ${monitor.name}`, text: message });
          log(`DEBUG: Email sent for ${monitor.name}`);
        } catch (e: any) { log(`DEBUG: Email failed: ${e.message}`); }
      })());
    }

    await Promise.allSettled(dispatchers);
  }

  // --- LOG CLEANUP JOB ---
  async function runLogCleanup() {
    while (true) {
      try {
        const workspaces = await prisma.workspace.findMany({ select: { id: true, logRetentionDays: true } });
        for (const ws of workspaces) {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - (ws.logRetentionDays || 90));
          const deleted = await prisma.pingLog.deleteMany({
            where: { monitor: { workspaceId: ws.id }, timestamp: { lt: cutoff } }
          });
          if (deleted.count > 0) log(`DEBUG: Cleaned ${deleted.count} old logs for workspace ${ws.id}`);
        }
      } catch (err: any) {
        log(`DEBUG: Log cleanup error: ${err.message}`);
      }
      // Run once every 24 hours
      await new Promise(resolve => setTimeout(resolve, 24 * 60 * 60 * 1000));
    }
  }

  // --- PINGER ENGINE ---
  async function pingOneMonitor(monitor: any) {
    let status = 1;
    let responseTime = 0;
    let errorMessage = '';
    let statusCode = 0;
    const sslUpdateData: any = {};
    const dnsUpdateData: any = {};

    // Check Maintenance Window
    const now = new Date();
    const activeMaintenance = await prisma.maintenanceWindow.findFirst({
      where: {
        monitorId: monitor.id,
        active: true,
        startTime: { lte: now },
        endTime: { gte: now }
      }
    });

    if (activeMaintenance) {
      if (monitor.currentStatus !== 'maintenance') {
        const updatedMonitor = await prisma.monitor.update({
          where: { id: monitor.id },
          data: { currentStatus: 'maintenance', incidentActive: false, consecutiveFailures: 0 }
        });
        io.emit('monitor-updated', updatedMonitor);
      }
      return; // Skip pinging during maintenance
    }

    if (monitor.monitorType === 'HEARTBEAT') {
      return; // Handled by separate cron loop
    }

    // DNS check
    try {
      const dnsResult = await checkDNS(monitor.url);
      dnsUpdateData.dnsResolutionTime = dnsResult.resolutionTime;
      if (dnsResult.resolvedIp) {
        if (monitor.dnsResolvedIp && monitor.dnsResolvedIp !== dnsResult.resolvedIp) {
          dnsUpdateData.dnsLastChanged = new Date();
          log(`DEBUG: DNS change detected for ${monitor.name}: ${monitor.dnsResolvedIp} → ${dnsResult.resolvedIp}`);
        }
        dnsUpdateData.dnsResolvedIp = dnsResult.resolvedIp;
      }
    } catch { /* ignore dns errors */ }

    // SSL check (every 6 hours)
    const sslCheckDue = !monitor.sslLastChecked || (Date.now() - new Date(monitor.sslLastChecked).getTime() > 6 * 60 * 60 * 1000);
    if (monitor.sslCheckEnabled && sslCheckDue) {
      try {
        const ssl = await checkSSL(monitor.url);
        sslUpdateData.sslValid = ssl.valid;
        sslUpdateData.sslExpiry = ssl.expiry;
        sslUpdateData.sslIssuer = ssl.issuer;
        sslUpdateData.sslSubject = ssl.subject;
        sslUpdateData.sslDaysLeft = ssl.daysLeft;
        sslUpdateData.sslLastChecked = new Date();
        // SSL expiry alerts
        if (ssl.daysLeft !== null && ssl.daysLeft <= 7) {
          await dispatchNotification(monitor, monitor.workspace, 'ssl_expiry', `Certificate expires in ${ssl.daysLeft} day(s)`);
        }
        log(`DEBUG: SSL check for ${monitor.name}: valid=${ssl.valid}, daysLeft=${ssl.daysLeft}`);
      } catch { /* ignore ssl errors */ }
    }

    // HTTP or TCP ping
    const start = Date.now();
    try {
      if (monitor.monitorType === 'TCP') {
        if (!monitor.url || !monitor.port) throw new Error('Host and port required for TCP check');
        const tcpResult = await checkTCP(monitor.url, monitor.port);
        responseTime = tcpResult.responseTime;
        statusCode = 0;
      } else if (monitor.monitorType === 'PING') {
        if (!monitor.url) throw new Error('Host/IP required for PING check');
        const pingRes = await ping.promise.probe(monitor.url, { timeout: 10 });
        if (!pingRes.alive) {
          status = 0;
          errorMessage = 'Host unreachable (ICMP ping failed)';
        } else {
          responseTime = typeof pingRes.time === 'number' ? pingRes.time : Number(pingRes.time) || 0;
          statusCode = 0;
        }
      } else {
        // HTTP
        const httpMethod = (monitor.method || 'GET').toLowerCase();
        let headers: any = { 'User-Agent': 'Eyeon.site/2.0' };
        if (monitor.customHeaders) {
          try { headers = { ...headers, ...JSON.parse(monitor.customHeaders) }; } catch (e) {}
        }
        
        const res = await (axios as any)[httpMethod](monitor.url, {
          timeout: 10000,
          headers,
          validateStatus: () => true
        });
        responseTime = Date.now() - start;
        statusCode = res.status;
        if (res.status >= 400) { status = 0; errorMessage = `HTTP ${res.status}`; }
        else if (monitor.responseTimeThreshold && responseTime > monitor.responseTimeThreshold) { status = 2; errorMessage = `Slow: ${responseTime}ms > ${monitor.responseTimeThreshold}ms`; }
        else if (monitor.expectedKeyword && typeof res.data === 'string' && !res.data.includes(monitor.expectedKeyword)) {
           status = 0; errorMessage = `Keyword missing: ${monitor.expectedKeyword}`;
        }
      }
    } catch (err: any) {
      status = 0; errorMessage = err.message; responseTime = Date.now() - start;
      log(`DEBUG: Ping failed for ${monitor.name}: ${errorMessage}`);
    }

    // Create log entry
    const logEntry = await prisma.pingLog.create({ data: { monitorId: monitor.id, status, responseTime, errorMessage, statusCode } });

    // Evaluate alerts
    let newIncidentActive = monitor.incidentActive;
    let newConsecutiveFailures = monitor.consecutiveFailures || 0;
    let newCurrentStatus = monitor.currentStatus;

    if (status === 0 || status === 2) {
      newConsecutiveFailures += 1;
      const alertType = status === 0 ? 'down' : 'degraded';
      if (newConsecutiveFailures >= (monitor.alertThreshold || 2)) {
        if (!newIncidentActive || (newIncidentActive && newCurrentStatus === 'degraded' && alertType === 'down')) {
          newIncidentActive = true; newCurrentStatus = alertType;
          if (alertType === 'down' || monitor.notifyOnDegraded) {
            await dispatchNotification(monitor, monitor.workspace, alertType as any, errorMessage);
          }
        } else if (newIncidentActive && newCurrentStatus !== 'down') { newCurrentStatus = alertType; }
      } else { if (!newIncidentActive) newCurrentStatus = 'up'; }
    } else {
      if (newIncidentActive) await dispatchNotification(monitor, monitor.workspace, 'up');
      newIncidentActive = false; newConsecutiveFailures = 0; newCurrentStatus = 'up';
    }

    const updatedMonitor = await prisma.monitor.update({
      where: { id: monitor.id },
      data: { lastChecked: new Date(), currentStatus: newCurrentStatus, consecutiveFailures: newConsecutiveFailures, incidentActive: newIncidentActive, ...sslUpdateData, ...dnsUpdateData }
    });

    io.emit('ping-log', logEntry);
    io.emit('monitor-updated', updatedMonitor);
    log(`DEBUG: ${monitor.name}: ${status === 1 ? 'UP' : status === 2 ? 'DEGRADED' : 'DOWN'} (${responseTime}ms)`);
  }

  async function runPinger() {
    log('DEBUG: Pinger loop started (parallel mode)');
    while (true) {
      try {
        const now = Date.now();
        const activeMonitors = await prisma.monitor.findMany({ where: { status: { not: 'paused' } }, include: { workspace: true } });
        
        // Regular active monitors (HTTP, TCP)
        const due = activeMonitors.filter(m => m.monitorType !== 'HEARTBEAT' && now - (m.lastChecked?.getTime() || 0) >= (m.interval || 60) * 1000);
        if (due.length > 0) {
          log(`DEBUG: Pinging ${due.length} monitors in parallel`);
          await Promise.allSettled(due.map(m => pingOneMonitor(m).catch((e: any) => log(`DEBUG: pingOneMonitor error for ${m.name}: ${e.message}`))));
        }

        // Heartbeat timeout check
        const hbMonitors = activeMonitors.filter(m => m.monitorType === 'HEARTBEAT');
        for (const hb of hbMonitors) {
          const limitMs = (hb.interval + (hb.heartbeatGrace || 5) * 60) * 1000;
          if (hb.lastChecked && now - hb.lastChecked.getTime() > limitMs && hb.currentStatus !== 'down') {
             const logEntry = await prisma.pingLog.create({ data: { monitorId: hb.id, status: 0, responseTime: 0, errorMessage: 'Heartbeat missed', statusCode: 0 } });
             await dispatchNotification(hb, hb.workspace, 'down', 'Heartbeat missed');
             const updated = await prisma.monitor.update({ where: { id: hb.id }, data: { currentStatus: 'down', incidentActive: true, consecutiveFailures: hb.consecutiveFailures + 1 } });
             io.emit('ping-log', logEntry);
             io.emit('monitor-updated', updated);
             log(`DEBUG: Heartbeat missed for ${hb.name}`);
          }
        }
      } catch (error: any) {
        log(`DEBUG: Pinger error: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  // Vite middleware for development
  const isProd = process.env.NODE_ENV === 'production';
  
  if (!isProd) {
    log('DEBUG: Initializing Vite middleware (DEV MODE)...');
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (error: any) {
      log(`DEBUG: Error initializing Vite: ${error.message}`);
    }
  } else {
    log('DEBUG: Serving production build (PROD MODE)...');
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    log(`DEBUG: Server listening on http://0.0.0.0:${PORT} in ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
    runPinger();
    runLogCleanup();
  });
}

startServer().catch(error => {
  console.error('DEBUG: Failed to start server:', error);
  process.exit(1);
});
