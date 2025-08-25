import { db } from "../firebase";
import { collection, doc, setDoc, getDocs, query, where, orderBy, deleteDoc, getCountFromServer } from "firebase/firestore";
import { TreeNode } from "../models";

const NODES = "treeNodes";

export async function createNode(partial: Omit<TreeNode, "updatedBy" | "updatedAt">) {
  const now = Date.now();
  const node: TreeNode = { ...partial, updatedBy: "localUser", updatedAt: now };
  await setDoc(doc(collection(db, NODES), node.id), node);
  return node;
}

export async function listRootNodes() {
  const q = query(collection(db, NODES), where("parentId", "==", null), orderBy("updatedAt", "asc"));
  return (await getDocs(q)).docs.map(d => d.data() as TreeNode);
}

export async function listChildren(parentId: string) {
  const q = query(collection(db, NODES), where("parentId", "==", parentId), orderBy("updatedAt", "asc"));
  return (await getDocs(q)).docs.map(d => d.data() as TreeNode);
}

export async function deleteLeafNode(id: string) {
  // Phase 1: enforce leaf-only by checking child count.
  const childCount = await getCountFromServer(query(collection(db, NODES), where("parentId", "==", id)));
  if (childCount.data().count > 0) throw new Error("Only leaf nodes can be deleted in Phase 1");
  await deleteDoc(doc(db, NODES, id));
}