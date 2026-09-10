import { expect, it } from "vitest";
import { appReturnPath } from "./app-return-path";
it("keeps return paths in the current app and preserves filters", () => {
 expect(appReturnPath("/app/kontoauszug?bankkonto=synthetic", "/app")).toBe("/app/kontoauszug?bankkonto=synthetic");
 for (const value of ["https://other.test/app", "//other.test/app", "/app/../../outside", "/application", "/app\\\\other.test", "\n/app", "/app/%2e%2e/outside"]) expect(appReturnPath(value, "/app")).toBe("/app");
});
