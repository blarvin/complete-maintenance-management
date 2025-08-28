import { db } from "../firebase";
import { collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, updateDoc, deleteDoc } from "firebase/firestore";
import { DataField, DataFieldHistory } from "../models";

const FIELDS = "dataFields";
const HISTORY = "dataFieldHistory";

async function nextRev(dataFieldId: string) {
  const q = query(collection(db, HISTORY), where("dataFieldId", "==", dataFieldId), orderBy("rev", "desc"));
  const snap = await getDocs(q);
  const rev = snap.docs.length ? (snap.docs[0].data() as DataFieldHistory).rev + 1 : 0;
  return rev;
}

export async function addField(field: Omit<DataField, "updatedBy" | "updatedAt">) {
  const now = Date.now();
  const rec: DataField = { ...field, updatedBy: "localUser", updatedAt: now };
  await setDoc(doc(collection(db, FIELDS), rec.id), rec);

  const rev = await nextRev(rec.id);
  const hist: DataFieldHistory = {
    id: `${rec.id}:${rev}`,
    dataFieldId: rec.id,
    parentNodeId: rec.parentNodeId,
    action: "create",
    property: "fieldValue",
    prevValue: null,
    newValue: rec.fieldValue,
    updatedBy: "localUser",
    updatedAt: now,
    rev,
  };
  await setDoc(doc(collection(db, HISTORY), hist.id), hist);
  return rec;
}

export async function updateFieldValue(id: string, newValue: string | null) {
  const ref = doc(db, FIELDS, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Field not found");
  const prev = snap.data() as DataField;
  const now = Date.now();
  await updateDoc(ref, { fieldValue: newValue, updatedAt: now, updatedBy: "localUser" });

  const rev = await nextRev(id);
  const hist: DataFieldHistory = {
    id: `${id}:${rev}`,
    dataFieldId: id,
    parentNodeId: prev.parentNodeId,
    action: "update",
    property: "fieldValue",
    prevValue: prev.fieldValue,
    newValue,
    updatedBy: "localUser",
    updatedAt: now,
    rev,
  };
  await setDoc(doc(collection(db, HISTORY), hist.id), hist);
}

export async function deleteField(id: string) {
  const ref = doc(db, FIELDS, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const prev = snap.data() as DataField;
  await deleteDoc(ref);

  const now = Date.now();
  const rev = await nextRev(id);
  const hist: DataFieldHistory = {
    id: `${id}:${rev}`,
    dataFieldId: id,
    parentNodeId: prev.parentNodeId,
    action: "delete",
    property: "fieldValue",
    prevValue: prev.fieldValue,
    newValue: null,
    updatedBy: "localUser",
    updatedAt: now,
    rev,
  };
  await setDoc(doc(collection(db, HISTORY), hist.id), hist);
}

export async function listFieldsForNode(parentNodeId: string) {
  const q = query(collection(db, FIELDS), where("parentNodeId", "==", parentNodeId), orderBy("updatedAt", "asc"));
  return (await getDocs(q)).docs.map(d => d.data() as DataField);
}