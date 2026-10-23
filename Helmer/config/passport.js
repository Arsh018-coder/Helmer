import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';

/**
 * Configure Passport.js Google OAuth 2.0 Strategy.
 * Authenticates users using their Google credentials and manages user persistence in MongoDB.
 */
export function configurePassport() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback';

  if (!clientID || !clientSecret) {
    console.warn('[Passport Warning] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not configured in .env');
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: clientID || '',
        clientSecret: clientSecret || '',
        callbackURL,
        proxy: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Extract primary profile details from Google response
          const googleId = profile.id;
          const displayName = profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim() || 'Google User';
          const firstName = profile.name?.givenName || '';
          const lastName = profile.name?.familyName || '';
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${googleId}@gmail.com`;
          const avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`;

          // Find or create user in MongoDB
          let user = await User.findOne({ googleId });

          if (user) {
            // Existing user: update last login and profile picture if changed
            user.lastLoginAt = new Date();
            if (avatar && !user.avatar) user.avatar = avatar;
            await user.save();
            return done(null, user);
          }

          // Also check by email to prevent duplicate accounts
          user = await User.findOne({ email: email.toLowerCase() });
          if (user) {
            user.googleId = googleId;
            user.lastLoginAt = new Date();
            if (avatar && !user.avatar) user.avatar = avatar;
            await user.save();
            return done(null, user);
          }

          // New user: create record in MongoDB
          const newUser = await User.create({
            googleId,
            displayName,
            firstName,
            lastName,
            email: email.toLowerCase(),
            avatar,
            createdAt: new Date(),
            lastLoginAt: new Date(),
          });

          return done(null, newUser);
        } catch (error) {
          console.error('[Passport Google Strategy Error]:', error);
          return done(error, null);
        }
      }
    )
  );

  /**
   * Serialize User:
   * Store only the user database ID in the session cookie to minimize session footprint.
   */
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  /**
   * Deserialize User:
   * Reconstruct user object from the database using the stored session ID.
   */
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      console.error('[Passport Deserialize Error]:', error);
      done(error, null);
    }
  });
}

export default configurePassport;
