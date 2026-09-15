'use strict';

const admin = require('firebase-admin');

let _firebaseApp = null;

function getFirebaseAdmin() {
  if (_firebaseApp) return admin;

  const base64ServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!base64ServiceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 is required');
  }

  const serviceAccountJson = Buffer.from(base64ServiceAccount, 'base64').toString('utf-8');
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (err) {
    throw new Error('Invalid JSON in FIREBASE_SERVICE_ACCOUNT_BASE64');
  }

  _firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  });

  return admin;
}

module.exports = { getFirebaseAdmin };
