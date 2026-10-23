/**
 * server.js — Node.js & Express Backend with Google OAuth 2.0 & Passport.js
 *
 * Implements:
 * - Environment variable loading via dotenv
 * - MongoDB persistence with Mongoose
 * - Express Session management
 * - Passport Google OAuth 2.0 authentication flow
 * - Protected route middleware (isLoggedIn)
 */

import express from 'express';
import session from 'express-session';
import passport from 'passport';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env
dotenv.config();

// Resolve paths for ES module environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import passport configuration and auth routes
import { configurePassport } from './config/passport.js';
import authRoutes, { isLoggedIn, logoutHandler } from './routes/authRoutes.js';

const app = express();
const PORT = process.env.EXPRESS_PORT || process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/helmer_auth';
const SESSION_SECRET = process.env.SESSION_SECRET || 'helmer-google-oauth-session-secret-key-32b-secure';

// ----------------------------------------------------
// 1. Database Connection (MongoDB / Mongoose)
// ----------------------------------------------------
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('[Database] MongoDB connected successfully at:', MONGO_URI);
  })
  .catch((err) => {
    console.warn('[Database Warning] MongoDB connection failed (running in offline/mock db mode):', err.message);
  });

// ----------------------------------------------------
// 2. Core Request Middleware
// ----------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ----------------------------------------------------
// 3. Session & Authentication Middleware Execution Order
// ----------------------------------------------------
// Step A: Configure express-session BEFORE passport middleware
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Step B: Initialize Passport
app.use(passport.initialize());

// Step C: Alter request object and deserialize user from session
app.use(passport.session());

// Step D: Initialize Passport Google Strategy
configurePassport();

// ----------------------------------------------------
// 4. Mount Authentication & Protected Routes
// ----------------------------------------------------
// Authentication endpoints: /auth/google, /auth/google/callback, /auth/logout
app.use('/auth', authRoutes);

// Direct /logout route
app.get('/logout', logoutHandler);

/**
 * Public Root / Home Page
 * Checks if req.isAuthenticated() is true:
 * - If authenticated: displays welcome greeting using req.user.displayName, profile email/avatar, and a /logout link.
 * - If not authenticated: displays Google OAuth login link (/auth/google).
 */
app.get('/', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const user = req.user || {};
    const displayName = user.displayName || 'Google User';
    const email = user.email || '';
    const avatar =
      user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`;

    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Helmer — Welcome ${displayName}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              background: radial-gradient(circle at 50% 15%, #1e293b 0%, #0b132b 100%);
              color: #f8fafc;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              padding: 24px;
            }
            .card {
              background: rgba(30, 41, 59, 0.75);
              backdrop-filter: blur(16px);
              -webkit-backdrop-filter: blur(16px);
              border: 1px solid rgba(255, 255, 255, 0.1);
              padding: 44px 36px;
              border-radius: 20px;
              box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.6);
              text-align: center;
              max-width: 440px;
              width: 100%;
              transition: transform 0.25s ease, box-shadow 0.25s ease;
            }
            .card:hover {
              transform: translateY(-2px);
              box-shadow: 0 24px 48px -15px rgba(0, 0, 0, 0.7);
            }
            .avatar-container {
              position: relative;
              display: inline-block;
              margin-bottom: 20px;
            }
            .avatar {
              width: 92px;
              height: 92px;
              border-radius: 50%;
              object-fit: cover;
              border: 3px solid #38bdf8;
              box-shadow: 0 0 24px rgba(56, 189, 248, 0.35);
              background: #0f172a;
            }
            .online-badge {
              position: absolute;
              bottom: 4px;
              right: 4px;
              width: 16px;
              height: 16px;
              background: #10b981;
              border-radius: 50%;
              border: 2px solid #1e293b;
            }
            h1 {
              font-size: 24px;
              font-weight: 700;
              letter-spacing: -0.02em;
              color: #ffffff;
              margin-bottom: 8px;
            }
            .email {
              color: #94a3b8;
              font-size: 15px;
              margin-bottom: 28px;
              word-break: break-all;
            }
            .btn-logout {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              width: 100%;
              padding: 13px 24px;
              border-radius: 12px;
              background: #ef4444;
              color: #ffffff;
              text-decoration: none;
              font-weight: 600;
              font-size: 15px;
              box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
              transition: all 0.2s ease;
            }
            .btn-logout:hover {
              background: #dc2626;
              transform: translateY(-1px);
              box-shadow: 0 6px 20px rgba(239, 68, 68, 0.45);
            }
            .tag {
              display: inline-block;
              margin-top: 24px;
              font-size: 12px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="avatar-container">
              <img class="avatar" src="${avatar}" alt="${displayName}'s profile picture" />
              <div class="online-badge" title="Active Session"></div>
            </div>
            <h1>Welcome, ${displayName}!</h1>
            <p class="email">${email}</p>
            <a href="/logout" class="btn-logout" id="logout-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Log out
            </a>
            <div class="tag">Google OAuth 2.0 • Active Session</div>
          </div>
        </body>
      </html>
    `);
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Helmer — Google OAuth 2.0</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: radial-gradient(circle at 50% 15%, #1e293b 0%, #0b132b 100%);
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px;
          }
          .card {
            background: rgba(30, 41, 59, 0.75);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 44px 36px;
            border-radius: 20px;
            box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.6);
            text-align: center;
            max-width: 440px;
            width: 100%;
            transition: transform 0.25s ease, box-shadow 0.25s ease;
          }
          .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 24px 48px -15px rgba(0, 0, 0, 0.7);
          }
          .icon-badge {
            width: 60px;
            height: 60px;
            background: rgba(56, 189, 248, 0.1);
            border: 1px solid rgba(56, 189, 248, 0.2);
            border-radius: 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20px;
            color: #38bdf8;
          }
          h1 {
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: #ffffff;
            margin-bottom: 12px;
          }
          p {
            color: #94a3b8;
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 28px;
          }
          .google-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            background: #ffffff;
            color: #1e293b;
            padding: 13px 28px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 15px;
            text-decoration: none;
            width: 100%;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
            transition: all 0.2s ease;
          }
          .google-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(255, 255, 255, 0.15);
            background: #f8fafc;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon-badge">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h1>Google OAuth 2.0 Service</h1>
          <p>Authenticate seamlessly using Google Passport Strategy and MongoDB session management.</p>
          <a href="/auth/google" class="google-btn" id="google-login-btn">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
            </svg>
            Sign in with Google
          </a>
        </div>
      </body>
    </html>
  `);
});

/**
 * Protected Route: /profile
 * Accessible only to authenticated users via isLoggedIn middleware.
 */
app.get('/profile', isLoggedIn, (req, res) => {
  res.json({
    ok: true,
    message: 'Welcome to your protected profile dashboard.',
    user: req.user,
  });
});

/**
 * Protected Route: /dashboard
 * Alternate protected route requested in requirements.
 */
app.get('/dashboard', isLoggedIn, (req, res) => {
  res.json({
    ok: true,
    message: 'Welcome to your protected operator dashboard.',
    user: req.user,
  });
});

// ----------------------------------------------------
// 5. Start Server
// ----------------------------------------------------
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Express Server] Server running on http://localhost:${PORT}`);
    console.log(`[Express Server] Google Callback URL: ${process.env.GOOGLE_CALLBACK_URL || `http://localhost:${PORT}/auth/google/callback`}`);
  });
}

export default app;
