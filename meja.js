const SUPABASE_URL = 'https://app.tech4ag.my';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYzMzczNjQ1LCJleHAiOjIwNzg3MzM2NDV9.vZOedqJzUn01PjwfaQp7VvRzSm4aRMr21QblPDK8AoY';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRecipients = [];
let groupedTables = {};
let activeTableShortcut = null;
let currentRole = null;

const searchTableInput = document.getElementById('searchTableInput');
const resetSearchBtn = document.getElementById('resetSearchBtn');
const filterStatus = document.getElementById('filterStatus');
const tableGrid = document.getElementById('tableGrid');
const loadingIndicator = document.getElementById('loadingIndicator');
const emptyIndicator = document.getElementById('emptyIndicator');
const tableShortcutsContainer = document.getElementById('tableShortcutsContainer');

const statTotalTables = document.getElementById('statTotalTables');
const statTotalRsvp = document.getElementById('statTotalRsvp');
const statFullTables = document.getElementById('statFullTables');
const statPartialTables = document.getElementById('statPartialTables');
const statEmptyTables = document.getElementById('statEmptyTables');
const statTotalParticipants = document.getElementById('statTotalParticipants');

const tableModal = document.getElementById('tableModal');
const modalTableName = document.getElementById('modalTableName');
const modalTableStats = document.getElementById('modalTableStats');
const modalParticipantList = document.getElementById('modalParticipantList');
const closeTableModalBtn = document.getElementById('closeTableModalBtn');
const logoutBtn = document.getElementById('logoutBtn');
const roleIndicator = document.getElementById('roleIndicator');

function checkSession() {
    const savedRole = localStorage.getItem('adminRole');
    
    if (savedRole === 'SUPERADMIN' || savedRole === 'PENGURUS') {
        currentRole = savedRole;
        
        if (currentRole === 'PENGURUS') {
            if (roleIndicator) {
                roleIndicator.classList.remove('hidden');
                roleIndicator.textContent = 'PENGURUS PESERTA';
            }
        } else {
            if (roleIndicator) {
                roleIndicator.classList.remove('hidden');
                roleIndicator.textContent = 'SUPER ADMIN';
                roleIndicator.classList.replace('bg-blue-800', 'bg-red-700');
                roleIndicator.classList.replace('border-blue-400', 'border-red-400');
            }
        }
        return true;
    } else {
        currentRole = null;
        window.location.href = 'admin.html';
        return false;
    }
}

window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
        checkSession();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (!checkSession()) return;
    fetchTableData();
    setupEventListeners();
});

function setupEventListeners() {
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('adminRole');
            window.location.href = 'admin.html';
        });
    }

    if (searchTableInput) {
        searchTableInput.addEventListener('input', () => {
            activeTableShortcut = null;
            if (searchTableInput.value.trim().length > 0) {
                if (resetSearchBtn) resetSearchBtn.classList.remove('hidden');
            } else {
                if (resetSearchBtn) resetSearchBtn.classList.add('hidden');
            }
            renderTableShortcuts();
            renderTableGrid();
        });
    }

    if (resetSearchBtn) {
        resetSearchBtn.addEventListener('click', () => {
            searchTableInput.value = '';
            activeTableShortcut = null;
            resetSearchBtn.classList.add('hidden');
            renderTableShortcuts();
            renderTableGrid();
            searchTableInput.focus();
        });
    }

    if (filterStatus) {
        filterStatus.addEventListener('change', () => {
            renderTableGrid();
        });
    }

    if (closeTableModalBtn) {
        closeTableModalBtn.addEventListener('click', closeDetailModal);
    }

    if (tableModal) {
        tableModal.addEventListener('click', (e) => {
            if (e.target === tableModal) {
                closeDetailModal();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && tableModal && !tableModal.classList.contains('hidden')) {
            closeDetailModal();
        }
    });
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
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function naturalSort(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

async function fetchTableData() {
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    if (tableGrid) tableGrid.innerHTML = '';
    if (emptyIndicator) emptyIndicator.classList.add('hidden');

    try {
        const { data, error } = await supabaseClient
            .from('recipients')
            .select('*')
            .order('no_meja', { ascending: true })
            .order('bil', { ascending: true });

        if (error) throw error;
        allRecipients = data || [];
        groupDataByTable();
        updateOverviewCards();
        renderTableShortcuts();
        renderTableGrid();
    } catch (err) {
        console.error('Ralat menarik data meja:', err);
    } finally {
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
    }
}

window.fetchTableData = fetchTableData;

function groupDataByTable() {
    groupedTables = {};

    const personMap = new Map();
    allRecipients.forEach(r => {
        const pKey = `${(r.nama || '').trim().toUpperCase()}|||${(r.sekolah || '').trim().toUpperCase()}`;
        if (!personMap.has(pKey)) {
            personMap.set(pKey, []);
        }
        personMap.get(pKey).push(r);
    });

    allRecipients.forEach(rec => {
        let tableKey = rec.no_meja ? rec.no_meja.trim().toUpperCase() : 'TANPA MEJA'; 
        
        if (tableKey !== 'TANPA MEJA' && !tableKey.startsWith('MEJA')) {
            tableKey = 'MEJA ' + tableKey;
        }

        if (!groupedTables[tableKey]) {
            groupedTables[tableKey] = {
                seatedParticipants: []
            };
        }

        const pKey = `${(rec.nama || '').trim().toUpperCase()}|||${(rec.sekolah || '').trim().toUpperCase()}`;
        const allPersonRecords = personMap.get(pKey);
        
        const isAnyHadir = allPersonRecords.some(r => r.attendance_status === 'HADIR');
        const isAllTidakHadir = allPersonRecords.length > 0 && allPersonRecords.every(r => r.attendance_status === 'TIDAK HADIR');
        
        let unifiedStatus = 'BELUM HADIR';
        let latestTime = null;
        let unifiedType = null;
        let unifiedRep = null;
        let primaryRsvpStatus = 'BELUM SAH';

        if (isAnyHadir) {
            unifiedStatus = 'HADIR';
            const hadirItem = allPersonRecords.find(r => r.attendance_status === 'HADIR');
            latestTime = hadirItem.attendance_time;
            unifiedType = hadirItem.attendance_type;
            unifiedRep = hadirItem.representative_name;
        } else if (isAllTidakHadir) {
            unifiedStatus = 'TIDAK HADIR';
        }

        // Dapatkan status RSVP dari rekod utama penerima
        const primaryRec = allPersonRecords[0];
        if (primaryRec && primaryRec.rsvp_status) {
            primaryRsvpStatus = primaryRec.rsvp_status;
        }

        allPersonRecords.sort((a, b) => (parseInt(a.bil) || 0) - (parseInt(b.bil) || 0));
        const currentIndex = allPersonRecords.findIndex(r => r.id === rec.id);
        const hasNext = currentIndex < (allPersonRecords.length - 1);
        
        let nextTable = null;
        let nextBil = null;
        
        if (hasNext) {
            const nextRec = allPersonRecords[currentIndex + 1];
            nextBil = nextRec.bil;
            nextTable = nextRec.no_meja ? nextRec.no_meja.trim().toUpperCase() : 'TANPA MEJA';
            if (nextTable !== 'TANPA MEJA' && !nextTable.startsWith('MEJA')) {
                nextTable = 'MEJA ' + nextTable;
            }
        }

        groupedTables[tableKey].seatedParticipants.push({
            id: rec.id,
            nama: rec.nama,
            sekolah: rec.sekolah,
            kategori: rec.kategori,
            bil: rec.bil,
            naik_pentas_status: rec.naik_pentas_status,
            attendance_status: unifiedStatus,
            attendance_time: latestTime,
            attendance_type: unifiedType,
            representative_name: unifiedRep,
            rsvp_status: primaryRsvpStatus,
            totalAwards: allPersonRecords.length,
            awardIndex: currentIndex + 1,
            hasNext: hasNext,
            nextTable: nextTable,
            nextBil: nextBil
        });
    });

    Object.keys(groupedTables).forEach(tKey => {
        groupedTables[tKey].seatedParticipants.sort((a, b) => (parseInt(a.bil) || 0) - (parseInt(b.bil) || 0));
    });
}

function updateOverviewCards() {
    const tableKeys = Object.keys(groupedTables);
    let full = 0;
    let partial = 0;
    let empty = 0;
    let totalSeatedPersons = 0;
    
    // Set unik untuk kira bilangan individu (elak kira dua kali untuk anugerah berganda)
    let uniqueRsvpSet = new Set();

    tableKeys.forEach(tableKey => {
        const tableData = groupedTables[tableKey];
        const seated = tableData.seatedParticipants;
        
        const totalInTable = seated.length;
        const hadirCount = seated.filter(p => p.attendance_status === 'HADIR').length;
        
        seated.forEach(p => {
            if (p.rsvp_status && p.rsvp_status !== 'BELUM SAH') {
                const pKey = `${p.nama}|||${p.sekolah}`;
                uniqueRsvpSet.add(pKey);
            }
        });

        totalSeatedPersons += totalInTable;

        if (totalInTable > 0 && hadirCount === totalInTable) {
            full++;
        } else if (hadirCount > 0) {
            partial++;
        } else {
            empty++;
        }
    });

    if (statTotalTables) statTotalTables.textContent = tableKeys.length;
    if (statTotalRsvp) statTotalRsvp.textContent = uniqueRsvpSet.size;
    if (statFullTables) statFullTables.textContent = full;
    if (statPartialTables) statPartialTables.textContent = partial;
    if (statEmptyTables) statEmptyTables.textContent = empty;
    if (statTotalParticipants) statTotalParticipants.textContent = totalSeatedPersons;
}

function renderTableShortcuts() {
    if (!tableShortcutsContainer) return;

    const sortedTableKeys = Object.keys(groupedTables).sort((a, b) => {
        if (a === 'TANPA MEJA') return 1;
        if (b === 'TANPA MEJA') return -1;
        return naturalSort(a, b);
    });

    if (sortedTableKeys.length === 0) {
        tableShortcutsContainer.innerHTML = '<span class="text-xs text-gray-400 italic">Tiada data meja tersedia.</span>';
        return;
    }

    let shortcutsHtml = '';

    const isAllActive = !activeTableShortcut;
    const allBtnClass = isAllActive 
        ? 'bg-blue-600 text-white border-blue-700 shadow-sm font-bold ring-2 ring-blue-300' 
        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100 font-medium';

    shortcutsHtml += `
        <button onclick="clearTableShortcut()" 
            class="px-3 py-1.5 text-xs rounded-full border transition flex items-center gap-1.5 ${allBtnClass}">
            <span>Semua Meja</span>
            <span class="text-[10px] opacity-80 font-mono">(${sortedTableKeys.length})</span>
        </button>
    `;

    sortedTableKeys.forEach(tableKey => {
        const tableData = groupedTables[tableKey];
        const seated = tableData.seatedParticipants;
        
        const total = seated.length;
        const hadir = seated.filter(p => p.attendance_status === 'HADIR').length;
        
        const isFull = (total > 0 && hadir === total);
        const isActive = (activeTableShortcut === tableKey);

        let pillClass = '';
        let badgeColor = '';
        let statusIcon = '';

        if (isFull) {
            if (isActive) {
                pillClass = 'bg-emerald-700 text-white border-emerald-800 shadow-md font-bold ring-2 ring-emerald-300 scale-105';
                badgeColor = 'bg-emerald-900 text-emerald-100';
            } else {
                pillClass = 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 shadow-xs font-semibold';
                badgeColor = 'bg-emerald-600 text-white';
            }
            statusIcon = `<svg class="w-3 h-3 text-white inline-block flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>`;
        } else {
            if (isActive) {
                pillClass = 'bg-blue-600 text-white border-blue-700 shadow-md font-bold ring-2 ring-blue-300 scale-105';
                badgeColor = 'bg-blue-800 text-blue-100';
            } else {
                pillClass = 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300 font-medium';
                badgeColor = 'bg-gray-200 text-gray-600';
            }
            statusIcon = `<span class="w-2 h-2 rounded-full ${(hadir > 0) ? 'bg-amber-400' : 'bg-gray-300'} inline-block flex-shrink-0"></span>`;
        }

        const safeKey = escapeHtml(tableKey);
        const escapedArg = escapeHtml(tableKey.replace(/'/g, "\\'"));

        shortcutsHtml += `
            <button onclick="filterByTableShortcut('${escapedArg}')" 
                title="${safeKey}: ${hadir}/${total} Duduk Hadir ${isFull ? '(Lengkap 100%)' : ''}"
                class="px-2.5 py-1.5 text-xs rounded-full border transition-all duration-150 flex items-center gap-1.5 ${pillClass}">
                ${statusIcon}
                <span class="truncate max-w-[110px]">${safeKey}</span>
                <span class="text-[10px] px-1.5 py-0.2 rounded-full font-mono ${badgeColor}">
                    ${hadir}/${total}
                </span>
            </button>
        `;
    });

    tableShortcutsContainer.innerHTML = shortcutsHtml;
}

function filterByTableShortcut(tableKey) {
    if (activeTableShortcut === tableKey) {
        activeTableShortcut = null;
    } else {
        activeTableShortcut = tableKey;
    }
    renderTableShortcuts();
    renderTableGrid();
}

function clearTableShortcut() {
    activeTableShortcut = null;
    renderTableShortcuts();
    renderTableGrid();
}

function renderTableGrid() {
    if (!tableGrid) return;
    tableGrid.innerHTML = '';

    const query = searchTableInput ? searchTableInput.value.trim().toUpperCase() : '';
    const selectedFilter = filterStatus ? filterStatus.value : 'ALL';

    const sortedTableKeys = Object.keys(groupedTables).sort((a, b) => {
        if (a === 'TANPA MEJA') return 1;
        if (b === 'TANPA MEJA') return -1;
        return naturalSort(a, b);
    });

    let renderedCount = 0;

    sortedTableKeys.forEach(tableKey => {
        const tableData = groupedTables[tableKey];
        const seated = tableData.seatedParticipants;
        
        const total = seated.length;
        const hadir = seated.filter(p => p.attendance_status === 'HADIR').length;
        
        const isFull = (total > 0 && hadir === total);
        const isEmpty = (hadir === 0);
        const isPartial = (!isFull && !isEmpty);

        if (activeTableShortcut && tableKey !== activeTableShortcut) return;

        if (selectedFilter === 'PENUH' && !isFull) return;
        if (selectedFilter === 'SEPARA' && !isPartial) return;
        if (selectedFilter === 'KOSONG' && !isEmpty) return;

        if (query) {
            const matchTable = tableKey.toUpperCase().includes(query);
            const matchSeated = seated.some(p => 
                (p.nama && p.nama.toUpperCase().includes(query)) ||
                (p.sekolah && p.sekolah.toUpperCase().includes(query)) ||
                (p.bil && p.bil.toString() === query)
            );
            if (!matchTable && !matchSeated) return;
        }

        renderedCount++;

        let borderAccent = 'border-l-4 border-gray-300';
        let statusBadge = '<span class="px-2 py-0.5 text-xs font-semibold rounded bg-gray-100 text-gray-700">Belum Hadir</span>';
        let progressBg = 'bg-gray-200';

        if (isFull) {
            borderAccent = 'border-l-4 border-emerald-500';
            statusBadge = '<span class="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">Lengkap (100%)</span>';
            progressBg = 'bg-emerald-500';
        } else if (isPartial) {
            borderAccent = 'border-l-4 border-amber-500';
            statusBadge = '<span class="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800">Sebahagian Hadir</span>';
            progressBg = 'bg-amber-500';
        }

        const percentage = total > 0 ? Math.round((hadir / total) * 100) : 0;

        const maxSlots = Math.max(10, total);
        let slotsHtml = '';
        for (let i = 0; i < maxSlots; i++) {
            if (i < total) {
                const p = seated[i];
                let slotColor = 'bg-gray-200 border-gray-300 text-gray-500';
                let slotTitle = `${escapeHtml(p.nama)} - Belum Hadir (Bil #${p.bil})`;
                let rsvpBorder = '';

                // Logik penonjolan RSVP dalam slot kerusi
                if (p.attendance_status !== 'HADIR' && p.attendance_status !== 'TIDAK HADIR' && p.rsvp_status && p.rsvp_status !== 'BELUM SAH') {
                    if (p.rsvp_status === 'TIDAK HADIR') {
                        // Kerusi ditandakan merah/kelabu pudar dengan sempadan silang secara bayangan
                        rsvpBorder = 'ring-2 ring-red-400 ring-offset-1';
                        slotColor = 'bg-red-50 border-red-400 text-red-700 opacity-80';
                        slotTitle = `${escapeHtml(p.nama)} - RSVP: TIDAK HADIR`;
                    } else {
                        rsvpBorder = 'ring-2 ring-cyan-400 ring-offset-1';
                        slotColor = 'bg-cyan-50 border-cyan-400 text-cyan-700';
                    }
                }

                if (p.attendance_status === 'HADIR') {
                    if (p.attendance_type === 'WAKIL') {
                        slotColor = 'bg-purple-500 text-white border-purple-600';
                        slotTitle = `${escapeHtml(p.nama)} - Wakil Hadir (${escapeHtml(p.representative_name || '')})`;
                    } else {
                        slotColor = 'bg-emerald-500 text-white border-emerald-600';
                        slotTitle = `${escapeHtml(p.nama)} - Hadir`;
                    }
                    rsvpBorder = ''; // Padam ring RSVP bila dah hadir
                } else if (p.attendance_status === 'TIDAK HADIR') {
                    slotColor = 'bg-rose-500 text-white border-rose-600';
                    slotTitle = `${escapeHtml(p.nama)} - Tidak Hadir`;
                    rsvpBorder = ''; // Padam ring RSVP
                }

                slotsHtml += `
                    <div title="${slotTitle}" class="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${slotColor} ${rsvpBorder} shadow-xs relative transition-colors">
                        ${i + 1}
                        ${p.totalAwards > 1 ? '<span class="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full border border-white"></span>' : ''}
                    </div>
                `;
            } else {
                slotsHtml += `
                    <div title="Kerusi Kosong" class="h-6 w-6 rounded-full flex items-center justify-center text-[10px] border border-dashed border-gray-300 text-gray-300">
                        ${i + 1}
                    </div>
                `;
            }
        }

        const card = document.createElement('div');
        card.className = `bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-5 border border-gray-200 flex flex-col justify-between ${borderAccent} cursor-pointer`;
        card.onclick = () => openDetailModal(tableKey);

        card.innerHTML = `
            <div>
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                        <span>${escapeHtml(tableKey)}</span>
                    </h3>
                    ${statusBadge}
                </div>

                <div class="mb-4">
                    <div class="flex justify-between items-center text-sm font-semibold text-gray-700 mb-1">
                        <span>Kehadiran Kerusi:</span>
                        <span class="text-blue-600 font-bold">${hadir} / ${total} Duduk</span>
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div class="${progressBg} h-2.5 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                    </div>
                </div>

                <div class="mt-4 pt-3 border-t border-gray-100">
                    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">10 Kerusi Fizikal Meja:</p>
                    <div class="grid grid-cols-5 gap-2 justify-items-center">
                        ${slotsHtml}
                    </div>
                </div>
            </div>

            <div class="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span class="text-gray-400">Klik untuk perincian</span>
                <span class="font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
                    Lihat Senarai
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </span>
            </div>
        `;

        tableGrid.appendChild(card);
    });

    if (renderedCount === 0 && emptyIndicator) {
        emptyIndicator.classList.remove('hidden');
    } else if (emptyIndicator) {
        emptyIndicator.classList.add('hidden');
    }
}

function openDetailModal(tableKey) {
    if (!tableModal || !modalTableName || !modalParticipantList) return;

    const tableData = groupedTables[tableKey] || { seatedParticipants: [] };
    const seated = tableData.seatedParticipants;

    const totalSeated = seated.length;
    const hadir = seated.filter(p => p.attendance_status === 'HADIR').length;
    const wakil = seated.filter(p => p.attendance_status === 'HADIR' && p.attendance_type === 'WAKIL').length;
    const hadirSendiri = hadir - wakil;
    const tidakHadir = seated.filter(p => p.attendance_status === 'TIDAK HADIR').length;
    const belumHadir = totalSeated - hadir - tidakHadir;

    modalTableName.textContent = tableKey;
    if (modalTableStats) {
        modalTableStats.innerHTML = `
            <span class="px-2.5 py-1 rounded bg-blue-50 text-blue-700 font-bold">Kerusi Fizikal: ${totalSeated} Orang</span>
            <span class="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-bold">Hadir Sendiri: ${hadirSendiri}</span>
            <span class="px-2.5 py-1 rounded bg-purple-50 text-purple-700 font-bold">Wakil: ${wakil}</span>
            <span class="px-2.5 py-1 rounded bg-rose-50 text-rose-700 font-bold">Tidak Hadir: ${tidakHadir}</span>
            <span class="px-2.5 py-1 rounded bg-amber-50 text-amber-700 font-bold">Belum Hadir: ${belumHadir}</span>
        `;
    }

    let rowsHtml = '';

    rowsHtml += `
        <tr class="bg-blue-50 border-b border-blue-200">
            <td colspan="5" class="px-4 py-2.5 text-xs font-bold text-blue-900 uppercase tracking-wider">
                Senarai Peserta Duduk Di Meja Ini
            </td>
        </tr>
    `;

    if (seated.length === 0) {
        rowsHtml += `<tr><td colspan="5" class="px-4 py-4 text-center text-gray-400 text-xs">Tiada peserta didaftarkan duduk di meja ini.</td></tr>`;
    } else {
        seated.forEach((p, idx) => {
            let statusBadge = '';
            let attendanceDetails = '';

            if (p.attendance_status === 'HADIR') {
                if (p.attendance_type === 'WAKIL') {
                    statusBadge = '<span class="px-2 py-0.5 text-xs font-bold rounded-full bg-purple-100 text-purple-800">Wakil Hadir</span>';
                    attendanceDetails = `<div class="text-[11px] text-gray-500 mt-0.5">Wakil: ${escapeHtml(p.representative_name || '')} (${formatTime(p.attendance_time)})</div>`;
                } else {
                    statusBadge = '<span class="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">Hadir Sendiri</span>';
                    attendanceDetails = `<div class="text-[11px] text-gray-500 mt-0.5">Masa: ${formatTime(p.attendance_time)}</div>`;
                }
            } else if (p.attendance_status === 'TIDAK HADIR') {
                statusBadge = '<span class="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-800">Tidak Hadir</span>';
            } else {
                statusBadge = '<span class="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">Belum Hadir</span>';
            }
            
            // Tambah penunjuk RSVP jika ada & highlight dalam modal
            let rsvpLabel = '';
            if (p.rsvp_status && p.rsvp_status !== 'BELUM SAH') {
                if (p.rsvp_status === 'TIDAK HADIR' && p.attendance_status === 'BELUM HADIR') {
                    rsvpLabel = `<div class="text-[10px] mt-1 font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-300 inline-block w-max shadow-sm">RSVP: TIDAK HADIR</div>`;
                } else {
                    rsvpLabel = `<div class="text-[10px] mt-1 font-bold px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200 inline-block w-max shadow-sm">RSVP: ${escapeHtml(p.rsvp_status)}</div>`;
                }
            }

            const isSelesai = !!p.naik_pentas_status;
            let pentasBadge = `
                <div class="inline-flex items-center gap-1 my-0.5 px-2 py-0.5 rounded text-[11px] ${isSelesai ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-gray-100 text-gray-600'}">
                    <span>${isSelesai ? 'Selesai Pentas' : 'Belum'}</span>
                </div>
            `;

            let multiNotice = '';
            if (p.totalAwards > 1) {
                if (p.hasNext) {
                    multiNotice = `
                        <div class="text-[10px] text-amber-800 font-bold mt-1 bg-amber-50 px-2 py-1 rounded border border-amber-200 inline-block shadow-sm">
                            ★ Anugerah ${p.awardIndex}/${p.totalAwards}. Selepas ini ke <strong>${escapeHtml(p.nextTable)}</strong> (Giliran #${escapeHtml(p.nextBil)}).
                        </div>
                    `;
                } else {
                    multiNotice = `
                        <div class="text-[10px] text-emerald-800 font-bold mt-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 inline-block shadow-sm">
                            ★ Ini anugerah terakhir (${p.awardIndex}/${p.totalAwards}).
                        </div>
                    `;
                }
            }

            rowsHtml += `
                <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100">
                    <td class="px-3 py-3 text-center text-xs font-mono font-bold text-gray-500 w-12 align-top">
                        ${idx + 1}
                    </td>
                    <td class="px-3 py-3 text-center text-xs font-bold text-blue-700 w-20 align-top">
                        <span class="px-2 py-1 bg-blue-100 rounded text-blue-900 block w-max mx-auto">#${escapeHtml(p.bil)}</span>
                    </td>
                    <td class="px-4 py-3 text-sm align-top">
                        <div class="font-bold text-gray-900">${escapeHtml(p.nama)}</div>
                        <div class="text-xs text-gray-600">${escapeHtml(p.sekolah)}</div>
                        <div class="text-[11px] text-gray-400 mb-1">${escapeHtml(p.kategori || '')}</div>
                        ${multiNotice}
                    </td>
                    <td class="px-4 py-3 text-sm whitespace-nowrap align-top">
                        <div>${statusBadge}</div>
                        ${attendanceDetails}
                        ${rsvpLabel}
                    </td>
                    <td class="px-3 py-3 text-center text-xs align-top">
                        <div class="flex flex-col items-center">
                            ${pentasBadge}
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    modalParticipantList.innerHTML = rowsHtml;
    tableModal.classList.remove('hidden');
}

function closeDetailModal() {
    if (tableModal) {
        tableModal.classList.add('hidden');
    }
}

window.openDetailModal = openDetailModal;
window.closeDetailModal = closeDetailModal;
window.filterByTableShortcut = filterByTableShortcut;
window.clearTableShortcut = clearTableShortcut;