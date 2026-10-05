import { db, auth } from './firebase-config.js';
import { collection, getDocs, doc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
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
    let cashSales = 0;
    let onlineSales = 0;
    tbody.innerHTML = '';
    
    txList.forEach(tx => {
        const amount = tx.totalAmount || 0;
        totalSales += amount;
        
        // If it's an old transaction without a paymentMethod, we default it to cash
        const method = tx.paymentMethod || 'cash';
        if (method === 'cash') cashSales += amount;
        if (method === 'online') onlineSales += amount;

        const dateStr = new Date(tx.date).toLocaleDateString() + ' ' + new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const itemsStr = tx.items.map(i => `${i.name} (x${i.qty})`).join('<br>');
        
        // Badge style based on method
        const badgeClass = method === 'cash' ? 'badge-cash' : 'badge-online';
        
        tbody.innerHTML += `
            <tr>
                <td style="font-size:12px; color:#555;">${dateStr}</td>
                <td style="font-size:14px;">${itemsStr}</td>
                <td><span class="method-badge ${badgeClass}">${method}</span></td>
                <td style="font-weight:bold; color:#2c3e50;">₹${amount}</td>
            </tr>
        `;
    });
    
    document.getElementById('sales-cash').textContent = cashSales;
    document.getElementById('sales-online').textContent = onlineSales;
    document.getElementById('sales-total').textContent = totalSales;
}

async function loadStock() {
    const catSnapshot = await getDocs(collection(db, "categories"));
    let categoriesList = [];
    catSnapshot.forEach(doc => { 
        categoriesList.push({ id: doc.id, ...doc.data() }); 
    });
    categoriesList.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    const snapshot = await getDocs(collection(db, "items"));
    const tbody = document.getElementById('stock-list');
    tbody.innerHTML = '';

    const items = [];
    snapshot.forEach(docSnap => { items.push({ id: docSnap.id, ...docSnap.data() }); });

    categoriesList.forEach(cat => {
        let catItems = items.filter(item => item.categoryId === cat.id);
        if (catItems.length === 0) return;

        catItems.sort((a, b) => {
            const itemOrderA = Number(a.order) || 0;
            const itemOrderB = Number(b.order) || 0;
            if (itemOrderA !== itemOrderB) return itemOrderA - itemOrderB;
            return a.name.localeCompare(b.name);
        });

        tbody.innerHTML += `
            <tr class="category-row">
                <td colspan="4" style="padding:15px 10px;">${cat.name}</td>
            </tr>
        `;

        catItems.forEach(item => {
            const currentStock = item.stock || 0;
            
            tbody.innerHTML += `
                <tr>
                    <td>
                        <strong>${item.name}</strong><br>
                        <span style="color:#666; font-size:13px;">(₹${item.price})</span>
                    </td>
                    <td style="text-align:center;">
                        <span style="background:${currentStock > 5 ? '#eafaf1' : '#fdedec'}; padding:4px 8px; border-radius:4px;">
                            ${currentStock}
                        </span>
                    </td>
                    <td><input type="number" id="add-stock-${item.id}" placeholder="Qty" style="width: 70px;"></td>
                    <td><button class="update-btn" onclick="window.updateItemStock('${item.id}', \`${item.name}\`, ${currentStock})">Update</button></td>
                </tr>
            `;
        });
    });
}

window.updateItemStock = async (itemId, itemName, currentStock) => {
    const inputField = document.getElementById(`add-stock-${itemId}`);
    const addedStock = Number(inputField.value);
    
    if (!addedStock || addedStock === 0) return alert("Enter a valid quantity.");
    
    try {
        const newStock = currentStock + addedStock;
        
        await updateDoc(doc(db, "items", itemId), { stock: newStock });
        
        await addDoc(collection(db, "stock_logs"), {
            itemId: itemId,
            itemName: itemName,
            addedQty: addedStock,
            date: new Date().toISOString()
        });

        inputField.value = '';
        loadStock(); 
    } catch (err) {
        console.error(err);
        alert("Failed to update stock.");
    }
}

loadTransactions();
loadStock();