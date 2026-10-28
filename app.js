const SUPABASE_URL = 'https://app.tech4ag.my';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYzMzczNjQ1LCJleHAiOjIwNzg3MzM2NDV9.vZOedqJzUn01PjwfaQp7VvRzSm4aRMr21QblPDK8AoY';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allData = []; 
let personProfilesMap = new Map();
let typingTimer;
const doneTypingInterval = 400;
let realtimeSubscription = null;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const resetSearchBtn = document.getElementById('resetSearchBtn');
const resultsContainer = document.getElementById('resultsContainer');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const initialState = document.getElementById('initialState');

const rsvpModal = document.getElementById('rsvpModal');
const modalTitle = document.getElementById('modalTitle');
const modalRecipientName = document.getElementById('modalRecipientName');
const modalRecipientId = document.getElementById('modalRecipientId');
const modalRecipientSekolah = document.getElementById('modalRecipientSekolah');
const modalMode = document.getElementById('modalMode');
const cancelRsvpBtn = document.getElementById('cancelRsvpBtn');
const saveRsvpBtn = document.getElementById('saveRsvpBtn');

document.addEventListener('DOMContentLoaded', fetchAllData);

if (searchInput) {
    searchInput.addEventListener('input', function (e) {
        e.target.value = e.target.value.toUpperCase();
        
        if (e.target.value.trim().length > 0) {
            resetSearchBtn.classList.remove('hidden');
        } else {
            resetSearchBtn.classList.add('hidden');
        }

        clearTimeout(typingTimer);
        typingTimer = setTimeout(processSearch, doneTypingInterval);
    });

    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            clearSearch();
        }
    });
}

if (resetSearchBtn) resetSearchBtn.addEventListener('click', clearSearch);
if (cancelRsvpBtn) cancelRsvpBtn.addEventListener('click', closeRsvpModal);
if (saveRsvpBtn) saveRsvpBtn.addEventListener('click', saveRsvp);

function clearSearch() {
    if (searchInput) searchInput.value = '';
    if (resetSearchBtn) resetSearchBtn.classList.add('hidden');
    processSearch();
    if (searchInput) searchInput.focus();
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getPersonKey(nama, sekolah) {
    return `${(nama || '').trim().toUpperCase()}|||${(sekolah || '').trim().toUpperCase()}`;
}

function showError(msg) {
    if (!errorText || !errorMessage) return;
    errorText.textContent = msg;
    errorMessage.classList.remove('hidden');
    setTimeout(() => {
        if (errorMessage) errorMessage.classList.add('hidden');
    }, 5000);
}

function sortAllData(data) {
    data.sort((a, b) => {
        const mejaA = a.no_meja ? a.no_meja.toString().toUpperCase().replace(/^MEJA\s*/, '').trim() : '';
        const mejaB = b.no_meja ? b.no_meja.toString().toUpperCase().replace(/^MEJA\s*/, '').trim() : '';
        
        const cmp = mejaA.localeCompare(mejaB, undefined, { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) return cmp;
        
        return (parseInt(a.bil) || 0) - (parseInt(b.bil) || 0);
    });

    data.sort((a, b) => {
        const sekA = a.sekolah ? a.sekolah.toUpperCase() : '';
        const sekB = b.sekolah ? b.sekolah.toUpperCase() : '';
        return sekA.localeCompare(sekB);
    });
}

function buildPersonProfiles(dataset) {
    const map = new Map();
    dataset.forEach(r => {
        const key = getPersonKey(r.nama, r.sekolah);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(r);
    });

    const profiles = new Map();
    map.forEach((records, key) => {
        records.sort((a, b) => {
            const mejaA = a.no_meja ? a.no_meja.toString().toUpperCase().replace(/^MEJA\s*/, '').trim() : '';
            const mejaB = b.no_meja ? b.no_meja.toString().toUpperCase().replace(/^MEJA\s*/, '').trim() : '';
            
            const cmp = mejaA.localeCompare(mejaB, undefined, { numeric: true, sensitivity: 'base' });
            if (cmp !== 0) return cmp;
            
            return (parseInt(a.bil) || 0) - (parseInt(b.bil) || 0);
        });
        
        const primaryRecord = records[0];
        let primaryTable = primaryRecord.no_meja;
        if (!primaryTable || primaryTable.trim() === '') {
            const fallback = records.find(r => r.no_meja && r.no_meja.trim() !== '');
            primaryTable = fallback ? fallback.no_meja : '-';
        }

        profiles.set(key, {
            nama: primaryRecord.nama,
            sekolah: primaryRecord.sekolah,
            primaryBil: primaryRecord.bil,
            primaryTable: primaryTable,
            allRecords: records,
            totalAwards: records.length,
            rsvpStatus: primaryRecord.rsvp_status || 'BELUM SAH',
            rsvpTime: primaryRecord.rsvp_time
        });
    });
    return profiles;
}

function setupRealtimeSubscription() {
    if (realtimeSubscription) {
        supabaseClient.removeChannel(realtimeSubscription);
        realtimeSubscription = null;
    }

    realtimeSubscription = supabaseClient
        .channel('realtime:recipients:app')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'recipients' },
            (payload) => {
                handleRealtimeUpdate(payload);
            }
        )
        .subscribe();
}

function handleRealtimeUpdate(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
        if (!allData.some(r => r.id === newRecord.id)) {
            allData.push(newRecord);
            sortAllData(allData);
            personProfilesMap = buildPersonProfiles(allData);
            processSearch();
        }
    } else if (eventType === 'UPDATE') {
        const index = allData.findIndex(r => r.id === newRecord.id);
        if (index !== -1) {
            allData[index] = { ...allData[index], ...newRecord };
        } else {
            allData.push(newRecord);
        }
        sortAllData(allData);
        personProfilesMap = buildPersonProfiles(allData);
        processSearch();
    } else if (eventType === 'DELETE') {
        allData = allData.filter(r => r.id !== oldRecord.id);
        personProfilesMap = buildPersonProfiles(allData);
        processSearch();
    }
}

async function fetchAllData() {
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    if (initialState) initialState.classList.add('hidden');
    
    try {
        const { data, error } = await supabaseClient
            .from('recipients')
            .select('*');

        if (error) throw error;
        allData = data || [];

        sortAllData(allData);
        personProfilesMap = buildPersonProfiles(allData);
        processSearch();

        setupRealtimeSubscription();
    } catch (error) {
        console.error("Fetch Error:", error);
        showError("Gagal memuat turun maklumat. Sila muat semula laman.");
    } finally {
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
    }
}

function processSearch() {
    const query = searchInput ? searchInput.value.trim().toUpperCase() : '';
    
    if (query.length < 3) {
        if (resultsContainer) resultsContainer.innerHTML = '';
        if (initialState) initialState.classList.remove('hidden');
        if (query.length > 0 && query.length < 3 && resultsContainer) {
            resultsContainer.innerHTML = `<div class="text-center text-gray-500 py-8 text-sm">Sila masukkan sekurang-kurangnya 3 aksara untuk carian...</div>`;
        }
        return;
    }

    if (initialState) initialState.classList.add('hidden');
    
    const qNum = parseInt(query);
    const queryCleanTable = query.replace(/^MEJA\s*/i, '').trim();

    const filteredData = allData.filter(r => {
        const nameMatch = r.nama && r.nama.toUpperCase().includes(query);
        const schoolMatch = r.sekolah && r.sekolah.toUpperCase().includes(query);
        const bilMatch = !isNaN(qNum) && r.bil === qNum;
        const tableStr = r.no_meja ? r.no_meja.toString().toUpperCase() : '';
        const tableMatch = tableStr !== '' && (
            tableStr.includes(query) ||
            (queryCleanTable !== '' && tableStr === queryCleanTable) ||
            (queryCleanTable !== '' && tableStr === `MEJA ${queryCleanTable}`)
        );
        return nameMatch || schoolMatch || bilMatch || tableMatch;
    });
    
    renderResults(filteredData, query);
}

function renderResults(recipients, query) {
    if (!resultsContainer) return;
    
    if (!recipients || recipients.length === 0) {
        resultsContainer.innerHTML = `
            <div class="bg-yellow-50 border border-yellow-200 p-6 rounded-xl text-center shadow-sm">
                <svg class="w-10 h-10 text-yellow-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                <p class="text-lg text-yellow-800 font-bold mb-1">Tiada Rekod Dijumpai</p>
                <p class="text-sm text-yellow-700">Tiada padanan untuk carian: "${escapeHtml(query)}"</p>
            </div>`;
        return;
    }

    const groupedBySchool = recipients.reduce((acc, recipient) => {
        const sekolahKey = recipient.sekolah || 'TIADA SEKOLAH';
        if (!acc[sekolahKey]) acc[sekolahKey] = [];
        acc[sekolahKey].push(recipient);
        return acc;
    }, {});

    let html = '';

    for (const [sekolah, records] of Object.entries(groupedBySchool)) {
        const uniqueProfiles = [];
        const seenKeys = new Set();
        
        records.forEach(r => {
            const pKey = getPersonKey(r.nama, r.sekolah);
            if (!seenKeys.has(pKey)) {
                seenKeys.add(pKey);
                uniqueProfiles.push(personProfilesMap.get(pKey));
            }
        });

        const safeSekolah = escapeHtml(sekolah.replace(/'/g, "\\'"));
        const btnPukalHtml = `
            <button onclick="openRsvpModal('PUKAL', null, null, '${safeSekolah}')" class="bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-300 text-xs px-4 py-2 rounded-lg shadow-sm font-bold flex items-center transition w-full sm:w-auto justify-center">
                <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                PENGESAHAN SEKOLAH (PUKAL)
            </button>`;

        html += `
            <div class="mb-8 fade-in bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 px-5 py-4 border-b border-gray-200 gap-3">
                    <h2 class="text-lg md:text-xl font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                        <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                        <span>${escapeHtml(sekolah)}</span>
                    </h2>
                    ${btnPukalHtml}
                </div>
                <div class="divide-y divide-gray-100">
        `;

        uniqueProfiles.forEach(profile => {
            const isMultiAward = profile.totalAwards > 1;
            const primaryRec = profile.allRecords[0];
            const safeNama = escapeHtml(profile.nama.replace(/'/g, "\\'"));
            
            const rawCurrentTable = (profile.primaryTable && profile.primaryTable.trim() !== '') ? profile.primaryTable.toUpperCase() : '-';
            const tableDisplay = rawCurrentTable.replace(/^MEJA\s*/, '');

            let isRsvpDone = profile.rsvpStatus && profile.rsvpStatus !== 'BELUM SAH';
            let cardBorder = isRsvpDone ? 'rsvp-confirmed-border rsvp-confirmed-bg' : 'border-l-4 border-transparent';
            
            let statusUi = '';
            if (isRsvpDone) {
                let textCol = profile.rsvpStatus === 'TIDAK HADIR' ? 'text-red-700' : 'text-cyan-800';
                let bgCol = profile.rsvpStatus === 'TIDAK HADIR' ? 'bg-red-100' : 'bg-cyan-100';
                let borderCol = profile.rsvpStatus === 'TIDAK HADIR' ? 'border-red-200' : 'border-cyan-200';
                
                statusUi = `
                    <div class="mt-2 inline-flex flex-col gap-1">
                        <span class="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold ${bgCol} ${textCol} border ${borderCol}">
                            ✓ Pengesahan Diterima: ${escapeHtml(profile.rsvpStatus)}
                        </span>
                        <span class="text-[10px] text-gray-500 font-medium">Pada: ${formatTime(profile.rsvpTime)}</span>
                    </div>
                `;
            }

            html += `
                <div class="p-5 md:p-6 hover:bg-gray-50 transition duration-150 ${cardBorder}">
                    <div class="flex flex-col md:flex-row justify-between gap-5">
                        
                        <div class="flex flex-row gap-4 items-start flex-1">
                            <div class="flex flex-col gap-2 shrink-0">
                                <div class="flex flex-col items-center justify-center w-16 h-16 md:w-20 md:h-20 text-center p-1 bg-blue-50 border border-blue-200 rounded-xl shadow-sm">
                                    <span class="text-[10px] font-bold text-blue-600 uppercase leading-tight">No<br>Meja</span>
                                    <span class="text-xl md:text-2xl font-black text-blue-900 mt-0.5 break-all leading-tight">${escapeHtml(tableDisplay)}</span>
                                </div>
                                <div class="flex flex-col items-center justify-center w-16 h-12 md:w-20 md:h-14 text-center p-1 bg-gray-50 border border-gray-200 rounded-xl shadow-sm">
                                    <span class="text-[9px] font-bold text-gray-500 uppercase leading-tight">Giliran</span>
                                    <span class="text-base md:text-lg font-black text-gray-800">${escapeHtml(profile.primaryBil)}</span>
                                </div>
                            </div>

                            <div class="flex flex-col justify-center flex-1">
                                <div class="flex flex-wrap items-center gap-2 mb-1.5">
                                    ${isMultiAward ? `
                                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                            ★ Penerima ${profile.totalAwards} Anugerah
                                        </span>
                                    ` : ''}
                                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-gray-700">
                                        ${escapeHtml(primaryRec.kategori || '-')}
                                    </span>
                                </div>
                                <h3 class="text-lg md:text-2xl font-black text-slate-900 uppercase tracking-tight leading-tight">${escapeHtml(profile.nama)}</h3>
                                ${statusUi}
                            </div>
                        </div>

                        <div class="w-full md:w-auto flex flex-col justify-center shrink-0 mt-2 md:mt-0">
                            <button onclick="openRsvpModal('INDIVIDU', '${primaryRec.id}', '${safeNama}', '${safeSekolah}')" class="${isRsvpDone ? 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-50' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'} px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center transition-colors w-full md:w-auto">
                                ${isRsvpDone ? 'KEMASKINI RSVP' : 'BUAT PENGESAHAN'}
                            </button>
                        </div>
                        
                    </div>
                </div>
            `;
        });

        html += `</div></div>`;
    }

    resultsContainer.innerHTML = html;
}

function resetRadioButtons() {
    const radios = document.getElementsByName('rsvpType');
    radios.forEach(r => r.checked = false);
}

function openRsvpModal(mode, id, name, sekolah) {
    if (!modalMode || !modalRecipientSekolah || !rsvpModal) return;
    
    modalMode.value = mode;
    modalRecipientSekolah.value = sekolah;
    
    const subtitle = document.getElementById('modalSubtitle');
    const nameSpan = document.getElementById('modalRecipientName');
    
    if (mode === 'INDIVIDU') {
        if (modalRecipientId) modalRecipientId.value = id;
        if (nameSpan) nameSpan.textContent = name;
        if (subtitle) subtitle.innerHTML = `Mengesahkan kehadiran untuk penerima individu:<br><span id="modalRecipientName" class="font-black text-gray-900 block mt-1.5 text-lg uppercase">${escapeHtml(name)}</span>`;
    } else {
        if (modalRecipientId) modalRecipientId.value = '';
        if (nameSpan) nameSpan.textContent = sekolah;
        if (subtitle) subtitle.innerHTML = `Mengesahkan kehadiran secara pukal untuk sekolah:<br><span id="modalRecipientName" class="font-black text-blue-700 block mt-1.5 text-lg uppercase">${escapeHtml(sekolah)}</span>`;
    }
    
    resetRadioButtons();
    rsvpModal.classList.remove('hidden');
}

function closeRsvpModal() {
    if (rsvpModal) rsvpModal.classList.add('hidden');
}

async function saveRsvp() {
    if (!modalMode || !modalRecipientSekolah) return;
    
    const mode = modalMode.value;
    const sekolahToUpdate = modalRecipientSekolah.value;
    const selectedRadio = document.querySelector('input[name="rsvpType"]:checked');

    if (!selectedRadio) {
        showError("Sila pilih status pengesahan anda terlebih dahulu.");
        return;
    }
    
    const rsvpStatusValue = selectedRadio.value;

    if (saveRsvpBtn) {
        saveRsvpBtn.disabled = true;
        saveRsvpBtn.innerHTML = 'Menyimpan...';
    }

    const currentTime = new Date().toISOString();

    try {
        if (mode === 'INDIVIDU') {
            const nameSpan = document.getElementById('modalRecipientName');
            const nameToUpdate = nameSpan ? nameSpan.innerText : '';
            
            allData.forEach(r => {
                if (r.nama === nameToUpdate && r.sekolah === sekolahToUpdate) {
                    r.rsvp_status = rsvpStatusValue;
                    r.rsvp_time = currentTime;
                }
            });

            const { error } = await supabaseClient
                .from('recipients')
                .update({ 
                    rsvp_status: rsvpStatusValue,
                    rsvp_time: currentTime
                })
                .match({ nama: nameToUpdate, sekolah: sekolahToUpdate });

            if (error) throw error;
            
        } else if (mode === 'PUKAL') {
            const idsToUpdate = allData.filter(s => s.sekolah === sekolahToUpdate).map(s => s.id);

            if (idsToUpdate.length > 0) {
                allData.forEach(r => {
                    if (idsToUpdate.includes(r.id)) {
                        r.rsvp_status = rsvpStatusValue;
                        r.rsvp_time = currentTime;
                    }
                });

                const { error } = await supabaseClient
                    .from('recipients')
                    .update({ 
                        rsvp_status: rsvpStatusValue,
                        rsvp_time: currentTime
                    })
                    .in('id', idsToUpdate);

                if (error) throw error;
            }
        }
        
        closeRsvpModal();
        personProfilesMap = buildPersonProfiles(allData);
        processSearch(); 

    } catch (error) {
        console.error("Ralat menyimpan RSVP:", error);
        showError("Gagal menyimpan maklumat pengesahan. Sila cuba lagi.");
        fetchAllData(); 
    } finally {
        if (saveRsvpBtn) {
            saveRsvpBtn.disabled = false;
            saveRsvpBtn.innerHTML = 'Simpan RSVP';
        }
    }
}

window.openRsvpModal = openRsvpModal;
window.closeRsvpModal = closeRsvpModal;
window.saveRsvp = saveRsvp;
window.clearSearch = clearSearch;