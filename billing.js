import { db, auth } from './firebase-config.js';
import { collection, getDocs, addDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

let cart = [];
let selectedPaymentMethod = null;

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
});

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

async function loadMenu() {
    const catSnapshot = await getDocs(collection(db, "categories"));
    let categoriesList = [];
    catSnapshot.forEach(doc => { 
        categoriesList.push({ id: doc.id, ...doc.data() }); 
    });
    categoriesList.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    const itemSnapshot = await getDocs(collection(db, "items"));
    const items = [];
    itemSnapshot.forEach(doc => { items.push({ id: doc.id, ...doc.data() }); });

    const posMenu = document.getElementById('pos-menu');
    posMenu.innerHTML = '';

    categoriesList.forEach(cat => {
        let catItems = items.filter(item => item.categoryId === cat.id);
        if (catItems.length === 0) return;

        catItems.sort((a, b) => {
            const itemOrderA = Number(a.order) || 0;
            const itemOrderB = Number(b.order) || 0;
            if (itemOrderA !== itemOrderB) return itemOrderA - itemOrderB;
            return a.name.localeCompare(b.name);
        });

        const catHeader = document.createElement('h3');
        catHeader.className = 'category-title';
        catHeader.textContent = cat.name;
        posMenu.appendChild(catHeader);

        catItems.forEach(item => {
            const currentStock = item.stock || 0;
            const priceList = item.price.toString().split(/[,\/]/);

            priceList.forEach(priceStr => {
                const basePrice = Number(priceStr.trim());
                if (isNaN(basePrice) || basePrice === 0) return;

                const card = document.createElement('div');
                card.className = 'item-card';
                card.innerHTML = `
                    <h4>${item.name}</h4>
                    <p style="margin:0; color:#d35400; font-weight:bold; font-size:16px;">₹${basePrice}</p>
                    <span class="stock-badge" style="background:${currentStock <= 0 ? '#7f8c8d' : '#e74c3c'}">Stock: ${currentStock}</span>
                `;
                
                card.onclick = () => addToCart(item, basePrice, currentStock);
                posMenu.appendChild(card);
            });
        });
    });
}

function addToCart(item, selectedPrice, currentStock) {
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

// --- MODAL LOGIC WITH UPI QR CODE ---
const modal = document.getElementById('payment-modal');
const btnCash = document.getElementById('pay-cash');
const btnOnline = document.getElementById('pay-online');
const btnConfirm = document.getElementById('confirm-payment-btn');
const qrContainer = document.getElementById('upi-qr-container');
const qrcodeDiv = document.getElementById('qrcode');

document.getElementById('billing-btn').addEventListener('click', () => {
    if (cart.length === 0) return alert("Cart is empty!");
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    document.getElementById('modal-total-amount').textContent = total;
    
    selectedPaymentMethod = null;
    btnCash.classList.remove('selected');
    btnOnline.classList.remove('selected');
    btnConfirm.disabled = true;
    qrContainer.style.display = 'none';
    
    modal.style.display = 'flex';
});

document.getElementById('cancel-payment-btn').addEventListener('click', () => {
    modal.style.display = 'none';
});

function selectPaymentMethod(method) {
    selectedPaymentMethod = method;
    btnConfirm.disabled = false;
    
    if (method === 'cash') {
        btnCash.classList.add('selected');
        btnOnline.classList.remove('selected');
        qrContainer.style.display = 'none'; // Hide QR Code
    } else {
        btnOnline.classList.add('selected');
        btnCash.classList.remove('selected');
        
        // 1. SHOW the container FIRST
        qrContainer.style.display = 'flex'; 
        
        const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        
        // UPDATED: New Paytm UPI ID and Payee Name "adda"
        const upiLink = `upi://pay?pa=paytm.s286395@pty&pn=adda&am=${total}&cu=INR`;
        
        qrcodeDiv.innerHTML = ''; // Clear previous QR
        
        // 2. Draw the QR Code after the box is visible
        setTimeout(() => {
            new QRCode(qrcodeDiv, {
                text: upiLink,
                width: 180,
                height: 180,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        }, 50);
    }
}

btnCash.addEventListener('click', () => selectPaymentMethod('cash'));
btnOnline.addEventListener('click', () => selectPaymentMethod('online'));

// --- COMPLETE PAYMENT ---
btnConfirm.addEventListener('click', async () => {
    if (cart.length === 0 || !selectedPaymentMethod) return;
    
    btnConfirm.textContent = "Processing...";
    btnConfirm.disabled = true;

    try {
        const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        
        await addDoc(collection(db, "transactions"), {
            date: new Date().toISOString(),
            items: cart.map(c => ({ name: c.name, qty: c.qty, price: c.price })),
            totalAmount: total,
            paymentMethod: selectedPaymentMethod 
        });

        const stockDeductions = {};
        cart.forEach(c => {
            if (!stockDeductions[c.id]) {
                stockDeductions[c.id] = { currentStock: c.currentStock, totalQtyToDeduct: 0 };
            }
            stockDeductions[c.id].totalQtyToDeduct += c.qty;
        });

        for (const [itemId, data] of Object.entries(stockDeductions)) {
            const newStock = data.currentStock - data.totalQtyToDeduct;
            await updateDoc(doc(db, "items", itemId), { stock: newStock });
        }

        modal.style.display = 'none';
        cart = [];
        renderCart();
        loadMenu(); 
    } catch (err) {
        console.error(err);
        alert("Transaction Failed.");
    } finally {
        btnConfirm.textContent = "Complete Payment";
        btnConfirm.disabled = false;
    }
});

loadMenu();