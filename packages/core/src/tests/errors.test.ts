import { describe, it, expect } from "vitest";
import { OidcError } from "../errors.js";

describe("OidcError", () => {
  it("is an instance of Error", () => {
    const err = new OidcError("INVALID_JWT", "bad token");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(OidcError);
  });

  it("has correct code and message", () => {
    const err = new OidcError("STATE_MISMATCH", "state does not match");
    expect(err.code).toBe("STATE_MISMATCH");
    expect(err.message).toBe("state does not match");
    expect(err.name).toBe("OidcError");
  });

  it("produces distinct instances for different error codes", () => {
    const a = new OidcError("NONCE_MISMATCH", "nonce");
    const b = new OidcError("MISSING_AUTH_CODE", "code");
    expect(a.code).not.toBe(b.code);
    expect(a.message).not.toBe(b.message);
  });
});
