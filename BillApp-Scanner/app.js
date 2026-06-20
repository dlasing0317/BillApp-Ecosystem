// ==========================================
// 🌟 FIREBASE SETUP (BILLAPP-SCANNER 獨立 DB)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🌟 從 Shared Folder 引入核心 UI 邏輯
import { 
    autoResizeInput, 
    showNoticeModal, 
    showConfirmModal, 
    initConfirmModal
} from '../shared/core-ui.js';

// 🚨🚨🚨 極度重要：呢度一定要放你「舊版 BillApp」專屬嘅 Key (DB A)！ 
// 🚨🚨🚨 絕對唔好 Copy 錯 Travel 嗰條 (DB B) 落嚟！
const firebaseConfig = {
    // apiKey: "YOUR_SCANNER_API_KEY",
    // authDomain: "YOUR_SCANNER_AUTH_DOMAIN",
    // projectId: "YOUR_SCANNER_PROJECT_ID",
    // storageBucket: "YOUR_SCANNER_STORAGE_BUCKET",
    // messagingSenderId: "YOUR_SENDER_ID",
    // appId: "YOUR_APP_ID"
};

// 如果你舊版有儲 Save 去 DB 先 Uncomment 呢兩行：
// const app = initializeApp(firebaseConfig);
// const db = getFirestore(app);

// 初始化 Modal Event Listeners
initConfirmModal();

// ==========================================
// 🌟 SCANNER / OCR / ORB LOGIC
// ==========================================
const btnSnap = document.getElementById('btn-snap');
const cameraInput = document.getElementById('camera-input');
const resultOrb = document.getElementById('result-orb');
const perPersonAmountDisplay = document.getElementById('per-person-amount');
const btnShare = document.getElementById('btn-share'); 
const btnDone = document.getElementById('btn-done');
const manualSubtotalInput = document.getElementById('manual-subtotal');
const manualTaxInput = document.getElementById('manual-tax');
const taxLabel = document.getElementById('tax-label');

const btnSettings = document.getElementById('btn-settings');
const settingsModal = document.getElementById('settings-modal');
const settingsNameInput = document.getElementById('settings-name-input');
const settingsVenmoInput = document.getElementById('settings-venmo-input');
const settingsZelleInput = document.getElementById('settings-zelle-input');
const btnSettingsSave = document.getElementById('btn-settings-save');
const btnSettingsCancel = document.getElementById('btn-settings-cancel');

const cropModal = document.getElementById('crop-modal');
const cropImage = document.getElementById('crop-image');
const btnCropCancel = document.getElementById('btn-crop-cancel');
const btnCropConfirm = document.getElementById('btn-crop-confirm');
let cropper = null; 

let scannedSubtotal = 0.00; 
let scannedTax = 0.00;       
let currentGrandTotal = 0.00; 
let currentPerPerson = 0.00;  
let globalTipValue = 5;
let globalSplitValue = 1;

function calculateAndRender() {
    const sub = parseFloat(manualSubtotalInput.value) || 0;
    const tax = parseFloat(manualTaxInput.value) || 0;
    scannedSubtotal = sub; scannedTax = tax;

    if (sub > 0 && tax > 0) {
        const taxPercent = (tax / sub) * 100;
        taxLabel.textContent = `Tax (${taxPercent.toFixed(1)}%)`;
    } else { taxLabel.textContent = 'Tax'; }

    const tipAmount = scannedSubtotal * (globalTipValue / 100);
    currentGrandTotal = scannedSubtotal + scannedTax + tipAmount; 
    currentPerPerson = currentGrandTotal / globalSplitValue;     

    const displayStr = currentGrandTotal === 0 ? `$0.00` : `$${currentPerPerson.toFixed(2)}`;
    perPersonAmountDisplay.textContent = displayStr;
    
    const textLen = displayStr.length;
    if (textLen > 8) { perPersonAmountDisplay.style.fontSize = '2.8rem'; } 
    else if (textLen > 6) { perPersonAmountDisplay.style.fontSize = '3.5rem'; } 
    else { perPersonAmountDisplay.style.fontSize = '4.5rem'; }

    currentGrandTotal > 0 ? resultOrb.classList.remove('inactive') : resultOrb.classList.add('inactive');
}

// 🌟 呼叫 Shared 的 autoResizeInput
manualSubtotalInput.addEventListener('input', function() { autoResizeInput(this); calculateAndRender(); });
manualTaxInput.addEventListener('input', function() { autoResizeInput(this); calculateAndRender(); });

function setupCircularDial(wrapperId, ringId, thumbId, displayId, min, max, step, initialValue, isPercent, onChangeCallback) {
    const wrapper = document.getElementById(wrapperId); const ring = document.getElementById(ringId); const thumb = document.getElementById(thumbId); const display = document.getElementById(displayId);
    let currentValue = initialValue; const r = 38; const cx = 50; const cy = 50; const circumference = 2 * Math.PI * r; const arcDegrees = 270; const arcLength = circumference * (arcDegrees / 360);
    ring.style.strokeDasharray = `${arcLength} ${circumference}`;

    function updateUI(val) {
        const percentage = (val - min) / (max - min); const offset = arcLength - (percentage * arcLength);
        ring.style.strokeDashoffset = offset;
        const svgAngleRad = (percentage * arcDegrees) * (Math.PI / 180);
        thumb.setAttribute('cx', cx + r * Math.cos(svgAngleRad)); thumb.setAttribute('cy', cy + r * Math.sin(svgAngleRad));
        display.textContent = val + (isPercent ? '%' : ''); onChangeCallback(val);
    }

    let isDragging = false;
    function handlePointer(e) {
        if (!isDragging && e.type !== 'pointerdown' && e.type !== 'touchstart') return;
        e.preventDefault(); 
        const rect = wrapper.getBoundingClientRect(); const centerX = rect.left + rect.width / 2; const centerY = rect.top + rect.height / 2;
        const clientX = e.clientX || (e.touches && e.touches[0].clientX); const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        if(clientX === undefined || clientY === undefined) return;
        const dx = clientX - centerX; const dy = clientY - centerY;
        let angle = Math.atan2(dy, dx) * (180 / Math.PI); 
        if (angle < 0) angle += 360; 
        let adjustedAngle = angle; if (angle < 135) adjustedAngle += 360;
        let percentage = (adjustedAngle - 135) / arcDegrees;
        if (percentage < 0) { if (adjustedAngle < 135) percentage = 0; }
        if (percentage > 1) { if (adjustedAngle > 135 + arcDegrees) percentage = 1; }
        percentage = Math.max(0, Math.min(1, percentage));
        let val = min + percentage * (max - min); val = Math.round(val / step) * step; val = Math.max(min, Math.min(max, val));
        if (val !== currentValue) { currentValue = val; updateUI(currentValue); }
    }

    wrapper.addEventListener('pointerdown', (e) => { isDragging = true; handlePointer(e); wrapper.setPointerCapture(e.pointerId); });
    wrapper.addEventListener('pointermove', handlePointer);
    wrapper.addEventListener('pointerup', (e) => { isDragging = false; wrapper.releasePointerCapture(e.pointerId); });
    wrapper.addEventListener('pointercancel', () => { isDragging = false; });
    wrapper.addEventListener('touchstart', (e) => { isDragging = true; handlePointer(e); }, {passive: false});
    wrapper.addEventListener('touchmove', handlePointer, {passive: false});
    wrapper.addEventListener('touchend', () => { isDragging = false; });
    updateUI(currentValue); return { setValue: (val) => { currentValue = val; updateUI(val); } };
}

const tipDialControl = setupCircularDial('tip-wrapper', 'tip-ring', 'tip-thumb', 'tip-display', 5, 30, 5, 5, true, (val) => { globalTipValue = val; calculateAndRender(); });
const splitDialControl = setupCircularDial('split-wrapper', 'split-ring', 'split-thumb', 'split-display', 1, 20, 1, 1, false, (val) => { globalSplitValue = val; calculateAndRender(); });

settingsNameInput.value = localStorage.getItem('billapp_user_name') || '';
settingsVenmoInput.value = localStorage.getItem('billapp_venmo_id') || '';
settingsZelleInput.value = localStorage.getItem('billapp_zelle_id') || '';

btnSettings.addEventListener('click', () => {
    settingsNameInput.value = localStorage.getItem('billapp_user_name') || '';
    settingsVenmoInput.value = localStorage.getItem('billapp_venmo_id') || '';
    settingsZelleInput.value = localStorage.getItem('billapp_zelle_id') || '';
    settingsModal.classList.remove('hidden');
});
btnSettingsCancel.addEventListener('click', () => settingsModal.classList.add('hidden'));
btnSettingsSave.addEventListener('click', () => {
    localStorage.setItem('billapp_user_name', settingsNameInput.value.trim());
    localStorage.setItem('billapp_venmo_id', settingsVenmoInput.value.trim());
    localStorage.setItem('billapp_zelle_id', settingsZelleInput.value.trim());
    settingsModal.classList.add('hidden');
    showNoticeModal('Profile Saved', ''); 
});

btnSnap.addEventListener('click', () => cameraInput.click());
btnCropCancel.addEventListener('click', () => { cropModal.classList.add('hidden'); if (cropper) cropper.destroy(); cameraInput.value = ''; });

cameraInput.addEventListener('change', (event) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        cropImage.src = e.target.result; cropModal.classList.remove('hidden');
        if (cropper) cropper.destroy();
        cropper = new Cropper(cropImage, { viewMode: 1, dragMode: 'crop', autoCropArea: 0.8, restore: false, guides: true, center: true, highlight: false, cropBoxMovable: true, cropBoxResizable: true, toggleDragModeOnDblclick: false });
    };
    reader.readAsDataURL(file);
});

const originalApertureSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="14.31" y1="8" x2="20.05" y2="17.94"></line><line x1="9.69" y1="8" x2="21.17" y2="8"></line><line x1="7.38" y1="12" x2="13.12" y2="2.06"></line><line x1="9.69" y1="16" x2="3.95" y2="6.06"></line><line x1="14.31" y1="16" x2="2.83" y2="16"></line><line x1="16.62" y1="12" x2="10.88" y2="21.94"></line></svg>`;

btnCropConfirm.addEventListener('click', async () => {
    if (!cropper) return;
    cropper.getCroppedCanvas({ maxWidth: 1024, maxHeight: 1024 }).toBlob(async (blob) => {
        cropModal.classList.add('hidden'); cropper.destroy();
        btnSnap.classList.add('scanning'); btnSnap.style.pointerEvents = 'none';

        try {
            const result = await window.Tesseract.recognize(blob, 'eng');
            let cleanText = result.data.text.replace(/(\d+)\s*[_\.,]\s*(\d+)/g, "$1.$2").replace(/\d+(?:\.\d+)?\s*%/g, "");
            const allAmounts = [...cleanText.matchAll(/\b\d{1,4}(?:,\d{3})*\.\d{2}\b/g)].map(m => parseFloat(m[0].replace(',', ''))).sort((a, b) => b - a);
            let finalSub = 0, finalTax = 0, finalTotal = 0;

            const splitMatch = cleanText.match(/subtotal|taxable value|net|surtax|\btax\b|vat|total amount|\btotal\b/i);
            if (splitMatch && allAmounts.length > 0) {
                const itemAmounts = [...cleanText.substring(0, splitMatch.index).matchAll(/\b\d{1,4}(?:,\d{3})*\.\d{2}\b/g)].map(m => parseFloat(m[0].replace(',', '')));
                const sumSubtotal = itemAmounts.reduce((a, b) => a + b, 0); const maxTotal = allAmounts[0]; const diffTax = maxTotal - sumSubtotal;
                if (sumSubtotal > 0 && diffTax >= 0 && diffTax < sumSubtotal * 0.3) { finalSub = sumSubtotal; finalTax = diffTax; finalTotal = maxTotal; }
            }
            if (finalSub === 0) {
                for (let i = 0; i < allAmounts.length; i++) {
                    for (let j = i + 1; j < allAmounts.length; j++) {
                        for (let k = j + 1; k < allAmounts.length; k++) {
                            let c = allAmounts[i], a = allAmounts[j], b = allAmounts[k];
                            if (Math.abs((a + b) - c) < 0.05 && b < a * 0.3) { finalTotal = c; finalSub = a; finalTax = b; break; }
                        } if (finalTotal) break;
                    } if (finalTotal) break;
                }
            }
            if (finalSub === 0) {
                const subMatch = cleanText.match(/(?:subtotal|taxable value|net)[^\n\r]{0,40}?(\d{1,4}(?:,\d{3})*\.\d{2})/i);
                const taxMatch = cleanText.match(/(?:surtax|\btax\b|vat)[^\n\r]{0,40}?(\d{1,4}(?:,\d{3})*\.\d{2})/i);
                const totalMatch = cleanText.match(/(?:total amount|\btotal\b)[^\n\r]{0,40}?(\d{1,4}(?:,\d{3})*\.\d{2})/i);
                let parsedSub = subMatch ? parseFloat(subMatch[1].replace(',', '')) : 0; let parsedTax = taxMatch ? parseFloat(taxMatch[1].replace(',', '')) : 0; let parsedTotal = totalMatch ? parseFloat(totalMatch[1].replace(',', '')) : 0;
                if (parsedSub > 0 && parsedTax > 0) { finalSub = parsedSub; finalTax = parsedTax; finalTotal = parsedSub + parsedTax; }
                else if (parsedTotal > 0 && parsedSub > 0 && parsedSub < parsedTotal) { finalTotal = parsedTotal; finalSub = parsedSub; finalTax = parsedTotal - parsedSub; }
                else if (parsedTotal > 0 && parsedTax > 0 && parsedTax < parsedTotal * 0.3) { finalTotal = parsedTotal; finalTax = parsedTax; finalSub = parsedTotal - parsedTax; }
                else if (parsedSub > 0) { finalSub = parsedSub; finalTax = parsedTax; }
                else if (parsedTotal > 0) { finalTotal = parsedTotal; finalSub = parsedTotal; finalTax = 0; }
            }

            if (finalSub > 0 || finalTotal > 0) {
                if (finalSub === 0 && finalTotal > 0) finalSub = finalTotal;
                manualSubtotalInput.value = Math.abs(parseFloat(finalSub.toFixed(2))); manualTaxInput.value = Math.abs(parseFloat(finalTax.toFixed(2)));
                autoResizeInput(manualSubtotalInput); autoResizeInput(manualTaxInput); calculateAndRender();
            } else { showNoticeModal('No Amount Found', 'Please try cropping closer to the Subtotal and Tax.'); }
        } catch (error) { showNoticeModal('Error', 'Recognition failed. Try again.'); } finally { btnSnap.innerHTML = originalApertureSVG; btnSnap.classList.remove('scanning'); btnSnap.style.pointerEvents = 'auto'; cameraInput.value = ''; }
    }, 'image/jpeg'); 
});

btnShare.addEventListener('click', async () => {
    if (currentGrandTotal === 0) { showNoticeModal('Empty Bill', ''); return; }
    
    const userName = localStorage.getItem('billapp_user_name') || 'Me';
    const shareText = `🍽️ ${userName} shared a bill\n\n🔹 Subtotal: $${scannedSubtotal.toFixed(2)}\n🔹 Tax: $${scannedTax.toFixed(2)}\n🔹 Tip (${globalTipValue}%): $${(scannedSubtotal * (globalTipValue / 100)).toFixed(2)}\n💰 Total: $${currentGrandTotal.toFixed(2)}\n\n👥 Split: ${globalSplitValue} ppl\n👉 Per Person: $${currentPerPerson.toFixed(2)}`;
    
    if (navigator.share) {
        try { await navigator.share({ title: `${userName}'s Bill`, text: shareText }); } catch (e) {}
    } else { 
        navigator.clipboard.writeText(shareText).then(() => { showNoticeModal('Copied', 'Details copied to clipboard.'); }); 
    }
});

btnDone.addEventListener('click', () => { 
    showConfirmModal('Clear all current amounts?', () => {
        manualSubtotalInput.value = ''; manualTaxInput.value = '';
        autoResizeInput(manualSubtotalInput); autoResizeInput(manualTaxInput);
        tipDialControl.setValue(5); splitDialControl.setValue(1);
    });
});

// 初始化大小
autoResizeInput(manualSubtotalInput); 
autoResizeInput(manualTaxInput); 
calculateAndRender();