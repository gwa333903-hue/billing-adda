import { db, auth } from './firebase-config.js';
import { collection, getDocs, addDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

let items = [];
let cart = [];

onAuthStateChanged(auth, (user) => {
    if (!user || user.email !== 'adda@adda.com') window.location.href = "login.html";
});

async function loadMenu() {
    const snapshot = await getDocs(collection(db, "items"));
    items = [];
    const posMenu = document.getElementById('pos-menu');
    posMenu.innerHTML = '';
    
    snapshot.forEach(docSnap => {
        const item = { id: docSnap.id, ...docSnap.data() };
        items.push(item);
        
        // Use first price if multiple are separated by comma
        const basePrice = Number(item.price.toString().split(',')[0]);
        const currentStock = item.stock || 0;

        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <h4>${item.name}</h4>
            <p>₹${basePrice}</p>
            <span class="stock-badge">Stock: ${currentStock}</span>
        `;
        card.onclick = () => addToCart(item, basePrice);
        posMenu.appendChild(card);
    });
}

function addToCart(item, price) {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ id: item.id, name: item.name, price: price, qty: 1, currentStock: item.stock || 0 });
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
                <span>${c.name} (x${c.qty})</span>
                <span>₹${itemTotal}</span>
                <button onclick="window.removeFromCart(${index})" style="color:red; border:none; background:none; cursor:pointer;">X</button>
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
        
        // 1. Record Transaction
        await addDoc(collection(db, "transactions"), {
            date: new Date().toISOString(),
            items: cart.map(c => ({ name: c.name, qty: c.qty, price: c.price })),
            totalAmount: total
        });

        // 2. Deduct Stock
        for (const cartItem of cart) {
            const newStock = Math.max(0, cartItem.currentStock - cartItem.qty);
            await updateDoc(doc(db, "items", cartItem.id), { stock: newStock });
        }

        alert("Payment Complete!");
        cart = [];
        renderCart();
        loadMenu(); // Refresh stock UI
    } catch (err) {
        console.error(err);
        alert("Transaction Failed.");
    } finally {
        btn.textContent = "Complete Payment";
        btn.disabled = false;
    }
});

loadMenu();
