// ==========================================
// 🌟 V100.9: Gemini AI Vision + Cloud Sync + Perfect Receipt Image Sharing
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBkS7L59BzlNCfpYM2_pWkNQcOodVcdORc",
  authDomain: "gen-lang-client-0370049065.firebaseapp.com",
  projectId: "gen-lang-client-0370049065",
  storageBucket: "gen-lang-client-0370049065.firebasestorage.app",
  messagingSenderId: "315301750535",
  appId: "1:315301750535:web:000fced25beebb8bfb47a2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const btnSnap = document.getElementById('btn-snap'); 
const cameraInput = document.getElementById('camera-input'); 
const resultOrb = document.getElementById('result-orb'); 
const perPersonAmountDisplay = document.getElementById('per-person-amount'); 
const btnNext = document.getElementById('btn-done'); 
const manualSubtotalInput = document.getElementById('manual-subtotal'); 
const manualTaxInput = document.getElementById('manual-tax'); 

let scannedSubtotal = 0.00; let scannedTax = 0.00; 
let currentGrandTotal = 0.00; let currentPerPerson = 0.00; 
let globalTipValue = 5; let globalSplitValue = 1;
let exactTipAmount = null; 
let isSystemUpdatingDial = false; 
let lastScannedImageBlob = null; // 🌟 用作完美儲存原生 Receipt 檔案

function showNoticeModal(title, msg) { 
    const modal = document.getElementById('custom-modal'); 
    document.getElementById('modal-title').textContent = title; 
    document.getElementById('modal-content').innerHTML = msg; 
    modal.classList.remove('hidden'); 
    document.getElementById('modal-close-btn').onclick = () => modal.classList.add('hidden'); 
}

async function analyzeImageWithGemini(base64Image) {
    const url = 'https://analyze-receipt-315301750535.us-west1.run.app';
    const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image: base64Data })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Backend Serverless API Failed');
    return data; 
}

function calculateAndRender() {
    const sub = parseFloat(manualSubtotalInput.value) || 0; 
    const tax = parseFloat(manualTaxInput.value) || 0; 
    scannedSubtotal = sub; scannedTax = tax;
    
    let tipAmount = 0;
    const tipWrapper = document.getElementById('tip-wrapper');
    const tipDisplay = document.getElementById('tip-display');
    const summaryTipLabel = document.getElementById('summary-tip-label');

    if (exactTipAmount !== null && exactTipAmount > 0) {
        tipAmount = exactTipAmount;
        if (summaryTipLabel) summaryTipLabel.textContent = `Tip (Incl.)`;
        if (tipDisplay) tipDisplay.textContent = 'INCL';
        if (tipWrapper) { tipWrapper.style.pointerEvents = 'none'; tipWrapper.style.opacity = '0.5'; }
    } else {
        tipAmount = scannedSubtotal * (globalTipValue / 100);
        if (summaryTipLabel) summaryTipLabel.textContent = `Tip (${globalTipValue}%)`;
        if (tipDisplay) tipDisplay.textContent = globalTipValue + '%';
        if (tipWrapper) { tipWrapper.style.pointerEvents = 'auto'; tipWrapper.style.opacity = '1'; }
    }

    const taxLabel = document.getElementById('tax-label'); 
    if (sub > 0 && tax > 0) { taxLabel.textContent = `Tax (${((tax / sub) * 100).toFixed(1)}%)`; } else { taxLabel.textContent = 'Tax'; }
    
    currentGrandTotal = scannedSubtotal + scannedTax + tipAmount; 
    currentPerPerson = currentGrandTotal / globalSplitValue;     
    
    const summaryTipInput = document.getElementById('summary-tip-amount'); 
    const summaryTotalInput = document.getElementById('summary-total-amount');
    
    if (summaryTipInput) summaryTipInput.value = tipAmount.toFixed(2); 
    if (summaryTotalInput) summaryTotalInput.value = currentGrandTotal.toFixed(2);
    
    const splitContainer = document.getElementById('split-dial-container'); 
    const orbLabel = document.querySelector('.orb-label'); 
    let displayStr = '$0.00';
    if(splitContainer) { splitContainer.style.opacity = '1'; splitContainer.style.pointerEvents = 'auto'; } 
    if(orbLabel) orbLabel.textContent = 'PER PERSON'; 
    displayStr = currentGrandTotal === 0 ? `$0.00` : `$${currentPerPerson.toFixed(2)}`; 
    
    perPersonAmountDisplay.textContent = displayStr;
    const textLen = displayStr.length; 
    if (textLen > 8) { perPersonAmountDisplay.style.fontSize = '2.8rem'; } 
    else if (textLen > 6) { perPersonAmountDisplay.style.fontSize = '3.5rem'; } 
    else { perPersonAmountDisplay.style.fontSize = '4.5rem'; }
    
    currentGrandTotal > 0 ? resultOrb.classList.remove('inactive') : resultOrb.classList.add('inactive');
}

manualSubtotalInput.addEventListener('input', function() { exactTipAmount = null; calculateAndRender(); }); 
manualTaxInput.addEventListener('input', function() { exactTipAmount = null; calculateAndRender(); });

function setupCircularDial(wrapperId, ringId, thumbId, displayId, min, max, step, initialValue, isPercent, onChangeCallback) {
    const wrapper = document.getElementById(wrapperId); const ring = document.getElementById(ringId); const thumb = document.getElementById(thumbId); const display = document.getElementById(displayId);
    let currentValue = initialValue; const r = 38; const cx = 50; const cy = 50; const circumference = 2 * Math.PI * r; const arcDegrees = 270; const arcLength = circumference * (arcDegrees / 360); ring.style.strokeDasharray = `${arcLength} ${circumference}`;
    function updateUI(val) { const percentage = (val - min) / (max - min); const offset = arcLength - (percentage * arcLength); ring.style.strokeDashoffset = offset; const svgAngleRad = (percentage * arcDegrees) * (Math.PI / 180); thumb.setAttribute('cx', cx + r * Math.cos(svgAngleRad)); thumb.setAttribute('cy', cy + r * Math.sin(svgAngleRad)); if(display.textContent !== 'INCL') display.textContent = val + (isPercent ? '%' : ''); onChangeCallback(val); }
    let isDragging = false; 
    function handlePointer(e) { if (!isDragging && e.type !== 'pointerdown' && e.type !== 'touchstart') return; e.preventDefault(); const rect = wrapper.getBoundingClientRect(); const centerX = rect.left + rect.width / 2; const centerY = rect.top + rect.height / 2; const clientX = e.clientX || (e.touches && e.touches[0].clientX); const clientY = e.clientY || (e.touches && e.touches[0].clientY); if(clientX === undefined || clientY === undefined) return; const dx = clientX - centerX; const dy = clientY - centerY; let angle = Math.atan2(dy, dx) * (180 / Math.PI); if (angle < 0) angle += 360; let adjustedAngle = angle; if (angle < 135) adjustedAngle += 360; let percentage = (adjustedAngle - 135) / arcDegrees; if (percentage < 0) { if (adjustedAngle < 135) percentage = 0; } if (percentage > 1) { if (adjustedAngle > 135 + arcDegrees) percentage = 1; } percentage = Math.max(0, Math.min(1, percentage)); let val = min + percentage * (max - min); val = Math.round(val / step) * step; val = Math.max(min, Math.min(max, val)); if (val !== currentValue) { currentValue = val; updateUI(currentValue); } }
    wrapper.addEventListener('pointerdown', (e) => { isDragging = true; handlePointer(e); wrapper.setPointerCapture(e.pointerId); }); wrapper.addEventListener('pointermove', handlePointer); wrapper.addEventListener('pointerup', (e) => { isDragging = false; wrapper.releasePointerCapture(e.pointerId); }); wrapper.addEventListener('pointercancel', () => { isDragging = false; }); wrapper.addEventListener('touchstart', (e) => { isDragging = true; handlePointer(e); }, {passive: false}); wrapper.addEventListener('touchmove', handlePointer, {passive: false}); wrapper.addEventListener('touchend', () => { isDragging = false; }); updateUI(currentValue); return { setValue: (val) => { currentValue = val; updateUI(val); } };
}

const tipDialControl = setupCircularDial('tip-wrapper', 'tip-ring', 'tip-thumb', 'tip-display', 0, 30, 5, 0, true, (val) => { 
    if (!isSystemUpdatingDial) exactTipAmount = null; 
    globalTipValue = val; calculateAndRender(); 
}); 
const splitDialControl = setupCircularDial('split-wrapper', 'split-ring', 'split-thumb', 'split-display', 1, 20, 1, 1, false, (val) => { globalSplitValue = val; calculateAndRender(); });

const originalApertureSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="14.31" y1="8" x2="20.05" y2="17.94"></line><line x1="9.69" y1="8" x2="21.17" y2="8"></line><line x1="7.38" y1="12" x2="13.12" y2="2.06"></line><line x1="9.69" y1="16" x2="3.95" y2="6.06"></line><line x1="14.31" y1="16" x2="2.83" y2="16"></line><line x1="16.62" y1="12" x2="10.88" y2="21.94"></line></svg>`;

btnSnap.addEventListener('click', () => cameraInput.click()); 

cameraInput.addEventListener('change', (event) => { 
    const file = event.target.files[0]; 
    if (!file) return; 

    btnSnap.classList.add('scanning'); 
    btnSnap.style.pointerEvents = 'none';

    const reader = new FileReader(); 
    reader.onload = (e) => { 
        const img = new Image();
        img.onload = async () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1500;
            const MAX_HEIGHT = 1500;
            let width = img.width; let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            } else {
                if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
            }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // 🌟 核心防彈修正：在壓縮畫質的同時，將 Blob 寫入全域變數
            canvas.toBlob((blob) => { 
                lastScannedImageBlob = blob; 
            }, 'image/jpeg', 0.8);
            
            const base64Image = canvas.toDataURL('image/jpeg', 0.8);
            
            try {
                const aiResult = await analyzeImageWithGemini(base64Image);
                let parsedSub = aiResult.subtotal || 0; 
                let parsedTax = aiResult.tax || 0; 
                let parsedTip = aiResult.gratuity || 0; 
                let parsedTotal = aiResult.total || 0;

                if (parsedSub > 0 || parsedTotal > 0) { 
                    if (parsedSub === 0 && parsedTotal > 0) parsedSub = parsedTotal; 
                    manualSubtotalInput.value = Math.abs(parseFloat(parsedSub.toFixed(2))); 
                    manualTaxInput.value = Math.abs(parseFloat(parsedTax.toFixed(2))); 
                    
                    if (parsedTip > 0) {
                        exactTipAmount = parsedTip; isSystemUpdatingDial = true; tipDialControl.setValue(0); exactTipAmount = parsedTip; isSystemUpdatingDial = false;
                    } else {
                        exactTipAmount = null; isSystemUpdatingDial = true; tipDialControl.setValue(5); isSystemUpdatingDial = false;
                    }
                    
                    calculateAndRender(); 
                } else { 
                    showNoticeModal('No Amount Found', 'AI 搵唔到銀碼，請影得清楚啲！'); 
                }
            } catch (error) { 
                console.error("🔥 AI Debug Log:", error);
                showNoticeModal('API 診斷錯誤', `<div style="font-size: 0.85rem; word-break: break-all; color: #ff4444; text-align: left; line-height: 1.4; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px;">${error.message}</div>`); 
            } finally { 
                btnSnap.innerHTML = originalApertureSVG; 
                btnSnap.classList.remove('scanning'); 
                btnSnap.style.pointerEvents = 'auto'; 
                cameraInput.value = ''; 
            }
        };
        img.src = e.target.result;
    }; 
    reader.readAsDataURL(file); 
});

btnNext.addEventListener('click', () => { 
    manualSubtotalInput.value = ''; manualTaxInput.value = ''; exactTipAmount = null;
    isSystemUpdatingDial = true; tipDialControl.setValue(0); splitDialControl.setValue(1); isSystemUpdatingDial = false;
    lastScannedImageBlob = null; 
});

// ==========================================
// 🚀 核心優化：整合並修正「原生檔案級」相片分享邏輯
// ==========================================
document.getElementById('btn-share').addEventListener('click', async () => {
    if (currentGrandTotal === 0) { showNoticeModal('Empty Bill', '大佬，未入銀碼喎！'); return; }
    
    const billNameInput = document.getElementById('manual-title').value.trim();
    const billName = billNameInput || "聚餐";
    const encodedBillName = encodeURIComponent(billName + " Bill"); 
    const myName = document.getElementById('profileName')?.value.trim() || "我";

    const venmo = document.getElementById('profileVenmo')?.value.trim();
    const zelle = document.getElementById('profileZelle')?.value.trim();
    const paypal = document.getElementById('profilePaypal')?.value.trim();
    const perPersonStr = currentPerPerson.toFixed(2);
    
    let shareText = `🍽️ ${myName} 送來了${billName}帳單明細\n\n`;
    shareText += `🔷 稅前 (Subtotal): $${scannedSubtotal.toFixed(2)}\n`;
    shareText += `🔷 稅金 (Tax): $${scannedTax.toFixed(2)}\n`;
    
    if (exactTipAmount !== null && exactTipAmount > 0) {
        shareText += `🔷 貼士 (Tip Incl.): $${exactTipAmount.toFixed(2)}\n`;
    } else {
        shareText += `🔷 貼士 (Tip ${globalTipValue}%): $${(scannedSubtotal * (globalTipValue / 100)).toFixed(2)}\n`;
    }
    
    shareText += `💰 總金額 (Total): $${currentGrandTotal.toFixed(2)}\n\n`;
    shareText += `👥 分攤人數: ${globalSplitValue} 人\n`;
    shareText += `👉 每人應付: $${perPersonStr}\n\n`;
    shareText += `👇 請選擇付款方式 👇\n`;

    if (venmo) {
        shareText += `\n🔵 點擊使用 Venmo 快速付款:\n`;
        shareText += `https://venmo.com/?tx=pay&recipients=${venmo}&amount=${perPersonStr}&note=${encodedBillName}\n`;
    }
    if (paypal) {
        shareText += `\n🟡 點擊使用 PayPal 快速付款:\n`;
        shareText += `https://paypal.me/${paypal}/${perPersonStr}\n`;
    }
    if (zelle) {
        shareText += `\n🟣 Zelle 轉帳帳號 (請複製):\n`;
        shareText += `${zelle}\n`;
        shareText += `(請手動輸入金額 $${perPersonStr})\n`;
    }
    shareText += `\n(由 BillApp 自動計算 🤖)`;

    const shareData = { title: `${billName} Bill`, text: shareText };

    // 🌟 關鍵修復：嚴格封裝二進制 Blob 為原生 File 結構，強制指定 image/jpeg 打包發送
    if (lastScannedImageBlob) {
        try {
            const file = new File([lastScannedImageBlob], 'receipt.jpg', { type: 'image/jpeg' });
            // 檢查當前系統（尤其是 iOS WebKit）是否支援此檔案組合分享
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                shareData.files = [file];
            }
        } catch (err) {
            console.error("File encapsulation failed:", err);
        }
    }

    if (navigator.share) { 
        try { 
            await navigator.share(shareData); 
        } catch (e) { 
            console.log("Share cancelled or failed", e); 
        } 
    } else { 
        navigator.clipboard.writeText(shareText).then(() => { showNoticeModal('Copied', 'Details copied to clipboard.'); }); 
    }
});

document.getElementById('btn-settings').addEventListener('click', () => { document.getElementById('settings-modal').classList.remove('hidden'); }); 
if (document.getElementById('btn-info')) { document.getElementById('btn-info').addEventListener('click', (e) => { e.preventDefault(); document.getElementById('info-modal').classList.remove('hidden'); }); document.getElementById('btn-info-close').addEventListener('click', () => document.getElementById('info-modal').classList.add('hidden')); }

calculateAndRender();

// ==========================================
// ☁️ Firebase Auth & Firestore 儲存邏輯
// ==========================================
window.handleLogin = async function() {
    const username = document.getElementById('usernameInput').value.toLowerCase().trim();
    const pin = document.getElementById('passwordInput').value;
    if(!username || !pin) return alert("Please enter username and PIN");
    const virtualEmail = `${username}@billapp.local`;

    try {
        await signInWithEmailAndPassword(auth, virtualEmail, pin);
    } catch (error) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            try {
                await createUserWithEmailAndPassword(auth, virtualEmail, pin);
                alert(`Welcome ${username}! Your account has been auto-created.`);
            } catch (createErr) {
                alert("Login/Signup Error: " + createErr.message);
            }
        } else {
            alert("Error: " + error.message);
        }
    }
};

onAuthStateChanged(auth, async (user) => {
    const loginSec = document.getElementById('loginSection');
    const profileSec = document.getElementById('profileSection');

    if (user) {
        if(loginSec) loginSec.style.display = 'none';
        if(profileSec) profileSec.style.display = 'flex'; 

        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            if(document.getElementById('profileName')) document.getElementById('profileName').value = data.name || '';
            if(document.getElementById('profileVenmo')) document.getElementById('profileVenmo').value = data.venmoId || '';
            if(document.getElementById('profileZelle')) document.getElementById('profileZelle').value = data.zelle || '';
            if(document.getElementById('profilePaypal')) document.getElementById('profilePaypal').value = data.paypal || '';
        }
    } else {
        if(loginSec) loginSec.style.display = 'flex';
        if(profileSec) profileSec.style.display = 'none';
    }
});

window.saveProfile = async function() {
    const user = auth.currentUser;
    if (!user) return alert("Please login first.");

    const profileData = {
        name: document.getElementById('profileName').value,
        venmoId: document.getElementById('profileVenmo').value,
        zelle: document.getElementById('profileZelle').value,
        paypal: document.getElementById('profilePaypal').value,
        updatedAt: new Date().toISOString()
    };

    try {
        await setDoc(doc(db, "users", user.uid), profileData);
        alert("Saved to Firebase Cloud! 🚀");
        document.getElementById('settings-modal').classList.add('hidden'); 
    } catch (error) {
        alert("Save Failed: " + error.message);
    }
};