import { randomUUID } from "node:crypto";
import { createNode } from "../src/data/repo/treeNodes";
import { addField } from "../src/data/repo/dataFields";
import { db } from "../src/data/firebase";

async function main() {
  const rootId = randomUUID();
  await createNode({ id: rootId, nodeName: "Main HVAC Unit", nodeSubtitle: "Building A", parentId: null });
  await addField({ id: randomUUID(), fieldName: "Type Of", parentNodeId: rootId, fieldValue: "Pump" });
  await addField({ id: randomUUID(), fieldName: "Status", parentNodeId: rootId, fieldValue: "In Service" });
  console.log("Seeded");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });