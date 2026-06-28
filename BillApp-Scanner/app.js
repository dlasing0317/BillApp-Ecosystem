// ==========================================
// 🌟 V100.1: Gemini AI Vision Engine (Syntax Fix)
// ==========================================
const btnSnap = document.getElementById('btn-snap'); const cameraInput = document.getElementById('camera-input'); const resultOrb = document.getElementById('result-orb'); const perPersonAmountDisplay = document.getElementById('per-person-amount'); const btnNext = document.getElementById('btn-done'); const manualSubtotalInput = document.getElementById('manual-subtotal'); const manualTaxInput = document.getElementById('manual-tax'); const cropModal = document.getElementById('crop-modal'); const cropImage = document.getElementById('crop-image');
let cropper = null; let scannedSubtotal = 0.00; let scannedTax = 0.00; let currentGrandTotal = 0.00; let currentPerPerson = 0.00; let globalTipValue = 5; let globalSplitValue = 1;

let exactTipAmount = null; 
let isSystemUpdatingDial = false; 

function showNoticeModal(title, msg) { const modal = document.getElementById('custom-modal'); document.getElementById('modal-title').textContent = title; document.getElementById('modal-content').innerHTML = msg; modal.classList.remove('hidden'); document.getElementById('modal-close-btn').onclick = () => modal.classList.add('hidden'); }
function autoResizeInput(el) { el.style.width = '0px'; el.style.width = Math.max(45, el.scrollWidth + 5) + 'px'; }

// 🤖 核心 AI 視覺解析引擎 (Gemini)
async function analyzeImageWithGemini(base64Image) {
    // ⚠️ 記得喺度填返你自己嘅 Gemini API Key
    const apiKey = 'Ab8RN6LpoRYCiKZgsCg0UlYUJviXGQSDJuXEra7EkOu0HTn0UQ'; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    // 剷走 'data:image/jpeg;base64,' 前綴
    const base64Data = base64Image.split(',')[1];

    const prompt = `
    You are an expert accountant. Analyze this receipt image and extract the subtotal, tax, gratuity/tip, and final total.
    If gratuity, service charge, or auto-gratuity is included, put it in the "gratuity" field.
    Return strictly a JSON object with no markdown formatting.
    Use this exact JSON schema:
    {
      "subtotal": 0.00,
      "tax": 0.00,
      "gratuity": 0.00,
      "total": 0.00
    }
    `;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [ { text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64Data } } ] }],
            generationConfig: { response_mime_type: "application/json" } // 強制 AI 只准輸出純 JSON
        })
    });

    if (!response.ok) throw new Error('API Request Failed');
    const data = await response.json();
    return JSON.parse(data.candidates[0].content.parts[0].text);
}

function calculateAndRender() {
    const sub = parseFloat(manualSubtotalInput.value) || 0; const tax = parseFloat(manualTaxInput.value) || 0; scannedSubtotal = sub; scannedTax = tax;
    
    let tipAmount = 0;
    const tipWrapper = document.getElementById('tip-wrapper');
    const tipDisplay = document.getElementById('tip-display');
    const summaryTipLabel = document.getElementById('summary-tip-label');

    // Auto-Gratuity UI Lock
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

    const taxLabel = document.getElementById('tax-label'); if (sub > 0 && tax > 0) { taxLabel.textContent = `Tax (${((tax / sub) * 100).toFixed(1)}%)`; } else { taxLabel.textContent = 'Tax'; }
    currentGrandTotal = scannedSubtotal + scannedTax + tipAmount; currentPerPerson = currentGrandTotal / globalSplitValue;     
    
    const summaryTipInput = document.getElementById('summary-tip-amount'); const summaryTotalInput = document.getElementById('summary-total-amount');
    if (summaryTipInput) summaryTipInput.value = tipAmount.toFixed(2); if (summaryTotalInput) summaryTotalInput.value = currentGrandTotal.toFixed(2);
    
    const splitContainer = document.getElementById('split-dial-container'); const orbLabel = document.querySelector('.orb-label'); let displayStr = '$0.00';
    if(splitContainer) { splitContainer.style.opacity = '1'; splitContainer.style.pointerEvents = 'auto'; } 
    if(orbLabel) orbLabel.textContent = 'PER PERSON'; displayStr = currentGrandTotal === 0 ? `$0.00` : `$${currentPerPerson.toFixed(2)}`; 
    
    perPersonAmountDisplay.textContent = displayStr;
    const textLen = displayStr.length; if (textLen > 8) { perPersonAmountDisplay.style.fontSize = '2.8rem'; } else if (textLen > 6) { perPersonAmountDisplay.style.fontSize = '3.5rem'; } else { perPersonAmountDisplay.style.fontSize = '4.5rem'; }
    currentGrandTotal > 0 ? resultOrb.classList.remove('inactive') : resultOrb.classList.add('inactive');
}

manualSubtotalInput.addEventListener('input', function() { exactTipAmount = null; autoResizeInput(this); calculateAndRender(); }); manualTaxInput.addEventListener('input', function() { exactTipAmount = null; autoResizeInput(this); calculateAndRender(); });

function setupCircularDial(wrapperId, ringId, thumbId, displayId, min, max, step, initialValue, isPercent, onChangeCallback) {
    const wrapper = document.getElementById(wrapperId); const ring = document.getElementById(ringId); const thumb = document.getElementById(thumbId); const display = document.getElementById(displayId);
    let currentValue = initialValue; const r = 38; const cx = 50; const cy = 50; const circumference = 2 * Math.PI * r; const arcDegrees = 270; const arcLength = circumference * (arcDegrees / 360); ring.style.strokeDasharray = `${arcLength} ${circumference}`;
    function updateUI(val) { const percentage = (val - min) / (max - min); const offset = arcLength - (percentage * arcLength); ring.style.strokeDashoffset = offset; const svgAngleRad = (percentage * arcDegrees) * (Math.PI / 180); thumb.setAttribute('cx', cx + r * Math.cos(svgAngleRad)); thumb.setAttribute('cy', cy + r * Math.sin(svgAngleRad)); if(display.textContent !== 'INCL') display.textContent = val + (isPercent ? '%' : ''); onChangeCallback(val); }
    let isDragging = false; function handlePointer(e) { if (!isDragging && e.type !== 'pointerdown' && e.type !== 'touchstart') return; e.preventDefault(); const rect = wrapper.getBoundingClientRect(); const centerX = rect.left + rect.width / 2; const centerY = rect.top + rect.height / 2; const clientX = e.clientX || (e.touches && e.touches[0].clientX); const clientY = e.clientY || (e.touches && e.touches[0].clientY); if(clientX === undefined || clientY === undefined) return; const dx = clientX - centerX; const dy = clientY - centerY; let angle = Math.atan2(dy, dx) * (180 / Math.PI); if (angle < 0) angle += 360; let adjustedAngle = angle; if (angle < 135) adjustedAngle += 360; let percentage = (adjustedAngle - 135) / arcDegrees; if (percentage < 0) { if (adjustedAngle < 135) percentage = 0; } if (percentage > 1) { if (adjustedAngle > 135 + arcDegrees) percentage = 1; } percentage = Math.max(0, Math.min(1, percentage)); let val = min + percentage * (max - min); val = Math.round(val / step) * step; val = Math.max(min, Math.min(max, val)); if (val !== currentValue) { currentValue = val; updateUI(currentValue); } }
    wrapper.addEventListener('pointerdown', (e) => { isDragging = true; handlePointer(e); wrapper.setPointerCapture(e.pointerId); }); wrapper.addEventListener('pointermove', handlePointer); wrapper.addEventListener('pointerup', (e) => { isDragging = false; wrapper.releasePointerCapture(e.pointerId); }); wrapper.addEventListener('pointercancel', () => { isDragging = false; }); wrapper.addEventListener('touchstart', (e) => { isDragging = true; handlePointer(e); }, {passive: false}); wrapper.addEventListener('touchmove', handlePointer, {passive: false}); wrapper.addEventListener('touchend', () => { isDragging = false; }); updateUI(currentValue); return { setValue: (val) => { currentValue = val; updateUI(val); } };
}
const tipDialControl = setupCircularDial('tip-wrapper', 'tip-ring', 'tip-thumb', 'tip-display', 0, 30, 5, 0, true, (val) => { 
    if (!isSystemUpdatingDial) exactTipAmount = null; 
    globalTipValue = val; calculateAndRender(); 
}); 
const splitDialControl = setupCircularDial('split-wrapper', 'split-ring', 'split-thumb', 'split-display', 1, 20, 1, 1, false, (val) => { globalSplitValue = val; calculateAndRender(); });

const settingsModal = document.getElementById('settings-modal');
document.getElementById('btn-settings').addEventListener('click', () => { settingsModal.classList.remove('hidden'); }); 

// 🌟 BUG 已修復：補回左邊嘅大括號 { 
document.getElementById('btn-settings-cancel').addEventListener('click', () => { settingsModal.classList.add('hidden'); }); 
document.getElementById('btn-settings-save').addEventListener('click', () => { settingsModal.classList.add('hidden'); });

if (document.getElementById('btn-info')) { document.getElementById('btn-info').addEventListener('click', (e) => { e.preventDefault(); document.getElementById('info-modal').classList.remove('hidden'); }); document.getElementById('btn-info-close').addEventListener('click', () => document.getElementById('info-modal').classList.add('hidden')); }

const originalApertureSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="14.31" y1="8" x2="20.05" y2="17.94"></line><line x1="9.69" y1="8" x2="21.17" y2="8"></line><line x1="7.38" y1="12" x2="13.12" y2="2.06"></line><line x1="9.69" y1="16" x2="3.95" y2="6.06"></line><line x1="14.31" y1="16" x2="2.83" y2="16"></line><line x1="16.62" y1="12" x2="10.88" y2="21.94"></line></svg>`;
btnSnap.addEventListener('click', () => cameraInput.click()); document.getElementById('btn-crop-cancel').addEventListener('click', () => { cropModal.classList.add('hidden'); if (cropper) cropper.destroy(); cameraInput.value = ''; });
cameraInput.addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { cropImage.src = e.target.result; cropModal.classList.remove('hidden'); if (cropper) cropper.destroy(); cropper = new Cropper(cropImage, { viewMode: 1, dragMode: 'crop', autoCropArea: 0.8, restore: false, guides: true, center: true, highlight: false, cropBoxMovable: true, cropBoxResizable: true, toggleDragModeOnDblclick: false }); }; reader.readAsDataURL(file); });

document.getElementById('btn-crop-confirm').addEventListener('click', async () => {
    if (!cropper) return;
    
    // 將 Crop 完嘅圖轉做 Base64 格式
    const base64Image = cropper.getCroppedCanvas({ maxWidth: 1024, maxHeight: 1024 }).toDataURL('image/jpeg', 0.8);
    
    cropModal.classList.add('hidden'); cropper.destroy(); 
    btnSnap.classList.add('scanning'); btnSnap.style.pointerEvents = 'none';

    try {
        // 🚀 將張相掟畀 Gemini AI！
        const aiResult = await analyzeImageWithGemini(base64Image);

        let parsedSub = aiResult.subtotal || 0;
        let parsedTax = aiResult.tax || 0;
        let parsedTip = aiResult.gratuity || 0;
        let parsedTotal = aiResult.total || 0;

        // 將乾淨嘅數字直接隊入 UI
        if (parsedSub > 0 || parsedTotal > 0) { 
            if (parsedSub === 0 && parsedTotal > 0) parsedSub = parsedTotal; 
            manualSubtotalInput.value = Math.abs(parseFloat(parsedSub.toFixed(2))); 
            manualTaxInput.value = Math.abs(parseFloat(parsedTax.toFixed(2))); 
            
            // 處理 Auto-Gratuity 鎖定
            if (parsedTip > 0) {
                exactTipAmount = parsedTip;
                isSystemUpdatingDial = true;
                tipDialControl.setValue(0); // UI 顯示 INCL
                exactTipAmount = parsedTip; 
                isSystemUpdatingDial = false;
            } else {
                exactTipAmount = null;
                isSystemUpdatingDial = true;
                tipDialControl.setValue(5); // 預設 5% Tip
                isSystemUpdatingDial = false;
            }

            autoResizeInput(manualSubtotalInput); autoResizeInput(manualTaxInput); calculateAndRender(); 
        } else { 
            showNoticeModal('No Amount Found', 'AI 搵唔到銀碼，請影得清楚啲！'); 
        }
    } catch (error) { 
        console.error("AI Error:", error);
        showNoticeModal('Error', 'AI 解析失敗，請檢查 API Key 或網絡連線。'); 
    } finally { 
        btnSnap.innerHTML = originalApertureSVG; btnSnap.classList.remove('scanning'); btnSnap.style.pointerEvents = 'auto'; cameraInput.value = ''; 
    }
});

btnNext.addEventListener('click', () => { 
    manualSubtotalInput.value = ''; manualTaxInput.value = ''; exactTipAmount = null;
    autoResizeInput(manualSubtotalInput); autoResizeInput(manualTaxInput); 
    isSystemUpdatingDial = true; tipDialControl.setValue(0); splitDialControl.setValue(1); isSystemUpdatingDial = false;
});

document.getElementById('btn-share').addEventListener('click', async () => {
    if (currentGrandTotal === 0) { showNoticeModal('Empty Bill', '大佬，未入銀碼喎！'); return; }
    const shareText = `🍽️ Bill Shared\n🔹 Subtotal: $${scannedSubtotal.toFixed(2)}\n🔹 Tax: $${scannedTax.toFixed(2)}\n🔹 Tip/Gratuity: $${exactTipAmount ? exactTipAmount.toFixed(2) : (scannedSubtotal * (globalTipValue / 100)).toFixed(2)}\n💰 Total: $${currentGrandTotal.toFixed(2)}\n\n👥 Split: ${globalSplitValue} ppl\n👉 Per Person: $${currentPerPerson.toFixed(2)}`;
    if (navigator.share) { try { await navigator.share({ title: `Bill Summary`, text: shareText }); } catch (e) {} } else { navigator.clipboard.writeText(shareText).then(() => { showNoticeModal('Copied', 'Details copied to clipboard.'); }); }
});

autoResizeInput(manualSubtotalInput); autoResizeInput(manualTaxInput); calculateAndRender();