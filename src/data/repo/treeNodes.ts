import { db } from "../firebase";
import { collection, doc, setDoc, getDocs, getDoc, query, where, orderBy, deleteDoc, getCountFromServer } from "firebase/firestore";
import { TreeNode } from "../models";
import { COLLECTIONS } from "../../constants";
import { getCurrentUserId } from "../../context/userContext";
import { now } from "../../utils/time";

export async function getNodeById(id: string): Promise<TreeNode | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.NODES, id));
  return snap.exists() ? (snap.data() as TreeNode) : null;
}

export async function createNode(partial: Omit<TreeNode, "updatedBy" | "updatedAt">) {
  const node: TreeNode = { ...partial, updatedBy: getCurrentUserId(), updatedAt: now() };
  await setDoc(doc(collection(db, COLLECTIONS.NODES), node.id), node);
  return node;
}

export async function listRootNodes() {
  const q = query(collection(db, COLLECTIONS.NODES), where("parentId", "==", null), orderBy("updatedAt", "asc"));
  return (await getDocs(q)).docs.map(d => d.data() as TreeNode);
}

export async function listChildren(parentId: string) {
  const q = query(collection(db, COLLECTIONS.NODES), where("parentId", "==", parentId), orderBy("updatedAt", "asc"));
  return (await getDocs(q)).docs.map(d => d.data() as TreeNode);
}

export async function deleteLeafNode(id: string) {
  // Phase 1: enforce leaf-only by checking child count.
  const childCount = await getCountFromServer(query(collection(db, COLLECTIONS.NODES), where("parentId", "==", id)));
  if (childCount.data().count > 0) throw new Error("Only leaf nodes can be deleted in Phase 1");
  await deleteDoc(doc(db, COLLECTIONS.NODES, id));
}