import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebaseconfig';
import { Workshop, CreateWorkshopData, UpdateWorkshopData } from '../types/workshop';

const WORKSHOPS_COLLECTION = 'workshops';

/**
 * Converter Firestore document para Workshop
 */
function convertFirestoreToWorkshop(docId: string, data: any): Workshop {
  return {
    id: docId,
    name: data.name,
    address: data.address,
    contact1: data.contact1,
    contact2: data.contact2 || '',
    status: data.status || 'yellow',
    totalPieces: data.totalPieces || 0,
    userId: data.userId,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
  };
}

/**
 * Criar uma nova oficina
 */
export async function createWorkshop(
  userId: string,
  workshopData: CreateWorkshopData
): Promise<Workshop> {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!workshopData.name || workshopData.name.trim().length < 3) {
      throw new Error('Nome da oficina é obrigatório (mínimo 3 caracteres)');
    }

    if (!workshopData.address || workshopData.address.trim().length < 5) {
      throw new Error('Endereço é obrigatório (mínimo 5 caracteres)');
    }

    if (!workshopData.contact1 || workshopData.contact1.trim().length < 10) {
      throw new Error('Contato 1 (WhatsApp) é obrigatório');
    }

    const now = Timestamp.now();
    const newWorkshop = {
      name: workshopData.name.trim(),
      address: workshopData.address.trim(),
      contact1: workshopData.contact1.trim(),
      contact2: workshopData.contact2?.trim() || '',
      status: workshopData.status || 'yellow',
      totalPieces: 0,
      userId,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, WORKSHOPS_COLLECTION), newWorkshop);
    
    return convertFirestoreToWorkshop(docRef.id, {
      ...newWorkshop,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error: any) {
    console.error('Error creating workshop:', error);
    throw new Error(error.message || 'Erro ao criar oficina');
  }
}

/**
 * Buscar todas as oficinas de um usuário
 */
export async function getWorkshopsByUser(userId: string): Promise<Workshop[]> {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const q = query(
      collection(db, WORKSHOPS_COLLECTION),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const workshops: Workshop[] = [];

    querySnapshot.forEach((doc) => {
      workshops.push(convertFirestoreToWorkshop(doc.id, doc.data()));
    });

    // Ordenar em memória por data de criação (mais recente primeiro)
    return workshops.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error: any) {
    console.error('Error fetching workshops:', error);
    throw new Error(error.message || 'Erro ao buscar oficinas');
  }
}

/**
 * Buscar uma oficina por ID
 */
export async function getWorkshopById(workshopId: string): Promise<Workshop | null> {
  try {
    if (!workshopId) {
      throw new Error('Workshop ID is required');
    }

    const docRef = doc(db, WORKSHOPS_COLLECTION, workshopId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return convertFirestoreToWorkshop(docSnap.id, docSnap.data());
  } catch (error: any) {
    console.error('Error fetching workshop:', error);
    throw new Error(error.message || 'Erro ao buscar oficina');
  }
}

/**
 * Atualizar uma oficina
 */
export async function updateWorkshop(
  workshopId: string,
  updateData: UpdateWorkshopData
): Promise<void> {
  try {
    if (!workshopId) {
      throw new Error('Workshop ID is required');
    }

    const docRef = doc(db, WORKSHOPS_COLLECTION, workshopId);
    const updatePayload: any = {
      ...updateData,
      updatedAt: Timestamp.now(),
    };

    await updateDoc(docRef, updatePayload);
  } catch (error: any) {
    console.error('Error updating workshop:', error);
    throw new Error(error.message || 'Erro ao atualizar oficina');
  }
}

/**
 * Deletar uma oficina
 */
export async function deleteWorkshop(workshopId: string): Promise<void> {
  try {
    if (!workshopId) {
      throw new Error('Workshop ID is required');
    }

    const docRef = doc(db, WORKSHOPS_COLLECTION, workshopId);
    await deleteDoc(docRef);
  } catch (error: any) {
    console.error('Error deleting workshop:', error);
    throw new Error(error.message || 'Erro ao deletar oficina');
  }
}

/**
 * Atualizar status de uma oficina
 */
export async function updateWorkshopStatus(
  workshopId: string,
  status: 'green' | 'yellow' | 'orange' | 'red'
): Promise<void> {
  try {
    await updateWorkshop(workshopId, { status });
  } catch (error: any) {
    console.error('Error updating workshop status:', error);
    throw error;
  }
}

/**
 * Atualizar total de peças de uma oficina
 */
export async function updateWorkshopPieces(
  workshopId: string,
  totalPieces: number
): Promise<void> {
  try {
    if (totalPieces < 0) {
      throw new Error('Total de peças não pode ser negativo');
    }
    await updateWorkshop(workshopId, { totalPieces });
  } catch (error: any) {
    console.error('Error updating workshop pieces:', error);
    throw error;
  }
}
