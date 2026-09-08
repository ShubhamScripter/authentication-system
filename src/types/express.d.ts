import "express";

// Augments Express's Request with the fields the auth middleware attaches
// after a valid access token + active Redis session are confirmed.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        sessionId: string;
      };
    }
  }
}

export {};
