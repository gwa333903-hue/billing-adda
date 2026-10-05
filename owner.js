import { db, auth } from './firebase-config.js';
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    if (!user || user.email !== 'adda@adda.com') window.location.href = "login.html";
});

let allTransactions = [];
let allItems = [];

// --- Transaction Logic ---
async function loadTransactions() {
    const snapshot = await getDocs(collection(db, "transactions"));
    allTransactions = [];
    snapshot.forEach(docSnap => {
        allTransactions.push(docSnap.data());
    });
    
    // Sort newest first
    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    applyFilter();
}

document.getElementById('filter-btn').addEventListener('click', applyFilter);

function applyFilter() {
    const timeFilter = document.getElementById('time-filter').value;
    const customDate = document.getElementById('custom-date').value;
    
    let filtered = allTransactions;
    const now = new Date();

    if (customDate) {
        filtered = filtered.filter(tx => tx.date.startsWith(customDate));
    } else if (timeFilter === 'today') {
        const todayStr = now.toISOString().split('T')[0];
        filtered = filtered.filter(tx => tx.date.startsWith(todayStr));
    } else if (timeFilter === 'month') {
        const monthStr = now.toISOString().substring(0, 7); // YYYY-MM
        filtered = filtered.filter(tx => tx.date.startsWith(monthStr));
    }

    renderTransactions(filtered);
}

function renderTransactions(txList) {
    const tbody = document.getElementById('tx-list');
    let totalSales = 0;
    tbody.innerHTML = '';
    
    txList.forEach(tx => {
        totalSales += tx.totalAmount;
        const dateStr = new Date(tx.date).toLocaleString();
        const itemsStr = tx.items.map(i => `${i.name}(x${i.qty})`).join(', ');
        
        tbody.innerHTML += `
            <tr>
                <td style="font-size:12px; color:#555;">${dateStr}</td>
                <td>${itemsStr}</td>
                <td style="font-weight:bold;">₹${tx.totalAmount}</td>
            </tr>
        `;
    });
    
    document.getElementById('sales-total').textContent = totalSales;
}

// --- Stock Management Logic ---
async function loadStock() {
    const snapshot = await getDocs(collection(db, "items"));
    allItems = [];
    const tbody = document.getElementById('stock-list');
    tbody.innerHTML = '';

    snapshot.forEach(docSnap => {
        const item = { id: docSnap.id, ...docSnap.data() };
        allItems.push(item);
        const currentStock = item.stock || 0;

        tbody.innerHTML += `
            <tr>
                <td><strong>${item.name}</strong></td>
                <td>${currentStock}</td>
                <td><input type="number" id="add-stock-${item.id}" placeholder="Qty" style="width: 60px;"></td>
                <td><button onclick="window.updateItemStock('${item.id}', ${currentStock})" style="background:#2ecc71;">Update</button></td>
            </tr>
        `;
    });
}

window.updateItemStock = async (itemId, currentStock) => {
    const addedStock = Number(document.getElementById(`add-stock-${itemId}`).value);
    if (!addedStock || addedStock <= 0) return alert("Enter a valid quantity to add.");
    
    try {
        const newStock = currentStock + addedStock;
        await updateDoc(doc(db, "items", itemId), { stock: newStock });
        loadStock(); // Refresh list
    } catch (err) {
        console.error(err);
        alert("Failed to update stock.");
    }
}

loadTransactions();
loadStock();
