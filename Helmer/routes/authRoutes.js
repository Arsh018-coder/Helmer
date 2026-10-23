import express from 'express';
import passport from 'passport';

const router = express.Router();

/**
 * Middleware: Verify if user is authenticated in the current session.
 * Protects dashboard, profile, and internal routes.
 */
export function isLoggedIn(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  // If API request, return 401 JSON; otherwise redirect to home
  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: Authentication required.' });
  }
  return res.redirect('/');
}

/**
 * Logout handler: Log out active user, destroy session, and redirect to home
 */
export function logoutHandler(req, res, next) {
  // Passport logout method
  req.logout((err) => {
    if (err) {
      console.error('[Logout Error]:', err);
      return next(err);
    }

    // Destroy express-session completely
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        console.error('[Session Destroy Error]:', destroyErr);
      }
      res.clearCookie('connect.sid');
      return res.redirect('/');
    });
  });
}

/**
 * @route   GET /auth/google
 * @desc    Initiate Google OAuth 2.0 authentication flow
 * @access  Public
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })
);

/**
 * @route   GET /auth/google/callback
 * @desc    Handle Google OAuth callback redirect
 * @access  Public
 */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/?error=google_oauth_failed',
    failureMessage: true,
  }),
  (req, res) => {
    // Successful authentication: redirect back to home page
    res.redirect('/');
  }
);

/**
 * @route   GET /auth/logout
 * @desc    Log out active user, clear session, and redirect to home
 * @access  Private / Public
 */
router.get('/logout', logoutHandler);

/**
 * @route   GET /auth/current-user
 * @desc    Return the authenticated user profile as JSON
 * @access  Public
 */
router.get('/current-user', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.json({
      ok: true,
      user: req.user,
    });
  }
  return res.status(401).json({
    ok: false,
    user: null,
  });
});

export default router;
