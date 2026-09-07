import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInAnonymously, deleteUser } from 'firebase/auth';
import { getDatabase, ref, get } from 'firebase/database';
import { firebaseConfig } from '../lib/firebase-config.ts';
// Checks live authentication, read access and denial of unauthenticated reads.
// It creates no rooms and removes its own temporary anonymous account.
const app = initializeApp(firebaseConfig, 'connection-check');
let user;
try {
  const denied = await fetch(firebaseConfig.databaseURL + '/rooms.json');
  assert.equal(denied.status, 401);
  ({ user } = await signInAnonymously(getAuth(app)));
  assert.ok(user.isAnonymous);
  const snapshot = await get(ref(getDatabase(app), 'rooms'));
  assert.ok(snapshot.val() === null || typeof snapshot.val() === 'object');
  console.log('PASS: Firebase leadsinger anonymous sign-in, authenticated room reads, unauthenticated reads denied.');
} finally {
  if (user) await deleteUser(user);
  await deleteApp(app);
}
