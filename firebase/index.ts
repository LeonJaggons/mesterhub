import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyD4QBiEBod35DucAEV00LxHRHboWyIH084",
  authDomain: "mesterhub-54626.firebaseapp.com",
  projectId: "mesterhub-54626",
  storageBucket: "mesterhub-54626.firebasestorage.app",
  messagingSenderId: "790208114791",
  appId: "1:790208114791:web:aae36a3d6bbdaefe79e4c2",
  measurementId: "G-N9HXS6WZCW",
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app, 'mesterhub')
export const storage = getStorage(app)
