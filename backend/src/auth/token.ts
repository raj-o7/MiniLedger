import jwt from 'jsonwebtoken';

/** Creates a signed JWT whose subject ("sub") is the user's id. */
export function signToken(userId: number, secret: string, expiresInSeconds: number): string {
  return jwt.sign({}, secret, {
    subject: String(userId),
    expiresIn: expiresInSeconds,
    algorithm: 'HS256',
  });
}

/** Returns the user id stored in the token, or null if the token is invalid or expired. */
export function verifyToken(token: string, secret: string): number | null {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || payload.sub === undefined) {
      return null;
    }
    const userId = Number(payload.sub);
    return Number.isInteger(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
}
