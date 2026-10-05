import { db, auth } from './firebase-config.js';
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
});

let allTransactions = [];

async function loadTransactions() {
    const snapshot = await getDocs(collection(db, "transactions"));
    allTransactions = [];
    snapshot.forEach(docSnap => {
        allTransactions.push(docSnap.data());
    });
    
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
        const monthStr = now.toISOString().substring(0, 7); 
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
        const dateStr = new Date(tx.date).toLocaleDateString() + ' ' + new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const itemsStr = tx.items.map(i => `${i.name} (x${i.qty})`).join('<br>');
        
        tbody.innerHTML += `
            <tr>
                <td style="font-size:12px; color:#555;">${dateStr}</td>
                <td style="font-size:14px;">${itemsStr}</td>
                <td style="font-weight:bold; color:#2c3e50;">₹${tx.totalAmount}</td>
            </tr>
        `;
    });
    
    document.getElementById('sales-total').textContent = totalSales;
}

async function loadStock() {
    // 1. Fetch Categories first
    const catSnapshot = await getDocs(collection(db, "categories"));
    const catCache = {};
    catSnapshot.forEach(docSnap => {
        catCache[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
    });

    const snapshot = await getDocs(collection(db, "items"));
    const tbody = document.getElementById('stock-list');
    tbody.innerHTML = '';

    let itemsArray = [];
    snapshot.forEach(docSnap => {
        itemsArray.push({ id: docSnap.id, ...docSnap.data() });
    });

    // 2. Sort by Category Order, then Item Order
    itemsArray.sort((a, b) => {
        const catA = catCache[a.categoryId];
        const catB = catCache[b.categoryId];
        const orderA = catA ? (Number(catA.order) || 0) : 999;
        const orderB = catB ? (Number(catB.order) || 0) : 999;
        
        if (orderA !== orderB) {
            return orderA - orderB;
        }
        const itemOrderA = Number(a.order) || 0;
        const itemOrderB = Number(b.order) || 0;
        if (itemOrderA !== itemOrderB) {
            return itemOrderA - itemOrderB;
        }
        return a.name.localeCompare(b.name);
    });

    itemsArray.forEach(item => {
        const currentStock = item.stock || 0;
        const categoryName = catCache[item.categoryId] ? catCache[item.categoryId].name : "Unassigned";
        
        tbody.innerHTML += `
            <tr>
                <td>
                    <strong>${item.name}</strong> 
                    <span style="font-size:12px; color:#888;">[${categoryName}]</span><br>
                    <span style="color:#666; font-size:13px;">(₹${item.price})</span>
                </td>
                <td style="text-align:center;">
                    <span style="background:${currentStock > 5 ? '#eafaf1' : '#fdedec'}; padding:4px 8px; border-radius:4px;">
                        ${currentStock}
                    </span>
                </td>
                <td><input type="number" id="add-stock-${item.id}" placeholder="Qty" style="width: 70px;"></td>
                <td><button class="update-btn" onclick="window.updateItemStock('${item.id}', ${currentStock})">Update</button></td>
            </tr>
        `;
    });
}

window.updateItemStock = async (itemId, currentStock) => {
    const inputField = document.getElementById(`add-stock-${itemId}`);
    const addedStock = Number(inputField.value);
    
    if (!addedStock || addedStock === 0) return alert("Enter a valid quantity.");
    
    try {
        const newStock = currentStock + addedStock;
        await updateDoc(doc(db, "items", itemId), { stock: newStock });
        inputField.value = '';
        loadStock(); 
    } catch (err) {
        console.error(err);
        alert("Failed to update stock.");
    }
}

loadTransactions();
loadStock();