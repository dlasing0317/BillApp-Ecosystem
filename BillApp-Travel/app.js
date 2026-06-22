// ==========================================
// 🌟 FIREBASE SETUP & IMPORT (V38.1)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, getDoc, arrayUnion, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { autoResizeInput, showNoticeModal, showConfirmModal, initConfirmModal, setupSwipeActions } from '../shared/core-ui.js';

const firebaseConfig = { apiKey: "AIzaSyADViQdzsf1MTmsDnf_NiQp0eB-EPFsgxI", authDomain: "billapp-travel.firebaseapp.com", projectId: "billapp-travel", storageBucket: "billapp-travel.firebasestorage.app", messagingSenderId: "47415537906", appId: "1:47415537906:web:c401cdc2dd8bd22d10e06b" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app);
initConfirmModal();

const getCurrentUser = () => { const name = localStorage.getItem('billapp_user_name'); return name ? name.trim() : 'Guest'; };

let currentTripMode = null; let currentTripId = null; let currentTripData = null; let editingExpenseId = null; 
function navigateTo(pageId) { document.querySelectorAll('.app-page').forEach(p => p.classList.remove('active')); document.getElementById(pageId).classList.add('active'); }

function showToast(msg) {
    const toast = document.getElementById('toast-notification'); const toastMsg = document.getElementById('toast-message');
    if(!toast) return; toastMsg.textContent = msg;
    toast.classList.remove('toast-hidden'); toast.classList.add('toast-visible');
    setTimeout(() => { toast.classList.remove('toast-visible'); toast.classList.add('toast-hidden'); }, 4000);
}

// ==========================================
// 🌟 NOTIFICATIONS SYSTEM 
// ==========================================
window.currentUnreadNotifs = [];

function setupNotifications() {
    const me = getCurrentUser(); if (me === 'Guest') return;
    const q = query(collection(db, "notifications"), where("targetUser", "==", me));
    
    onSnapshot(q, (snapshot) => {
        const notifList = document.getElementById('notification-list');
        const badge = document.getElementById('notification-badge');
        let docsArr = []; snapshot.forEach(d => docsArr.push({id: d.id, ...d.data()}));
        docsArr.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        notifList.innerHTML = ''; let unreadCount = 0; window.currentUnreadNotifs = [];
        if (docsArr.length === 0) { notifList.innerHTML = '<div style="text-align: center; color: var(--text-dim); padding: 20px;">No notifications yet.</div>'; badge.style.display = 'none'; return; }

        docsArr.forEach(data => {
            if (!data.read) { unreadCount++; window.currentUnreadNotifs.push(data.id); }
            notifList.innerHTML += `
                <div class="glass-box" style="padding: 12px; opacity: ${data.read ? '0.5' : '1'}; background: ${data.read ? 'transparent' : 'rgba(125, 211, 252, 0.1)'};">
                    <div style="color: white; font-size: 0.95rem;">${data.message}</div>
                    <div style="color: var(--text-dim); font-size: 0.75rem; margin-top: 5px;">${new Date(data.createdAt).toLocaleString('en-US', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'})}</div>
                </div>`;
        });

        if (unreadCount > 0) {
            badge.style.display = 'flex'; badge.textContent = unreadCount;
            const latest = docsArr[0];
            if (!latest.read && (new Date() - new Date(latest.createdAt)) < 10000) { showToast(latest.message); }
        } else { badge.style.display = 'none'; }
    });
}

document.getElementById('btn-notifications').addEventListener('click', () => {
    document.getElementById('notifications-modal').classList.remove('hidden');
    window.currentUnreadNotifs.forEach(id => { updateDoc(doc(db, "notifications", id), { read: true }); });
    window.currentUnreadNotifs = []; document.getElementById('notification-badge').style.display = 'none';
});
document.getElementById('btn-notifications-close').addEventListener('click', () => { document.getElementById('notifications-modal').classList.add('hidden'); });

// ==========================================
// 🌟 FIREBASE TRIPS FETCHING (Case-Insensitive)
// ==========================================
function loadTrips() {
    const tripList = document.getElementById('trip-list-container'); const me = getCurrentUser();
    const q = query(collection(db, "trips"), orderBy("createdAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
        tripList.innerHTML = ''; let hasTrips = false;
        if (snapshot.empty) { tripList.innerHTML = '<div style="text-align: center; color: var(--text-dim); margin-top: 20px;">No Trips yet. Click + to create.</div>'; return; }
        
        const lowerMe = me.toLowerCase().replace(/\s+/g, '');

        snapshot.forEach((docSnap) => {
            const data = docSnap.data(); 
            const tripOwner = data.owner || (data.members && data.members[0]) || 'Unknown'; 
            
            // 🛡️ Safe Case-Insensitive Matching
            const isOwner = tripOwner.toLowerCase().replace(/\s+/g, '') === lowerMe;
            let isMember = false;
            if (data.members) {
                isMember = data.members.some(m => m.toLowerCase().replace(/\s+/g, '') === lowerMe);
            }

            if (isOwner || isMember) { renderTripCard(docSnap.id, data); hasTrips = true; }
        });
        if (!hasTrips) tripList.innerHTML = `<div style="text-align: center; color: var(--text-dim); margin-top: 20px;">You haven't joined any trips yet. Click the 🤝 icon to join.</div>`;
    }, (error) => { tripList.innerHTML = '<div style="text-align: center; color: #ff4444; margin-top: 20px;">Failed to load trips.</div>'; });
}

async function loadExpenses(tripId) {
    const timeline = document.getElementById('trip-timeline'); timeline.innerHTML = '<div class="glass-box" style="margin-bottom: 15px; opacity: 0.5;"><div style="text-align: center; color: var(--text-dim); font-size: 0.9rem;">Start of trip timeline</div></div>';
    try {
        const q = query(collection(db, `trips/${tripId}/expenses`), orderBy("createdAt", "desc")); const querySnapshot = await getDocs(q);
        const me = getCurrentUser(); const lowerMe = me.toLowerCase().replace(/\s+/g, '');

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data(); const wrapper = document.createElement('div'); wrapper.className = 'trip-item-wrapper expense-wrapper';
            const actionBg = document.createElement('div'); actionBg.className = 'trip-item-action-bg';
            
            // 🛡️ Safe Case-Insensitive Permissions
            const isTripOwner = (currentTripData.owner && currentTripData.owner.toLowerCase().replace(/\s+/g, '') === lowerMe) || (currentTripData.members && currentTripData.members[0].toLowerCase().replace(/\s+/g, '') === lowerMe);
            const isExpenseCreator = data.paidBy.toLowerCase().replace(/\s+/g, '') === lowerMe;
            
            if (isTripOwner || isExpenseCreator) {
                actionBg.innerHTML = `<div class="action-edit">Edit</div><div class="action-delete">Delete</div>`;
                actionBg.querySelector('.action-delete').addEventListener('click', () => { const card = wrapper.querySelector('.trip-card'); card.classList.add('swiped-left'); showConfirmModal(`Delete "${data.title}"?`, async () => { try { await deleteDoc(doc(db, `trips/${tripId}/expenses`, docSnap.id)); loadExpenses(tripId); } catch(e) {} }); });
                actionBg.querySelector('.action-edit').addEventListener('click', () => {
                    editingExpenseId = docSnap.id; document.getElementById('expense-modal-title').textContent = 'Edit Expense'; document.getElementById('basic-expense-title').value = data.title; document.getElementById('basic-expense-amount').value = data.amount;
                    const originalPaidBy = document.getElementById('paid-by-container').innerHTML; document.getElementById('basic-paid-by-container').innerHTML = originalPaidBy;
                    document.getElementById('basic-paid-by-container').querySelectorAll('.avatar-bubble').forEach(bubble => { if (bubble.textContent.trim() === data.paidBy) { bubble.classList.add('active'); } else { bubble.classList.remove('active'); } bubble.addEventListener('click', function() { document.getElementById('basic-paid-by-container').querySelectorAll('.avatar-bubble').forEach(x => x.classList.remove('active')); this.classList.add('active'); }); });
                    document.getElementById('basic-expense-modal').classList.remove('hidden');
                });
            } else { actionBg.innerHTML = `<div style="width:100%; display:flex; justify-content:center; align-items:center; color:var(--text-dim); font-size: 0.9rem;">Only ${data.paidBy} can edit this</div>`; }

            const newItem = document.createElement('div'); newItem.className = 'trip-card glass-box'; 
            newItem.innerHTML = `<div style="display:flex; justify-content: space-between; align-items: center;"><div style="color: white; font-weight: 600; font-size: 1.1rem;">${data.title}</div><div style="color: var(--accent-blue); font-size: 1.4rem; font-weight: 700;">$${data.amount.toFixed(2)}</div></div><div style="color: var(--text-dim); font-size: 0.85rem; margin-top: 5px;">Paid by ${data.paidBy} • Split with ${data.splitCount} ppl</div>`;
            if (isTripOwner || isExpenseCreator) { setupSwipeActions(newItem); }
            wrapper.appendChild(actionBg); wrapper.appendChild(newItem); timeline.insertBefore(wrapper, timeline.firstChild);
        });
    } catch (e) { console.error("Error loading expenses: ", e); }
}

// ==========================================
// 🌟 AUTO-MERGE & JOIN LOGIC (Protected)
// ==========================================
async function processJoin(tripDocRef, tData, me, modalToClose) {
    const existingMembers = tData.members || [];
    const lowerMe = me.toLowerCase().replace(/\s+/g, '');
    let exactMatch = false; let matchedName = null;

    existingMembers.forEach(m => {
        if (m === me) exactMatch = true;
        else if (m.toLowerCase().replace(/\s+/g, '') === lowerMe) matchedName = m;
    });

    const confirmed = tData.confirmedMembers || [];
    const isConfirmed = confirmed.includes(me);
    let updatedMembers = [...existingMembers];

    if (exactMatch) {
        if (!isConfirmed) {
            confirmed.push(me); await updateDoc(tripDocRef, { confirmedMembers: confirmed });
            if (tData.owner && tData.owner !== me) { await addDoc(collection(db, "notifications"), { targetUser: tData.owner, message: `🎉 ${me} accepted your invite to "${tData.name}"!`, read: false, createdAt: new Date().toISOString() }); }
        }
        showNoticeModal('Already Joined', `You are already in "${tData.name}".`);
    } else if (matchedName) {
        // V38.1 Claim the slot without overriding local profile
        updatedMembers = updatedMembers.map(m => m === matchedName ? me : m);
        if (!isConfirmed) confirmed.push(me);
        await updateDoc(tripDocRef, { members: updatedMembers, confirmedMembers: confirmed });
        if (!isConfirmed && tData.owner && tData.owner !== me) { await addDoc(collection(db, "notifications"), { targetUser: tData.owner, message: `🎉 ${me} accepted your invite to "${tData.name}"!`, read: false, createdAt: new Date().toISOString() }); }
        showNoticeModal('Success', `You joined "${tData.name}"!`);
    } else {
        updatedMembers.push(me);
        if (!isConfirmed) confirmed.push(me);
        await updateDoc(tripDocRef, { members: updatedMembers, confirmedMembers: confirmed });
        if (!isConfirmed && tData.owner && tData.owner !== me) { await addDoc(collection(db, "notifications"), { targetUser: tData.owner, message: `🎉 ${me} joined your trip "${tData.name}"!`, read: false, createdAt: new Date().toISOString() }); }
        showNoticeModal('Success', `You have successfully joined "${tData.name}"!`);
    }

    if (modalToClose) modalToClose.classList.add('hidden');
    window.history.replaceState({}, document.title, window.location.pathname);
}

const joinModal = document.getElementById('join-trip-modal'); const btnOpenJoin = document.getElementById('btn-open-join'); const btnJoinCancel = document.getElementById('btn-join-cancel'); const btnJoinSubmit = document.getElementById('btn-join-submit'); const joinCodeInput = document.getElementById('join-code-input');

btnOpenJoin.addEventListener('click', () => { const me = getCurrentUser(); if (me === 'Guest') { showNoticeModal('Profile Required', 'Please set your Name in settings first!'); return; } joinCodeInput.value = ''; joinModal.classList.remove('hidden'); });
btnJoinCancel.addEventListener('click', () => { joinModal.classList.add('hidden'); });

btnJoinSubmit.addEventListener('click', async () => {
    const inviteCode = joinCodeInput.value.trim(); if (!inviteCode) { showNoticeModal('Error', 'Please enter a code.'); return; }
    let me = getCurrentUser(); btnJoinSubmit.textContent = 'Checking...'; btnJoinSubmit.disabled = true;
    try {
        const q = query(collection(db, "trips"), where("joinCode", "==", inviteCode)); const querySnapshot = await getDocs(q); let tripDocRef = null; let tData = null;
        if (!querySnapshot.empty) { tripDocRef = querySnapshot.docs[0].ref; tData = querySnapshot.docs[0].data(); }
        else { try { const docSnap = await getDoc(doc(db, "trips", inviteCode)); if (docSnap.exists()) { tripDocRef = docSnap.ref; tData = docSnap.data(); } } catch(err) { } }

        if (tripDocRef && tData) { await processJoin(tripDocRef, tData, me, joinModal); } else { showNoticeModal('Error', 'Invalid Trip Code. Please check and try again.'); }
    } catch (e) { showNoticeModal('Error', 'Network error.'); } finally { btnJoinSubmit.textContent = 'Join'; btnJoinSubmit.disabled = false; }
});

async function checkInvite() {
    const urlParams = new URLSearchParams(window.location.search); const inviteCode = urlParams.get('invite');
    if (inviteCode) {
        let me = getCurrentUser(); if (me === 'Guest') { showNoticeModal('Setup Profile Required', 'Please click the profile icon (top right) and enter your Name before joining a trip!'); return; }
        try {
            const q = query(collection(db, "trips"), where("joinCode", "==", inviteCode)); const querySnapshot = await getDocs(q); let tripDocRef = null; let tData = null;
            if (!querySnapshot.empty) { tripDocRef = querySnapshot.docs[0].ref; tData = querySnapshot.docs[0].data(); }
            else { try { const docSnap = await getDoc(doc(db, "trips", inviteCode)); if (docSnap.exists()) { tripDocRef = docSnap.ref; tData = docSnap.data(); } } catch(err) {} }

            if (tripDocRef && tData) {
                const existingMembers = tData.members || []; const lowerMe = me.toLowerCase().replace(/\s+/g, ''); let exactMatch = false; let matchedName = null;
                existingMembers.forEach(m => { if (m === me) exactMatch = true; else if (m.toLowerCase().replace(/\s+/g, '') === lowerMe) matchedName = m; });
                const isConfirmed = (tData.confirmedMembers || []).includes(me);
                
                if (exactMatch && isConfirmed) { window.history.replaceState({}, document.title, window.location.pathname); } 
                else {
                    const inviteModal = document.getElementById('invite-modal'); const ownerName = tData.owner || (tData.members && tData.members[0]) || 'someone';
                    document.getElementById('invite-message').innerHTML = `You've been invited to join<br><br><b style="color:white; font-size:1.3rem;">"${tData.name}"</b><br><br><span style="font-size:0.9rem;">Created by ${ownerName}</span>`;
                    inviteModal.classList.remove('hidden');
                    document.getElementById('btn-invite-accept').onclick = async () => {
                        document.getElementById('btn-invite-accept').textContent = 'Joining...';
                        await processJoin(tripDocRef, tData, me, inviteModal);
                    };
                    document.getElementById('btn-invite-cancel').onclick = () => { inviteModal.classList.add('hidden'); window.history.replaceState({}, document.title, window.location.pathname); };
                }
            } else { window.history.replaceState({}, document.title, window.location.pathname); }
        } catch(e) { }
    }
}

// Start sequence
loadTrips();
setupNotifications();
checkInvite();

// ==========================================
// 🌟 Home & Trip Events
// ==========================================
document.getElementById('btn-back-home').addEventListener('click', () => { navigateTo('page-home'); });
document.getElementById('fab-trip').addEventListener('click', () => { navigateTo('page-scanner'); });
document.getElementById('btn-cancel-scan').addEventListener('click', () => { navigateTo(currentTripMode ? 'page-trip' : 'page-home'); });

document.querySelectorAll('#paid-by-container').forEach(container => { container.addEventListener('click', function(e) { if(e.target.classList.contains('avatar-bubble')) { container.querySelectorAll('.avatar-bubble').forEach(x => x.classList.remove('active')); e.target.classList.add('active'); } }); });
document.querySelectorAll('#split-between-container').forEach(container => { container.addEventListener('click', function(e) { if(e.target.classList.contains('checkable')) { e.target.classList.toggle('active'); } }); });

// ==========================================
// 🌟 TRIP LOGIC 
// ==========================================
const btnAddTrip = document.getElementById('btn-add-trip'); const newTripModal = document.getElementById('new-trip-modal'); const btnNewTripCancel = document.getElementById('btn-new-trip-cancel'); const btnNewTripSave = document.getElementById('btn-new-trip-save'); const newTripNameInput = document.getElementById('new-trip-name'); const newTripStartInput = document.getElementById('new-trip-start'); const newTripEndInput = document.getElementById('new-trip-end'); const newMemberInput = document.getElementById('new-member-input'); const btnAddMember = document.getElementById('btn-add-member'); const newTripMembersList = document.getElementById('new-trip-members-list'); const tripModalTitle = document.getElementById('trip-modal-title');
let currentNewTripMembers = [getCurrentUser()]; 
function renderNewTripMembers() { newTripMembersList.innerHTML = ''; currentNewTripMembers.forEach(member => { const bubble = document.createElement('div'); bubble.className = 'avatar-bubble'; bubble.style.display = 'flex'; bubble.style.alignItems = 'center'; bubble.innerHTML = `${member} <span class="remove-btn" style="color: #ff4444; margin-left: 8px; font-size: 1.2rem; cursor: pointer; line-height: 1;">×</span>`; bubble.querySelector('.remove-btn').addEventListener('click', () => { currentNewTripMembers = currentNewTripMembers.filter(m => m !== member); renderNewTripMembers(); }); newTripMembersList.appendChild(bubble); }); }
btnAddMember.addEventListener('click', () => { const name = newMemberInput.value.trim(); if (name && !currentNewTripMembers.includes(name)) { currentNewTripMembers.push(name); newMemberInput.value = ''; renderNewTripMembers(); } }); newMemberInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') btnAddMember.click(); });
btnAddTrip.addEventListener('click', () => { tripModalTitle.textContent = 'Create New Trip'; newTripNameInput.value = ''; newMemberInput.value = ''; currentNewTripMembers = [getCurrentUser()]; renderNewTripMembers(); currentTripId = null; newTripModal.classList.remove('hidden'); });
btnNewTripCancel.addEventListener('click', () => { newTripModal.classList.add('hidden'); });

document.getElementById('btn-invite-member').addEventListener('click', async (e) => {
    e.preventDefault(); let targetTripId = currentTripId; let targetTripName = newTripNameInput.value.trim();
    let targetJoinCode = currentTripData ? currentTripData.joinCode : null;

    if (tripModalTitle.textContent === 'Create New Trip' || !targetTripId) {
        if (!targetTripName) { showNoticeModal('Error', 'Please enter a Trip Name first!'); return; }
        const btnInvite = document.getElementById('btn-invite-member'); const originalText = btnInvite.innerHTML; btnInvite.innerHTML = 'Generating...';
        targetJoinCode = Math.floor(100000 + Math.random() * 900000).toString();
        const tripData = { name: targetTripName, startDate: newTripStartInput.value, endDate: newTripEndInput.value, members: currentNewTripMembers, owner: getCurrentUser(), joinCode: targetJoinCode, createdAt: new Date().toISOString() };
        try { const docRef = await addDoc(collection(db, "trips"), tripData); targetTripId = docRef.id; currentTripId = docRef.id; currentTripData = tripData; tripModalTitle.textContent = 'Edit Trip'; } catch (err) { btnInvite.innerHTML = originalText; return; } btnInvite.innerHTML = originalText;
    } else if (!targetJoinCode) {
        targetJoinCode = Math.floor(100000 + Math.random() * 900000).toString();
        await updateDoc(doc(db, "trips", targetTripId), { joinCode: targetJoinCode }); currentTripData.joinCode = targetJoinCode;
    }

    const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${targetJoinCode}`;
    const shareText = `✈️ Join my trip "${targetTripName}" on TripSplit!\n\nOpen the App and tap the 🤝 icon to enter this 6-digit Code:\n\n👉 **${targetJoinCode}**\n\nOr click here to join in browser:\n${inviteUrl}`;
    if (navigator.share) { try { await navigator.share({ title: 'Join my Trip', text: shareText }); } catch(err){} } else { navigator.clipboard.writeText(shareText).then(() => { showNoticeModal('Invite Copied!', 'Send this code to your friends.'); }); }
});

btnNewTripSave.addEventListener('click', async () => {
    const tripName = newTripNameInput.value.trim(); if (!tripName) { showNoticeModal('Error', '大佬，打個 Trip Name 先啦！'); return; } if (currentNewTripMembers.length === 0) { showNoticeModal('Error', '起碼要有自己一個 Member 啦！'); return; }
    btnNewTripSave.disabled = true; btnNewTripSave.textContent = 'Saving...';
    let targetJoinCode = currentTripData ? currentTripData.joinCode : Math.floor(100000 + Math.random() * 900000).toString();
    const tripData = { name: tripName, startDate: newTripStartInput.value, endDate: newTripEndInput.value, members: currentNewTripMembers, owner: getCurrentUser(), joinCode: targetJoinCode, createdAt: currentTripData && tripModalTitle.textContent === 'Edit Trip' ? currentTripData.createdAt : new Date().toISOString() };
    try { if (tripModalTitle.textContent === 'Edit Trip') { await updateDoc(doc(db, "trips", currentTripId), tripData); document.getElementById('trip-header-title').textContent = tripData.name; currentTripData = tripData; updateAssignmentModalMembers(tripData.members); } else { await addDoc(collection(db, "trips"), tripData); } newTripModal.classList.add('hidden'); } catch (e) { showNoticeModal('Error', 'Save failed!'); } finally { btnNewTripSave.disabled = false; btnNewTripSave.textContent = 'Save Trip'; }
});

function renderTripCard(id, data) {
    const tripList = document.getElementById('trip-list-container'); const msg = tripList.querySelector('div[style*="text-align: center"]'); if (msg) msg.remove();
    const colors = [['#1e3a8a', '#0f172a'], ['#831843', '#0f172a'], ['#064e3b', '#0f172a'], ['#450a0a', '#0f172a']]; const randomColor = colors[Math.floor(Math.random() * colors.length)]; const startObj = new Date(data.startDate); const endObj = new Date(data.endDate); const dateDisplay = `${startObj.toLocaleString('en-US', {month: 'short'})} ${startObj.getDate()} - ${endObj.toLocaleString('en-US', {month: 'short'})} ${endObj.getDate()}`;
    const wrapper = document.createElement('div'); wrapper.className = 'trip-item-wrapper'; const actionBg = document.createElement('div'); actionBg.className = 'trip-item-action-bg';
    
    // 🛡️ Safe Case-Insensitive Check
    const me = getCurrentUser(); const lowerMe = me.toLowerCase().replace(/\s+/g, '');
    const tripOwner = data.owner || (data.members && data.members[0]) || 'Unknown'; 
    const isOwner = tripOwner.toLowerCase().replace(/\s+/g, '') === lowerMe;

    if (isOwner) {
        actionBg.innerHTML = `<div class="action-edit">Edit</div><div class="action-delete">Delete</div>`;
        actionBg.querySelector('.action-delete').addEventListener('click', () => { const card = wrapper.querySelector('.trip-card'); card.classList.add('swiped-left'); showConfirmModal(`Delete Trip "${data.name}"?\nAll expenses inside will be lost!`, async () => { try { await deleteDoc(doc(db, "trips", id)); wrapper.remove(); } catch(e) { alert('Delete fail!'); } }); });
        actionBg.querySelector('.action-edit').addEventListener('click', () => { currentTripData = data; currentTripId = id; document.getElementById('trip-modal-title').textContent = 'Edit Trip'; document.getElementById('new-trip-name').value = data.name; document.getElementById('new-trip-start').value = data.startDate; document.getElementById('new-trip-end').value = data.endDate; currentNewTripMembers = [...data.members]; renderNewTripMembers(); document.getElementById('new-trip-modal').classList.remove('hidden'); });
    } else { actionBg.innerHTML = `<div style="width:100%; display:flex; justify-content:center; align-items:center; color:var(--text-dim); font-size:0.9rem;">Only ${tripOwner} can edit this trip</div>`; }

    const newCard = document.createElement('div'); newCard.className = 'trip-card'; newCard.innerHTML = `<div class="trip-bg" style="background: linear-gradient(135deg, ${randomColor[0]}, ${randomColor[1]});"></div><div class="trip-content"><h2>${data.name}</h2><p>${data.members.length} Members • ${dateDisplay}</p></div>`;
    if (isOwner) { setupSwipeActions(newCard); }
    newCard.addEventListener('click', (e) => { if (newCard.getAttribute('data-swiping') === 'true') return; currentTripMode = data.name; currentTripId = id; currentTripData = data; document.getElementById('trip-header-title').textContent = data.name; updateAssignmentModalMembers(data.members); loadExpenses(id); navigateTo('page-trip'); });
    wrapper.appendChild(actionBg); wrapper.appendChild(newCard); tripList.appendChild(wrapper);
}

function updateAssignmentModalMembers(membersArray) {
    const paidByContainer = document.getElementById('paid-by-container'); const splitContainer = document.getElementById('split-between-container'); paidByContainer.innerHTML = ''; splitContainer.innerHTML = ''; 
    const me = getCurrentUser(); const lowerMe = me.toLowerCase().replace(/\s+/g, '');
    membersArray.forEach((member, index) => {
        const isMe = member.toLowerCase().replace(/\s+/g, '') === lowerMe; 
        const paidBubble = document.createElement('div'); paidBubble.className = `avatar-bubble ${isMe || (index === 0 && !membersArray.some(m => m.toLowerCase().replace(/\s+/g, '') === lowerMe)) ? 'active' : ''}`; paidBubble.textContent = member; paidByContainer.appendChild(paidBubble);
        const splitBubble = document.createElement('div'); splitBubble.className = 'avatar-bubble checkable active'; splitBubble.textContent = member; splitContainer.appendChild(splitBubble);
    });
}

// ==========================================
// 🌟 BASIC MANUAL EXPENSE LOGIC
// ==========================================
const btnManualAdd = document.getElementById('btn-manual-add'); const basicExpenseModal = document.getElementById('basic-expense-modal'); const btnBasicCancel = document.getElementById('btn-basic-cancel'); const btnBasicSave = document.getElementById('btn-basic-save'); const basicExpenseTitle = document.getElementById('basic-expense-title'); const basicExpenseAmount = document.getElementById('basic-expense-amount'); const basicPaidByContainer = document.getElementById('basic-paid-by-container'); const expenseModalTitle = document.getElementById('expense-modal-title');
btnManualAdd.addEventListener('click', () => { if (!currentTripId) return; editingExpenseId = null; expenseModalTitle.textContent = 'Add Expense'; basicExpenseTitle.value = ''; basicExpenseAmount.value = ''; const originalPaidBy = document.getElementById('paid-by-container').innerHTML; basicPaidByContainer.innerHTML = originalPaidBy; basicPaidByContainer.querySelectorAll('.avatar-bubble').forEach(bubble => { bubble.addEventListener('click', function() { basicPaidByContainer.querySelectorAll('.avatar-bubble').forEach(x => x.classList.remove('active')); this.classList.add('active'); }); }); basicExpenseModal.classList.remove('hidden'); });
btnBasicCancel.addEventListener('click', () => { basicExpenseModal.classList.add('hidden'); });
btnBasicSave.addEventListener('click', async () => {
    const title = basicExpenseTitle.value.trim() || 'Untitled Expense'; const amount = parseFloat(basicExpenseAmount.value); if (isNaN(amount) || amount <= 0) { showNoticeModal('Error', '大佬，打返個有效嘅銀碼先啦！'); return; }
    const activePayer = basicPaidByContainer.querySelector('.avatar-bubble.active'); const payerName = activePayer ? activePayer.textContent.trim() : 'Unknown'; const allMembers = Array.from(basicPaidByContainer.querySelectorAll('.avatar-bubble')).map(b => b.textContent.trim()); const splitCount = allMembers.length || 1;
    btnBasicSave.disabled = true; btnBasicSave.textContent = 'Saving...'; const expenseData = { title: title, amount: amount, paidBy: payerName, splitBetween: allMembers, splitCount: splitCount, createdAt: new Date().toISOString() };
    try { if (editingExpenseId) { await updateDoc(doc(db, `trips/${currentTripId}/expenses`, editingExpenseId), expenseData); } else { await addDoc(collection(db, `trips/${currentTripId}/expenses`), expenseData); } basicExpenseModal.classList.add('hidden'); loadExpenses(currentTripId); } catch (e) { showNoticeModal('Error', 'Save error'); } finally { btnBasicSave.disabled = false; btnBasicSave.textContent = 'Save'; }
});

// ==========================================
// 🌟 SCANNER / OCR / ORB LOGIC
// ==========================================
const btnSnap = document.getElementById('btn-snap'); const cameraInput = document.getElementById('camera-input'); const resultOrb = document.getElementById('result-orb'); const perPersonAmountDisplay = document.getElementById('per-person-amount'); const btnNext = document.getElementById('btn-next'); const btnDone = document.getElementById('btn-done'); const manualSubtotalInput = document.getElementById('manual-subtotal'); const manualTaxInput = document.getElementById('manual-tax'); const taxLabel = document.getElementById('tax-label'); const btnSettings = document.getElementById('btn-settings'); const settingsModal = document.getElementById('settings-modal'); const settingsNameInput = document.getElementById('settings-name-input'); const settingsVenmoInput = document.getElementById('settings-venmo-input'); const settingsZelleInput = document.getElementById('settings-zelle-input'); const btnSettingsSave = document.getElementById('btn-settings-save'); const btnSettingsCancel = document.getElementById('btn-settings-cancel');
const btnInfo = document.getElementById('btn-info'); const infoModal = document.getElementById('info-modal'); const btnInfoClose = document.getElementById('btn-info-close'); const debugEnv = document.getElementById('debug-env');
function triggerInfoModal(e) { if(e) e.preventDefault(); const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches; debugEnv.textContent = isStandalone ? "📱 PWA Standalone (App)" : "🌐 Standard Browser"; infoModal.classList.remove('hidden'); }
if (btnInfo && infoModal && btnInfoClose) { btnInfo.addEventListener('click', triggerInfoModal); btnInfo.addEventListener('touchstart', triggerInfoModal, {passive: false}); btnInfoClose.addEventListener('click', (e) => { e.preventDefault(); infoModal.classList.add('hidden'); }); btnInfoClose.addEventListener('touchstart', (e) => { e.preventDefault(); infoModal.classList.add('hidden'); }, {passive: false}); }

const assignmentModal = document.getElementById('assignment-modal'); const btnAssignmentCancel = document.getElementById('btn-assignment-cancel'); const btnAssignmentSave = document.getElementById('btn-assignment-save'); const expenseTitleInput = document.getElementById('expense-title'); const cropModal = document.getElementById('crop-modal'); const cropImage = document.getElementById('crop-image'); const btnCropCancel = document.getElementById('btn-crop-cancel'); const btnCropConfirm = document.getElementById('btn-crop-confirm');
let cropper = null; let scannedSubtotal = 0.00; let scannedTax = 0.00; let currentGrandTotal = 0.00; let currentPerPerson = 0.00; let lastScannedImageFile = null; let globalTipValue = 5; let globalSplitValue = 1;

function calculateAndRender() {
    const sub = parseFloat(manualSubtotalInput.value) || 0; const tax = parseFloat(manualTaxInput.value) || 0; scannedSubtotal = sub; scannedTax = tax;
    if (sub > 0 && tax > 0) { const taxPercent = (tax / sub) * 100; taxLabel.textContent = `Tax (${taxPercent.toFixed(1)}%)`; } else { taxLabel.textContent = 'Tax'; }
    const tipAmount = scannedSubtotal * (globalTipValue / 100); currentGrandTotal = scannedSubtotal + scannedTax + tipAmount; currentPerPerson = currentGrandTotal / globalSplitValue;     
    const displayStr = currentGrandTotal === 0 ? `$0.00` : `$${currentPerPerson.toFixed(2)}`; perPersonAmountDisplay.textContent = displayStr;
    const textLen = displayStr.length; if (textLen > 8) { perPersonAmountDisplay.style.fontSize = '2.8rem'; } else if (textLen > 6) { perPersonAmountDisplay.style.fontSize = '3.5rem'; } else { perPersonAmountDisplay.style.fontSize = '4.5rem'; }
    currentGrandTotal > 0 ? resultOrb.classList.remove('inactive') : resultOrb.classList.add('inactive');
}
manualSubtotalInput.addEventListener('input', function() { autoResizeInput(this); calculateAndRender(); }); manualTaxInput.addEventListener('input', function() { autoResizeInput(this); calculateAndRender(); });

function setupCircularDial(wrapperId, ringId, thumbId, displayId, min, max, step, initialValue, isPercent, onChangeCallback) {
    const wrapper = document.getElementById(wrapperId); const ring = document.getElementById(ringId); const thumb = document.getElementById(thumbId); const display = document.getElementById(displayId);
    let currentValue = initialValue; const r = 38; const cx = 50; const cy = 50; const circumference = 2 * Math.PI * r; const arcDegrees = 270; const arcLength = circumference * (arcDegrees / 360); ring.style.strokeDasharray = `${arcLength} ${circumference}`;
    function updateUI(val) { const percentage = (val - min) / (max - min); const offset = arcLength - (percentage * arcLength); ring.style.strokeDashoffset = offset; const svgAngleRad = (percentage * arcDegrees) * (Math.PI / 180); thumb.setAttribute('cx', cx + r * Math.cos(svgAngleRad)); thumb.setAttribute('cy', cy + r * Math.sin(svgAngleRad)); display.textContent = val + (isPercent ? '%' : ''); onChangeCallback(val); }
    let isDragging = false; function handlePointer(e) { if (!isDragging && e.type !== 'pointerdown' && e.type !== 'touchstart') return; e.preventDefault(); const rect = wrapper.getBoundingClientRect(); const centerX = rect.left + rect.width / 2; const centerY = rect.top + rect.height / 2; const clientX = e.clientX || (e.touches && e.touches[0].clientX); const clientY = e.clientY || (e.touches && e.touches[0].clientY); if(clientX === undefined || clientY === undefined) return; const dx = clientX - centerX; const dy = clientY - centerY; let angle = Math.atan2(dy, dx) * (180 / Math.PI); if (angle < 0) angle += 360; let adjustedAngle = angle; if (angle < 135) adjustedAngle += 360; let percentage = (adjustedAngle - 135) / arcDegrees; if (percentage < 0) { if (adjustedAngle < 135) percentage = 0; } if (percentage > 1) { if (adjustedAngle > 135 + arcDegrees) percentage = 1; } percentage = Math.max(0, Math.min(1, percentage)); let val = min + percentage * (max - min); val = Math.round(val / step) * step; val = Math.max(min, Math.min(max, val)); if (val !== currentValue) { currentValue = val; updateUI(currentValue); } }
    wrapper.addEventListener('pointerdown', (e) => { isDragging = true; handlePointer(e); wrapper.setPointerCapture(e.pointerId); }); wrapper.addEventListener('pointermove', handlePointer); wrapper.addEventListener('pointerup', (e) => { isDragging = false; wrapper.releasePointerCapture(e.pointerId); }); wrapper.addEventListener('pointercancel', () => { isDragging = false; }); wrapper.addEventListener('touchstart', (e) => { isDragging = true; handlePointer(e); }, {passive: false}); wrapper.addEventListener('touchmove', handlePointer, {passive: false}); wrapper.addEventListener('touchend', () => { isDragging = false; }); updateUI(currentValue); return { setValue: (val) => { currentValue = val; updateUI(val); } };
}

const tipDialControl = setupCircularDial('tip-wrapper', 'tip-ring', 'tip-thumb', 'tip-display', 5, 30, 5, 5, true, (val) => { globalTipValue = val; calculateAndRender(); }); const splitDialControl = setupCircularDial('split-wrapper', 'split-ring', 'split-thumb', 'split-display', 1, 20, 1, 1, false, (val) => { globalSplitValue = val; calculateAndRender(); });

settingsNameInput.value = localStorage.getItem('billapp_user_name') || ''; settingsVenmoInput.value = localStorage.getItem('billapp_venmo_id') || ''; settingsZelleInput.value = localStorage.getItem('billapp_zelle_id') || '';
btnSettings.addEventListener('click', () => { settingsNameInput.value = localStorage.getItem('billapp_user_name') || ''; settingsVenmoInput.value = localStorage.getItem('billapp_venmo_id') || ''; settingsZelleInput.value = localStorage.getItem('billapp_zelle_id') || ''; settingsModal.classList.remove('hidden'); });
btnSettingsCancel.addEventListener('click', () => settingsModal.classList.add('hidden'));
btnSettingsSave.addEventListener('click', () => { localStorage.setItem('billapp_user_name', settingsNameInput.value.trim()); localStorage.setItem('billapp_venmo_id', settingsVenmoInput.value.trim()); localStorage.setItem('billapp_zelle_id', settingsZelleInput.value.trim()); settingsModal.classList.add('hidden'); showNoticeModal('Profile Saved', ''); loadTrips(); /* 🌟 Refresh in case name change affects view */ });

btnSnap.addEventListener('click', () => cameraInput.click()); btnCropCancel.addEventListener('click', () => { cropModal.classList.add('hidden'); if (cropper) cropper.destroy(); cameraInput.value = ''; });
cameraInput.addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { cropImage.src = e.target.result; cropModal.classList.remove('hidden'); if (cropper) cropper.destroy(); cropper = new Cropper(cropImage, { viewMode: 1, dragMode: 'crop', autoCropArea: 0.8, restore: false, guides: true, center: true, highlight: false, cropBoxMovable: true, cropBoxResizable: true, toggleDragModeOnDblclick: false }); }; reader.readAsDataURL(file); });
const originalApertureSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="14.31" y1="8" x2="20.05" y2="17.94"></line><line x1="9.69" y1="8" x2="21.17" y2="8"></line><line x1="7.38" y1="12" x2="13.12" y2="2.06"></line><line x1="9.69" y1="16" x2="3.95" y2="6.06"></line><line x1="14.31" y1="16" x2="2.83" y2="16"></line><line x1="16.62" y1="12" x2="10.88" y2="21.94"></line></svg>`;

btnCropConfirm.addEventListener('click', async () => {
    if (!cropper) return;
    cropper.getCroppedCanvas({ maxWidth: 1024, maxHeight: 1024 }).toBlob(async (blob) => {
        cropModal.classList.add('hidden'); cropper.destroy(); lastScannedImageFile = new File([blob], 'receipt.jpg', { type: 'image/jpeg' }); btnSnap.classList.add('scanning'); btnSnap.style.pointerEvents = 'none';
        try {
            const result = await window.Tesseract.recognize(blob, 'eng'); let cleanText = result.data.text.replace(/(\d+)\s*[_\.,]\s*(\d+)/g, "$1.$2").replace(/\d+(?:\.\d+)?\s*%/g, ""); const allAmounts = [...cleanText.matchAll(/\b\d{1,4}(?:,\d{3})*\.\d{2}\b/g)].map(m => parseFloat(m[0].replace(',', ''))).sort((a, b) => b - a); let finalSub = 0, finalTax = 0, finalTotal = 0;
            const splitMatch = cleanText.match(/subtotal|taxable value|net|surtax|\btax\b|vat|total amount|\btotal\b/i);
            if (splitMatch && allAmounts.length > 0) { const itemAmounts = [...cleanText.substring(0, splitMatch.index).matchAll(/\b\d{1,4}(?:,\d{3})*\.\d{2}\b/g)].map(m => parseFloat(m[0].replace(',', ''))); const sumSubtotal = itemAmounts.reduce((a, b) => a + b, 0); const maxTotal = allAmounts[0]; const diffTax = maxTotal - sumSubtotal; if (sumSubtotal > 0 && diffTax >= 0 && diffTax < sumSubtotal * 0.3) { finalSub = sumSubtotal; finalTax = diffTax; finalTotal = maxTotal; } }
            if (finalSub === 0) { for (let i = 0; i < allAmounts.length; i++) { for (let j = i + 1; j < allAmounts.length; j++) { for (let k = j + 1; k < allAmounts.length; k++) { let c = allAmounts[i], a = allAmounts[j], b = allAmounts[k]; if (Math.abs((a + b) - c) < 0.05 && b < a * 0.3) { finalTotal = c; finalSub = a; finalTax = b; break; } } if (finalTotal) break; } if (finalTotal) break; } }
            if (finalSub === 0) {
                const subMatch = cleanText.match(/(?:subtotal|taxable value|net)[^\n\r]{0,40}?(\d{1,4}(?:,\d{3})*\.\d{2})/i); const taxMatch = cleanText.match(/(?:surtax|\btax\b|vat)[^\n\r]{0,40}?(\d{1,4}(?:,\d{3})*\.\d{2})/i); const totalMatch = cleanText.match(/(?:total amount|\btotal\b)[^\n\r]{0,40}?(\d{1,4}(?:,\d{3})*\.\d{2})/i);
                let parsedSub = subMatch ? parseFloat(subMatch[1].replace(',', '')) : 0; let parsedTax = taxMatch ? parseFloat(taxMatch[1].replace(',', '')) : 0; let parsedTotal = totalMatch ? parseFloat(totalMatch[1].replace(',', '')) : 0;
                if (parsedSub > 0 && parsedTax > 0) { finalSub = parsedSub; finalTax = parsedTax; finalTotal = parsedSub + parsedTax; } else if (parsedTotal > 0 && parsedSub > 0 && parsedSub < parsedTotal) { finalTotal = parsedTotal; finalSub = parsedSub; finalTax = parsedTotal - parsedSub; } else if (parsedTotal > 0 && parsedTax > 0 && parsedTax < parsedTotal * 0.3) { finalTotal = parsedTotal; finalTax = parsedTax; finalSub = parsedTotal - parsedTax; } else if (parsedSub > 0) { finalSub = parsedSub; finalTax = parsedTax; } else if (parsedTotal > 0) { finalTotal = parsedTotal; finalSub = parsedTotal; finalTax = 0; }
            }
            if (finalSub > 0 || finalTotal > 0) { if (finalSub === 0 && finalTotal > 0) finalSub = finalTotal; manualSubtotalInput.value = Math.abs(parseFloat(finalSub.toFixed(2))); manualTaxInput.value = Math.abs(parseFloat(finalTax.toFixed(2))); autoResizeInput(manualSubtotalInput); autoResizeInput(manualTaxInput); calculateAndRender(); } else { lastScannedImageFile = null; showNoticeModal('No Amount Found', 'Please try cropping closer to the Subtotal and Tax.'); }
        } catch (error) { showNoticeModal('Error', 'Recognition failed. Try again.'); } finally { btnSnap.innerHTML = originalApertureSVG; btnSnap.classList.remove('scanning'); btnSnap.style.pointerEvents = 'auto'; cameraInput.value = ''; }
    }, 'image/jpeg'); 
});

btnNext.addEventListener('click', async () => {
    if (currentGrandTotal === 0) { showNoticeModal('Empty Bill', ''); return; }
    if (currentTripMode) { expenseTitleInput.value = ''; assignmentModal.classList.remove('hidden'); } else {
        const userName = localStorage.getItem('billapp_user_name') || 'Me'; const shareText = `🍽️ ${userName} shared a bill\n\n🔹 Subtotal: $${scannedSubtotal.toFixed(2)}\n🔹 Tax: $${scannedTax.toFixed(2)}\n🔹 Tip (${globalTipValue}%): $${(scannedSubtotal * (globalTipValue / 100)).toFixed(2)}\n💰 Total: $${currentGrandTotal.toFixed(2)}\n\n👥 Split: ${globalSplitValue} ppl\n👉 Per Person: $${currentPerPerson.toFixed(2)}`;
        if (navigator.share) { try { await navigator.share({ title: `${userName}'s Bill`, text: shareText }); } catch (e) {} } else { navigator.clipboard.writeText(shareText).then(() => { showNoticeModal('Copied', 'Details copied to clipboard.'); }); }
    }
});

btnAssignmentCancel.addEventListener('click', () => { assignmentModal.classList.add('hidden'); });
btnAssignmentSave.addEventListener('click', async () => {
    const title = expenseTitleInput.value.trim() || 'Untitled Expense'; const activePayer = document.querySelector('#paid-by-container .avatar-bubble.active'); const payerName = activePayer ? activePayer.innerText : 'Unknown';
    const splitNodes = document.querySelectorAll('#split-between-container .avatar-bubble.active'); const splitCount = splitNodes.length || 1; let splitArray = []; splitNodes.forEach(n => splitArray.push(n.innerText));
    const expenseData = { title: title, amount: currentGrandTotal, paidBy: payerName, splitBetween: splitArray, splitCount: splitCount, createdAt: new Date().toISOString() };
    try { await addDoc(collection(db, `trips/${currentTripId}/expenses`), expenseData); assignmentModal.classList.add('hidden'); manualSubtotalInput.value = ''; manualTaxInput.value = ''; autoResizeInput(manualSubtotalInput); autoResizeInput(manualTaxInput); calculateAndRender(); navigateTo('page-trip'); loadExpenses(currentTripId); } catch (e) { showNoticeModal('Error', 'Failed to save expense to DB'); }
});

btnDone.addEventListener('click', () => { manualSubtotalInput.value = ''; manualTaxInput.value = ''; autoResizeInput(manualSubtotalInput); autoResizeInput(manualTaxInput); lastScannedImageFile = null; tipDialControl.setValue(5); splitDialControl.setValue(1); if (!currentTripMode) navigateTo('page-home'); });
autoResizeInput(manualSubtotalInput); autoResizeInput(manualTaxInput); calculateAndRender();