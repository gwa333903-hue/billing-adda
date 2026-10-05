import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

// Auto-login: If already logged in, go straight to billing
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = "billing.html";
    }
});

const loginForm = document.getElementById('login-form');
const errorMsg = document.getElementById('error-msg');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = "billing.html";
    } catch (err) {
        console.error(err);
        errorMsg.textContent = "Invalid password.";
    }
});