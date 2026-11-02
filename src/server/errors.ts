import type { ApiError } from "../shared/types";

export class AppError extends Error {
  constructor(
    public code: ApiError["code"],
    message: string,
    public status: number,
    public retryable = false,
  ) {
    super(message);
  }
  toJSON(): ApiError {
    return { error: this.message, code: this.code, retryable: this.retryable };
  }
}

export const notConfigured = (what: string) =>
  new AppError("not_configured", `${what} isn't configured on this server. Demo mode is available.`, 501);
