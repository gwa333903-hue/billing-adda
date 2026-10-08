import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!password) return alert("Please enter the password!");

    const btn = document.getElementById('login-btn');
    btn.textContent = "Verifying...";
    btn.disabled = true;

    try {
        await signOut(auth);
        
        await signInWithEmailAndPassword(auth, email, password);
        
        window.location.href = "owner.html";
    } catch (err) {
        console.error(err);
        alert("Incorrect password or authentication failed.");
        btn.textContent = "Secure Login";
        btn.disabled = false;
    }
});
