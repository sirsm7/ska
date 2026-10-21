const SUPABASE_URL = 'https://app.tech4ag.my';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYzMzczNjQ1LCJleHAiOjIwNzg3MzM2NDV9.vZOedqJzUn01PjwfaQp7VvRzSm4aRMr21QblPDK8AoY';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentTab = 'belum'; 
let allData = []; 
let personProfilesMap = new Map();

// DOM Elements
const searchInput = document.getElementById('searchInput');
const resetSearchBtn = document.getElementById('resetSearchBtn');
const filterKategori = document.getElementById('filterKategori');
const searchIndicator = document.getElementById('searchIndicator');
const tabContainer = document.getElementById('tabContainer');
const resultsContainer = document.getElementById('resultsContainer');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const tabBelum = document.getElementById('tabBelum');
const tabTelah = document.getElementById('tabTelah');
const countBelum = document.getElementById('countBelum');
const countTelah = document.getElementById('countTelah');

const statTotal = document.getElementById('statTotal');
const statHadir = document.getElementById('statHadir');
const statWakil = document.getElementById('statWakil');
const statTidakHadir = document.getElementById('statTidakHadir');
const statBelum = document.getElementById('statBelum');

const wakilModal = document.getElementById('wakilModal');
const modalRecipientName = document.getElementById('modalRecipientName');
const modalRecipientId = document.getElementById('modalRecipientId');
const modalRecipientSekolah = document.getElementById('modalRecipientSekolah');
const modalMode = document.getElementById('modalMode');
const cancelWakilBtn = document.getElementById('cancelWakilBtn');
const saveWakilBtn = document.getElementById('saveWakilBtn');

let typingTimer;
const doneTypingInterval = 300;

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
        typingTimer = setTimeout(processDataView, doneTypingInterval);
    });

    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            clearSearch();
        }
    });
}

if (filterKategori) filterKategori.addEventListener('change', processDataView);
if (resetSearchBtn) resetSearchBtn.addEventListener('click', clearSearch);
if (cancelWakilBtn) cancelWakilBtn.addEventListener('click', closeWakilModal);
if (saveWakilBtn) saveWakilBtn.addEventListener('click', saveWakil);

function clearSearch() {
    if (searchInput) searchInput.value = '';
    if (resetSearchBtn) resetSearchBtn.classList.add('hidden');
    processDataView();
    if (searchInput) searchInput.focus();
}

function formatTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', hour12: true });
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

function getPersonKey(nama, sekolah) {
    return `${(nama || '').trim().toUpperCase()}|||${(sekolah || '').trim().toUpperCase()}`;
}

function showError(msg) {
    if (!errorText || !errorMessage) return;
    errorText.textContent = msg;
    errorMessage.classList.remove('hidden');
    setTimeout(() => errorMessage.classList.add('hidden'), 5000);
}

function switchTab(tab) {
    currentTab = tab;
    if (tab === 'belum') {
        if (tabBelum) {
            tabBelum.classList.add('bg-blue-50', 'text-blue-700', 'border-blue-600');
            tabBelum.classList.remove('text-gray-500', 'border-transparent', 'hover:bg-gray-50');
        }
        if (tabTelah) {
            tabTelah.classList.remove('bg-blue-50', 'text-blue-700', 'border-blue-600');
            tabTelah.classList.add('text-gray-500', 'border-transparent', 'hover:bg-gray-50');
        }
    } else {
        if (tabTelah) {
            tabTelah.classList.add('bg-blue-50', 'text-blue-700', 'border-blue-600');
            tabTelah.classList.remove('text-gray-500', 'border-transparent', 'hover:bg-gray-50');
        }
        if (tabBelum) {
            tabBelum.classList.remove('bg-blue-50', 'text-blue-700', 'border-blue-600');
            tabBelum.classList.add('text-gray-500', 'border-transparent', 'hover:bg-gray-50');
        }
    }
    processDataView();
}

window.switchTab = switchTab;

function buildPersonProfiles(dataset) {
    const map = new Map();

    dataset.forEach(r => {
        const key = getPersonKey(r.nama, r.sekolah);
        if (!map.has(key)) {
            map.set(key, []);
        }
        map.get(key).push(r);
    });

    const profiles = new Map();
    map.forEach((records, key) => {
        records.sort((a, b) => (parseInt(a.bil) || 0) - (parseInt(b.bil) || 0));

        const primaryRecord = records[0];
        let primaryTable = primaryRecord.no_meja;

        if (!primaryTable || primaryTable.trim() === '') {
            const fallback = records.find(r => r.no_meja && r.no_meja.trim() !== '');
            primaryTable = fallback ? fallback.no_meja : '-';
        }

        const isAnyHadir = records.some(r => r.attendance_status === 'HADIR');
        const isAllTidakHadir = records.length > 0 && records.every(r => r.attendance_status === 'TIDAK HADIR');

        let unifiedStatus = 'BELUM HADIR';
        let latestAttendanceTime = null;
        let unifiedAttendanceType = null;
        let unifiedRepName = null;

        if (isAnyHadir) {
            unifiedStatus = 'HADIR';
            const hadirRec = records.find(r => r.attendance_status === 'HADIR');
            latestAttendanceTime = hadirRec.attendance_time;
            unifiedAttendanceType = hadirRec.attendance_type;
            unifiedRepName = hadirRec.representative_name;
        } else if (isAllTidakHadir) {
            unifiedStatus = 'TIDAK HADIR';
        }

        profiles.set(key, {
            nama: primaryRecord.nama,
            sekolah: primaryRecord.sekolah,
            primaryBil: primaryRecord.bil,
            primaryTable: primaryTable,
            allRecords: records,
            totalAwards: records.length,
            unifiedStatus: unifiedStatus,
            attendanceTime: latestAttendanceTime,
            attendanceType: unifiedAttendanceType,
            representativeName: unifiedRepName
        });
    });

    return profiles;
}

async function fetchAllData() {
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    if (resultsContainer) resultsContainer.innerHTML = '';
    
    try {
        const { data, error } = await supabaseClient
            .from('recipients')
            .select('*')
            .order('sekolah', { ascending: true })
            .order('bil', { ascending: true });

        if (error) throw error;
        allData = data || [];
        
        personProfilesMap = buildPersonProfiles(allData);
        processDataView();

    } catch (error) {
        console.error("Fetch Error:", error);
        showError("Gagal memuat turun data dari pelayan.");
    } finally {
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
    }
}

function updateCounts(filteredDataSet) {
    let total = filteredDataSet.length;
    let hadir = 0;
    let wakil = 0;
    let belum = 0;
    let tidakHadir = 0;

    let belumTabCount = 0;
    let telahTabCount = 0;

    filteredDataSet.forEach(r => {
        if (r.attendance_status === 'HADIR') {
            if (r.attendance_type === 'WAKIL') wakil++;
            else hadir++;
            telahTabCount++;
        } else if (r.attendance_status === 'TIDAK HADIR') {
            tidakHadir++;
            belumTabCount++;
        } else {
            belum++; 
            belumTabCount++;
        }
    });

    if (statTotal) statTotal.textContent = total;
    if (statHadir) statHadir.textContent = hadir;
    if (statWakil) statWakil.textContent = wakil;
    if (statTidakHadir) statTidakHadir.textContent = tidakHadir;
    if (statBelum) statBelum.textContent = belum;
    
    if (countBelum) countBelum.textContent = belumTabCount;
    if (countTelah) countTelah.textContent = telahTabCount;
}

function processDataView() {
    if (!searchInput || !filterKategori) return;
    
    const query = searchInput.value.trim().toUpperCase();
    const selectedKat = filterKategori.value;
    let currentDataSet = allData;

    if (selectedKat !== 'ALL') {
        currentDataSet = currentDataSet.filter(r => r.kategori && r.kategori.toUpperCase().includes(selectedKat));
    }
    
    updateCounts(currentDataSet);

    let dataToRender = currentDataSet;

    if (query) {
        if (searchIndicator) searchIndicator.classList.remove('hidden');
        if (tabContainer) tabContainer.classList.add('opacity-50', 'pointer-events-none');
        
        const qNum = parseInt(query);
        const queryCleanTable = query.replace(/^MEJA\s*/i, '').trim();

        dataToRender = dataToRender.filter(r => {
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
    } else {
        if (searchIndicator) searchIndicator.classList.add('hidden');
        if (tabContainer) tabContainer.classList.remove('opacity-50', 'pointer-events-none');
        
        if (currentTab === 'belum') {
            dataToRender = dataToRender.filter(r => r.attendance_status !== 'HADIR');
        } else {
            dataToRender = dataToRender.filter(r => r.attendance_status === 'HADIR');
        }
    }
    
    renderResults(dataToRender, query, selectedKat);
}

function renderResults(recipients, query, category) {
    if (!resultsContainer) return;
    
    if (!recipients || recipients.length === 0) {
        let msg = 'Tiada rekod dalam kategori ini.';
        if (query) {
            msg = `Tiada rekod dijumpai untuk carian: "${escapeHtml(query)}"`;
        } else if (category !== 'ALL') {
            msg = `Tiada rekod dijumpai untuk tapisan kategori: ${escapeHtml(category)}`;
        }
        
        resultsContainer.innerHTML = `
            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                <div class="flex items-center">
                    <p class="text-sm text-yellow-800 font-medium">${msg}</p>
                </div>
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
    let totalRenderedRecords = 0;

    for (const [sekolah, records] of Object.entries(groupedBySchool)) {
        records.sort((a, b) => (parseInt(a.bil) || 0) - (parseInt(b.bil) || 0));

        const hasBelumHadir = records.some(s => s.attendance_status === 'BELUM HADIR');
        
        const btnPukal = hasBelumHadir && currentTab === 'belum' ? 
            `<button onclick="openWakilModalPukal('${escapeHtml(sekolah.replace(/'/g, "\\'"))}')" class="bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-300 text-xs px-3 py-1.5 rounded shadow-sm font-bold flex items-center transition">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                TANDA PUKAL WAKIL
            </button>` : '';
            
        const btnPukalTidak = hasBelumHadir && currentTab === 'belum' ? 
            `<button onclick="confirmPukalTidakHadir('${escapeHtml(sekolah.replace(/'/g, "\\'"))}')" class="bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 text-xs px-3 py-1.5 rounded shadow-sm font-bold flex items-center transition">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                TANDA PUKAL TIDAK HADIR
            </button>` : '';

        html += `
            <div class="mb-8 fade-in">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-200 px-4 py-3 rounded-t-lg border-b border-gray-300 gap-3">
                    <h2 class="text-xl font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                        <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                        <span>${escapeHtml(sekolah)}</span>
                    </h2>
                    <div class="flex gap-2 flex-wrap w-full sm:w-auto">
                        ${btnPukal}
                        ${btnPukalTidak}
                    </div>
                </div>
                <div class="bg-white shadow rounded-b-lg overflow-hidden divide-y divide-gray-200">
        `;

        records.forEach(row => {
            totalRenderedRecords++;
            const pKey = getPersonKey(row.nama, row.sekolah);
            const profile = personProfilesMap.get(pKey) || {
                nama: row.nama,
                sekolah: row.sekolah,
                primaryBil: row.bil,
                primaryTable: row.no_meja || '-',
                allRecords: [row],
                totalAwards: 1,
                unifiedStatus: row.attendance_status,
                attendanceTime: row.attendance_time,
                attendanceType: row.attendance_type,
                representativeName: row.representative_name
            };

            const isMultiAward = profile.totalAwards > 1;
            const isPrimaryAward = (row.bil === profile.primaryBil);
            const awardIndex = isMultiAward ? (profile.allRecords.findIndex(r => r.bil === row.bil) + 1) : 1;

            const cardBorderClass = isMultiAward 
                ? (isPrimaryAward ? 'award-card-first' : 'award-card-subsequent') 
                : '';

            const safeNama = row.nama ? row.nama.replace(/'/g, "\\'") : '';
            const safeSekolah = row.sekolah ? row.sekolah.replace(/'/g, "\\'") : '';
            const actionDomId = `act-row-${row.id}`;

            const rawCurrentTable = (row.no_meja && row.no_meja.toString().trim() !== '') ? row.no_meja.toString().toUpperCase() : '-';
            const currentAwardTableShort = rawCurrentTable.replace(/^MEJA\s*/, '');
            const primaryTableShort = (profile.primaryTable && profile.primaryTable !== '-') 
                ? profile.primaryTable.toString().toUpperCase().replace(/^MEJA\s*/, '')
                : '-';

            let statusMejaUtamaText = 'MEJA<br>UTAMA';
            let statusMejaUtamaClass = 'text-blue-700';

            if (isMultiAward && !isPrimaryAward) {
                statusMejaUtamaText = `DUDUK<br>MEJA ${escapeHtml(primaryTableShort)}`;
                statusMejaUtamaClass = 'text-amber-600';
            } else if (rawCurrentTable === '-') {
                statusMejaUtamaText = 'TIADA<br>MEJA';
                statusMejaUtamaClass = 'text-gray-400';
            }

            let statusHtml = '';
            let actionHtml = '';

            if (row.attendance_status === 'HADIR') {
                statusHtml = `
                    <div class="text-green-600 font-bold flex items-center text-sm">
                        <span class="mr-1.5">🟢</span> Hadir ${formatTime(row.attendance_time)}
                    </div>`;
                if (row.attendance_type === 'WAKIL') {
                    statusHtml = `
                        <div class="text-purple-600 font-bold flex items-center text-sm mb-1">
                            <span class="mr-1.5">🟣</span> Wakil Hadir ${formatTime(row.attendance_time)}
                        </div>
                        <div class="text-xs text-gray-600 font-medium bg-purple-50 px-2.5 py-1 rounded border border-purple-100 inline-block">
                            Kategori Wakil: <span class="font-bold text-purple-800">${escapeHtml(row.representative_name || '-')}</span>
                        </div>`;
                }
            } else if (row.attendance_status === 'TIDAK HADIR') {
                statusHtml = `<div class="text-red-600 font-bold flex items-center text-sm mt-1"><span class="mr-1.5">🔴</span> Tidak Hadir</div>`;
                actionHtml = generateActionButtons(row.id, safeNama, safeSekolah, row.attendance_status);
            } else {
                statusHtml = `<div class="text-yellow-600 font-bold flex items-center text-sm mt-1"><span class="mr-1.5">🟡</span> Belum Hadir</div>`;
                actionHtml = generateActionButtons(row.id, safeNama, safeSekolah, row.attendance_status);
            }

            const pentasBadge = row.naik_pentas_status 
                ? '<span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-300 ml-2">✓ Selesai Pentas</span>'
                : '';

            html += `
                <div class="p-5 hover:bg-gray-50 transition duration-150 border-b border-gray-100 ${cardBorderClass}">
                    <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
                        
                        <div class="flex flex-col md:flex-row gap-4 w-full lg:w-auto flex-1 items-start">
                            
                            <!-- Tiga Kotak Maklumat Bersebelahan (Design Baru) -->
                            <div class="flex gap-2 flex-shrink-0">
                                <div class="border border-slate-700 flex flex-col items-center justify-center w-[4.5rem] h-[4.5rem] text-center bg-white p-1">
                                    <span class="text-[9px] font-bold text-slate-500 uppercase leading-tight">No<br>Giliran</span>
                                    <span class="text-xl font-black text-slate-800 mt-0.5">${escapeHtml(row.bil)}</span>
                                </div>
                                <div class="border border-slate-700 flex flex-col items-center justify-center w-[4.5rem] h-[4.5rem] text-center bg-white p-1">
                                    <span class="text-[9px] font-bold text-slate-500 uppercase leading-tight">No<br>Meja</span>
                                    <span class="text-base font-black text-slate-800 mt-0.5 break-all leading-tight">${escapeHtml(currentAwardTableShort)}</span>
                                </div>
                                <div class="border border-slate-700 flex flex-col items-center justify-center w-[4.5rem] h-[4.5rem] text-center bg-white p-1">
                                    <span class="text-[9px] font-bold text-slate-500 uppercase leading-tight">Status<br>Meja</span>
                                    <span class="text-[10px] font-bold ${statusMejaUtamaClass} mt-0.5 leading-tight">${statusMejaUtamaText}</span>
                                </div>
                            </div>

                            <!-- Nama & Maklumat Tambahan Penerima -->
                            <div class="flex flex-col justify-center flex-1 w-full">
                                <div class="flex flex-wrap items-center gap-2 mb-1.5">
                                    ${isMultiAward ? `
                                        <span class="multi-badge inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold shadow-xs">
                                            ★ Anugerah ${awardIndex} daripada${profile.totalAwards}
                                        </span>
                                    ` : ''}
                                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                        ${escapeHtml(row.kategori || '-')}
                                    </span>
                                    ${pentasBadge}
                                </div>
                                <h3 class="text-xl lg:text-2xl font-black text-slate-900 uppercase tracking-tight leading-tight">${escapeHtml(row.nama)}</h3>
                                ${statusHtml}
                            </div>
                        </div>

                        <!-- Butang Tindakan -->
                        <div class="w-full lg:w-auto flex flex-col sm:flex-row flex-wrap gap-2 justify-end shrink-0 mt-2 lg:mt-0" id="${actionDomId}">
                            ${actionHtml}
                        </div>
                    </div>
                </div>
            `;
        });

        html += `</div></div>`;
    }

    resultsContainer.innerHTML = html;
}

function generateActionButtons(id, name, sekolah, status) {
    let buttons = `
        <button onclick="markHadir('${name}', '${sekolah}')" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg shadow font-bold text-sm flex items-center justify-center transition duration-150">
            <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            HADIR
        </button>
        <button onclick="openWakilModal('${id}', '${name}', '${sekolah}')" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg shadow font-bold text-sm flex items-center justify-center transition duration-150">
            <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            WAKIL
        </button>
    `;

    if (status !== 'TIDAK HADIR') {
        buttons += `
            <button onclick="markTidakHadir('${name}', '${sekolah}')" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-lg shadow font-bold text-sm flex items-center justify-center transition duration-150">
                <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                TIDAK HADIR
            </button>
        `;
    }

    return buttons;
}

window.markHadir = markHadir;
window.markTidakHadir = markTidakHadir;
window.openWakilModal = openWakilModal;
window.openWakilModalPukal = openWakilModalPukal;
window.confirmPukalTidakHadir = confirmPukalTidakHadir;
window.closeWakilModal = closeWakilModal;
window.saveWakil = saveWakil;
window.clearSearch = clearSearch;

async function markHadir(name, sekolah) {
    const currentTime = new Date().toISOString();

    let updated = false;
    allData.forEach(r => {
        if (r.nama === name && r.sekolah === sekolah) {
            r.attendance_status = 'HADIR';
            r.attendance_time = currentTime;
            r.attendance_type = 'SENDIRI';
            r.representative_name = null;
            updated = true;
        }
    });

    if (updated) {
        personProfilesMap = buildPersonProfiles(allData);
        processDataView();
    }

    try {
        const { error } = await supabaseClient
            .from('recipients')
            .update({ 
                attendance_status: 'HADIR',
                attendance_time: currentTime,
                attendance_type: 'SENDIRI',
                representative_name: null
            })
            .match({ nama: name, sekolah: sekolah });

        if (error) throw error;
    } catch (error) {
        console.error("Ralat tanda hadir:", error);
        showError("Gagal mengemaskini status kehadiran.");
        fetchAllData(); 
    }
}

async function markTidakHadir(name, sekolah) {
    if (!confirm(`Mengesahkan ${name} sebagai TIDAK HADIR bagi semua giliran anugerah?`)) return;
    
    const currentTime = new Date().toISOString();

    let updated = false;
    allData.forEach(r => {
        if (r.nama === name && r.sekolah === sekolah) {
            r.attendance_status = 'TIDAK HADIR';
            r.attendance_time = currentTime;
            r.attendance_type = null;
            r.representative_name = null;
            updated = true;
        }
    });

    if (updated) {
        personProfilesMap = buildPersonProfiles(allData);
        processDataView();
    }

    try {
        const { error } = await supabaseClient
            .from('recipients')
            .update({ 
                attendance_status: 'TIDAK HADIR',
                attendance_time: currentTime,
                attendance_type: null,
                representative_name: null
            })
            .match({ nama: name, sekolah: sekolah });

        if (error) throw error;
    } catch (error) {
        console.error("Ralat tanda tidak hadir:", error);
        showError("Gagal mengemaskini status tidak hadir.");
        fetchAllData(); 
    }
}

async function confirmPukalTidakHadir(sekolah) {
    if (!confirm(`Mengesahkan SEMUA yang belum hadir bagi sekolah ${sekolah} sebagai TIDAK HADIR?`)) return;
    
    const currentTime = new Date().toISOString();
    const selectedKat = filterKategori ? filterKategori.value : 'ALL';
    
    let pendingStudents = allData.filter(s => s.sekolah === sekolah && s.attendance_status === 'BELUM HADIR');
    if (selectedKat !== 'ALL') {
        pendingStudents = pendingStudents.filter(s => s.kategori && s.kategori.toUpperCase().includes(selectedKat));
    }
    
    const idsToUpdate = pendingStudents.map(s => s.id);
    
    if (idsToUpdate.length > 0) {
        allData.forEach(r => {
            if (idsToUpdate.includes(r.id)) {
                r.attendance_status = 'TIDAK HADIR';
                r.attendance_time = currentTime;
                r.attendance_type = null;
                r.representative_name = null;
            }
        });
        personProfilesMap = buildPersonProfiles(allData);
        processDataView();

        try {
            const { error } = await supabaseClient
                .from('recipients')
                .update({ 
                    attendance_status: 'TIDAK HADIR',
                    attendance_time: currentTime,
                    attendance_type: null,
                    representative_name: null
                })
                .in('id', idsToUpdate);

            if (error) throw error;
        } catch (error) {
            console.error("Ralat pukal tidak hadir:", error);
            showError("Gagal mengemaskini pukal tidak hadir.");
            fetchAllData();
        }
    } else {
        alert("Tiada penerima yang sepadan untuk ditandakan.");
    }
}

function resetRadioButtons() {
    const radios = document.getElementsByName('wakilType');
    radios.forEach(r => r.checked = false);
}

function openWakilModal(id, name, sekolah) {
    if (!modalMode || !modalRecipientId || !modalRecipientSekolah || !wakilModal) return;
    
    modalMode.value = 'INDIVIDU';
    modalRecipientId.value = id;
    modalRecipientSekolah.value = sekolah;
    
    const modalSubtitle = document.getElementById('modalSubtitle');
    if (modalSubtitle) {
        modalSubtitle.innerHTML = `Penerima asal: <span id="modalRecipientName" class="font-bold text-gray-800">${escapeHtml(name)}</span>`;
    }
    
    resetRadioButtons();
    wakilModal.classList.remove('hidden');
}

function openWakilModalPukal(sekolah) {
    if (!modalMode || !modalRecipientSekolah || !wakilModal) return;
    
    modalMode.value = 'PUKAL';
    modalRecipientSekolah.value = sekolah;
    
    const modalSubtitle = document.getElementById('modalSubtitle');
    if (modalSubtitle) {
        modalSubtitle.innerHTML = `Tanda wakil secara pukal untuk:<br><span class="font-bold text-gray-800 text-base uppercase">${escapeHtml(sekolah)}</span>`;
    }
    
    resetRadioButtons();
    wakilModal.classList.remove('hidden');
}

function closeWakilModal() {
    if (wakilModal) wakilModal.classList.add('hidden');
}

async function saveWakil() {
    if (!modalMode || !modalRecipientSekolah) return;
    
    const mode = modalMode.value;
    const sekolahToUpdate = modalRecipientSekolah.value;
    const selectedRadio = document.querySelector('input[name="wakilType"]:checked');

    if (!selectedRadio) {
        alert("Sila pilih kategori wakil.");
        return;
    }
    const wakilType = selectedRadio.value;

    if (saveWakilBtn) {
        saveWakilBtn.disabled = true;
        saveWakilBtn.innerHTML = 'Menyimpan...';
    }

    const currentTime = new Date().toISOString();

    try {
        if (mode === 'INDIVIDU') {
            const nameSpan = document.getElementById('modalRecipientName');
            const nameToUpdate = nameSpan ? nameSpan.innerText : '';
            
            allData.forEach(r => {
                if (r.nama === nameToUpdate && r.sekolah === sekolahToUpdate) {
                    r.attendance_status = 'HADIR';
                    r.attendance_time = currentTime;
                    r.attendance_type = 'WAKIL';
                    r.representative_name = wakilType;
                }
            });

            const { error } = await supabaseClient
                .from('recipients')
                .update({ 
                    attendance_status: 'HADIR',
                    attendance_time: currentTime,
                    attendance_type: 'WAKIL',
                    representative_name: wakilType
                })
                .match({ nama: nameToUpdate, sekolah: sekolahToUpdate });

            if (error) throw error;
        } else if (mode === 'PUKAL') {
            const selectedKat = filterKategori ? filterKategori.value : 'ALL';
            let pendingStudents = allData.filter(s => s.sekolah === sekolahToUpdate && s.attendance_status === 'BELUM HADIR');
            
            if (selectedKat !== 'ALL') {
                pendingStudents = pendingStudents.filter(s => s.kategori && s.kategori.toUpperCase().includes(selectedKat));
            }
            
            const idsToUpdate = pendingStudents.map(s => s.id);

            if (idsToUpdate.length > 0) {
                allData.forEach(r => {
                    if (idsToUpdate.includes(r.id)) {
                        r.attendance_status = 'HADIR';
                        r.attendance_time = currentTime;
                        r.attendance_type = 'WAKIL';
                        r.representative_name = wakilType;
                    }
                });

                const { error } = await supabaseClient
                    .from('recipients')
                    .update({ 
                        attendance_status: 'HADIR',
                        attendance_time: currentTime,
                        attendance_type: 'WAKIL',
                        representative_name: wakilType
                    })
                    .in('id', idsToUpdate);

                if (error) throw error;
            } else {
                alert("Tiada rekod yang sepadan untuk ditandakan (berdasarkan tapisan kategori).");
            }
        }
        
        closeWakilModal();
        personProfilesMap = buildPersonProfiles(allData);
        processDataView(); 

    } catch (error) {
        console.error("Ralat daftar wakil:", error);
        showError("Gagal merekod maklumat wakil.");
        fetchAllData(); 
    } finally {
        if (saveWakilBtn) {
            saveWakilBtn.disabled = false;
            saveWakilBtn.innerHTML = 'Simpan';
        }
    }
}