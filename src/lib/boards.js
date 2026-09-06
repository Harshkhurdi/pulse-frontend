import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebaseClient";

/**
 * Board management: Pulse v1 boards are personal workspaces — every board
 * has a single owner_id, and tasks carry both user_id and board_id. Shared
 * team boards arrive in the next phase (members + rules upgrade).
 */

export async function listBoards(userId) {
  const snap = await getDocs(
    query(collection(db, "boards"), where("owner_id", "==", userId)),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() || {}) }))
    .sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0));
}

export async function createBoard(userId, name) {
  const clean = (name || "").trim() || "Untitled board";
  const ref = await addDoc(collection(db, "boards"), {
    name: clean.slice(0, 60),
    owner_id: userId,
    created_at: Date.now(),
  });
  return { id: ref.id, name: clean.slice(0, 60), owner_id: userId, created_at: Date.now() };
}

/**
 * One-time bootstrap: guarantees the user has at least one board and
 * claims every legacy task (no board_id) into it.
 *
 * Guarded against concurrent callers: React StrictMode mounts effects
 * twice in dev, and two racing bootstraps would each see zero boards and
 * create a duplicate. The in-flight promise is shared instead.
 */
let bootstrapInFlight = null;
export async function ensureUserBoard(userId) {
  if (!bootstrapInFlight) {
    bootstrapInFlight = (async () => {
      const boards = await listBoards(userId);
      if (boards.length > 0) return boards;

      const created = await createBoard(userId, "My Board");

      // Claim orphan tasks created before boards existed.
      const orphans = await getDocs(
        query(collection(db, "tasks"), where("user_id", "==", userId)),
      );
      const claim = orphans.docs.filter((d) => !d.data().board_id);
      for (const d of claim) {
        await updateDoc(doc(db, "tasks", d.id), { board_id: created.id });
      }

      return [created];
    })();
  }
  try {
    return await bootstrapInFlight;
  } finally {
    bootstrapInFlight = null;
  }
}

export async function deleteBoardDoc(boardId) {
  await deleteDoc(doc(db, "boards", boardId));
}

export async function renameBoardDoc(boardId, name) {
  await updateDoc(doc(db, "boards", boardId), {
    name: (name || "").trim().slice(0, 60) || "Untitled board",
  });
}
