// src/api/middlewares/logRequests.ts
import { Request, Response, NextFunction } from "express";
import logger from "../../services/utils/logger";

const logRequests = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime();

  res.on("finish", () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const elapsedMs = seconds * 1000 + nanoseconds / 1e6;

    const timestamp = new Date().toISOString();

    const remoteAddress = req.ip || req.connection?.remoteAddress || "-";

    const method = req.method;
    const url = req.originalUrl;
    const httpVersion = req.httpVersion;
    const status = res.statusCode;
    const contentLength = res.getHeader("Content-Length") || 0;
    const userAgent = req.get("User-Agent") || "-";

    const message = `[${timestamp}] - ${remoteAddress} - "${method} ${url} HTTP/${httpVersion}" ${status} ${contentLength} "-" "${userAgent}" - ${elapsedMs.toFixed(
      2
    )}ms`;

    if (status >= 400) {
      logger.warn(message);
    } else {
      logger.info(message);
    }
  });

  next();
};

export default logRequests;
