import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

let dbInstance: Firestore | null = null;
let isInitialized = false;

export function getFirebaseAdminDb(): Firestore {
  if (!dbInstance) {
    if (!isInitialized) {
      try {
        let projectId = process.env.FIREBASE_PROJECT_ID;
        let databaseId = process.env.FIREBASE_DATABASE_ID || "(default)";

        // Fallback to firebase-applet-config.json if env is empty
        try {
          const configPath = path.join(process.cwd(), "firebase-applet-config.json");
          if (fs.existsSync(configPath)) {
            const configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
            if (!projectId) projectId = configData.projectId;
            if (configData.firestoreDatabaseId) databaseId = configData.firestoreDatabaseId;
          }
        } catch (e) {
          console.warn("[Firebase Admin] Could not read firebase-applet-config.json fallback");
        }

        const app = !getApps().length ? initializeApp({ projectId: projectId || "prime-osprey-1224x" }) : getApp();
        isInitialized = true;
        dbInstance = getFirestore(app, databaseId);
        console.log(`[Firebase Admin] Initialized Firestore with Database ID: ${databaseId}`);
      } catch (error: any) {
        console.error("[Firebase Admin] Initialization failed:", error.message);
        throw error;
      }
    }
  }
  return dbInstance!;
}

export function getFirebaseAdminAuth(): Auth {
  getFirebaseAdminDb(); // Ensure app is initialized
  return getAuth();
}

