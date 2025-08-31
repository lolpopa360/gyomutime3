import * as admin from 'firebase-admin';

let app: admin.app.App | undefined;

// Singleton pattern for Firebase Admin initialization
export function getAdminApp(): admin.app.App {
  if (app) return app;
  
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set');
  }
  
  try {
    const serviceAccount = JSON.parse(raw);
    
    // Validate required fields
    if (!serviceAccount.project_id) {
      throw new Error('Invalid service account: missing project_id');
    }
    
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: `${serviceAccount.project_id}.appspot.com`,
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
    });
    
    console.log(`Firebase Admin initialized for project: ${serviceAccount.project_id}`);
    return app;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    throw new Error('Firebase Admin initialization failed');
  }
}

// Get Firestore instance
export function getFirestore(): admin.firestore.Firestore {
  const firestore = getAdminApp().firestore();
  
  // Configure Firestore settings for better performance
  firestore.settings({
    timestampsInSnapshots: true,
    ignoreUndefinedProperties: true,
  });
  
  return firestore;
}

// Get Auth instance
export function getAuth(): admin.auth.Auth {
  return getAdminApp().auth();
}

// Get Storage bucket
export function getStorageBucket() {
  const bucket = getAdminApp().storage().bucket();
  
  // Set default metadata for uploads
  bucket.setMetadata({
    cacheControl: 'public, max-age=3600',
  }).catch(() => {
    // Ignore metadata errors for local development
  });
  
  return bucket;
}

// Helper function to clean up resources (for testing)
export async function cleanup(): Promise<void> {
  if (app) {
    await app.delete();
    app = undefined;
  }
}
