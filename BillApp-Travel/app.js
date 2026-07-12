// ==========================================
// 🌟 FIREBASE SETUP & IMPORT (V58.0 - 100% Scanner Parity + One-Tap Scan)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, getDoc, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { autoResizeInput, showNoticeModal, showConfirmModal, initConfirmModal, setupSwipeActions } from '../shared/core-ui.js';

const firebaseConfig = { apiKey: "AIzaSyADViQdzsf1MTmsDnf_NiQp0eB-EPFsgxI", authDomain: "billapp-travel.firebaseapp.com", projectId: "billapp-travel", storageBucket: "billapp-travel.firebasestorage.app", messagingSenderId: "47415537906", appId: "1:47415537906:web:c401cdc2dd8bd22d10e06b" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);
const storage = getStorage(app);
initConfirmModal();

const getCurrentUser = () => { const name = localStorage.getItem('billapp_user_name'); return name ? name.trim() : 'Guest'; };

let currentTripMode = null; let currentTripId = null; let currentTripData = null; let editingExpenseId = null; let editingExpenseOriginal = null;

// 🌟 BillApp-Travel 全域外幣與即時匯率暫存狀態
let currentCurrency = "USD";
let currentExchangeRate = 1.0000;
let currentForeignTotal = 0.00;

async function uploadScannedReceiptImage(tripId) {
    if (!tripId || !lastScannedImageBlob) return null;
    const now = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `trips/${tripId}/receipts/receipt_${now}_${rand}.jpg`;
    const imgRef = storageRef(storage, path);
    await uploadBytes(imgRef, lastScannedImageBlob, { contentType: 'image/jpeg' });
    const url = await getDownloadURL(imgRef);
    return { receiptImageUrl: url, receiptImagePath: path };
}

function navigateTo(pageId) { document.querySelectorAll('.app-page').forEach(p => p.classList.remove('active')); document.getElementById(pageId).classList.add('active'); }
function showToast(msg) { const toast = document.getElementById('toast-notification'); const toastMsg = document.getElementById('toast-message'); if(!toast) return; toastMsg.textContent = msg; toast.classList.remove('toast-hidden'); toast.classList.add('toast-visible'); setTimeout(() => { toast.classList.remove('toast-visible'); toast.classList.add('toast-hidden'); }, 4000); }

window.currentUnreadNotifs = []; let notifUnsubscribe = null; let isInitialNotifLoad = true;
function setupNotifications() {
    const me = getCurrentUser(); if (me === 'Guest') return; const lowerMe = me.toLowerCase().replace(/\s+/g, '');
    if (notifUnsubscribe) notifUnsubscribe();
    notifUnsubscribe = onSnapshot(query(collection(db, "notifications"), where("targetUserLower", "==", lowerMe)), (snapshot) => {
        const notifList = document.getElementById('notification-list'); const badge = document.getElementById('notification-badge');
        let docsArr = []; snapshot.forEach(d => docsArr.push({id: d.id, ...d.data()})); docsArr.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        notifList.innerHTML = ''; let unreadCount = 0; window.currentUnreadNotifs = [];
        if (docsArr.length === 0) { notifList.innerHTML = '<div style="text-align: center; color: var(--text-dim); padding: 20px;">No notifications yet.</div>'; badge.style.display = 'none'; isInitialNotifLoad = false; return; }
        docsArr.forEach(data => {
            if (!data.read) { unreadCount++; window.currentUnreadNotifs.push(data.id); }
            notifList.innerHTML += `<div class="glass-box" style="padding: 12px; opacity: ${data.read ? '0.5' : '1'}; background: ${data.read ? 'transparent' : 'rgba(125, 211, 252, 0.1)'};"><div style="color: white; font-size: 0.95rem;">${data.message}</div><div style="color: var(--text-dim); font-size: 0.75rem; margin-top: 5px;">${new Date(data.createdAt).toLocaleString()}</div></div>`;
        });
        if (unreadCount > 0) { badge.style.display = 'flex'; badge.textContent = unreadCount; } else { badge.style.display = 'none'; }
        snapshot.docChanges().forEach((change) => { if (change.type === "added" && !isInitialNotifLoad) { const data = change.doc.data(); if (!data.read) showToast(data.message); } });
        isInitialNotifLoad = false;
    });
}
document.getElementById('btn-notifications').addEventListener('click', () => { document.getElementById('notifications-modal').classList.remove('hidden'); window.currentUnreadNotifs.forEach(id => { updateDoc(doc(db, "notifications", id), { read: true }); }); window.currentUnreadNotifs = []; document.getElementById('notification-badge').style.display = 'none'; });
document.getElementById('btn-notifications-close').addEventListener('click', () => { document.getElementById('notifications-modal').classList.add('hidden'); });

let tripsUnsubscribe = null;
function loadTrips() {
    const tripList = document.getElementById('trip-list-container'); const lowerMe = getCurrentUser().toLowerCase().replace(/\s+/g, '');
    if (tripsUnsubscribe) tripsUnsubscribe();
    tripsUnsubscribe = onSnapshot(query(collection(db, "trips"), orderBy("createdAt", "desc")), (snapshot) => {
        tripList.innerHTML = ''; let hasTrips = false;
        if (snapshot.empty) { tripList.innerHTML = '<div style="text-align: center; color: var(--text-dim); margin-top: 20px;">No Trips yet.</div>'; return; }
        snapshot.forEach((docSnap) => {
            const data = docSnap.data(); const tripOwner = data.owner || 'Unknown'; const isOwner = tripOwner.toLowerCase().replace(/\s+/g, '') === lowerMe;
            let isConfirmed = false; if (data.confirmedMembers) { isConfirmed = data.confirmedMembers.some(m => m.toLowerCase().replace(/\s+/g, '') === lowerMe); } else if (!data.joinCode) { isConfirmed = data.members && data.members.some(m => m.toLowerCase().replace(/\s+/g, '') === lowerMe); }
            if (isOwner || isConfirmed) { renderTripCard(docSnap.id, data); hasTrips = true; }
        });
        if (!hasTrips) tripList.innerHTML = `<div style="text-align: center; color: var(--text-dim); margin-top: 20px;">You haven't joined any trips.</div>`;
    });
}

async function loadExpenses(tripId) {
    const timeline = document.getElementById('trip-timeline'); timeline.innerHTML = '<div class="glass-box" style="margin-bottom: 15px; opacity: 0.5;"><div style="text-align: center; color: var(--text-dim); font-size: 0.9rem;">Start of trip timeline</div></div>';
    try {
        const querySnapshot = await getDocs(query(collection(db, `trips/${tripId}/expenses`), orderBy("createdAt", "desc")));
        const lowerMe = getCurrentUser().toLowerCase().replace(/\s+/g, '');
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data(); const wrapper = document.createElement('div'); wrapper.className = 'trip-item-wrapper expense-wrapper'; const actionBg = document.createElement('div'); actionBg.className = 'trip-item-action-bg';
            const isTripOwner = (currentTripData.owner && currentTripData.owner.toLowerCase().replace(/\s+/g, '') === lowerMe);
            const isExpenseCreator = data.paidBy.toLowerCase().replace(/\s+/g, '') === lowerMe;
            if (isTripOwner || isExpenseCreator) {
                actionBg.innerHTML = `<div class="action-edit">Edit</div><div class="action-delete">Delete</div>`;
                actionBg.querySelector('.action-delete').addEventListener('click', () => { const card = wrapper.querySelector('.trip-card'); card.classList.add('swiped-left'); showConfirmModal(`Delete "${data.title}"?`, async () => { try { await deleteDoc(doc(db, `trips/${tripId}/expenses`, docSnap.id)); loadExpenses(tripId); } catch(e) {} }); });
                actionBg.querySelector('.action-edit').addEventListener('click', () => { editingExpenseId = docSnap.id; editingExpenseOriginal = { splitBetween: Array.isArray(data.splitBetween) ? [...data.splitBetween] : null, splitCount: data.splitCount, createdAt: data.createdAt || null }; document.getElementById('expense-modal-title').textContent = 'Edit Expense'; document.getElementById('basic-expense-title').value = data.title; document.getElementById('basic-expense-amount').value = data.amount; const originalPaidBy = document.getElementById('paid-by-container').innerHTML; document.getElementById('basic-paid-by-container').innerHTML = originalPaidBy; document.getElementById('basic-paid-by-container').querySelectorAll('.avatar-bubble').forEach(bubble => { if (bubble.textContent.trim() === data.paidBy) { bubble.classList.add('active'); } else { bubble.classList.remove('active'); } bubble.addEventListener('click', function() { document.getElementById('basic-paid-by-container').querySelectorAll('.avatar-bubble').forEach(x => x.classList.remove('active')); this.classList.add('active'); }); }); document.getElementById('basic-expense-modal').classList.remove('hidden'); });
            } else { actionBg.innerHTML = `<div style="width:100%; display:flex; justify-content:center; align-items:center; color:var(--text-dim); font-size: 0.9rem;">Only ${data.paidBy} can edit this</div>`; }
            const newItem = document.createElement('div'); newItem.className = 'trip-card glass-box'; 
            newItem.innerHTML = `<div style="display:flex; justify-content: space-between; align-items: center;"><div style="color: white; font-weight: 600; font-size: 1.1rem;">${data.title}</div><div style="color: var(--accent-blue); font-size: 1.4rem; font-weight: 700;">$${data.amount.toFixed(2)}</div></div><div style="color: var(--text-dim); font-size: 0.85rem; margin-top: 5px;">Paid by ${data.paidBy} • Split with ${data.splitCount} ppl</div>`;
            if (isTripOwner || isExpenseCreator) { setupSwipeActions(newItem); }
            wrapper.appendChild(actionBg); wrapper.appendChild(newItem); timeline.insertBefore(wrapper, timeline.firstChild);
        });
    } catch (e) { console.error(e); }
}

async function processJoin(tripDocRef, tData, me, modalToClose) {
    const existingMembers = tData.members || []; const confirmed = tData.confirmedMembers || []; const lowerMe = me.toLowerCase().replace(/\s+/g, '');
    let matchedName = null; existingMembers.forEach(m => { if (m.toLowerCase().replace(/\s+/g, '') === lowerMe) matchedName = m; });
    const targetName = matchedName || me; const isAlreadyConfirmed = confirmed.some(m => m.toLowerCase().replace(/\s+/g, '') === lowerMe);
    if (!isAlreadyConfirmed) {
        confirmed.push(targetName); if (!matchedName) existingMembers.push(me);
        await updateDoc(tripDocRef, { members: existingMembers, confirmedMembers: confirmed });
        if (tData.owner && tData.owner.toLowerCase().replace(/\s+/g, '') !== lowerMe) { await addDoc(collection(db, "notifications"), { targetUser: tData.owner, targetUserLower: tData.owner.toLowerCase().replace(/\s+/g, ''), message: `🎉 ${targetName} joined your trip "${tData.name}"!`, read: false, createdAt: new Date().toISOString() }); } 
        showNoticeModal('Success', `You joined "${tData.name}"!`);
    } else { showNoticeModal('Already Joined', `You are already in "${tData.name}".`); }
    if (modalToClose) modalToClose.classList.add('hidden'); window.history.replaceState({}, document.title, window.location.pathname); loadTrips();
}

const joinModal = document.getElementById('join-trip-modal'); document.getElementById('btn-open-join').addEventListener('click', () => { if (getCurrentUser() === 'Guest') { showNoticeModal('Profile Required', 'Set Name first!'); return; } document.getElementById('join-code-input').value = ''; joinModal.classList.remove('hidden'); }); document.getElementById('btn-join-cancel').addEventListener('click', () => { joinModal.classList.add('hidden'); });
document.getElementById('btn-join-submit').addEventListener('click', async () => {
    const inviteCode = document.getElementById('join-code-input').value.trim(); if (!inviteCode) return;
    const btn = document.getElementById('btn-join-submit'); btn.textContent = 'Checking...'; btn.disabled = true;
    try {
        const querySnapshot = await getDocs(query(collection(db, "trips"), where("joinCode", "==", inviteCode))); let tripDocRef = null; let tData = null;
        if (!querySnapshot.empty) { tripDocRef = querySnapshot.docs[0].ref; tData = querySnapshot.docs[0].data(); } else { try { const docSnap = await getDoc(doc(db, "trips", inviteCode)); if (docSnap.exists()) { tripDocRef = docSnap.ref; tData = docSnap.data(); } } catch(err) {} }
        if (tripDocRef && tData) { await processJoin(tripDocRef, tData, getCurrentUser(), joinModal); } else { showNoticeModal('Error', 'Invalid Code.'); }
    } catch (e) { } finally { btn.textContent = 'Join'; btn.disabled = false; }
});

async function checkInvite() {
    const inviteCode = new URLSearchParams(window.location.search).get('invite');
    if (inviteCode) {
        if (getCurrentUser() === 'Guest') { showNoticeModal('Setup Profile Required', 'Set Name before joining!'); return; }
        try {
            const querySnapshot = await getDocs(query(collection(db, "trips"), where("joinCode", "==", inviteCode))); let tripDocRef = null; let tData = null;
            if (!querySnapshot.empty) { tripDocRef = querySnapshot.docs[0].ref; tData = querySnapshot.docs[0].data(); } else { try { const docSnap = await getDoc(doc(db, "trips", inviteCode)); if (docSnap.exists()) { tripDocRef = docSnap.ref; tData = docSnap.data(); } } catch(err) {} }
            if (tripDocRef && tData) {
                if (tData.confirmedMembers && tData.confirmedMembers.some(m => m.toLowerCase().replace(/\s+/g, '') === getCurrentUser().toLowerCase().replace(/\s+/g, ''))) { window.history.replaceState({}, document.title, window.location.pathname); } 
                else {
                    const inviteModal = document.getElementById('invite-modal'); document.getElementById('invite-message').innerHTML = `You've been invited to join<br><br><b style="color:white; font-size:1.3rem;">"${tData.name}"</b><br><br><span style="font-size:0.9rem;">Created by ${tData.owner || 'someone'}</span>`; inviteModal.classList.remove('hidden');
                    document.getElementById('btn-invite-accept').onclick = async () => { document.getElementById('btn-invite-accept').textContent = 'Joining...'; await processJoin(tripDocRef, tData, getCurrentUser(), inviteModal); };
                    document.getElementById('btn-invite-cancel').onclick = () => { inviteModal.classList.add('hidden'); window.history.replaceState({}, document.title, window.location.pathname); };
                }
            } else { window.history.replaceState({}, document.title, window.location.pathname); }
        } catch(e) {}
    }
}
loadTrips(); setupNotifications(); checkInvite();

document.getElementById('btn-back-home').addEventListener('click', () => { navigateTo('page-home'); }); document.getElementById('fab-trip').addEventListener('click', () => { calculateAndRender(); navigateTo('page-scanner'); }); document.getElementById('btn-cancel-scan').addEventListener('click', () => { navigateTo(currentTripMode ? 'page-trip' : 'page-home'); });
document.querySelectorAll('#paid-by-container').forEach(c => { c.addEventListener('click', function(e) { if(e.target.classList.contains('avatar-bubble')) { c.querySelectorAll('.avatar-bubble').forEach(x => x.classList.remove('active')); e.target.classList.add('active'); } }); });
document.querySelectorAll('#split-between-container').forEach(c => { c.addEventListener('click', function(e) { if(e.target.classList.contains('checkable')) { e.target.classList.toggle('active'); } }); });

const newTripModal = document.getElementById('new-trip-modal'); let currentNewTripMembers = [getCurrentUser()];
function renderNewTripMembers() { const list = document.getElementById('new-trip-members-list'); list.innerHTML = ''; currentNewTripMembers.forEach(member => { const bubble = document.createElement('div'); bubble.className = 'avatar-bubble'; bubble.style.display = 'flex'; bubble.style.alignItems = 'center'; bubble.innerHTML = `${member} <span class="remove-btn" style="color: #ff4444; margin-left: 8px; font-size: 1.2rem; cursor: pointer; line-height: 1;">×</span>`; bubble.querySelector('.remove-btn').addEventListener('click', () => { currentNewTripMembers = currentNewTripMembers.filter(m => m !== member); renderNewTripMembers(); }); list.appendChild(bubble); }); }
document.getElementById('btn-add-member').addEventListener('click', () => { const name = document.getElementById('new-member-input').value.trim(); if (name && !currentNewTripMembers.includes(name)) { currentNewTripMembers.push(name); document.getElementById('new-member-input').value = ''; renderNewTripMembers(); } }); document.getElementById('new-member-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') document.getElementById('btn-add-member').click(); });
document.getElementById('btn-add-trip').addEventListener('click', () => { if (getCurrentUser() === 'Guest') { showNoticeModal('Profile Required', 'Set Name before creating a trip!'); return; } document.getElementById('trip-modal-title').textContent = 'Create New Trip'; document.getElementById('new-trip-name').value = ''; document.getElementById('new-member-input').value = ''; currentNewTripMembers = [getCurrentUser()]; renderNewTripMembers(); currentTripId = null; newTripModal.classList.remove('hidden'); });
document.getElementById('btn-new-trip-cancel').addEventListener('click', () => { newTripModal.classList.add('hidden'); });
document.getElementById('btn-invite-member').addEventListener('click', async (e) => {
    e.preventDefault(); let targetTripId = currentTripId; let targetTripName = document.getElementById('new-trip-name').value.trim(); let targetJoinCode = currentTripData ? currentTripData.joinCode : null;
    if (document.getElementById('trip-modal-title').textContent === 'Create New Trip' || !targetTripId) {
        if (!targetTripName) { showNoticeModal('Error', 'Enter a Trip Name first!'); return; }
        const btnInvite = document.getElementById('btn-invite-member'); const originalText = btnInvite.innerHTML; btnInvite.innerHTML = 'Generating...'; targetJoinCode = Math.floor(100000 + Math.random() * 900000).toString();
        const tripData = { name: targetTripName, startDate: document.getElementById('new-trip-start').value, endDate: document.getElementById('new-trip-end').value, members: currentNewTripMembers, confirmedMembers: [getCurrentUser()], owner: getCurrentUser(), joinCode: targetJoinCode, createdAt: new Date().toISOString() };
        try { const docRef = await addDoc(collection(db, "trips"), tripData); targetTripId = docRef.id; currentTripId = docRef.id; currentTripData = tripData; document.getElementById('trip-modal-title').textContent = 'Edit Trip'; } catch (err) { btnInvite.innerHTML = originalText; return; } btnInvite.innerHTML = originalText;
    } else if (!targetJoinCode) { targetJoinCode = Math.floor(100000 + Math.random() * 900000).toString(); await updateDoc(doc(db, "trips", targetTripId), { joinCode: targetJoinCode }); currentTripData.joinCode = targetJoinCode; }
    const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${targetJoinCode}`; const shareText = `✈️ Join my trip "${targetTripName}" on TripSplit!\n\nEnter Code: ${targetJoinCode}\nOr click: ${inviteUrl}`;
    if (navigator.share) { try { await navigator.share({ title: 'Join my Trip', text: shareText }); } catch(err){} } else { navigator.clipboard.writeText(shareText).then(() => { showNoticeModal('Copied!', 'Code copied to clipboard.'); }); }
});
document.getElementById('btn-new-trip-save').addEventListener('click', async () => {
    const tripName = document.getElementById('new-trip-name').value.trim(); if (!tripName) { showNoticeModal('Error', '打個 Trip Name 先啦！'); return; }
    const btnSave = document.getElementById('btn-new-trip-save'); btnSave.disabled = true; btnSave.textContent = 'Saving...';
    let targetJoinCode = currentTripData ? currentTripData.joinCode : Math.floor(100000 + Math.random() * 900000).toString(); const isEdit = document.getElementById('trip-modal-title').textContent === 'Edit Trip';
    const finalOwner = (isEdit && currentTripData && currentTripData.owner) ? currentTripData.owner : getCurrentUser(); const finalConfirmed = (isEdit && currentTripData && currentTripData.confirmedMembers) ? currentTripData.confirmedMembers : [getCurrentUser()];
    const tripData = { name: tripName, startDate: document.getElementById('new-trip-start').value, endDate: document.getElementById('new-trip-end').value, members: currentNewTripMembers, confirmedMembers: finalConfirmed, owner: finalOwner, joinCode: targetJoinCode, createdAt: isEdit ? currentTripData.createdAt : new Date().toISOString() };
    try { if (isEdit) { await updateDoc(doc(db, "trips", currentTripId), tripData); document.getElementById('trip-header-title').textContent = tripData.name; currentTripData = tripData; updateAssignmentModalMembers(tripData.members); } else { await addDoc(collection(db, "trips"), tripData); } newTripModal.classList.add('hidden'); } catch (e) { showNoticeModal('Error', 'Save failed!'); } finally { btnSave.disabled = false; btnSave.textContent = 'Save Trip'; }
});

function renderTripCard(id, data) {
    const tripList = document.getElementById('trip-list-container'); const msg = tripList.querySelector('div[style*="text-align: center"]'); if (msg) msg.remove();
    const colors = [['#1e3a8a', '#0f172a'], ['#831843', '#0f172a'], ['#064e3b', '#0f172a'], ['#450a0a', '#0f172a']]; const randomColor = colors[Math.floor(Math.random() * colors.length)]; const startObj = new Date(data.startDate); const endObj = new Date(data.endDate); const dateDisplay = `${startObj.toLocaleString('en-US', {month: 'short'})} ${startObj.getDate()} - ${endObj.toLocaleString('en-US', {month: 'short'})} ${endObj.getDate()}`;
    const wrapper = document.createElement('div'); wrapper.className = 'trip-item-wrapper'; const actionBg = document.createElement('div'); actionBg.className = 'trip-item-action-bg';
    const isOwner = (data.owner || 'Unknown').toLowerCase().replace(/\s+/g, '') === getCurrentUser().toLowerCase().replace(/\s+/g, '');
    if (isOwner) {
        actionBg.innerHTML = `<div class="action-edit">Edit</div><div class="action-delete">Delete</div>`;
        actionBg.querySelector('.action-delete').addEventListener('click', () => { const card = wrapper.querySelector('.trip-card'); card.classList.add('swiped-left'); showConfirmModal(`Delete Trip "${data.name}"?`, async () => { try { await deleteDoc(doc(db, "trips", id)); wrapper.remove(); } catch(e) {} }); });
        actionBg.querySelector('.action-edit').addEventListener('click', () => { currentTripData = data; currentTripId = id; document.getElementById('trip-modal-title').textContent = 'Edit Trip'; document.getElementById('new-trip-name').value = data.name; document.getElementById('new-trip-start').value = data.startDate; document.getElementById('new-trip-end').value = data.endDate; currentNewTripMembers = [...data.members]; renderNewTripMembers(); document.getElementById('new-trip-modal').classList.remove('hidden'); });
    } else { actionBg.innerHTML = `<div style="width:100%; display:flex; justify-content:center; align-items:center; color:var(--text-dim); font-size:0.9rem;">Only ${data.owner || 'Owner'} can edit</div>`; }
    const newCard = document.createElement('div'); newCard.className = 'trip-card'; newCard.innerHTML = `<div class="trip-bg" style="background: linear-gradient(135deg, ${randomColor[0]}, ${randomColor[1]});"></div><div class="trip-content"><h2>${data.name}</h2><p>${data.members.length} Members • ${dateDisplay}</p></div>`;
    if (isOwner) { setupSwipeActions(newCard); }
    newCard.addEventListener('click', () => { if (newCard.getAttribute('data-swiping') === 'true') return; currentTripMode = data.name; currentTripId = id; currentTripData = data; document.getElementById('trip-header-title').textContent = data.name; updateAssignmentModalMembers(data.members); loadExpenses(id); navigateTo('page-trip'); });
    wrapper.appendChild(actionBg); wrapper.appendChild(newCard); tripList.appendChild(wrapper);
}

function updateAssignmentModalMembers(membersArray) {
    const paidByContainer = document.getElementById('paid-by-container'); const splitContainer = document.getElementById('split-between-container'); paidByContainer.innerHTML = ''; splitContainer.innerHTML = ''; const lowerMe = getCurrentUser().toLowerCase().replace(/\s+/g, '');
    membersArray.forEach((member, index) => {
        const isMe = member.toLowerCase().replace(/\s+/g, '') === lowerMe; 
        const paidBubble = document.createElement('div'); paidBubble.className = `avatar-bubble ${isMe || (index === 0 && !membersArray.some(m => m.toLowerCase().replace(/\s+/g, '') === lowerMe)) ? 'active' : ''}`; paidBubble.textContent = member; paidByContainer.appendChild(paidBubble);
        const splitBubble = document.createElement('div'); splitBubble.className = 'avatar-bubble checkable active'; splitBubble.textContent = member; splitContainer.appendChild(splitBubble);
    });
}

document.getElementById('btn-manual-add').addEventListener('click', () => { if (!currentTripId) return; editingExpenseId = null; editingExpenseOriginal = null; document.getElementById('expense-modal-title').textContent = 'Add Expense'; document.getElementById('basic-expense-title').value = ''; document.getElementById('basic-expense-amount').value = ''; document.getElementById('basic-paid-by-container').innerHTML = document.getElementById('paid-by-container').innerHTML; document.getElementById('basic-paid-by-container').querySelectorAll('.avatar-bubble').forEach(b => { b.addEventListener('click', function() { document.getElementById('basic-paid-by-container').querySelectorAll('.avatar-bubble').forEach(x => x.classList.remove('active')); this.classList.add('active'); }); }); document.getElementById('basic-expense-modal').classList.remove('hidden'); });
document.getElementById('btn-basic-cancel').addEventListener('click', () => { editingExpenseId = null; editingExpenseOriginal = null; document.getElementById('basic-expense-modal').classList.add('hidden'); });
document.getElementById('btn-basic-save').addEventListener('click', async () => {
    const title = document.getElementById('basic-expense-title').value.trim() || 'Untitled Expense'; const amount = parseFloat(document.getElementById('basic-expense-amount').value); if (isNaN(amount) || amount <= 0) { showNoticeModal('Error', '打返個銀碼！'); return; }
    const activePayer = document.getElementById('basic-paid-by-container').querySelector('.avatar-bubble.active'); const payerName = activePayer ? activePayer.textContent.trim() : 'Unknown'; const allMembers = Array.from(document.getElementById('basic-paid-by-container').querySelectorAll('.avatar-bubble')).map(b => b.textContent.trim());
    const btn = document.getElementById('btn-basic-save'); btn.disabled = true; btn.textContent = 'Saving...';
    const splitBetween = editingExpenseId && editingExpenseOriginal && Array.isArray(editingExpenseOriginal.splitBetween) && editingExpenseOriginal.splitBetween.length > 0 ? editingExpenseOriginal.splitBetween : allMembers;
    const splitCount = editingExpenseId && editingExpenseOriginal && typeof editingExpenseOriginal.splitCount === 'number' ? editingExpenseOriginal.splitCount : (splitBetween.length || 1);
    const createdAt = editingExpenseId && editingExpenseOriginal && editingExpenseOriginal.createdAt ? editingExpenseOriginal.createdAt : new Date().toISOString();
    const expenseData = { title: title, amount: amount, paidBy: payerName, splitBetween: splitBetween, splitCount: splitCount, createdAt: createdAt };
    try { if (editingExpenseId) { await updateDoc(doc(db, `trips/${currentTripId}/expenses`, editingExpenseId), expenseData); } else { await addDoc(collection(db, `trips/${currentTripId}/expenses`), expenseData); } editingExpenseId = null; editingExpenseOriginal = null; document.getElementById('basic-expense-modal').classList.add('hidden'); loadExpenses(currentTripId); } catch (e) { showNoticeModal('Error', 'Save error'); } finally { btn.disabled = false; btn.textContent = 'Save'; }
});

// ==========================================
// 🤖 SCANNER / ORB LOGIC & GEMINI ENGINE (V58.0)
// ==========================================
const btnSnap = document.getElementById('btn-snap'); const cameraInput = document.getElementById('camera-input'); const resultOrb = document.getElementById('result-orb'); const perPersonAmountDisplay = document.getElementById('per-person-amount'); const btnNext = document.getElementById('btn-next'); const manualSubtotalInput = document.getElementById('manual-subtotal'); const manualTaxInput = document.getElementById('manual-tax'); const assignmentModal = document.getElementById('assignment-modal'); const expenseTitleInput = document.getElementById('expense-title'); const cropModal = document.getElementById('crop-modal'); const cropImage = document.getElementById('crop-image');
let cropper = null; let scannedSubtotal = 0.00; let scannedTax = 0.00; let currentGrandTotal = 0.00; let currentPerPerson = 0.00; let globalTipValue = 5; let globalSplitValue = 1;

let exactTipAmount = null; 
let isSystemUpdatingDial = false;
let globalParsedItems = []; 
let lastScannedImageBlob = null; // 用作分享圖片

let isItemizedMode = false;
const btnModeSimple = document.getElementById('btn-mode-simple'); const btnModeItemized = document.getElementById('btn-mode-itemized'); const modeSlider = document.getElementById('mode-slider');

function updateScannerModeUI() {
    if (isItemizedMode) { modeSlider.style.transform = 'translateX(100%)'; btnModeSimple.style.color = 'var(--text-dim)'; btnModeItemized.style.color = '#000'; } 
    else { modeSlider.style.transform = 'translateX(0)'; btnModeSimple.style.color = '#000'; btnModeItemized.style.color = 'var(--text-dim)'; }
    calculateAndRender();
}

if(btnModeSimple && btnModeItemized) {
    btnModeSimple.addEventListener('click', () => { isItemizedMode = false; updateScannerModeUI(); document.getElementById('itemized-modal').classList.add('hidden'); });
    btnModeItemized.addEventListener('click', () => { 
        if (currentGrandTotal === 0 || isNaN(currentGrandTotal)) { showNoticeModal('Oops!', '請先掃描單據或手動輸入 Subtotal 啦！'); isItemizedMode = false; updateScannerModeUI(); return; }
        isItemizedMode = true; updateScannerModeUI();
        document.getElementById('itemized-modal').classList.remove('hidden');
        initPaintbrushMode();
    });
}

function calculateAndRender() {
    const sub = parseFloat(manualSubtotalInput.value) || 0; const tax = parseFloat(manualTaxInput.value) || 0; scannedSubtotal = sub; scannedTax = tax;
    
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

    const taxLabel = document.getElementById('tax-label'); if (sub > 0 && tax > 0) { taxLabel.textContent = `Tax (${((tax / sub) * 100).toFixed(1)}%)`; } else { taxLabel.textContent = 'Tax'; }
    currentGrandTotal = scannedSubtotal + scannedTax + tipAmount; currentPerPerson = currentGrandTotal / globalSplitValue;     
    
    const summaryTipVal = document.getElementById('summary-tip-val'); const summaryTotalVal = document.getElementById('summary-total-val');
    if (summaryTipVal) summaryTipVal.textContent = `$${tipAmount.toFixed(2)}`;
    if (summaryTotalVal) summaryTotalVal.textContent = `$${currentGrandTotal.toFixed(2)}`;
    
    const splitContainer = document.getElementById('split-dial-container'); const orbLabel = document.getElementById('orb-dynamic-label'); let displayStr = '$0.00';
    if (isItemizedMode || currentTripMode) { if(splitContainer) { splitContainer.style.opacity = '0.2'; splitContainer.style.pointerEvents = 'none'; } if(orbLabel) orbLabel.textContent = 'RECEIPT TOTAL'; displayStr = currentGrandTotal === 0 ? `$0.00` : `$${currentGrandTotal.toFixed(2)}`; } 
    else { if(splitContainer) { splitContainer.style.opacity = '1'; splitContainer.style.pointerEvents = 'auto'; } if(orbLabel) orbLabel.textContent = 'PER PERSON'; displayStr = currentGrandTotal === 0 ? `$0.00` : `$${currentPerPerson.toFixed(2)}`; }
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
const tipDialControl = setupCircularDial('tip-wrapper', 'tip-ring', 'tip-thumb', 'tip-display', 5, 30, 5, 5, true, (val) => { 
    if (!isSystemUpdatingDial) exactTipAmount = null; 
    globalTipValue = val; calculateAndRender(); 
}); 
const splitDialControl = setupCircularDial('split-wrapper', 'split-ring', 'split-thumb', 'split-display', 1, 20, 1, 1, false, (val) => { globalSplitValue = val; calculateAndRender(); });

const settingsModal = document.getElementById('settings-modal');
document.getElementById('settings-name-input').value = localStorage.getItem('billapp_user_name') || ''; document.getElementById('settings-venmo-input').value = localStorage.getItem('billapp_venmo_id') || ''; document.getElementById('settings-zelle-input').value = localStorage.getItem('billapp_zelle_id') || '';
document.getElementById('btn-settings').addEventListener('click', () => { settingsModal.classList.remove('hidden'); }); document.getElementById('btn-settings-cancel').addEventListener('click', () => settingsModal.classList.add('hidden'));
document.getElementById('btn-settings-save').addEventListener('click', () => { localStorage.setItem('billapp_user_name', document.getElementById('settings-name-input').value.trim()); localStorage.setItem('billapp_venmo_id', document.getElementById('settings-venmo-input').value.trim()); localStorage.setItem('billapp_zelle_id', document.getElementById('settings-zelle-input').value.trim()); settingsModal.classList.add('hidden'); showNoticeModal('Profile Saved', ''); loadTrips(); setupNotifications(); });
if (document.getElementById('btn-info')) { document.getElementById('btn-info').addEventListener('click', (e) => { e.preventDefault(); document.getElementById('debug-env').textContent = (window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) ? "📱 PWA App" : "🌐 Browser"; document.getElementById('info-modal').classList.remove('hidden'); }); document.getElementById('btn-info-close').addEventListener('click', () => document.getElementById('info-modal').classList.add('hidden')); }

// ==========================================
// 🚀 🤖 一鍵極速掃描 (V58.0 Pure AI-Driven - 移除 Crop 手動步驟)
// ==========================================
btnSnap.addEventListener('click', () => cameraInput.click()); 
const originalApertureSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="14.31" y1="8" x2="20.05" y2="17.94"></line><line x1="9.69" y1="8" x2="21.17" y2="8"></line><line x1="7.38" y1="12" x2="13.12" y2="2.06"></line><line x1="9.69" y1="16" x2="3.95" y2="6.06"></line><line x1="14.31" y1="16" x2="2.83" y2="16"></line><line x1="16.62" y1="12" x2="10.88" y2="21.94"></line></svg>`;

cameraInput.addEventListener('change', (event) => { 
    const file = event.target.files[0]; 
    if (!file) return; 

    // 直接啟動掃描動畫 UI
    btnSnap.classList.add('scanning'); 
    btnSnap.style.pointerEvents = 'none';

    const reader = new FileReader(); 
    reader.onload = (e) => { 
        const img = new Image();
        img.onload = async () => {
            // 利用 Canvas 在背景自動縮放圖片 (避免上傳原圖 10MB 爆 Quota)
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
            
            // 順手 Save 留底畀 WhatsApp Share
            canvas.toBlob((blob) => { lastScannedImageBlob = blob; }, 'image/jpeg', 0.8);
            const base64Image = canvas.toDataURL('image/jpeg', 0.8);
            const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
            
            try {
                const cloudRunUrl = 'https://analyze-receipt-315301750535.us-west1.run.app';
                
                // 1. 直飛 Cloud Run 獲取 AI 結果 (與你 V56.0 邏輯完全一樣)
                const aiResponse = await fetch(cloudRunUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base64Image: base64Data })
                });

                const receiptData = await aiResponse.json();
                if (!aiResponse.ok) throw new Error(receiptData.error || `Cloud Run HTTP ${aiResponse.status}`);
                
                // 2. 獲取原幣值與即時匯率換算
                currentCurrency = receiptData.currency || "USD";
                currentForeignTotal = receiptData.total || 0;
                currentExchangeRate = 1.0000;

                let finalSubtotal = receiptData.subtotal || 0; 
                let finalTax = receiptData.tax || 0; 
                let finalTip = receiptData.exactTip || receiptData.gratuity || 0; 

                if (currentCurrency !== "USD") {
                    try {
                        const rateResponse = await fetch('https://open.er-api.com/v6/latest/USD');
                        if (rateResponse.ok) {
                            const rateData = await rateResponse.json();
                            const rateToUSD = rateData.rates[currentCurrency];
                            if (rateToUSD) {
                                currentExchangeRate = 1 / rateToUSD;
                                finalSubtotal = finalSubtotal * currentExchangeRate;
                                finalTax = finalTax * currentExchangeRate;
                                if (finalTip > 0) finalTip = finalTip * currentExchangeRate;
                            }
                        }
                    } catch (err) { 
                        console.error("匯率同步失敗:", err); 
                        showToast("⚠️ 匯率同步失敗，暫以原幣值填入面版"); 
                    }
                }

                // 3. 對接 Cloud Run 更新後的 items 清單到畫筆系統
                globalParsedItems = [];
                const apiItems = receiptData.items || receiptData.lineItems || receiptData.line_items || [];
                if (apiItems && Array.isArray(apiItems) && apiItems.length > 0) {
                    apiItems.forEach((item, index) => {
                        let price = parseFloat(item.price || item.amount || item.total || 0);
                        let name = item.name || item.description || item.title || `Item ${index + 1}`;
                        if (price > 0) {
                            let finalItemPrice = currentCurrency !== "USD" ? price * currentExchangeRate : price;
                            globalParsedItems.push({
                                id: 'item_gemini_' + index,
                                name: name,
                                price: finalItemPrice,
                                assignedTo: []
                            });
                        }
                    });
                }

                // 4. 面板數值灌入
                manualSubtotalInput.value = Math.abs(parseFloat(finalSubtotal.toFixed(2))); 
                manualTaxInput.value = Math.abs(parseFloat(finalTax.toFixed(2))); 
                
                if (finalTip > 0) {
                    exactTipAmount = parseFloat(finalTip.toFixed(2));
                    isSystemUpdatingDial = true; tipDialControl.setValue(0); 
                    exactTipAmount = parseFloat(finalTip.toFixed(2)); isSystemUpdatingDial = false;
                } else {
                    exactTipAmount = null;
                    isSystemUpdatingDial = true; tipDialControl.setValue(5); isSystemUpdatingDial = false;
                }
                
                autoResizeInput(manualSubtotalInput); autoResizeInput(manualTaxInput);
                calculateAndRender(); 
                showToast(currentCurrency !== "USD" ? `🌐 成功辨識 ${currentCurrency} 匯率與項目！` : "🤖 雲端 AI 智能解析完成！");

            } catch (error) { 
                console.error("🔥 AI Debug Log:", error);
                showNoticeModal('AI 解析失敗', `系統訊息: ${error.message}<br><br>請確認後端網路連線。`); 
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

btnNext.addEventListener('click', async () => {
    if (currentGrandTotal === 0) { showNoticeModal('Empty Bill', '大佬，未入銀碼喎！'); return; }
    if (isItemizedMode) { document.getElementById('itemized-modal').classList.remove('hidden'); } 
    else {
        if (currentTripMode) { expenseTitleInput.value = ''; assignmentModal.classList.remove('hidden'); } 
        else {
            const userName = localStorage.getItem('billapp_user_name') || 'Me'; 
            let tipLabelStr = exactTipAmount !== null ? 'Tip (Incl.)' : `Tip (${globalTipValue}%)`;
            const shareText = `🍽️ ${userName} shared a bill\n\n🔹 Subtotal: $${scannedSubtotal.toFixed(2)}\n🔹 Tax: $${scannedTax.toFixed(2)}\n🔹 ${tipLabelStr}: $${(exactTipAmount !== null ? exactTipAmount : (scannedSubtotal * (globalTipValue / 100))).toFixed(2)}\n💰 Total: $${currentGrandTotal.toFixed(2)}\n\n👥 Split: ${globalSplitValue} ppl\n👉 Per Person: $${currentPerPerson.toFixed(2)}`;
            if (navigator.share) { try { await navigator.share({ title: `${userName}'s Bill`, text: shareText }); } catch (e) {} } else { navigator.clipboard.writeText(shareText).then(() => { showNoticeModal('Copied', 'Details copied to clipboard.'); }); }
        }
    }
});

document.getElementById('btn-assignment-cancel').addEventListener('click', () => { assignmentModal.classList.add('hidden'); });

// 🌟 將外幣資料 (foreignAmount, currency, rate) 完美寫入 Firestore 結構
document.getElementById('btn-assignment-save').addEventListener('click', async () => {
    const title = expenseTitleInput.value.trim() || 'Untitled Expense'; 
    const activePayer = document.querySelector('#paid-by-container .avatar-bubble.active'); 
    const payerName = activePayer ? activePayer.innerText : 'Unknown';
    const splitNodes = document.querySelectorAll('#split-between-container .avatar-bubble.active'); 
    let splitArray = []; 
    splitNodes.forEach(n => splitArray.push(n.innerText));
    
    try {
        const receiptMeta = await uploadScannedReceiptImage(currentTripId);
        await addDoc(collection(db, `trips/${currentTripId}/expenses`), { 
            title: title, 
            amount: currentGrandTotal, 
            foreignAmount: currentForeignTotal, 
            foreignCurrency: currentCurrency, 
            exchangeRate: currentExchangeRate, 
            paidBy: payerName, 
            splitBetween: splitArray, 
            splitCount: splitArray.length || 1, 
            createdAt: new Date().toISOString(),
            receiptImageUrl: receiptMeta ? receiptMeta.receiptImageUrl : null,
            receiptImagePath: receiptMeta ? receiptMeta.receiptImagePath : null
        }); 
        assignmentModal.classList.add('hidden'); 
        manualSubtotalInput.value = ''; 
        manualTaxInput.value = ''; 
        exactTipAmount = null; 
        lastScannedImageBlob = null;
        autoResizeInput(manualSubtotalInput); 
        autoResizeInput(manualTaxInput); 
        calculateAndRender(); 
        navigateTo('page-trip'); 
        loadExpenses(currentTripId); 
    } catch (e) { 
        showNoticeModal('Error', 'Failed to save expense'); 
    }
});

document.getElementById('btn-done').addEventListener('click', () => { manualSubtotalInput.value = ''; manualTaxInput.value = ''; exactTipAmount = null; autoResizeInput(manualSubtotalInput); autoResizeInput(manualTaxInput); isSystemUpdatingDial = true; tipDialControl.setValue(5); splitDialControl.setValue(1); isSystemUpdatingDial = false; if (!currentTripMode) navigateTo('page-home'); });
autoResizeInput(manualSubtotalInput); autoResizeInput(manualTaxInput); calculateAndRender();

// ==========================================
// 🌟 V54.0: PAINTBRUSH MODE LOGIC (支援 10+ 人橫向捲動 & 雙字母頭像)
// ==========================================
let parsedItemsData = []; let currentBrushUser = null; let tripMembersForSplit = [];

function initPaintbrushMode() {
    tripMembersForSplit = currentTripData ? currentTripData.members : [getCurrentUser(), 'Amy', 'Samuel'];
    if (!tripMembersForSplit.includes(getCurrentUser())) tripMembersForSplit.unshift(getCurrentUser());
    currentBrushUser = getCurrentUser();
    if (globalParsedItems && globalParsedItems.length > 0) { parsedItemsData = JSON.parse(JSON.stringify(globalParsedItems)); } else { parsedItemsData = [{ id: 'item_manual', name: "Manual Item (OCR Failed)", price: scannedSubtotal, assignedTo: [] }]; }
    renderAvatarDock(); renderScannedItems(); updateItemizedMath();
}

function renderAvatarDock() {
    const dockContainer = document.getElementById('avatar-dock-container'); 
    dockContainer.innerHTML = '';
    
    // 🛠️ 修正 1：強制開啟橫向捲動 (Horizontal Scroll)，突破 6 個人限制
    dockContainer.style.display = 'flex';
    dockContainer.style.width = '100%';
    dockContainer.style.maxWidth = '100%';
    dockContainer.style.justifyContent = 'flex-start';
    dockContainer.style.overflowX = 'auto';
    dockContainer.style.overflowY = 'hidden';
    dockContainer.style.paddingBottom = '10px';
    dockContainer.style.webkitOverflowScrolling = 'touch';
    dockContainer.style.overscrollBehaviorX = 'contain';
    dockContainer.style.touchAction = 'pan-x';
    dockContainer.style.scrollbarWidth = 'none'; // 隱藏 scrollbar 保持介面乾淨

    tripMembersForSplit.forEach(member => {
        // 🛠️ 修正 2：抽取頭 2 個字母，例如 "Sherry" 變 "SH"
        const initial = member.substring(0, 2).toUpperCase(); 
        const isMe = member === getCurrentUser();
        
        const wrapper = document.createElement('div'); 
        wrapper.className = 'dock-avatar-wrapper';
        wrapper.style.flexShrink = '0'; // 保證每個頭像不會被螢幕邊界壓扁
        wrapper.style.marginRight = '12px'; // 加大間隔方便手指點擊
        
        const avatarDiv = document.createElement('div'); 
        avatarDiv.className = `dock-avatar ${member === currentBrushUser ? 'active-brush' : ''}`; 
        
        // 稍微縮小字體並收緊字距，讓雙字母完美居中
        avatarDiv.innerHTML = `<span style="font-size: 0.85em; letter-spacing: -0.5px;">${initial}</span>`;
        
        if (member === currentBrushUser) { avatarDiv.style.background = isMe ? 'var(--accent-blue)' : '#E5E7EB'; avatarDiv.style.color = '#000'; }
        
        const amountDiv = document.createElement('div'); 
        amountDiv.className = 'avatar-amount'; 
        amountDiv.id = `amount-${member.replace(/\s+/g, '-')}`; 
        amountDiv.textContent = '$0.00';
        
        if (member === currentBrushUser) { amountDiv.style.color = isMe ? 'var(--accent-blue)' : '#E5E7EB'; }
        
        avatarDiv.addEventListener('click', () => { currentBrushUser = member; renderAvatarDock(); updateItemizedMath(); });
        
        wrapper.appendChild(avatarDiv); 
        wrapper.appendChild(amountDiv); 
        dockContainer.appendChild(wrapper);
    });
}

function renderScannedItems() {
    const listContainer = document.getElementById('scanned-items-list'); listContainer.innerHTML = '';
    parsedItemsData.forEach((item) => {
        const itemRow = document.createElement('div'); itemRow.className = 'item-row'; let avatarsHTML = '';
        if (item.assignedTo.length === 0) { 
            avatarsHTML = `<div style="width: 28px; height: 28px; border-radius: 50%; border: 2px dashed rgba(255,255,255,0.2);"></div>`; 
        } else {
            item.assignedTo.forEach((assignee, i) => { 
                const isMe = assignee === getCurrentUser(); 
                const bgCol = isMe ? 'var(--accent-blue)' : '#E5E7EB'; 
                const marginLeft = i === 0 ? '0' : '-10px'; 
                
                // 🛠️ 列表裡面的小頭像也同步改為 2 個字母
                const initials = assignee.substring(0, 2).toUpperCase();
                avatarsHTML += `<div class="mini-avatar" style="background: ${bgCol}; margin-left: ${marginLeft}; z-index: ${i}; font-size: 0.65em; letter-spacing: -0.5px; display:flex; justify-content:center; align-items:center;">${initials}</div>`; 
            });
        }
        itemRow.innerHTML = `<div style="pointer-events: none; display: flex; flex-direction: row; align-items: center; width: 45px; justify-content: flex-start;">${avatarsHTML}</div><div style="flex: 1; pointer-events: none; display: flex; flex-direction: row; justify-content: space-between; align-items: center;"><div style="color: white; font-size: 0.95rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70%;">${item.name}</div><div style="color: var(--text-dim); font-size: 1rem; font-weight: 500;">$${item.price.toFixed(2)}</div></div>`;
        itemRow.addEventListener('click', () => { if (!currentBrushUser) return; const userIndex = item.assignedTo.indexOf(currentBrushUser); if (userIndex === -1) { item.assignedTo.push(currentBrushUser); } else { item.assignedTo.splice(userIndex, 1); } renderScannedItems(); updateItemizedMath(); });
        listContainer.appendChild(itemRow);
    });
}

function updateItemizedMath() {
    let userTotals = {}; tripMembersForSplit.forEach(m => userTotals[m] = 0);
    parsedItemsData.forEach(item => { if (item.assignedTo.length > 0) { const splitPrice = item.price / item.assignedTo.length; item.assignedTo.forEach(assignee => { if (userTotals[assignee] !== undefined) { userTotals[assignee] += splitPrice; } }); } });
    tripMembersForSplit.forEach(member => { const amountNode = document.getElementById(`amount-${member.replace(/\s+/g, '-')}`); if (amountNode) { amountNode.textContent = `$${userTotals[member].toFixed(2)}`; } });
}

document.getElementById('btn-itemized-save').addEventListener('click', async () => {
    const saveBtn = document.getElementById('btn-itemized-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        if (!currentTripId) {
            showNoticeModal('Trip Required', 'Itemized save currently works inside a trip only.');
            return;
        }

        const assignedItems = parsedItemsData.filter(item => item.assignedTo && item.assignedTo.length > 0);
        if (assignedItems.length === 0) {
            showNoticeModal('No Assignments', 'Assign at least one item before confirming split.');
            return;
        }

        const userTotals = {};
        tripMembersForSplit.forEach(member => { userTotals[member] = 0; });
        assignedItems.forEach(item => {
            const splitPrice = item.price / item.assignedTo.length;
            item.assignedTo.forEach(assignee => {
                if (userTotals[assignee] !== undefined) userTotals[assignee] += splitPrice;
            });
        });

        const splitMembers = Object.keys(userTotals).filter(member => userTotals[member] > 0);
        const itemizedBreakdown = splitMembers.map(member => ({ member: member, amount: parseFloat(userTotals[member].toFixed(2)) }));
        const itemizedItems = parsedItemsData.map(item => ({ name: item.name, price: item.price, assignedTo: item.assignedTo || [] }));

        const receiptMeta = await uploadScannedReceiptImage(currentTripId);

        await addDoc(collection(db, `trips/${currentTripId}/expenses`), {
            title: 'Itemized Expense',
            amount: currentGrandTotal,
            foreignAmount: currentForeignTotal,
            foreignCurrency: currentCurrency,
            exchangeRate: currentExchangeRate,
            paidBy: getCurrentUser(),
            splitBetween: splitMembers,
            splitCount: splitMembers.length || 1,
            isItemized: true,
            itemizedBreakdown: itemizedBreakdown,
            itemizedItems: itemizedItems,
            createdAt: new Date().toISOString(),
            receiptImageUrl: receiptMeta ? receiptMeta.receiptImageUrl : null,
            receiptImagePath: receiptMeta ? receiptMeta.receiptImagePath : null
        });

        document.getElementById('itemized-modal').classList.add('hidden');
        isItemizedMode = false;
        updateScannerModeUI();
        manualSubtotalInput.value = '';
        manualTaxInput.value = '';
        exactTipAmount = null;
        lastScannedImageBlob = null;
        autoResizeInput(manualSubtotalInput);
        autoResizeInput(manualTaxInput);
        calculateAndRender();
        navigateTo('page-trip');
        loadExpenses(currentTripId);
        showToast('Itemized expense saved');
    } catch (e) {
        showNoticeModal('Error', 'Failed to save itemized split.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Confirm Split';
    }
});

document.getElementById('btn-itemized-cancel').addEventListener('click', () => { document.getElementById('itemized-modal').classList.add('hidden'); });
document.getElementById('itemized-bg-overlay').addEventListener('click', () => { document.getElementById('itemized-modal').classList.add('hidden'); });