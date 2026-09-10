import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ setup: vi.fn(), origin: vi.fn(), login: vi.fn(), cookie: vi.fn(), clear: vi.fn(), required: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/instance-context", () => ({ assertMutationOrigin: mocks.origin, assertPublicSetupAllowed: mocks.setup }));
vi.mock("@/lib/pb", () => ({ authWithPassword: mocks.login, isSetupRequired: mocks.required, createFirma: mocks.create, createEigentuemer: mocks.create }));
vi.mock("@/lib/session", () => ({ setSessionCookie: mocks.cookie, clearSessionCookie: mocks.clear }));
vi.mock("./mitgliedschaft", () => ({ resolveMitgliedschaftFuerSession: async () => ({firmaId: "firma"}) }));
vi.mock("next/navigation", () => ({redirect: (path:string) => { throw new Error("redirect:"+path); }}));
import { loginAction, setupAction, logoutAction } from "./auth-actions";
afterEach(() => vi.resetAllMocks());
it("the alternate setup action rejects a cloud instance before all writes", async () => {
 mocks.setup.mockRejectedValue(new Error("PUBLIC_SETUP_DISABLED"));
 await expect(setupAction(new FormData())).rejects.toThrow("PUBLIC_SETUP_DISABLED");
 expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.required).not.toHaveBeenCalled(); expect(mocks.cookie).not.toHaveBeenCalled();
});
it("the alternate login action uses the shared session setter after origin validation", async () => {
 mocks.required.mockResolvedValue(false); mocks.login.mockResolvedValue({id:"user",email:"synthetic@test.invalid",name:"Test",role:"eigentuemer",firma:"firma"});
 const form = new FormData(); form.set("email","synthetic@test.invalid");form.set("password","synthetic-password");
 await expect(loginAction(form)).rejects.toThrow("redirect:/app");
 expect(mocks.origin).toHaveBeenCalledOnce();expect(mocks.cookie).toHaveBeenCalledWith({userId:"user",email:"synthetic@test.invalid",name:"Test",role:"eigentuemer",firmaId:"firma"});
});
it("the alternate login action rejects foreign origins before authentication", async () => {
 mocks.origin.mockRejectedValue(new Error("ORIGIN_DENIED"));
 await expect(loginAction(new FormData())).rejects.toThrow("ORIGIN_DENIED");expect(mocks.login).not.toHaveBeenCalled();
});
it("the alternate logout action uses the guarded cookie clearer", async () => {
 await expect(logoutAction()).rejects.toThrow("redirect:/login");expect(mocks.clear).toHaveBeenCalledOnce();
});
