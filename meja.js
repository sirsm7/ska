const SUPABASE_URL = 'https://app.tech4ag.my';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYzMzczNjQ1LCJleHAiOjIwNzg3MzM2NDV9.vZOedqJzUn01PjwfaQp7VvRzSm4aRMr21QblPDK8AoY';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRecipients = [];
let groupedTables = {};

// DOM Elements
const searchTableInput = document.getElementById('searchTableInput');
const resetSearchBtn = document.getElementById('resetSearchBtn');
const filterStatus = document.getElementById('filterStatus');
const tableGrid = document.getElementById('tableGrid');
const loadingIndicator = document.getElementById('loadingIndicator');
const emptyIndicator = document.getElementById('emptyIndicator');

// Stats Elements
const statTotalTables = document.getElementById('statTotalTables');
const statFullTables = document.getElementById('statFullTables');
const statPartialTables = document.getElementById('statPartialTables');
const statEmptyTables = document.getElementById('statEmptyTables');
const statTotalParticipants = document.getElementById('statTotalParticipants');

// Detail Modal Elements
const tableModal = document.getElementById('tableModal');
const modalTableName = document.getElementById('modalTableName');
const modalTableStats = document.getElementById('modalTableStats');
const modalParticipantList = document.getElementById('modalParticipantList');
const closeTableModalBtn = document.getElementById('closeTableModalBtn');
const logoutBtn = document.getElementById('logoutBtn');

function checkSession() {
    if (localStorage.getItem('isAdminLoggedIn') !== 'true') {
        window.location.href = 'admin.html';
        return false;
    }
    return true;
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
            localStorage.removeItem('isAdminLoggedIn');
            window.location.href = 'admin.html';
        });
    }

    if (searchTableInput) {
        searchTableInput.addEventListener('input', () => {
            if (searchTableInput.value.trim().length > 0) {
                if (resetSearchBtn) resetSearchBtn.classList.remove('hidden');
            } else {
                if (resetSearchBtn) resetSearchBtn.classList.add('hidden');
            }
            renderTableGrid();
        });
    }

    if (resetSearchBtn) {
        resetSearchBtn.addEventListener('click', () => {
            searchTableInput.value = '';
            resetSearchBtn.classList.add('hidden');
            renderTableGrid();
            searchTableInput.focus();
        });
    }

    if (filterStatus) {
        filterStatus.addEventListener('change', renderTableGrid);
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
        renderTableGrid();
    } catch (err) {
        console.error('Ralat menarik data meja:', err);
        alert('Gagal memuat turun data penerima dari pelayan.');
    } finally {
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
    }
}

// Make fetchTableData globally available for refresh button
window.fetchTableData = fetchTableData;

function groupDataByTable() {
    groupedTables = {};

    allRecipients.forEach(r => {
        const tableKey = (r.no_meja && r.no_meja.trim() !== '') ? r.no_meja.trim() : 'Tanpa Meja';
        if (!groupedTables[tableKey]) {
            groupedTables[tableKey] = [];
        }
        groupedTables[tableKey].push(r);
    });
}

function naturalSort(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function updateOverviewCards() {
    const tableKeys = Object.keys(groupedTables);
    let full = 0;
    let partial = 0;
    let empty = 0;

    tableKeys.forEach(tableKey => {
        const list = groupedTables[tableKey];
        const hadirCount = list.filter(p => p.attendance_status === 'HADIR').length;
        const totalInTable = list.length;

        if (totalInTable > 0 && hadirCount === totalInTable) {
            full++;
        } else if (hadirCount > 0 && hadirCount < totalInTable) {
            partial++;
        } else {
            empty++;
        }
    });

    if (statTotalTables) statTotalTables.textContent = tableKeys.length;
    if (statFullTables) statFullTables.textContent = full;
    if (statPartialTables) statPartialTables.textContent = partial;
    if (statEmptyTables) statEmptyTables.textContent = empty;
    if (statTotalParticipants) statTotalParticipants.textContent = allRecipients.length;
}

function renderTableGrid() {
    if (!tableGrid) return;
    tableGrid.innerHTML = '';

    const query = searchTableInput ? searchTableInput.value.trim().toUpperCase() : '';
    const selectedFilter = filterStatus ? filterStatus.value : 'ALL';

    const sortedTableKeys = Object.keys(groupedTables).sort((a, b) => {
        if (a === 'Tanpa Meja') return 1;
        if (b === 'Tanpa Meja') return -1;
        return naturalSort(a, b);
    });

    let renderedCount = 0;

    sortedTableKeys.forEach(tableKey => {
        const participants = groupedTables[tableKey];
        const total = participants.length;
        const hadir = participants.filter(p => p.attendance_status === 'HADIR').length;
        const wakil = participants.filter(p => p.attendance_status === 'HADIR' && p.attendance_type === 'WAKIL').length;
        const hadirSendiri = hadir - wakil;
        const tidakHadir = participants.filter(p => p.attendance_status === 'TIDAK HADIR').length;
        const belumHadir = total - hadir - tidakHadir;

        // Tapis mengikut status
        const isFull = (total > 0 && hadir === total);
        const isEmpty = (hadir === 0);
        const isPartial = (hadir > 0 && hadir < total);

        if (selectedFilter === 'PENUH' && !isFull) return;
        if (selectedFilter === 'SEPARA' && !isPartial) return;
        if (selectedFilter === 'KOSONG' && !isEmpty) return;

        // Tapis mengikut carian meja atau peserta
        if (query) {
            const matchTable = tableKey.toUpperCase().includes(query);
            const matchParticipant = participants.some(p => 
                (p.nama && p.nama.toUpperCase().includes(query)) ||
                (p.sekolah && p.sekolah.toUpperCase().includes(query)) ||
                (p.bil && p.bil.toString() === query)
            );
            if (!matchTable && !matchParticipant) return;
        }

        renderedCount++;

        // Status Card Styling
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

        // 10-Slot Visual Representation (Meja Bulat 10 Peserta)
        const maxSlots = Math.max(10, total);
        let slotsHtml = '';
        for (let i = 0; i < maxSlots; i++) {
            if (i < total) {
                const p = participants[i];
                let slotColor = 'bg-gray-200 border-gray-300 text-gray-500';
                let slotTitle = `${escapeHtml(p.nama)} - Belum Hadir`;

                if (p.attendance_status === 'HADIR') {
                    if (p.attendance_type === 'WAKIL') {
                        slotColor = 'bg-purple-500 text-white border-purple-600';
                        slotTitle = `${escapeHtml(p.nama)} - Wakil Hadir (${escapeHtml(p.representative_name || '')})`;
                    } else {
                        slotColor = 'bg-emerald-500 text-white border-emerald-600';
                        slotTitle = `${escapeHtml(p.nama)} - Hadir`;
                    }
                } else if (p.attendance_status === 'TIDAK HADIR') {
                    slotColor = 'bg-rose-500 text-white border-rose-600';
                    slotTitle = `${escapeHtml(p.nama)} - Tidak Hadir`;
                }

                slotsHtml += `
                    <div title="${slotTitle}" class="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${slotColor} shadow-xs">
                        ${i + 1}
                    </div>
                `;
            } else {
                // Kerusi kosong jika kurang daripada 10
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
                        <span>Kehadiran:</span>
                        <span class="text-blue-600 font-bold">${hadir} / ${total} Hadir</span>
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div class="${progressBg} h-2.5 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                    </div>
                </div>

                <div class="mt-4 pt-3 border-t border-gray-100">
                    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Kedudukan 10 Kerusi Peserta:</p>
                    <div class="grid grid-cols-5 gap-2 justify-items-center">
                        ${slotsHtml}
                    </div>
                </div>
            </div>

            <div class="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span class="text-gray-400">Klik untuk lihat senarai</span>
                <span class="font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
                    Perincian
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

    const participants = groupedTables[tableKey] || [];
    const total = participants.length;
    const hadir = participants.filter(p => p.attendance_status === 'HADIR').length;
    const wakil = participants.filter(p => p.attendance_status === 'HADIR' && p.attendance_type === 'WAKIL').length;
    const hadirSendiri = hadir - wakil;
    const tidakHadir = participants.filter(p => p.attendance_status === 'TIDAK HADIR').length;
    const belumHadir = total - hadir - tidakHadir;

    modalTableName.textContent = tableKey;
    if (modalTableStats) {
        modalTableStats.innerHTML = `
            <div class="flex flex-wrap gap-2 text-xs">
                <span class="px-2 py-1 rounded bg-blue-50 text-blue-700 font-semibold">Kapasiti: ${total} Orang</span>
                <span class="px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-semibold">Hadir Sendiri: ${hadirSendiri}</span>
                <span class="px-2 py-1 rounded bg-purple-50 text-purple-700 font-semibold">Wakil: ${wakil}</span>
                <span class="px-2 py-1 rounded bg-rose-50 text-rose-700 font-semibold">Tidak Hadir: ${tidakHadir}</span>
                <span class="px-2 py-1 rounded bg-amber-50 text-amber-700 font-semibold">Belum Hadir: ${belumHadir}</span>
            </div>
        `;
    }

    let rowsHtml = '';
    participants.forEach((p, idx) => {
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

        const pentasBadge = p.naik_pentas_status 
            ? '<span class="text-[10px] font-bold text-emerald-600 block">Selesai Pentas</span>' 
            : '<span class="text-[10px] text-gray-400 block">Belum Pentas</span>';

        rowsHtml += `
            <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100">
                <td class="px-3 py-3 text-center text-xs font-mono font-bold text-gray-500 w-12">
                    ${idx + 1}
                </td>
                <td class="px-3 py-3 text-center text-xs font-bold text-blue-700 w-16">
                    ${escapeHtml(p.bil)}
                </td>
                <td class="px-4 py-3 text-sm">
                    <div class="font-bold text-gray-900">${escapeHtml(p.nama)}</div>
                    <div class="text-xs text-gray-500">${escapeHtml(p.sekolah)}</div>
                    <div class="text-[11px] text-gray-400">${escapeHtml(p.kategori)}</div>
                </td>
                <td class="px-4 py-3 text-sm whitespace-nowrap">
                    <div>${statusBadge}</div>
                    ${attendanceDetails}
                </td>
                <td class="px-3 py-3 text-center text-xs whitespace-nowrap">
                    ${pentasBadge}
                </td>
            </tr>
        `;
    });

    if (rowsHtml === '') {
        rowsHtml = `<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400 text-sm">Tiada peserta didaftarkan di meja ini.</td></tr>`;
    }

    modalParticipantList.innerHTML = rowsHtml;
    tableModal.classList.remove('hidden');
}

function closeDetailModal() {
    if (tableModal) {
        tableModal.classList.add('hidden');
    }
}

// Make functions globally accessible
window.openDetailModal = openDetailModal;
window.closeDetailModal = closeDetailModal;