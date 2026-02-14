import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../lib/prisma';
import { RoleType } from '@prisma/client';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL,

    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0].value;
        
        if (!email) {
            return done(new Error('No email found from Google profile'), undefined);
        }

        // Check if user exists
        let user = await prisma.user.findFirst({
          where: {
            OR: [
              // @ts-ignore: Prisma client update failed due to file lock
              { googleId: profile.id },
              { email: email },
            ],
          },
        });

        if (!user) {
          // Create new user
          user = await prisma.user.create({
            data: {
              email,
              name: profile.displayName,
              // @ts-ignore: Prisma client update failed due to file lock
              googleId: profile.id,
              role: RoleType.USER, 
            },
          });
          // @ts-ignore: googleId missing in type until generation
        } else if (!user.googleId) {
            // Link googleId if user exists but not linked
            user = await prisma.user.update({
                where: { id: user.id },
                // @ts-ignore: googleId missing in type until generation
                data: { googleId: profile.id }
            });
        }

        return done(null, user);
      } catch (error) {
        return done(error, undefined);
      }
    }
  )
);
