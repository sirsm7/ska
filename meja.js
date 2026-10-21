const SUPABASE_URL = 'https://app.tech4ag.my';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYzMzczNjQ1LCJleHAiOjIwNzg3MzM2NDV9.vZOedqJzUn01PjwfaQp7VvRzSm4aRMr21QblPDK8AoY';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRecipients = [];
let groupedTables = {};
let activeTableShortcut = null;

const searchTableInput = document.getElementById('searchTableInput');
const resetSearchBtn = document.getElementById('resetSearchBtn');
const filterStatus = document.getElementById('filterStatus');
const tableGrid = document.getElementById('tableGrid');
const loadingIndicator = document.getElementById('loadingIndicator');
const emptyIndicator = document.getElementById('emptyIndicator');
const tableShortcutsContainer = document.getElementById('tableShortcutsContainer');

const statTotalTables = document.getElementById('statTotalTables');
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

function getPersonKey(nama, sekolah) {
    return `${(nama || '').trim().toUpperCase()}|||${(sekolah || '').trim().toUpperCase()}`;
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
        const pKey = getPersonKey(r.nama, r.sekolah);
        if (!personMap.has(pKey)) {
            personMap.set(pKey, []);
        }
        personMap.get(pKey).push(r);
    });

    const uniquePersons = [];
    personMap.forEach((records) => {
        records.sort((a, b) => (parseInt(a.bil) || 0) - (parseInt(b.bil) || 0));

        const primaryRec = records[0];
        let primaryTableKey = primaryRec.no_meja ? primaryRec.no_meja.trim().toUpperCase() : ''; 

        if (!primaryTableKey) {
            const fallback = records.find(r => r.no_meja && r.no_meja.trim() !== '');
            primaryTableKey = fallback ? fallback.no_meja.trim().toUpperCase() : 'TANPA MEJA'; 
        }

        if (primaryTableKey !== 'TANPA MEJA' && !primaryTableKey.startsWith('MEJA')) {
            primaryTableKey = 'MEJA ' + primaryTableKey;
        }

        const isAnyHadir = records.some(r => r.attendance_status === 'HADIR');
        const isAllTidakHadir = records.length > 0 && records.every(r => r.attendance_status === 'TIDAK HADIR');

        let unifiedStatus = 'BELUM HADIR';
        let latestTime = null;
        let unifiedType = null;
        let unifiedRep = null;

        if (isAnyHadir) {
            unifiedStatus = 'HADIR';
            const hadirItem = records.find(r => r.attendance_status === 'HADIR');
            latestTime = hadirItem.attendance_time;
            unifiedType = hadirItem.attendance_type;
            unifiedRep = hadirItem.representative_name;
        } else if (isAllTidakHadir) {
            unifiedStatus = 'TIDAK HADIR';
        }

        uniquePersons.push({
            pKey: getPersonKey(primaryRec.nama, primaryRec.sekolah),
            nama: primaryRec.nama,
            sekolah: primaryRec.sekolah,
            kategori: primaryRec.kategori,
            primaryBil: primaryRec.bil,
            primaryTable: primaryTableKey,
            allRecords: records,
            totalAwards: records.length,
            attendance_status: unifiedStatus,
            attendance_time: latestTime,
            attendance_type: unifiedType,
            representative_name: unifiedRep
        });
    });

    uniquePersons.forEach(person => {
        const tKey = person.primaryTable || 'TANPA MEJA';
        if (!groupedTables[tKey]) {
            groupedTables[tKey] = {
                seatedParticipants: [],
                crossTableParticipants: []
            };
        }
        groupedTables[tKey].seatedParticipants.push(person);
    });

    allRecipients.forEach(rawRec => {
        let rawTable = rawRec.no_meja ? rawRec.no_meja.trim().toUpperCase() : 'TANPA MEJA';
        if (rawTable !== 'TANPA MEJA' && !rawTable.startsWith('MEJA')) {
            rawTable = 'MEJA ' + rawTable;
        }

        const pKey = getPersonKey(rawRec.nama, rawRec.sekolah);
        const parentPerson = uniquePersons.find(p => p.pKey === pKey);

        if (parentPerson && parentPerson.primaryTable !== rawTable && rawTable !== 'TANPA MEJA') {
            if (!groupedTables[rawTable]) {
                groupedTables[rawTable] = {
                    seatedParticipants: [],
                    crossTableParticipants: []
                };
            }
            const alreadyAdded = groupedTables[rawTable].crossTableParticipants.some(c => c.rawRecord.id === rawRec.id);
            if (!alreadyAdded) {
                groupedTables[rawTable].crossTableParticipants.push({
                    rawRecord: rawRec,
                    parentPerson: parentPerson
                });
            }
        }
    });

    Object.keys(groupedTables).forEach(tKey => {
        groupedTables[tKey].seatedParticipants.sort((a, b) => (parseInt(a.primaryBil) || 0) - (parseInt(b.primaryBil) || 0));
        groupedTables[tKey].crossTableParticipants.sort((a, b) => (parseInt(a.rawRecord.bil) || 0) - (parseInt(b.rawRecord.bil) || 0));
    });
}

function updateOverviewCards() {
    const tableKeys = Object.keys(groupedTables);
    let full = 0;
    let partial = 0;
    let empty = 0;
    let totalSeatedPersons = 0;

    tableKeys.forEach(tableKey => {
        const tableData = groupedTables[tableKey];
        const seated = tableData.seatedParticipants;
        const cross = tableData.crossTableParticipants;
        
        const totalInTable = seated.length;
        const hadirCount = seated.filter(p => p.attendance_status === 'HADIR').length;
        const crossHadirCount = cross.filter(c => c.parentPerson.attendance_status === 'HADIR').length;
        
        totalSeatedPersons += totalInTable;

        if (totalInTable > 0 && hadirCount === totalInTable) {
            full++;
        } else if (hadirCount > 0 || crossHadirCount > 0) {
            partial++;
        } else {
            empty++;
        }
    });

    if (statTotalTables) statTotalTables.textContent = tableKeys.length;
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
        const cross = tableData.crossTableParticipants;
        
        const total = seated.length;
        const hadir = seated.filter(p => p.attendance_status === 'HADIR').length;
        const crossHadir = cross.filter(c => c.parentPerson.attendance_status === 'HADIR').length;
        
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
            statusIcon = `<span class="w-2 h-2 rounded-full ${(hadir > 0 || crossHadir > 0) ? 'bg-amber-400' : 'bg-gray-300'} inline-block flex-shrink-0"></span>`;
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
        const cross = tableData.crossTableParticipants;
        
        const total = seated.length;
        const hadir = seated.filter(p => p.attendance_status === 'HADIR').length;
        const crossHadir = cross.filter(c => c.parentPerson.attendance_status === 'HADIR').length;
        
        const isFull = (total > 0 && hadir === total);
        const isEmpty = (hadir === 0 && crossHadir === 0);
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
                (p.primaryBil && p.primaryBil.toString() === query) ||
                p.allRecords.some(r => r.bil && r.bil.toString() === query)
            );
            const matchCross = cross.some(c => 
                (c.rawRecord.nama && c.rawRecord.nama.toUpperCase().includes(query)) ||
                (c.rawRecord.sekolah && c.rawRecord.sekolah.toUpperCase().includes(query)) ||
                (c.rawRecord.bil && c.rawRecord.bil.toString() === query)
            );
            if (!matchTable && !matchSeated && !matchCross) return;
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
            if (hadir === 0 && crossHadir > 0) {
                statusBadge = '<span class="px-2 py-0.5 text-[11px] font-bold rounded bg-amber-100 text-amber-800">Hadir (Duduk Meja Lain)</span>';
            } else {
                statusBadge = '<span class="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800">Sebahagian Hadir</span>';
            }
            progressBg = 'bg-amber-500';
        }

        const percentage = total > 0 ? Math.round((hadir / total) * 100) : 0;

        const maxSlots = Math.max(10, total);
        let slotsHtml = '';
        for (let i = 0; i < maxSlots; i++) {
            if (i < total) {
                const p = seated[i];
                let slotColor = 'bg-gray-200 border-gray-300 text-gray-500';
                let slotTitle = `${escapeHtml(p.nama)} - Belum Hadir (Bil #${p.primaryBil})`;

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
                    <div title="${slotTitle}" class="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${slotColor} shadow-xs relative">
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

        const crossNotice = cross.length > 0 ? `
            <div class="mt-2 text-[11px] bg-amber-50 text-amber-900 px-2 py-1 rounded border border-amber-200 flex items-center justify-between">
                <span>🔔 Penerima hadiah meja ini:</span>
                <span class="font-bold">${cross.length} orang duduk di meja lain</span>
            </div>
        ` : '';

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

                ${crossNotice}
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

    const tableData = groupedTables[tableKey] || { seatedParticipants: [], crossTableParticipants: [] };
    const seated = tableData.seatedParticipants;
    const cross = tableData.crossTableParticipants;

    const totalSeated = seated.length;
    const hadir = seated.filter(p => p.attendance_status === 'HADIR').length;
    const wakil = seated.filter(p => p.attendance_status === 'HADIR' && p.attendance_type === 'WAKIL').length;
    const hadirSendiri = hadir - wakil;
    const tidakHadir = seated.filter(p => p.attendance_status === 'TIDAK HADIR').length;
    const belumHadir = totalSeated - hadir - tidakHadir;

    modalTableName.textContent = tableKey;
    if (modalTableStats) {
        modalTableStats.innerHTML = `
            <div class="flex flex-wrap gap-2 text-xs">
                <span class="px-2.5 py-1 rounded bg-blue-50 text-blue-700 font-bold">Kerusi Fizikal: ${totalSeated} Orang</span>
                <span class="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-bold">Hadir Sendiri: ${hadirSendiri}</span>
                <span class="px-2.5 py-1 rounded bg-purple-50 text-purple-700 font-bold">Wakil: ${wakil}</span>
                <span class="px-2.5 py-1 rounded bg-rose-50 text-rose-700 font-bold">Tidak Hadir: ${tidakHadir}</span>
                <span class="px-2.5 py-1 rounded bg-amber-50 text-amber-700 font-bold">Belum Hadir: ${belumHadir}</span>
                ${cross.length > 0 ? `<span class="px-2.5 py-1 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold">🔔 Panggil Dari Meja Lain: ${cross.length} Orang</span>` : ''}
            </div>
        `;
    }

    let rowsHtml = '';

    rowsHtml += `
        <tr class="bg-blue-50 border-b border-blue-200">
            <td colspan="5" class="px-4 py-2.5 text-xs font-bold text-blue-900 uppercase tracking-wider">
                Bahagian 1: Peserta Yang Duduk Di Meja Ini (Kapasiti Kerusi Fizikal)
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

            let pentasBadges = '';
            p.allRecords.forEach(rec => {
                const isSelesai = !!rec.naik_pentas_status;
                pentasBadges += `
                    <div class="inline-flex items-center gap-1 my-0.5 px-2 py-0.5 rounded text-[11px] ${isSelesai ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-gray-100 text-gray-600'}">
                        <span>#${escapeHtml(rec.bil)}:</span>
                        <span>${isSelesai ? 'Selesai Pentas' : 'Belum'}</span>
                    </div>
                `;
            });

            const multiNotice = p.totalAwards > 1 ? `
                <div class="text-[10px] text-amber-700 font-bold mt-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                    ★ ${p.totalAwards} Anugerah (Duduk di meja ini berasaskan Giliran Terawal #${escapeHtml(p.primaryBil)})
                </div>
            ` : '';

            rowsHtml += `
                <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100">
                    <td class="px-3 py-3 text-center text-xs font-mono font-bold text-gray-500 w-12">
                        ${idx + 1}
                    </td>
                    <td class="px-3 py-3 text-center text-xs font-bold text-blue-700 w-20">
                        <span class="px-2 py-1 bg-blue-100 rounded text-blue-900">#${escapeHtml(p.primaryBil)}</span>
                    </td>
                    <td class="px-4 py-3 text-sm">
                        <div class="font-bold text-gray-900">${escapeHtml(p.nama)}</div>
                        <div class="text-xs text-gray-600">${escapeHtml(p.sekolah)}</div>
                        <div class="text-[11px] text-gray-400">${escapeHtml(p.kategori || '')}</div>
                        ${multiNotice}
                    </td>
                    <td class="px-4 py-3 text-sm whitespace-nowrap">
                        <div>${statusBadge}</div>
                        ${attendanceDetails}
                    </td>
                    <td class="px-3 py-3 text-center text-xs">
                        <div class="flex flex-col items-center">
                            ${pentasBadges}
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    if (cross.length > 0) {
        rowsHtml += `
            <tr class="bg-amber-100/80 border-y-2 border-amber-300">
                <td colspan="5" class="px-4 py-2.5 text-xs font-black text-amber-950 uppercase tracking-wider flex items-center justify-between">
                    <span>Bahagian 2: Senarai Semakan Pengurus Peserta (Penerima Hadiah Meja Ini Yang Duduk Di Meja Lain)</span>
                    <span class="text-[11px] bg-amber-200 px-2 py-0.5 rounded border border-amber-400 font-bold">Tindakan: Panggil Dari Meja Duduk Fizikal</span>
                </td>
            </tr>
        `;

        cross.forEach(c => {
            const r = c.rawRecord;
            const parent = c.parentPerson;
            const isSelesai = !!r.naik_pentas_status;

            rowsHtml += `
                <tr class="bg-amber-50/40 hover:bg-amber-50 transition-colors border-b border-amber-200">
                    <td class="px-3 py-3 text-center text-xs font-bold text-amber-600">
                        -
                    </td>
                    <td class="px-3 py-3 text-center text-xs font-bold text-gray-800">
                        <span class="px-2 py-1 bg-gray-800 text-white rounded font-mono">#${escapeHtml(r.bil)}</span>
                    </td>
                    <td class="px-4 py-3 text-sm">
                        <div class="font-bold text-gray-900">${escapeHtml(r.nama)}</div>
                        <div class="text-xs text-gray-600">${escapeHtml(r.sekolah)} - ${escapeHtml(r.kategori || '')}</div>
                        <div class="mt-1.5 text-xs font-bold text-amber-900 bg-amber-100 px-2.5 py-1 rounded border border-amber-300 inline-flex flex-wrap items-center gap-1.5 shadow-xs">
                            <span>🔔 PENGURUS PESERTA:</span>
                            <span>Panggil peserta dari tempat duduk:</span>
                            <span class="bg-blue-600 text-white px-2 py-0.2 rounded font-black">${escapeHtml(parent.primaryTable)}</span>
                            <span class="text-slate-600 font-normal text-[11px]">(Giliran Hadiah Terawal #${escapeHtml(parent.primaryBil)})</span>
                        </div>
                    </td>
                    <td class="px-4 py-3 text-sm whitespace-nowrap">
                        <span class="px-2 py-0.5 text-xs font-bold rounded-full ${parent.attendance_status === 'HADIR' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-100 text-gray-700'}">
                            ${escapeHtml(parent.attendance_status)}
                        </span>
                    </td>
                    <td class="px-3 py-3 text-center text-xs">
                        <span class="px-2 py-0.5 text-[11px] rounded font-bold ${isSelesai ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-100 text-gray-600'}">
                            ${isSelesai ? `Selesai Pentas #${escapeHtml(r.bil)}` : 'Belum Naik Pentas'}
                        </span>
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