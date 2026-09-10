import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getInstanceContext, validateInstance, withInstance, type InstanceContext } from "./instance-context";
import { getRecord, getAdminToken } from "./pb";

const enabled = process.env.TP002_CONTEXTS_PATH === "/fixtures/contexts.json";
describe.skipIf(!enabled)("real isolated PB contexts", () => {
 it("keeps nested parallel reads and admin tokens bound with identical record IDs", async () => {
  const instances: InstanceContext[] = JSON.parse(readFileSync("/fixtures/contexts.json", "utf8"));
  expect(instances).toHaveLength(2);
  const [a,b] = instances.map(c => validateInstance(c));
  expect(a.tenantId).not.toBe(b.tenantId);
  expect(a.pocketbaseUrl).toBe("http://pb-0:8090");
  expect(b.pocketbaseUrl).toBe("http://pb-1:8090");
  expect(a.adminEmail).toBe("tp002-0@synthetic.invalid");
  expect(b.adminEmail).toBe("tp002-1@synthetic.invalid");
  await Promise.all(Array.from({length:20}, (_,index) => withInstance(index % 2 ? a : b, async () => {
    const context = await getInstanceContext();
    const first = await getRecord<{id:string;name:string}>("firmen", "samefirma000001");
    const token = await getAdminToken();
    await withInstance(context.tenantId === a.tenantId ? b : a, async () => {
      const other = await getRecord<{id:string;name:string}>("firmen", "samefirma000001");
      expect(other.id).toBe(first.id); expect(other.name).not.toBe(first.name);
      expect(await getAdminToken()).not.toBe(token);
    });
    expect(await getInstanceContext()).toBe(context);
    expect(await getRecord("firmen", "samefirma000001")).toEqual(first);
  })));
 });
});
