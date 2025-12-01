import { db } from "../firebase";
import { collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, updateDoc, deleteDoc } from "firebase/firestore";
import { DataField, DataFieldHistory } from "../models";
import { COLLECTIONS } from "../../constants";
import { getCurrentUserId } from "../../context/userContext";
import { now } from "../../utils/time";

async function nextRev(dataFieldId: string) {
  const q = query(collection(db, COLLECTIONS.HISTORY), where("dataFieldId", "==", dataFieldId), orderBy("rev", "desc"));
  const snap = await getDocs(q);
  const rev = snap.docs.length ? (snap.docs[0].data() as DataFieldHistory).rev + 1 : 0;
  return rev;
}

export async function addField(field: Omit<DataField, "updatedBy" | "updatedAt">) {
  const ts = now();
  const userId = getCurrentUserId();
  const rec: DataField = { ...field, updatedBy: userId, updatedAt: ts };
  await setDoc(doc(collection(db, COLLECTIONS.FIELDS), rec.id), rec);

  const rev = await nextRev(rec.id);
  const hist: DataFieldHistory = {
    id: `${rec.id}:${rev}`,
    dataFieldId: rec.id,
    parentNodeId: rec.parentNodeId,
    action: "create",
    property: "fieldValue",
    prevValue: null,
    newValue: rec.fieldValue,
    updatedBy: userId,
    updatedAt: ts,
    rev,
  };
  await setDoc(doc(collection(db, COLLECTIONS.HISTORY), hist.id), hist);
  return rec;
}

export async function updateFieldValue(id: string, newValue: string | null) {
  const ref = doc(db, COLLECTIONS.FIELDS, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Field not found");
  const prev = snap.data() as DataField;
  const ts = now();
  const userId = getCurrentUserId();
  await updateDoc(ref, { fieldValue: newValue, updatedAt: ts, updatedBy: userId });

  const rev = await nextRev(id);
  const hist: DataFieldHistory = {
    id: `${id}:${rev}`,
    dataFieldId: id,
    parentNodeId: prev.parentNodeId,
    action: "update",
    property: "fieldValue",
    prevValue: prev.fieldValue,
    newValue,
    updatedBy: userId,
    updatedAt: ts,
    rev,
  };
  await setDoc(doc(collection(db, COLLECTIONS.HISTORY), hist.id), hist);
}

export async function deleteField(id: string) {
  const ref = doc(db, COLLECTIONS.FIELDS, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const prev = snap.data() as DataField;
  await deleteDoc(ref);

  const ts = now();
  const rev = await nextRev(id);
  const hist: DataFieldHistory = {
    id: `${id}:${rev}`,
    dataFieldId: id,
    parentNodeId: prev.parentNodeId,
    action: "delete",
    property: "fieldValue",
    prevValue: prev.fieldValue,
    newValue: null,
    updatedBy: getCurrentUserId(),
    updatedAt: ts,
    rev,
  };
  await setDoc(doc(collection(db, COLLECTIONS.HISTORY), hist.id), hist);
}

export async function listFieldsForNode(parentNodeId: string) {
  const q = query(collection(db, COLLECTIONS.FIELDS), where("parentNodeId", "==", parentNodeId), orderBy("updatedAt", "asc"));
  return (await getDocs(q)).docs.map(d => d.data() as DataField);
}

export async function getFieldHistory(dataFieldId: string) {
  const q = query(collection(db, COLLECTIONS.HISTORY), where("dataFieldId", "==", dataFieldId), orderBy("rev", "asc"));
  return (await getDocs(q)).docs.map(d => d.data() as DataFieldHistory);
}