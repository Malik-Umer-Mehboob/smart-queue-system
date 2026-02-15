import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../lib/prisma';
import { RoleType } from '@prisma/client';

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profilePath, done) => {
        const profile = profilePath as any;
        try {
          const email = profile.emails?.[0].value;
          
          if (!email) {
              return done(new Error('No email found from Google profile'), undefined);
          }

          // Check if user exists
          let user = await prisma.user.findFirst({
            where: {
              OR: [
                // @ts-ignore: googleId missing in type until generation
                { googleId: profile.id },
                { email: email },
              ],
            } as any,
          });

          if (!user) {
            // Create new user
            user = await prisma.user.create({
              data: {
                email,
                name: profile.displayName,
                // @ts-ignore: googleId missing in type until generation
                googleId: profile.id,
                role: RoleType.USER, 
              } as any,
            });
          } else if (!(user as any).googleId) {
              // Link googleId if user exists but not linked
              user = await prisma.user.update({
                  where: { id: user.id },
                  data: { googleId: profile.id } as any
              });
          }

          return done(null, user);
        } catch (error) {
          return done(error, undefined);
        }
      }
    )
  );
} else {
  console.log('[passport]: Google OAuth credentials missing. Skipping Google Strategy.');
}
