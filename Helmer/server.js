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
import authRoutes, { isLoggedIn } from './routes/authRoutes.js';

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

/**
 * Public Root / Home Page
 */
app.get('/', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Helmer Auth — Logged In</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b132b; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1c2541; padding: 32px; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); text-align: center; max-width: 420px; }
            img { width: 72px; height: 72px; border-radius: 50%; margin-bottom: 16px; border: 2px solid #48cae4; }
            a { color: #48cae4; text-decoration: none; font-weight: bold; }
            .btn { display: inline-block; padding: 10px 20px; margin-top: 16px; border-radius: 8px; background: #e63946; color: #fff; }
          </style>
        </head>
        <body>
          <div class="card">
            <img src="${req.user.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=' + req.user.displayName}" alt="Avatar" />
            <h2>Welcome, ${req.user.displayName}!</h2>
            <p style="color: #90e0ef;">Email: ${req.user.email}</p>
            <p style="color: #888; font-size: 13px;">Google ID: ${req.user.googleId}</p>
            <div style="margin-top: 20px;">
              <a href="/profile" style="margin-right: 15px;">Go to Protected Profile →</a>
              <a href="/auth/logout" class="btn">Log out</a>
            </div>
          </div>
        </body>
      </html>
    `);
  }

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Helmer Auth — Google OAuth 2.0</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b132b; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1c2541; padding: 36px; border-radius: 14px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); text-align: center; max-width: 440px; }
          .google-btn { display: inline-flex; align-items: center; justify-content: center; gap: 12px; background: #fff; color: #1f2937; padding: 12px 24px; border-radius: 30px; font-weight: 600; text-decoration: none; margin-top: 24px; box-shadow: 0 4px 14px rgba(0,0,0,0.15); transition: transform 0.2s; }
          .google-btn:hover { transform: translateY(-2px); }
        </style>
      </head>
      <body>
        <div class="card">
          <h2 style="margin-top: 0;">Google OAuth 2.0 Service</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">Authenticate seamlessly using Google Passport Strategy and MongoDB session management.</p>
          <a href="/auth/google" class="google-btn">
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
