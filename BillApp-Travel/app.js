// ==========================================
// 🌟 FIREBASE SETUP & IMPORT (V52.0 - Gratuity Fix)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, getDoc, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { autoResizeInput, showNoticeModal, showConfirmModal, initConfirmModal, setupSwipeActions } from '../shared/core-ui.js';

const firebaseConfig = { apiKey: "AIzaSyADViQdzsf1MTmsDnf_NiQp0eB-EPFsgxI", authDomain: "billapp-travel.firebaseapp.com", projectId: "billapp-travel", storageBucket: "billapp-travel.firebasestorage.app", messagingSenderId: "47415537906", appId: "1:47415537906:web:c401cdc2dd8bd22d10e06b" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);
initConfirmModal();

const getCurrentUser = () => { const name = localStorage.getItem('billapp_user_name'); return name ? name.trim() : 'Guest'; };

let currentTripMode = null; let currentTripId = null; let currentTripData = null; let editingExpenseId = null; 
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
                actionBg.querySelector('.action-edit').addEventListener('click', () => { editingExpenseId = docSnap.id; document.getElementById('expense-modal-title').textContent = 'Edit Expense'; document.getElementById('basic-expense-title').value = data.title; document.getElementById('basic-expense-amount').value = data.amount; const originalPaidBy = document.getElementById('paid-by-container').innerHTML; document.getElementById('basic-paid-by-container').innerHTML = originalPaidBy; document.getElementById('basic-paid-by-container').querySelectorAll('.avatar-bubble').forEach(bubble => { if (bubble.textContent.trim() === data.paidBy) { bubble.classList.add('active'); } else { bubble.classList.remove('active'); } bubble.addEventListener('click', function() { document.getElementById('basic-paid-by-container').querySelectorAll('.avatar-bubble').forEach(x => x.classList.remove('active')); this.classList.add('active'); }); }); document.getElementById('basic-expense-modal').classList.remove('hidden'); });
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

document.getElementById('btn-manual-add').addEventListener('click', () => { if (!currentTripId) return; editingExpenseId = null; document.getElementById('expense-modal-title').textContent = 'Add Expense'; document.getElementById('basic-expense-title').value = ''; document.getElementById('basic-expense-amount').value = ''; document.getElementById('basic-paid-by-container').innerHTML = document.getElementById('paid-by-container').innerHTML; document.getElementById('basic-paid-by-container').querySelectorAll('.avatar-bubble').forEach(b => { b.addEventListener('click', function() { document.getElementById('basic-paid-by-container').querySelectorAll('.avatar-bubble').forEach(x => x.classList.remove('active')); this.classList.add('active'); }); }); document.getElementById('basic-expense-modal').classList.remove('hidden'); });
document.getElementById('btn-basic-cancel').addEventListener('click', () => { document.getElementById('basic-expense-modal').classList.add('hidden'); });
document.getElementById('btn-basic-save').addEventListener('click', async () => {
    const title = document.getElementById('basic-expense-title').value.trim() || 'Untitled Expense'; const amount = parseFloat(document.getElementById('basic-expense-amount').value); if (isNaN(amount) || amount <= 0) { showNoticeModal('Error', '打返個銀碼！'); return; }
    const activePayer = document.getElementById('basic-paid-by-container').querySelector('.avatar-bubble.active'); const payerName = activePayer ? activePayer.textContent.trim() : 'Unknown'; const allMembers = Array.from(document.getElementById('basic-paid-by-container').querySelectorAll('.avatar-bubble')).map(b => b.textContent.trim());
    const btn = document.getElementById('btn-basic-save'); btn.disabled = true; btn.textContent = 'Saving...'; const expenseData = { title: title, amount: amount, paidBy: payerName, splitBetween: allMembers, splitCount: allMembers.length || 1, createdAt: new Date().toISOString() };
    try { if (editingExpenseId) { await updateDoc(doc(db, `trips/${currentTripId}/expenses`, editingExpenseId), expenseData); } else { await addDoc(collection(db, `trips/${currentTripId}/expenses`), expenseData); } document.getElementById('basic-expense-modal').classList.add('hidden'); loadExpenses(currentTripId); } catch (e) { showNoticeModal('Error', 'Save error'); } finally { btn.disabled = false; btn.textContent = 'Save'; }
});

// ==========================================
// 🌟 SCANNER / ORB LOGIC (V52.0)
// ==========================================
const btnSnap = document.getElementById('btn-snap'); const cameraInput = document.getElementById('camera-input'); const resultOrb = document.getElementById('result-orb'); const perPersonAmountDisplay = document.getElementById('per-person-amount'); const btnNext = document.getElementById('btn-next'); const manualSubtotalInput = document.getElementById('manual-subtotal'); const manualTaxInput = document.getElementById('manual-tax'); const assignmentModal = document.getElementById('assignment-modal'); const expenseTitleInput = document.getElementById('expense-title'); const cropModal = document.getElementById('crop-modal'); const cropImage = document.getElementById('crop-image');
let cropper = null; let scannedSubtotal = 0.00; let scannedTax = 0.00; let currentGrandTotal = 0.00; let currentPerPerson = 0.00; let globalTipValue = 5; let globalSplitValue = 1;

let exactTipAmount = null; // 🌟 存放單據上的真實 Gratuity
let isSystemUpdatingDial = false; // 🌟 防止轉盤打交

let globalParsedItems = []; 
function parseReceiptItems(text) {
    const lines = text.split('\n'); const items = []; let idCounter = 1;
    const ignoreWords = ['subtotal', 'tax', 'total', 'tip', 'change', 'cash', 'visa', 'mastercard', 'amex', 'due', 'balance', 'guest', 'table', 'terminal', 'inv#', 'description', 'price', 'dine-in', 'yumee'];
    lines.forEach(line => {
        const cleanLine = line.trim(); if (!cleanLine) return; const lowerLine = cleanLine.toLowerCase(); if (ignoreWords.some(word => lowerLine.includes(word))) return;
        const priceRegex = /(?:\$?\s*)(\d{1,4}(?:,\d{3})*\.\d{2})(?!\d)/; const match = cleanLine.match(priceRegex);
        if (match) {
            const priceVal = parseFloat(match[1].replace(',', ''));
            if (priceVal > 0 && priceVal < 500) {
                let name = cleanLine.replace(match[0], '').trim(); name = name.replace(/^(\d+\s*x?\s*)/i, '').trim(); 
                name = name.replace(/^[-.,:;!@#$%^&*()_+=\[\]{}|\\<>\/?]+/g, '').trim(); // 支援中文名，只除怪標點
                if (name.length >= 1) { items.push({ id: 'item_' + idCounter++, name: name, price: priceVal, assignedTo: [] }); }
            }
        }
    }); return items;
}

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
    let tipPctDisplay = globalTipValue;

    if (exactTipAmount !== null && exactTipAmount > 0) {
        tipAmount = exactTipAmount;
        if (scannedSubtotal > 0) tipPctDisplay = (tipAmount / scannedSubtotal) * 100;
    } else {
        tipAmount = scannedSubtotal * (globalTipValue / 100);
    }

    const taxLabel = document.getElementById('tax-label'); if (sub > 0 && tax > 0) { taxLabel.textContent = `Tax (${((tax / sub) * 100).toFixed(1)}%)`; } else { taxLabel.textContent = 'Tax'; }
    currentGrandTotal = scannedSubtotal + scannedTax + tipAmount; currentPerPerson = currentGrandTotal / globalSplitValue;     
    
    const summaryTipLabel = document.getElementById('summary-tip-label');
    if (summaryTipLabel) summaryTipLabel.textContent = `Tip (${typeof tipPctDisplay === 'number' && !Number.isInteger(tipPctDisplay) ? tipPctDisplay.toFixed(1) : Math.round(tipPctDisplay)}%)`;

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

manualSubtotalInput.addEventListener('input', function() { exactTipAmount = null; autoResizeInput(this); calculateAndRender(); }); manualTaxInput.addEventListener('input', function() { autoResizeInput(this); calculateAndRender(); });

function setupCircularDial(wrapperId, ringId, thumbId, displayId, min, max, step, initialValue, isPercent, onChangeCallback) {
    const wrapper = document.getElementById(wrapperId); const ring = document.getElementById(ringId); const thumb = document.getElementById(thumbId); const display = document.getElementById(displayId);
    let currentValue = initialValue; const r = 38; const cx = 50; const cy = 50; const circumference = 2 * Math.PI * r; const arcDegrees = 270; const arcLength = circumference * (arcDegrees / 360); ring.style.strokeDasharray = `${arcLength} ${circumference}`;
    function updateUI(val) { const percentage = (val - min) / (max - min); const offset = arcLength - (percentage * arcLength); ring.style.strokeDashoffset = offset; const svgAngleRad = (percentage * arcDegrees) * (Math.PI / 180); thumb.setAttribute('cx', cx + r * Math.cos(svgAngleRad)); thumb.setAttribute('cy', cy + r * Math.sin(svgAngleRad)); display.textContent = val + (isPercent ? '%' : ''); onChangeCallback(val); }
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
if (document.getElementById('btn-info')) { document.getElementById('btn-info').addEventListener('click', (e) => { e.preventDefault(); document.getElementById('info-modal').classList.remove('hidden'); }); document.getElementById('btn-info-close').addEventListener('click', () => document.getElementById('info-modal').classList.add('hidden')); }

btnSnap.addEventListener('click', () => cameraInput.click()); document.getElementById('btn-crop-cancel').addEventListener('click', () => { cropModal.classList.add('hidden'); if (cropper) cropper.destroy(); cameraInput.value = ''; });
cameraInput.addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { cropImage.src = e.target.result; cropModal.classList.remove('hidden'); if (cropper) cropper.destroy(); cropper = new Cropper(cropImage, { viewMode: 1, dragMode: 'crop', autoCropArea: 0.8, restore: false, guides: true, center: true, highlight: false, cropBoxMovable: true, cropBoxResizable: true, toggleDragModeOnDblclick: false }); }; reader.readAsDataURL(file); });
const originalApertureSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="14.31" y1="8" x2="20.05" y2="17.94"></line><line x1="9.69" y1="8" x2="21.17" y2="8"></line><line x1="7.38" y1="12" x2="13.12" y2="2.06"></line><line x1="9.69" y1="16" x2="3.95" y2="6.06"></line><line x1="14.31" y1="16" x2="2.83" y2="16"></line><line x1="16.62" y1="12" x2="10.88" y2="21.94"></line></svg>`;

document.getElementById('btn-crop-confirm').addEventListener('click', async () => {
    if (!cropper) return;
    cropper.getCroppedCanvas({ maxWidth: 1024, maxHeight: 1024 }).toBlob(async (blob) => {
        cropModal.classList.add('hidden'); cropper.destroy(); btnSnap.classList.add('scanning'); btnSnap.style.pointerEvents = 'none';
        try {
            const result = await window.Tesseract.recognize(blob, 'eng+chi_tra+chi_sim'); 
            let cleanText = result.data.text.replace(/(\d+)\s*[_\.,]\s*(\d+)/g, "$1.$2").replace(/\d+(?:\.\d+)?\s*%/g, ""); 
            globalParsedItems = parseReceiptItems(cleanText);

            // 🌟 V52: 智能擷取 Subtotal, Tax, Gratuity 同 Total
            const subMatch = cleanText.match(/(?:sub\/?ttl|subtotal|taxable value|net)[^\n\r\d]{0,40}?(\d{1,4}(?:,\d{3})*\.\d{2})/i);
            const taxMatch = cleanText.match(/(?:surtax|\btax\b|vat)[^\n\r\d]{0,40}?(\d{1,4}(?:,\d{3})*\.\d{2})/i);
            const tipMatch = cleanText.match(/(?:gratuity|tip|tips|service charge|auto grt)[^\n\r\d]{0,40}?(\d{1,4}(?:,\d{3})*\.\d{2})/i);
            const totalMatch = cleanText.match(/(?:total due|total amount|\btotal\b)[^\n\r\d]{0,40}?(\d{1,4}(?:,\d{3})*\.\d{2})/i);

            let parsedSub = subMatch ? parseFloat(subMatch[1].replace(',', '')) : 0;
            let parsedTax = taxMatch ? parseFloat(taxMatch[1].replace(',', '')) : 0;
            let parsedTip = tipMatch ? parseFloat(tipMatch[1].replace(',', '')) : 0;
            let parsedTotal = totalMatch ? parseFloat(totalMatch[1].replace(',', '')) : 0;

            if (parsedTotal > 0) {
                if (parsedSub === 0 && parsedTax > 0) parsedSub = parsedTotal - parsedTax - parsedTip;
                if (parsedSub > 0 && parsedTax === 0 && parsedTotal > (parsedSub + parsedTip)) parsedTax = parsedTotal - parsedSub - parsedTip;
            } else if (parsedSub > 0) {
                parsedTotal = parsedSub + parsedTax + parsedTip;
            }

            if (parsedSub > 0 || parsedTotal > 0) { 
                if (parsedSub === 0 && parsedTotal > 0) parsedSub = parsedTotal; 
                manualSubtotalInput.value = Math.abs(parseFloat(parsedSub.toFixed(2))); 
                manualTaxInput.value = Math.abs(parseFloat(parsedTax.toFixed(2))); 
                
                // 🌟 V52: 設定精確 Gratuity
                if (parsedTip > 0) {
                    exactTipAmount = parsedTip;
                    isSystemUpdatingDial = true;
                    let approxPct = Math.round((parsedTip / parsedSub) * 100);
                    approxPct = Math.min(Math.max(approxPct, 0), 30);
                    tipDialControl.setValue(approxPct);
                    exactTipAmount = parsedTip; 
                    isSystemUpdatingDial = false;
                } else {
                    exactTipAmount = null;
                    isSystemUpdatingDial = true;
                    tipDialControl.setValue(5);
                    isSystemUpdatingDial = false;
                }

                autoResizeInput(manualSubtotalInput); autoResizeInput(manualTaxInput); calculateAndRender(); 
            } else { showNoticeModal('No Amount Found', 'Please try cropping closer to the Subtotal and Tax.'); }
        } catch (error) { showNoticeModal('Error', 'Recognition failed. Try again.'); } finally { btnSnap.innerHTML = originalApertureSVG; btnSnap.classList.remove('scanning'); btnSnap.style.pointerEvents = 'auto'; cameraInput.value = ''; }
    }, 'image/jpeg'); 
});

btnNext.addEventListener('click', async () => {
    if (currentGrandTotal === 0) { showNoticeModal('Empty Bill', '大佬，未入銀碼喎！'); return; }
    if (isItemizedMode) { document.getElementById('itemized-modal').classList.remove('hidden'); } 
    else {
        if (currentTripMode) { expenseTitleInput.value = ''; assignmentModal.classList.remove('hidden'); } 
        else {
            const userName = localStorage.getItem('billapp_user_name') || 'Me'; 
            const shareText = `🍽️ ${userName} shared a bill\n\n🔹 Subtotal: $${scannedSubtotal.toFixed(2)}\n🔹 Tax: $${scannedTax.toFixed(2)}\n🔹 Tip/Gratuity: $${exactTipAmount ? exactTipAmount.toFixed(2) : (scannedSubtotal * (globalTipValue / 100)).toFixed(2)}\n💰 Total: $${currentGrandTotal.toFixed(2)}\n\n👥 Split: ${globalSplitValue} ppl\n👉 Per Person: $${currentPerPerson.toFixed(2)}`;
            if (navigator.share) { try { await navigator.share({ title: `${userName}'s Bill`, text: shareText }); } catch (e) {} } else { navigator.clipboard.writeText(shareText).then(() => { showNoticeModal('Copied', 'Details copied to clipboard.'); }); }
        }
    }
});

document.getElementById('btn-assignment-cancel').addEventListener('click', () => { assignmentModal.classList.add('hidden'); });
document.getElementById('btn-assignment-save').addEventListener('click', async () => {
    const title = expenseTitleInput.value.trim() || 'Untitled Expense'; const activePayer = document.querySelector('#paid-by-container .avatar-bubble.active'); const payerName = activePayer ? activePayer.innerText : 'Unknown';
    const splitNodes = document.querySelectorAll('#split-between-container .avatar-bubble.active'); let splitArray = []; splitNodes.forEach(n => splitArray.push(n.innerText));
    try { await addDoc(collection(db, `trips/${currentTripId}/expenses`), { title: title, amount: currentGrandTotal, paidBy: payerName, splitBetween: splitArray, splitCount: splitArray.length || 1, createdAt: new Date().toISOString() }); assignmentModal.classList.add('hidden'); manualSubtotalInput.value = ''; manualTaxInput.value = ''; autoResizeInput(manualSubtotalInput); autoResizeInput(manualTaxInput); exactTipAmount = null; calculateAndRender(); navigateTo('page-trip'); loadExpenses(currentTripId); } catch (e) { showNoticeModal('Error', 'Failed to save expense'); }
});

document.getElementById('btn-done').addEventListener('click', () => { manualSubtotalInput.value = ''; manualTaxInput.value = ''; exactTipAmount = null; autoResizeInput(manualSubtotalInput); autoResizeInput(manualTaxInput); isSystemUpdatingDial = true; tipDialControl.setValue(5); splitDialControl.setValue(1); isSystemUpdatingDial = false; if (!currentTripMode) navigateTo('page-home'); });
autoResizeInput(manualSubtotalInput); autoResizeInput(manualTaxInput); calculateAndRender();

// ==========================================
// 🌟 V52.0: PAINTBRUSH MODE LOGIC
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
    const dockContainer = document.getElementById('avatar-dock-container'); dockContainer.innerHTML = '';
    tripMembersForSplit.forEach(member => {
        const initial = member.charAt(0).toUpperCase(); const isMe = member === getCurrentUser();
        const wrapper = document.createElement('div'); wrapper.className = 'dock-avatar-wrapper';
        const avatarDiv = document.createElement('div'); avatarDiv.className = `dock-avatar ${member === currentBrushUser ? 'active-brush' : ''}`; avatarDiv.innerHTML = initial;
        if (member === currentBrushUser) { avatarDiv.style.background = isMe ? 'var(--accent-blue)' : '#E5E7EB'; avatarDiv.style.color = '#000'; }
        const amountDiv = document.createElement('div'); amountDiv.className = 'avatar-amount'; amountDiv.id = `amount-${member.replace(/\s+/g, '-')}`; amountDiv.textContent = '$0.00';
        if (member === currentBrushUser) { amountDiv.style.color = isMe ? 'var(--accent-blue)' : '#E5E7EB'; }
        avatarDiv.addEventListener('click', () => { currentBrushUser = member; renderAvatarDock(); updateItemizedMath(); });
        wrapper.appendChild(avatarDiv); wrapper.appendChild(amountDiv); dockContainer.appendChild(wrapper);
    });
}

function renderScannedItems() {
    const listContainer = document.getElementById('scanned-items-list'); listContainer.innerHTML = '';
    parsedItemsData.forEach((item) => {
        const itemRow = document.createElement('div'); itemRow.className = 'item-row'; let avatarsHTML = '';
        if (item.assignedTo.length === 0) { avatarsHTML = `<div style="width: 28px; height: 28px; border-radius: 50%; border: 2px dashed rgba(255,255,255,0.2);"></div>`; } else {
            item.assignedTo.forEach((assignee, i) => { const isMe = assignee === getCurrentUser(); const bgCol = isMe ? 'var(--accent-blue)' : '#E5E7EB'; const marginLeft = i === 0 ? '0' : '-10px'; avatarsHTML += `<div class="mini-avatar" style="background: ${bgCol}; margin-left: ${marginLeft}; z-index: ${i};">${assignee.charAt(0).toUpperCase()}</div>`; });
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

document.getElementById('btn-itemized-cancel').addEventListener('click', () => { document.getElementById('itemized-modal').classList.add('hidden'); });
document.getElementById('itemized-bg-overlay').addEventListener('click', () => { document.getElementById('itemized-modal').classList.add('hidden'); });