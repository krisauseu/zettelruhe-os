import { afterEach, describe, expect, it, vi } from "vitest";
import { getInstanceContext, withInstance, type InstanceContext } from "./instance-context";
import { sendBusinessMail, sendSystemMail, isSmtpConfigured, isSystemSmtpConfigured,
  SMTP_DELIVERY_ERROR } from "./smtp";

type TransportOptions = { host: string; port: number; secure: boolean; requireTLS: boolean;
  auth?: { user: string; pass: string }; tls?: { servername: string } };

const sent = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const transports = vi.hoisted(() => [] as TransportOptions[]);
const deliveries = vi.hoisted(() => [] as Array<{ transport: number; subject: unknown }>);
const failure = vi.hoisted(() => ({ dns: undefined as Error | undefined,
  transport: undefined as Error | undefined, password: undefined as string | undefined }));
const resolved = vi.hoisted(() => ({ addresses: ["8.8.8.8"] }));
vi.mock("node:dns/promises", () => ({ resolve4: async () => {
  if (failure.dns) throw failure.dns;
  return resolved.addresses;
} }));
vi.mock("nodemailer", () => ({ default: { createTransport: (options: TransportOptions) => {
  const transport = transports.push(options) - 1;
  return {
    sendMail: async (mail: Record<string, unknown>) => {
      await Promise.resolve();
      if (failure.transport && (!failure.password || options.auth?.pass === failure.password)) {
        throw failure.transport;
      }
      sent.push(mail);
      deliveries.push({ transport, subject: mail.subject });
      return { messageId: "synthetic-id", accepted: [mail.to] };
    },
  };
} } }));
vi.mock("./pb", () => ({ getFirmaById: async (id: string) => {
  const context = await getInstanceContext();
  if (id !== "active-firm") return null;
  const tenant = context.tenantId === "t_syntheticb" ? "B" : "A";
  return { id, name: `Firma ${tenant}`, email: `firma-${tenant.toLowerCase()}@synthetic.invalid` };
} }));

const system = { host: "system.synthetic.invalid", port: 587, secure: false,
  user: "system", password: "system-secret", from: "system@zettelruhe.de", fromName: "Zettelruhe" };
const fallback = { ...system, from: "versand@zettelruhe.de" };
const own = { host: "customer.synthetic.invalid", port: 465, secure: true,
  user: "customer", password: "customer-secret", from: "office@synthetic.invalid", fromName: "Office" };
const context: InstanceContext = {
  tenantId: "t_synthetica", pocketbaseUrl: "http://pb.synthetic.invalid",
  appUrl: "https://synthetica.invalid", configVersion: 1, sessionVersion: 1,
  sessionSecret: "x".repeat(40), adminEmail: "admin@synthetic.invalid", adminPassword: "test",
  smtp: null, systemSmtp: system, fallbackSmtp: fallback,
};
const contextB: InstanceContext = { ...context, tenantId: "t_syntheticb",
  pocketbaseUrl: "http://pb-b.synthetic.invalid", appUrl: "https://syntheticb.invalid" };
const input = { to: "partner@synthetic.invalid", subject: "Test", text: "Synthetic" };

describe("cloud mail separation", () => {
  afterEach(() => {
    vi.unstubAllEnvs(); vi.restoreAllMocks();
    sent.length = 0; transports.length = 0; deliveries.length = 0;
    resolved.addresses = ["8.8.8.8"];
    failure.dns = undefined; failure.transport = undefined; failure.password = undefined;
  });
  it("uses central fallback with Reply-To from this firm's record", async () => {
    vi.stubEnv("INSTANCE_MODE", "cloud");
    await withInstance(context, async () => {
      expect(await isSmtpConfigured()).toBe(true);
      await sendBusinessMail("active-firm", input);
    });
    expect(sent[0].from).toEqual({ name: "Firma A via Zettelruhe", address: "versand@zettelruhe.de" });
    expect(sent[0].replyTo).toBe("firma-a@synthetic.invalid");
  });
  it("rejects an unknown firm before fallback delivery", async () => {
    vi.stubEnv("INSTANCE_MODE", "cloud");
    await expect(withInstance(context, () => sendBusinessMail("unknown-firm", input))).rejects.toThrow("aktive Firma");
    expect(sent).toHaveLength(0);
  });
  it("uses tenant SMTP only for business mail and central SMTP for system mail", async () => {
    vi.stubEnv("INSTANCE_MODE", "cloud");
    await withInstance({ ...context, smtp: own }, async () => {
      await sendBusinessMail("active-firm", input);
      await sendSystemMail(input);
    });
    expect(sent[0].from).toEqual({ name: "Office", address: "office@synthetic.invalid" });
    expect(sent[0].replyTo).toBeUndefined();
    expect(sent[1].from).toEqual({ name: "Zettelruhe", address: "system@zettelruhe.de" });
  });
  it("does not send system mail through tenant SMTP if central SMTP is missing", async () => {
    vi.stubEnv("INSTANCE_MODE", "cloud");
    await withInstance({ ...context, smtp: own, systemSmtp: null }, async () => {
      expect(await isSystemSmtpConfigured()).toBe(false);
      await expect(sendSystemMail(input)).rejects.toThrow("Systemmail");
    });
  });
  it("rejects private DNS answers for customer SMTP before opening a socket", async () => {
    vi.stubEnv("INSTANCE_MODE", "cloud");
    resolved.addresses = ["172.30.88.2"];
    await expect(withInstance({ ...context, smtp: own }, () =>
      sendBusinessMail("active-firm", input))).rejects.toThrow(SMTP_DELIVERY_ERROR);
    expect(sent).toHaveLength(0);
    expect(transports).toHaveLength(0);
  });
  it("binds concurrent fallback Reply-To to each active instance's firm record", async () => {
    vi.stubEnv("INSTANCE_MODE", "cloud");
    await Promise.all([context, contextB, context, contextB].map((instance, i) =>
      withInstance(instance, () => sendBusinessMail("active-firm", { ...input, subject: `${i}` }))));
    expect(transports).toHaveLength(4);
    for (const [i, tenant] of ["a", "b", "a", "b"].entries()) {
      const mail = sent.find(mail => mail.subject === `${i}`)!;
      expect(mail.replyTo).toBe(`firma-${tenant}@synthetic.invalid`);
      expect(mail.from).toEqual({ name: `Firma ${tenant.toUpperCase()} via Zettelruhe`,
        address: fallback.from });
    }
  });
  it("creates a fresh transporter for every concurrent tenant send and secret rotation", async () => {
    vi.stubEnv("INSTANCE_MODE", "cloud");
    const ownB = { ...own, host: "customer-b.synthetic.invalid", user: "customer-b",
      password: "customer-b-secret", from: "office-b@synthetic.invalid" };
    const rotated = { ...own, password: "customer-secret-rotated" };
    const instances = [{ ...context, smtp: own }, { ...contextB, smtp: ownB },
      { ...context, smtp: rotated, configVersion: 2 }, { ...contextB, smtp: ownB }];
    await Promise.all(instances.map((instance, i) => withInstance(instance, () =>
      sendBusinessMail("active-firm", { ...input, subject: `${i}` }))));
    expect(transports).toHaveLength(4);
    expect(new Set(deliveries.map(delivery => delivery.transport)).size).toBe(4);
    for (const [i, instance] of instances.entries()) {
      const delivery = deliveries.find(delivery => delivery.subject === `${i}`)!;
      const options = transports[delivery.transport];
      expect(options.auth).toEqual({ user: instance.smtp.user, pass: instance.smtp.password });
      expect(options.tls).toEqual({ servername: instance.smtp.host });
      expect(sent.find(mail => mail.subject === `${i}`)!.from).toEqual({ name: own.fromName,
        address: instance.smtp.from });
    }
  });
  it.each(["DNS", "TLS", "AUTH"])("sanitizes %s errors without falling back or retaining a cause", async kind => {
    vi.stubEnv("INSTANCE_MODE", "cloud");
    const raw = Object.assign(new Error(`${kind} ${own.host} ${own.user} ${own.password}`),
      { response: `535 ${own.password}`, address: "8.8.8.8", port: own.port });
    if (kind === "DNS") failure.dns = raw;
    else { failure.transport = raw; failure.password = own.password; }
    const logs = [vi.spyOn(console, "error"), vi.spyOn(console, "warn"), vi.spyOn(console, "log")];
    const error = await withInstance({ ...context, smtp: own }, () =>
      sendBusinessMail("active-firm", input)).then(() => {
        throw new Error("Expected delivery failure");
      }, error => error as Error);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(SMTP_DELIVERY_ERROR);
    expect(error.cause).toBeUndefined();
    expect(error).not.toBe(raw);
    for (const detail of [own.host, own.user, own.password, raw.response]) {
      expect(String(error.stack)).not.toContain(detail);
    }
    expect(Object.getOwnPropertyNames(error).sort()).toEqual(["message", "stack"]);
    expect(transports).toHaveLength(kind === "DNS" ? 0 : 1);
    expect(sent).toHaveLength(0);
    await withInstance(contextB, () => sendBusinessMail("active-firm", input));
    await withInstance({ ...context, smtp: own }, () => sendSystemMail(input));
    expect(sent).toHaveLength(2);
    expect(sent[0].from).toEqual({ name: "Firma B via Zettelruhe", address: fallback.from });
    expect(sent[1].from).toEqual({ name: system.fromName, address: system.from });
    for (const log of logs) expect(log).not.toHaveBeenCalled();
  });
  it("preserves actionable recipient and subject validation before opening a transport", async () => {
    vi.stubEnv("INSTANCE_MODE", "cloud");
    await withInstance({ ...context, smtp: own }, async () => {
      await expect(sendBusinessMail("active-firm", { ...input, to: "invalid" })).rejects.toThrow("Empfänger-E-Mail");
      await expect(sendBusinessMail("active-firm", { ...input, subject: " " })).rejects.toThrow("Betreff fehlt");
    });
    expect(transports).toHaveLength(0);
  });
  it("preserves self-hosted SMTP for system and business mail without requiring STARTTLS", async () => {
    vi.stubEnv("INSTANCE_MODE", "self-hosted");
    vi.stubEnv("SMTP_HOST", "localhost"); vi.stubEnv("SMTP_PORT", "2525");
    vi.stubEnv("SMTP_SECURE", "false"); vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASSWORD", ""); vi.stubEnv("SMTP_FROM", "relay@synthetic.invalid");
    vi.stubEnv("SMTP_FROM_NAME", "Local relay");
    await sendSystemMail(input);
    await sendBusinessMail("active-firm", input);
    expect(transports).toHaveLength(2);
    for (const transport of transports) {
      expect(transport).toMatchObject({ host: "localhost", port: 2525, secure: false, requireTLS: false });
      expect(transport.auth).toBeUndefined();
    }
    for (const mail of sent) expect(mail.from).toEqual({ name: "Local relay", address: "relay@synthetic.invalid" });
  });
});
