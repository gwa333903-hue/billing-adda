import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-vGsySxKoO7X9HevDjx8ZL2TJ0An3GwY",
    authDomain: "adda-4a797.firebaseapp.com",
      projectId: "adda-4a797",
        storageBucket: "adda-4a797.firebasestorage.app",
          messagingSenderId: "599949050789",
            appId: "1:599949050789:web:c3adfbb8e8c7b211105e4c",
              measurementId: "G-GDSN2WNH0C"
              };

              export const app = initializeApp(firebaseConfig);
              export const db = getFirestore(app);
              export const storage = getStorage(app);
              export const auth = getAuth(app);
              
