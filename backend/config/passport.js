const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const { ExtractJwt } = require('passport-jwt');
const User = require('../models/User');
const logger = require('../utils/logger');

// JWT Strategy - for protected API routes
passport.use(
  'jwt',
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => req?.cookies?.accessToken || null,
      ]),
      secretOrKey: process.env.JWT_SECRET,
      passReqToCallback: true,
    },
    async (req, payload, done) => {
      try {
        const user = await User.findById(payload.id).select('-password -refreshToken');
        if (!user || !user.isActive) {
          return done(null, false, { message: 'User not found or inactive' });
        }
        return done(null, user);
      } catch (err) {
        return done(err, false);
      }
    }
  )
);

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    'google',
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ 'oauth.googleId': profile.id });

          if (!user) {
            user = await User.findOne({ email: profile.emails[0].value });
            if (user) {
              user.oauth = { ...user.oauth, googleId: profile.id };
              await user.save();
            } else {
              user = await User.create({
                name: profile.displayName,
                email: profile.emails[0].value,
                avatar: profile.photos[0]?.value,
                oauth: { googleId: profile.id },
                isEmailVerified: true,
                password: Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16),
              });
            }
          }

          return done(null, user);
        } catch (err) {
          logger.error(`Google OAuth error: ${err.message}`);
          return done(err, null);
        }
      }
    )
  );
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).select('-password');
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
