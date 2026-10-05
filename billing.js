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
    
    // Sort items alphabetically
    let itemsArray = [];
    snapshot.forEach(docSnap => {
        itemsArray.push({ id: docSnap.id, ...docSnap.data() });
    });
    itemsArray.sort((a, b) => a.name.localeCompare(b.name));

    itemsArray.forEach(item => {
        const currentStock = item.stock || 0;
        const isOutOfStock = currentStock <= 0;
        
        // NEW: Splits the price whether you type "9,14" OR "9/14"
        const priceList = item.price.toString().split(/[,\/]/);

        priceList.forEach(priceStr => {
            const basePrice = Number(priceStr.trim());
            if (isNaN(basePrice) || basePrice === 0) return; // Skip if empty or invalid

            const card = document.createElement('div');
            card.className = 'item-card';
            
            // If out of stock, grey it out
            if (isOutOfStock) {
                card.style.opacity = '0.5';
                card.style.borderColor = '#ccc';
                card.style.cursor = 'not-allowed';
            }
            
            card.innerHTML = `
                <h4>${item.name}</h4>
                <p style="margin:0; color:#d35400; font-weight:bold; font-size:16px;">₹${basePrice}</p>
                <span class="stock-badge" style="background:${isOutOfStock ? '#7f8c8d' : '#e74c3c'}">Stock: ${currentStock}</span>
            `;
            
            card.onclick = () => {
                if (isOutOfStock) {
                    alert(`${item.name} is currently out of stock!`);
                } else {
                    addToCart(item, basePrice, currentStock);
                }
            };
            
            posMenu.appendChild(card);
        });
    });
}

function addToCart(item, selectedPrice, currentStock) {
    let totalInCart = 0;
    cart.forEach(c => {
        if (c.id === item.id) totalInCart += c.qty;
    });

    if (totalInCart >= currentStock) {
        alert(`You only have ${currentStock} of ${item.name} left in stock!`);
        return;
    }

    const existing = cart.find(c => c.id === item.id && c.price === selectedPrice);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ id: item.id, name: item.name, price: selectedPrice, qty: 1, currentStock: currentStock });
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
        
        await addDoc(collection(db, "transactions"), {
            date: new Date().toISOString(),
            items: cart.map(c => ({ name: c.name, qty: c.qty, price: c.price })),
            totalAmount: total
        });

        const stockDeductions = {};
        cart.forEach(c => {
            if (!stockDeductions[c.id]) {
                stockDeductions[c.id] = { currentStock: c.currentStock, totalQtyToDeduct: 0 };
            }
            stockDeductions[c.id].totalQtyToDeduct += c.qty;
        });

        for (const [itemId, data] of Object.entries(stockDeductions)) {
            const newStock = Math.max(0, data.currentStock - data.totalQtyToDeduct);
            await updateDoc(doc(db, "items", itemId), { stock: newStock });
        }

        alert("Payment Complete!");
        cart = [];
        renderCart();
        loadMenu(); 
    } catch (err) {
        console.error(err);
        alert("Transaction Failed.");
    } finally {
        btn.textContent = "Complete Payment";
        btn.disabled = false;
    }
});

loadMenu();