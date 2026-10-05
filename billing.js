import { db, auth } from './firebase-config.js';
import { collection, getDocs, addDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

let cart = [];

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
});

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

async function loadMenu() {
    const snapshot = await getDocs(collection(db, "items"));
    const posMenu = document.getElementById('pos-menu');
    posMenu.innerHTML = '';
    
    // Sort items alphabetically for easier scanning
    let itemsArray = [];
    snapshot.forEach(docSnap => {
        itemsArray.push({ id: docSnap.id, ...docSnap.data() });
    });
    itemsArray.sort((a, b) => a.name.localeCompare(b.name));

    itemsArray.forEach(item => {
        const currentStock = item.stock || 0;
        
        // Split multiple prices (e.g. "9,14" becomes ["9", "14"])
        const priceList = item.price.toString().split(',');

        priceList.forEach(priceStr => {
            const basePrice = Number(priceStr.trim());
            if (isNaN(basePrice)) return;

            const card = document.createElement('div');
            card.className = 'item-card';
            
            // Show price in bold to make it clear which variant they are tapping
            card.innerHTML = `
                <h4>${item.name}</h4>
                <p style="margin:0; color:#d35400; font-weight:bold; font-size:16px;">₹${basePrice}</p>
                <span class="stock-badge">Stock: ${currentStock}</span>
            `;
            
            // Pass the specific price they clicked
            card.onclick = () => addToCart(item, basePrice);
            posMenu.appendChild(card);
        });
    });
}

function addToCart(item, selectedPrice) {
    // Check if the exact item AND exact price is already in the cart
    const existing = cart.find(c => c.id === item.id && c.price === selectedPrice);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ id: item.id, name: item.name, price: selectedPrice, qty: 1, currentStock: item.stock || 0 });
    }
    renderCart();
}

function renderCart() {
    const list = document.getElementById('cart-list');
    let total = 0;
    list.innerHTML = '';
    
    cart.forEach((c, index) => {
        const itemTotal = c.price * c.qty;
        total += itemTotal;
        list.innerHTML += `
            <div class="cart-item">
                <div class="cart-item-info">
                    <strong style="font-size:14px;">${c.name}</strong>
                    <span style="font-size:13px; color:#666;">₹${c.price} x ${c.qty}</span>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <strong style="font-size:15px;">₹${itemTotal}</strong>
                    <button class="remove-btn" onclick="window.removeFromCart(${index})">×</button>
                </div>
            </div>
        `;
    });
    document.getElementById('cart-total').textContent = total;
}

window.removeFromCart = (index) => {
    cart.splice(index, 1);
    renderCart();
}

document.getElementById('complete-btn').addEventListener('click', async () => {
    if (cart.length === 0) return alert("Cart is empty!");
    
    const btn = document.getElementById('complete-btn');
    btn.textContent = "Processing...";
    btn.disabled = true;

    try {
        const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        
        // 1. Record the transaction
        await addDoc(collection(db, "transactions"), {
            date: new Date().toISOString(),
            items: cart.map(c => ({ name: c.name, qty: c.qty, price: c.price })),
            totalAmount: total
        });

        // 2. Group deductions by Item ID (so if they buy a 9 & 14 Gold Flake, it subtracts 2 total)
        const stockDeductions = {};
        cart.forEach(c => {
            if (!stockDeductions[c.id]) {
                stockDeductions[c.id] = { currentStock: c.currentStock, totalQtyToDeduct: 0 };
            }
            stockDeductions[c.id].totalQtyToDeduct += c.qty;
        });

        // 3. Update Firestore Stock safely
        for (const [itemId, data] of Object.entries(stockDeductions)) {
            const newStock = Math.max(0, data.currentStock - data.totalQtyToDeduct);
            await updateDoc(doc(db, "items", itemId), { stock: newStock });
        }

        alert("Payment Complete!");
        cart = [];
        renderCart();
        loadMenu(); // Refresh stock counts immediately
    } catch (err) {
        console.error(err);
        alert("Transaction Failed.");
    } finally {
        btn.textContent = "Complete Payment";
        btn.disabled = false;
    }
});

loadMenu();