import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "we-are-the-walrus",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
