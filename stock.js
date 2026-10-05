import { db, auth } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

// Allow ONLY Owner or Staff to view the page
onAuthStateChanged(auth, (user) => {
    if (!user || (user.email !== 'adda@adda.com' && user.email !== 'staff@adda.com')) {
        window.location.href = "index.html";
    }
});

async function loadStockLogs() {
    try {
        const snapshot = await getDocs(collection(db, "stock_logs"));
        let logs = [];
        snapshot.forEach(docSnap => {
            logs.push(docSnap.data());
        });

        // Sort newest first
        logs.sort((a, b) => new Date(b.date) - new Date(a.date));

        const tbody = document.getElementById('log-list');
        tbody.innerHTML = '';

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #777;">No stock history found yet.</td></tr>';
            return;
        }

        logs.forEach(log => {
            const dateStr = new Date(log.date).toLocaleDateString() + ' ' + new Date(log.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            tbody.innerHTML += `
                <tr>
                    <td style="font-size:13px; color:#555;">${dateStr}</td>
                    <td style="font-weight:bold; color:#2c3e50;">${log.itemName}</td>
                    <td><span class="qty-badge">+${log.addedQty}</span></td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("Error loading logs:", err);
        document.getElementById('log-list').innerHTML = '<tr><td colspan="3" style="text-align: center; color: red;">Failed to load logs. Ensure Firestore rules are updated.</td></tr>';
    }
}

loadStockLogs();