import { collection, doc, getDoc, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import type { Personnel } from '../types';
import type { GlobalSupplier } from '../types/supplier';
import { db, logSystemAction, sanitizeData } from './firebaseService';
import { syncSupplierTopFields } from '../utils/supplierUtils';
import { isSupplierMaster } from '../utils/supplierAccess';

const COL = 'suppliers';

export const saveSupplierToCloud = async (supplier: GlobalSupplier, actor: Personnel) => {
  const payload = syncSupplierTopFields({
    ...supplier,
    updatedAt: new Date().toISOString(),
  });
  await setDoc(doc(db, COL, payload.id), sanitizeData(payload));
  await logSystemAction(
    'CREATE',
    'Supplier',
    `تأمین‌کننده جدید: ${payload.companyName || payload.id}`,
    actor.fullName || actor.username,
    payload.id,
    undefined,
    COL,
    actor.id,
  );
};

export const updateSupplierInCloud = async (
  id: string,
  updates: Partial<GlobalSupplier>,
  actor: Personnel,
  details?: string,
) => {
  const payload = sanitizeData({ ...updates, updatedAt: new Date().toISOString() });
  await updateDoc(doc(db, COL, id), payload);
  await logSystemAction(
    'UPDATE',
    'Supplier',
    details || `بروزرسانی تأمین‌کننده`,
    actor.fullName || actor.username,
    id,
    undefined,
    COL,
    actor.id,
  );
};

export const softDeleteSupplierFromCloud = async (id: string, actor: Personnel) => {
  if (!isSupplierMaster(actor)) {
    throw new Error('Only master can delete suppliers');
  }
  let backup: unknown = null;
  const snap = await getDoc(doc(db, COL, id));
  if (snap.exists()) backup = snap.data();

  const deletedAt = new Date().toISOString();
  await updateDoc(doc(db, COL, id), sanitizeData({ deletedAt, updatedAt: deletedAt }));
  await logSystemAction(
    'DELETE',
    'Supplier',
    `حذف نرم تأمین‌کننده`,
    actor.fullName || actor.username,
    id,
    backup,
    COL,
    actor.id,
  );
};

export const restoreSupplierFromCloud = async (id: string, actor: Personnel) => {
  await updateDoc(doc(db, COL, id), sanitizeData({ deletedAt: null, updatedAt: new Date().toISOString() }));
  await logSystemAction(
    'UPDATE',
    'Supplier',
    `بازیابی تأمین‌کننده`,
    actor.fullName || actor.username,
    id,
    undefined,
    COL,
    actor.id,
  );
};

export const subscribeToSuppliers = (callback: (list: GlobalSupplier[]) => void) => {
  const q = query(collection(db, COL), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, snapshot => {
    const list = snapshot.docs.map(d => {
      const data = d.data() as GlobalSupplier;
      return { ...data, id: data.id || d.id };
    });
    callback(list);
  });
};
