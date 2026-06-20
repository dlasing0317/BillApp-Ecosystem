// ==========================================
// 🌟 CORE UI MODULE - 嚴禁放入任何 Business Logic！
// ==========================================

// 1. 自動縮放 Input Width
export function autoResizeInput(input) {
    let span = document.getElementById('width-measurer');
    if (!span) { 
        span = document.createElement('span'); 
        span.id = 'width-measurer'; 
        span.style.cssText = 'position:absolute; visibility:hidden; white-space:pre; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif; font-size:1.1rem; font-weight:600; font-variant-numeric: tabular-nums;'; 
        document.body.appendChild(span); 
    }
    span.textContent = input.value || input.placeholder || "0.00";
    input.style.width = `${span.offsetWidth + 2}px`;
}

// 2. 通用 Notice Modal
export function showNoticeModal(title, text) {
    const customModal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    
    modalTitle.textContent = title;
    if (text) { 
        modalContent.innerHTML = `<p style="color: var(--text-dim); margin-bottom: 25px; line-height: 1.5;">${text}</p>`; 
    } else { 
        modalContent.innerHTML = `<div style="height: 25px;"></div>`; 
    }
    customModal.classList.remove('hidden');
}

// 3. 通用 Confirm Modal (包埋 Callback)
let confirmActionCallback = null;
export function showConfirmModal(msg, callback) {
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    
    confirmMessage.textContent = msg;
    confirmActionCallback = callback;
    confirmModal.classList.remove('hidden');
}

// 初始化 Confirm Modal 啲掣 (淨係需要行一次)
export function initConfirmModal() {
    const btnConfirmCancel = document.getElementById('btn-confirm-cancel');
    const btnConfirmDelete = document.getElementById('btn-confirm-delete');
    const confirmModal = document.getElementById('confirm-modal');

    if(btnConfirmCancel) {
        btnConfirmCancel.addEventListener('click', () => {
            confirmModal.classList.add('hidden');
            confirmActionCallback = null;
            document.querySelectorAll('.trip-card.swiped-left').forEach(card => card.classList.remove('swiped-left'));
        });
    }

    if(btnConfirmDelete) {
        btnConfirmDelete.addEventListener('click', () => {
            if (confirmActionCallback) confirmActionCallback();
            confirmModal.classList.add('hidden');
            confirmActionCallback = null;
        });
    }

    // 順便綁埋 Notice Modal 個 Close 掣
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const customModal = document.getElementById('custom-modal');
    if (modalCloseBtn && customModal) {
        modalCloseBtn.addEventListener('click', () => customModal.classList.add('hidden'));
    }
}

// 4. 雙向 Swipe 手勢
export function setupSwipeActions(cardElement) {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    
    cardElement.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        currentX = startX;
        isDragging = true;
        cardElement.style.transition = 'none'; 
    }, {passive: true});

    cardElement.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        
        if (Math.abs(diff) > 10) cardElement.setAttribute('data-swiping', 'true');
        
        if (diff > 0) {
            cardElement.style.transform = `translateX(${Math.min(diff, 120)}px)`;
        } else {
            cardElement.style.transform = `translateX(${Math.max(diff, -120)}px)`;
        }
    }, {passive: true});

    cardElement.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        cardElement.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)'; 
        
        const diff = currentX - startX;
        const wrapper = cardElement.closest('.trip-item-wrapper');

        if (diff > 90) { 
            const editBtn = wrapper.querySelector('.action-edit');
            if (editBtn) editBtn.click();
        } else if (diff < -90) { 
            const deleteBtn = wrapper.querySelector('.action-delete');
            if (deleteBtn) deleteBtn.click();
        }
        
        cardElement.style.transform = 'translateX(0)';
        setTimeout(() => cardElement.removeAttribute('data-swiping'), 100);
    });
}