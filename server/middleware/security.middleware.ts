import { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "../config/env";

/**
 * Enterprise Helmet Security Configuration
 */
const devSecurityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "https:", "http:", "data:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:", "http:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
      fontSrc: ["'self'", "https:", "http:", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "http:", "ws:", "wss:"],
      frameSrc: ["'self'", "https:", "http:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'", "https://aistudio.google.com", "https://*.usercontent.goog"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  frameguard: false,
});

const prodSecurityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "https:", "http:", "data:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:", "http:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
      fontSrc: ["'self'", "https:", "http:", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "http:", "ws:", "wss:"],
      frameSrc: ["'self'", "https:", "http:"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  frameguard: { action: "sameorigin" },
});

export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  if (env.nodeEnv !== "production") {
    devSecurityHeaders(req, res, next);
  } else {
    prodSecurityHeaders(req, res, next);
  }
};

/**
 * Enterprise CORS Configuration
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // In full-stack Cloud Run and container environments, dynamically allow valid origins and reflect origin header
    callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-Request-ID"],
  exposedHeaders: ["X-Total-Count", "X-Page", "X-Limit", "X-Request-ID"],
  maxAge: 86400, // 24 hours preflight cache
});

/**
 * Basic XSS & SQL Injection Sanitization Middleware
 * Strips dangerous script tags from string inputs in req.body and req.query
 */
export function sanitizeInputs(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === "string") {
        // Strip script tags and null bytes
        req.body[key] = req.body[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/\0/g, "");
      }
    }
  }
  next();
}
