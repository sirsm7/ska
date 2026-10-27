const SUPABASE_URL = 'https://app.tech4ag.my';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYzMzczNjQ1LCJleHAiOjIwNzg3MzM2NDV9.vZOedqJzUn01PjwfaQp7VvRzSm4aRMr21QblPDK8AoY';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRecipients = [];
let personProfilesMap = new Map();
let currentRole = null; 
let searchTimer;
const doneTypingInterval = 400;

const loginScreen = document.getElementById('loginScreen');
const mainContent = document.getElementById('mainContent');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginError = document.getElementById('loginError');

const superAdminControls = document.getElementById('superAdminControls');
const roleIndicator = document.getElementById('roleIndicator');

const msgModal = document.getElementById('msgModal');
const msgTitle = document.getElementById('msgTitle');
const msgBody = document.getElementById('msgBody');
const confirmModal = document.getElementById('confirmModal');
const confirmResetAllModal = document.getElementById('confirmResetAllModal');
const confirmResetModal = document.getElementById('confirmResetModal');
const resetTargetName = document.getElementById('resetTargetName');
const resetTargetId = document.getElementById('resetTargetId');
const btnConfirmReset = document.getElementById('btnConfirmReset');
const processModal = document.getElementById('processModal');
const processText = document.getElementById('processText');

const filterStatus = document.getElementById('filterStatus');
const filterPentasStatus = document.getElementById('filterPentasStatus');
const filterKategori = document.getElementById('filterKategori');
const adminSearchInput = document.getElementById('adminSearchInput');
const adminResetSearchBtn = document.getElementById('adminResetSearchBtn');
const tableLoading = document.getElementById('tableLoading');
const reportTableBody = document.getElementById('reportTableBody');
const wakilList = document.getElementById('wakilList');
const wakilEmpty = document.getElementById('wakilEmpty');

const statTotal = document.getElementById('statTotal');
const statRsvp = document.getElementById('statRsvp');
const statHadir = document.getElementById('statHadir');
const statWakil = document.getElementById('statWakil');
const statTidakHadir = document.getElementById('statTidakHadir');
const statBelum = document.getElementById('statBelum');

let resetTargetRecipient = null;

function checkSession() {
    const savedRole = localStorage.getItem('adminRole');
    
    if (savedRole === 'SUPERADMIN' || savedRole === 'PENGURUS') {
        currentRole = savedRole;
        
        if (loginScreen) loginScreen.classList.add('hidden');
        if (mainContent) mainContent.classList.remove('hidden');
        
        if (currentRole === 'PENGURUS') {
            if (superAdminControls) superAdminControls.classList.add('hidden');
            if (roleIndicator) {
                roleIndicator.classList.remove('hidden');
                roleIndicator.textContent = 'PENGURUS PESERTA';
            }
        } else {
            if (superAdminControls) superAdminControls.classList.remove('hidden');
            if (roleIndicator) {
                roleIndicator.classList.remove('hidden');
                roleIndicator.textContent = 'SUPER ADMIN';
                roleIndicator.classList.replace('bg-blue-800', 'bg-red-700');
                roleIndicator.classList.replace('border-blue-400', 'border-red-400');
            }
        }
        
        fetchData();
    } else {
        currentRole = null;
        if (loginScreen) loginScreen.classList.remove('hidden');
        if (mainContent) mainContent.classList.add('hidden');
        if (passwordInput) passwordInput.value = '';
    }
}

window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
        checkSession();
    }
});

if (loginBtn) loginBtn.addEventListener('click', handleLogin);
if (passwordInput) {
    passwordInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') handleLogin();
    });
}

function handleLogin() {
    const pwd = passwordInput.value;
    
    if (pwd === 'ppdag@12345') {
        localStorage.setItem('adminRole', 'SUPERADMIN');
        loginError.classList.add('hidden');
        checkSession();
    } else if (pwd === 'jpnmel2026') {
        localStorage.setItem('adminRole', 'PENGURUS');
        loginError.classList.add('hidden');
        checkSession();
    } else {
        loginError.classList.remove('hidden');
    }
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
        localStorage.removeItem('adminRole');
        checkSession();
    });
}

document.addEventListener('DOMContentLoaded', checkSession);

// Listeners untuk carian dan penapis
if (adminSearchInput) {
    adminSearchInput.addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
        if (e.target.value.trim().length > 0) {
            adminResetSearchBtn.classList.remove('hidden');
        } else {
            adminResetSearchBtn.classList.add('hidden');
        }
        clearTimeout(searchTimer);
        searchTimer = setTimeout(renderTables, doneTypingInterval);
    });

    adminSearchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            clearAdminSearch();
        }
    });
}

if (adminResetSearchBtn) {
    adminResetSearchBtn.addEventListener('click', clearAdminSearch);
}

if (filterStatus) filterStatus.addEventListener('change', renderTables);
if (filterPentasStatus) filterPentasStatus.addEventListener('change', renderTables);
if (filterKategori) filterKategori.addEventListener('change', renderTables);

function clearAdminSearch() {
    if (adminSearchInput) {
        adminSearchInput.value = '';
        adminSearchInput.focus();
    }
    if (adminResetSearchBtn) adminResetSearchBtn.classList.add('hidden');
    renderTables();
}

function showMsg(title, msg) {
    msgTitle.textContent = title;
    msgBody.textContent = msg;
    msgModal.classList.remove('hidden');
}

function closeMsgModal() {
    msgModal.classList.add('hidden');
}

function confirmClearData() {
    if (currentRole !== 'SUPERADMIN') return;
    confirmModal.classList.remove('hidden');
}

function closeConfirmModal() {
    confirmModal.classList.add('hidden');
}

function confirmResetAll() {
    if (currentRole !== 'SUPERADMIN') return;
    confirmResetAllModal.classList.remove('hidden');
}

function closeConfirmResetAllModal() {
    confirmResetAllModal.classList.add('hidden');
}

function showProcess(text) {
    processText.textContent = text;
    processModal.classList.remove('hidden');
}

function hideProcess() {
    processModal.classList.add('hidden');
}

function getPersonKey(nama, sekolah) {
    return `${(nama || '').trim().toUpperCase()}|||${(sekolah || '').trim().toUpperCase()}`;
}

function buildProfiles() {
    personProfilesMap = new Map();
    allRecipients.forEach(r => {
        const key = getPersonKey(r.nama, r.sekolah);
        if (!personProfilesMap.has(key)) {
            personProfilesMap.set(key, []);
        }
        personProfilesMap.get(key).push(r);
    });

    personProfilesMap.forEach(records => {
        // NATURAL SORT: Meja dahulu, kemudian Bil (Memastikan anugerah meja terawal menjadi primary)
        records.sort((a, b) => {
            const mejaA = a.no_meja ? a.no_meja.toString().toUpperCase().replace(/^MEJA\s*/, '').trim() : '';
            const mejaB = b.no_meja ? b.no_meja.toString().toUpperCase().replace(/^MEJA\s*/, '').trim() : '';
            
            const cmp = mejaA.localeCompare(mejaB, undefined, { numeric: true, sensitivity: 'base' });
            if (cmp !== 0) return cmp;
            
            return (parseInt(a.bil) || 0) - (parseInt(b.bil) || 0);
        });
    });
}

function confirmReset(id, name, sekolah) {
    if (currentRole !== 'SUPERADMIN') {
        showMsg('Akses Ditolak', 'Hanya Super Admin dibenarkan menetapkan semula (reset) status kehadiran individu.');
        return;
    }
    resetTargetId.value = id;
    resetTargetName.textContent = name;
    resetTargetRecipient = { id, name, sekolah };
    confirmResetModal.classList.remove('hidden');
}

function closeResetModal() {
    confirmResetModal.classList.add('hidden');
    btnConfirmReset.innerHTML = 'Reset Status';
    btnConfirmReset.disabled = false;
    resetTargetRecipient = null;
}

async function executeResetAll() {
    if (currentRole !== 'SUPERADMIN') return;
    
    closeConfirmResetAllModal();
    showProcess('Melaksanakan reset pukal kehadiran & RSVP...');
    try {
        const { error } = await supabaseClient
            .from('recipients')
            .update({
                attendance_status: 'BELUM HADIR',
                attendance_time: null,
                attendance_type: null,
                representative_name: null,
                naik_pentas_status: false,
                rsvp_status: 'BELUM SAH',
                rsvp_time: null
            })
            .neq('id', '00000000-0000-0000-0000-000000000000'); 

        if (error) throw error;
        
        hideProcess();
        showMsg('Berjaya', 'Semua status kehadiran, pengesahan awal (RSVP) & pentas telah dikembalikan kepada asal.');
        fetchData(); 
    } catch (error) {
        console.error("Error reset pukal:", error);
        hideProcess();
        showMsg('Ralat', 'Gagal melaksanakan reset pukal pangkalan data.');
    }
}

async function executeResetData() {
    if (currentRole !== 'SUPERADMIN' || !resetTargetRecipient) return;
    const { name, sekolah } = resetTargetRecipient;
    btnConfirmReset.innerHTML = 'Memproses...';
    btnConfirmReset.disabled = true;
    
    try {
        const { error } = await supabaseClient
            .from('recipients')
            .update({
                attendance_status: 'BELUM HADIR',
                attendance_time: null,
                attendance_type: null,
                representative_name: null,
                naik_pentas_status: false,
                rsvp_status: 'BELUM SAH',
                rsvp_time: null
            })
            .match({ nama: name, sekolah: sekolah });

        if (error) throw error;
        
        closeResetModal();
        showMsg('Berjaya', `Status kehadiran dan RSVP bagi ${name} telah dikembalikan kepada asal.`);
        fetchData(); 
    } catch (error) {
        console.error("Error reset individu:", error);
        btnConfirmReset.innerHTML = 'Reset Status';
        btnConfirmReset.disabled = false;
        showMsg('Ralat', 'Gagal menetapkan semula status individu.');
    }
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

// Fungsi baharu untuk membina dropdown kategori secara dinamik
function populateKategoriDropdown(data) {
    if (!filterKategori) return;
    
    const currentSelection = filterKategori.value;
    
    // Ekstrak kategori unik, abaikan nilai kosong/null
    const uniqueKategori = [...new Set(data.map(item => item.kategori).filter(k => k && k.trim() !== ''))];
    
    // Sort kategori mengikut susunan abjad
    uniqueKategori.sort((a, b) => a.localeCompare(b));
    
    // Bina pilihan dropdown
    let optionsHtml = '<option value="ALL">Semua Kategori</option>';
    uniqueKategori.forEach(kat => {
        const safeKat = escapeHtml(kat);
        optionsHtml += `<option value="${safeKat}">Kategori: ${safeKat}</option>`;
    });
    
    filterKategori.innerHTML = optionsHtml;
    
    // Kekalkan pilihan sebelumnya jika ada dan masih wujud dalam senarai baharu
    if (uniqueKategori.includes(currentSelection) || currentSelection === 'ALL') {
        filterKategori.value = currentSelection;
    }
}

async function fetchData() {
    if (!currentRole) return;

    if (reportTableBody) reportTableBody.innerHTML = '';
    if (tableLoading) tableLoading.classList.remove('hidden');

    try {
        const { data, error } = await supabaseClient
            .from('recipients')
            .select('*');

        if (error) throw error;
        allRecipients = data || [];
        
        // Pelaksanaan Natural Sort untuk 'no_meja' diikuti 'bil'
        allRecipients.sort((a, b) => {
            const mejaA = a.no_meja ? a.no_meja.toString().toUpperCase().replace(/^MEJA\s*/, '').trim() : '';
            const mejaB = b.no_meja ? b.no_meja.toString().toUpperCase().replace(/^MEJA\s*/, '').trim() : '';
            
            const cmp = mejaA.localeCompare(mejaB, undefined, { numeric: true, sensitivity: 'base' });
            
            if (cmp !== 0) return cmp;
            
            const bilA = parseInt(a.bil) || 0;
            const bilB = parseInt(b.bil) || 0;
            return bilA - bilB;
        });
        
        populateKategoriDropdown(allRecipients);
        buildProfiles();
        updateDashboard();
        renderTables();
    } catch (error) {
        console.error("Error fetching:", error);
        showMsg('Ralat', 'Gagal memuat turun data dari pelayan.');
    } finally {
        if (tableLoading) tableLoading.classList.add('hidden');
    }
}

function updateDashboard() {
    let total = allRecipients.length;
    let hadir = 0;
    let wakil = 0;
    let tidakHadir = 0;
    let belum = 0;
    let rsvpCount = 0;

    allRecipients.forEach(r => {
        if (r.rsvp_status && r.rsvp_status !== 'BELUM SAH') {
            rsvpCount++;
        }
        
        if (r.attendance_status === 'HADIR') {
            if (r.attendance_type === 'WAKIL') wakil++;
            else hadir++;
        } else if (r.attendance_status === 'TIDAK HADIR') {
            tidakHadir++;
        } else {
            belum++;
        }
    });

    if (statTotal) statTotal.textContent = total;
    if (statRsvp) statRsvp.textContent = rsvpCount;
    if (statHadir) statHadir.textContent = hadir;
    if (statWakil) statWakil.textContent = wakil;
    if (statTidakHadir) statTidakHadir.textContent = tidakHadir;
    if (statBelum) statBelum.textContent = belum;
}

async function toggleNaikPentas(id, currentStatus) {
    const newStatus = !currentStatus;
    
    const cbDesktop = document.getElementById(`pentas-check-dt-${id}`);
    const cbMobile = document.getElementById(`pentas-check-mb-${id}`);
    const contDesktop = document.getElementById(`pentas-container-dt-${id}`);
    const contMobile = document.getElementById(`pentas-container-mb-${id}`);
    
    if (cbDesktop) cbDesktop.disabled = true;
    if (cbMobile) cbMobile.disabled = true;
    
    const loadingText = '<span class="text-xs text-gray-500">Menyimpan...</span>';
    if (contDesktop) contDesktop.innerHTML = loadingText;
    if (contMobile) contMobile.innerHTML = loadingText;

    try {
        const { error } = await supabaseClient
            .from('recipients')
            .update({ naik_pentas_status: newStatus })
            .eq('id', id);

        if (error) throw error;
        
        const index = allRecipients.findIndex(r => r.id === id);
        if (index !== -1) {
            allRecipients[index].naik_pentas_status = newStatus;
        }
        
        renderTables();
    } catch (error) {
        console.error("Ralat kemaskini status pentas:", error);
        showMsg('Ralat', 'Gagal menyimpan status naik pentas.');
        
        if (cbDesktop) {
            cbDesktop.checked = currentStatus;
            cbDesktop.disabled = false;
        }
        if (cbMobile) {
            cbMobile.checked = currentStatus;
            cbMobile.disabled = false;
        }
        renderTables(); 
    }
}

function renderTables() {
    if (!reportTableBody) return;
    
    const filterKehadiran = filterStatus ? filterStatus.value : 'ALL';
    const filterPentas = filterPentasStatus ? filterPentasStatus.value : 'ALL';
    const filterKat = filterKategori ? filterKategori.value : 'ALL';
    const searchQuery = adminSearchInput ? adminSearchInput.value.trim().toUpperCase() : '';
    
    let filteredData = allRecipients;
    
    if (filterKat !== 'ALL') {
        filteredData = filteredData.filter(r => r.kategori && r.kategori === filterKat);
    }

    if (filterKehadiran !== 'ALL') {
        filteredData = filteredData.filter(r => r.attendance_status === filterKehadiran);
    }

    if (filterPentas === 'BELUM_NAIK') {
        filteredData = filteredData.filter(r => !r.naik_pentas_status);
    } else if (filterPentas === 'SUDAH_NAIK') {
        filteredData = filteredData.filter(r => r.naik_pentas_status);
    }
    
    // Applikasi logik carian teks
    if (searchQuery) {
        const qNum = parseInt(searchQuery);
        const queryCleanTable = searchQuery.replace(/^MEJA\s*/i, '').trim();

        filteredData = filteredData.filter(r => {
            const nameMatch = r.nama && r.nama.toUpperCase().includes(searchQuery);
            const schoolMatch = r.sekolah && r.sekolah.toUpperCase().includes(searchQuery);
            const bilMatch = !isNaN(qNum) && r.bil === qNum;
            const tableStr = r.no_meja ? r.no_meja.toString().toUpperCase() : '';
            const tableMatch = tableStr !== '' && (
                tableStr.includes(searchQuery) ||
                (queryCleanTable !== '' && tableStr === queryCleanTable) ||
                (queryCleanTable !== '' && tableStr === `MEJA ${queryCleanTable}`)
            );
            return nameMatch || schoolMatch || bilMatch || tableMatch;
        });
    }

    let html = '';
    filteredData.forEach(row => {
        let statusBadge = '';
        let extraInfo = '';
        let isModified = false;
        
        const isHadir = row.attendance_status === 'HADIR';
        const hasRsvp = row.rsvp_status && row.rsvp_status !== 'BELUM SAH';
        
        const pKey = getPersonKey(row.nama, row.sekolah);
        const personRecords = personProfilesMap.get(pKey) || [row];
        const totalAwards = personRecords.length;
        const currentIndex = personRecords.findIndex(r => r.id === row.id);
        const awardIndex = currentIndex + 1;
        
        const rawCurrentTable = row.no_meja ? row.no_meja : '-';
        const currentTableFormatted = (rawCurrentTable !== '-' && !rawCurrentTable.toString().toUpperCase().startsWith('MEJA'))
            ? 'MEJA ' + rawCurrentTable : rawCurrentTable;

        let tableDisplayHtml = '';
        
        if (totalAwards > 1) {
            const nextRecord = personRecords[currentIndex + 1];
            
            if (nextRecord) {
                const rawNextTable = nextRecord.no_meja ? nextRecord.no_meja : '-';
                const nextTableFormatted = (rawNextTable !== '-' && !rawNextTable.toString().toUpperCase().startsWith('MEJA'))
                    ? 'MEJA ' + rawNextTable : rawNextTable;
                    
                tableDisplayHtml = `
                    <div class="mt-1.5 flex flex-col gap-1.5 p-2 bg-amber-50 border border-amber-300 rounded shadow-sm">
                        <div class="flex flex-wrap items-center gap-1.5 text-xs font-bold text-gray-800">
                            <span>MEJA GILIRAN INI:</span>
                            <span class="bg-gray-800 text-white px-2 py-0.5 rounded font-black">${escapeHtml(currentTableFormatted)}</span>
                        </div>
                        <div class="text-[11px] font-bold text-amber-900 bg-amber-100 px-2.5 py-2 rounded border border-amber-300">
                            <span class="block mb-1 text-xs">🔔 <strong>ARAHAN PENGURUS PESERTA:</strong></span>
                            Selepas turun dari pentas, arahkan peserta bergerak ke <strong>${escapeHtml(nextTableFormatted)}</strong> untuk bersedia bagi giliran anugerah <strong>#${escapeHtml(nextRecord.bil)}</strong>.
                        </div>
                    </div>
                `;
            } else {
                tableDisplayHtml = `
                    <div class="mt-1.5 flex flex-col gap-1.5 p-2 bg-emerald-50 border border-emerald-300 rounded shadow-sm">
                        <div class="flex flex-wrap items-center gap-1.5 text-xs font-bold text-gray-800">
                            <span>MEJA GILIRAN INI:</span>
                            <span class="bg-gray-800 text-white px-2 py-0.5 rounded font-black">${escapeHtml(currentTableFormatted)}</span>
                        </div>
                        <div class="text-[11px] font-bold text-emerald-900 bg-emerald-100 px-2.5 py-2 rounded border border-emerald-300">
                            <span class="block mb-1 text-xs">✅ <strong>ARAHAN PENGURUS PESERTA:</strong></span>
                            Ini adalah anugerah TERAKHIR peserta. Selepas turun pentas, peserta boleh kembali ke mana-mana tempat duduk kosong asal mereka atau mengikut protokol majlis.
                        </div>
                    </div>
                `;
            }
        } else {
            tableDisplayHtml = `
                <div class="mt-1.5 text-[11px] font-semibold text-blue-700 flex items-center gap-1">
                    🪑 Meja Semasa: <span class="font-bold text-blue-900 bg-blue-100 px-1.5 py-0.5 rounded">${escapeHtml(currentTableFormatted)}</span>
                </div>
            `;
        }

        if (isHadir) {
            isModified = true;
            if (row.attendance_type === 'WAKIL') {
                statusBadge = `<span class="px-2 py-1 inline-flex text-[11px] md:text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">Wakil Hadir</span>`;
                extraInfo = `<div class="text-xs text-gray-500 mt-1">Masa: ${formatTime(row.attendance_time)}<br/>Wakil: <span class="font-semibold text-gray-700">${escapeHtml(row.representative_name)}</span></div>`;
            } else {
                statusBadge = `<span class="px-2 py-1 inline-flex text-[11px] md:text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Hadir</span>`;
                extraInfo = `<div class="text-xs text-gray-500 mt-1">Masa: ${formatTime(row.attendance_time)}</div>`;
            }
        } else if (row.attendance_status === 'TIDAK HADIR') {
            isModified = true;
            statusBadge = `<span class="px-2 py-1 inline-flex text-[11px] md:text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Tidak Hadir</span>`;
        } else {
            statusBadge = `<span class="px-2 py-1 inline-flex text-[11px] md:text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Belum Hadir</span>`;
        }

        // Logik Penonjolan Lencana RSVP
        let rsvpInfo = '';
        if(hasRsvp) {
            if (row.rsvp_status === 'TIDAK HADIR' && !isHadir) {
                rsvpInfo = `<div class="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-300 shadow-sm">RSVP: TIDAK HADIR</div>`;
            } else {
                rsvpInfo = `<div class="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold rsvp-badge shadow-sm">RSVP: ${escapeHtml(row.rsvp_status)}</div>`;
            }
        }

        const safeNama = row.nama ? row.nama.replace(/'/g, "\\'") : '';
        const safeSekolah = row.sekolah ? row.sekolah.replace(/'/g, "\\'") : '';

        // Butang reset hanya ditunjukkan jika pengguna adalah superadmin
        const resetBtn = (isModified && currentRole === 'SUPERADMIN') ? 
            `<button onclick="confirmReset('${row.id}', '${safeNama}', '${safeSekolah}')" class="mt-2 text-[10px] md:text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300 py-1 px-2 rounded transition-colors inline-flex items-center w-max">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                Reset Kehadiran
            </button>` : '';

        const isNaikPentas = !!row.naik_pentas_status;
        const rowClass = isNaikPentas ? 'naik-pentas-row' : 'hover:bg-gray-50 transition-colors';
        const pentasLabel = isNaikPentas 
            ? `<span class="text-[10px] md:text-xs font-bold text-green-700 block mt-1">SELESAI #${escapeHtml(row.bil)}</span>` 
            : (totalAwards > 1 ? `<span class="text-[9px] text-gray-500 block mt-0.5 font-medium">Pentas ${awardIndex}/${totalAwards}</span>` : '');
        const notPresentMsg = !isHadir ? `<span class="text-[9px] md:text-[10px] text-gray-500 mt-1 italic block text-center leading-tight">Belum lapor<br>hadir</span>` : '';
        const disabledAttr = !isHadir ? 'disabled' : '';
        
        const giliranCircle = `<div class="inline-flex h-10 w-10 ${isNaikPentas ? 'bg-green-200 border-green-400 text-green-800' : 'bg-blue-100 border-blue-300 text-blue-800'} rounded-full items-center justify-center border-2 text-sm font-black mx-auto mb-2 shadow-sm">
                        ${escapeHtml(row.bil)}
                    </div>`;

        const multiAwardTag = totalAwards > 1 ? `
            <span class="inline-flex items-center text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300 ml-1">
                ★ Anugerah ${awardIndex}/${totalAwards}
            </span>
        ` : '';

        html += `
            <tr id="row-${row.id}" class="${rowClass} border-b border-gray-100">
                
                <td class="md:hidden px-2 py-4 align-top w-20 text-center border-r border-gray-100 bg-gray-50/50">
                    ${giliranCircle}
                    <div id="pentas-container-mb-${row.id}" class="flex flex-col items-center justify-center mt-2">
                        <input type="checkbox" 
                            id="pentas-check-mb-${row.id}" 
                            class="pentas-checkbox" 
                            ${isNaikPentas ? 'checked' : ''} 
                            ${disabledAttr}
                            onchange="toggleNaikPentas('${row.id}', ${isNaikPentas})">
                        ${pentasLabel}
                    </div>
                </td>
                <td class="md:hidden px-3 py-4 align-top">
                    <div class="text-sm font-bold text-gray-900 leading-tight mb-1 ${isNaikPentas ? 'line-through text-gray-500' : ''}">
                        ${escapeHtml(row.nama)} ${multiAwardTag}
                    </div>
                    <div class="text-[11px] text-gray-700 leading-tight mb-1">${escapeHtml(row.sekolah)}</div>
                    ${tableDisplayHtml}
                    ${rsvpInfo}
                    <div class="bg-gray-50 p-2 rounded border border-gray-100 mt-2">
                        <div class="flex items-center justify-between">
                            <div>${statusBadge}</div>
                            ${!isHadir ? `<span class="text-[10px] text-red-500 italic">*Tanda disekat</span>` : ''}
                        </div>
                        ${extraInfo}
                        ${resetBtn}
                    </div>
                </td>

                <td class="hidden md:table-cell px-4 py-4 whitespace-nowrap text-center align-middle">
                    <div class="inline-flex h-10 w-10 ${isNaikPentas ? 'bg-green-200 border-green-400 text-green-800' : 'bg-blue-100 border-blue-300 text-blue-800'} rounded-full items-center justify-center border-2 text-sm font-black shadow-sm">
                        ${escapeHtml(row.bil)}
                    </div>
                </td>
                <td class="hidden md:table-cell px-6 py-4 align-middle">
                    <div class="text-sm font-bold text-gray-900 ${isNaikPentas ? 'line-through text-gray-500' : ''}">
                        ${escapeHtml(row.nama)} ${multiAwardTag}
                    </div>
                    <div class="text-sm text-gray-700">${escapeHtml(row.sekolah)}</div>
                    <div class="text-xs text-gray-500">${escapeHtml(row.kategori || '')}</div>
                    ${tableDisplayHtml}
                    ${rsvpInfo}
                </td>
                <td class="hidden md:table-cell px-4 py-4 align-top">
                    <div>${statusBadge}</div>
                    ${extraInfo}
                    ${resetBtn}
                </td>
                <td class="hidden md:table-cell px-4 py-4 text-center align-middle bg-gray-50">
                    <div id="pentas-container-dt-${row.id}" class="flex flex-col items-center justify-center h-full">
                        <input type="checkbox" 
                            id="pentas-check-dt-${row.id}" 
                            class="pentas-checkbox" 
                            ${isNaikPentas ? 'checked' : ''} 
                            ${disabledAttr}
                            onchange="toggleNaikPentas('${row.id}', ${isNaikPentas})">
                        ${pentasLabel}
                        ${notPresentMsg}
                    </div>
                </td>
            </tr>
        `;
    });
    
    if (html === '') {
        let msg = 'Tiada rekod ditemui untuk tapisan ini.';
        if (searchQuery) {
            msg = `Tiada padanan carian untuk "${escapeHtml(searchQuery)}".`;
        }
        html = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-500 text-sm">${msg}</td></tr>`;
    }
    reportTableBody.innerHTML = html;

    let wakilHtml = '';
    // Untuk logik wakil, kita kekalkan ia berdasarkan senarai filteredData yang telah ditapis oleh carian/filter
    const wakilData = filteredData.filter(r => r.attendance_status === 'HADIR' && r.attendance_type === 'WAKIL');
    
    wakilData.forEach(row => {
        wakilHtml += `
            <li class="p-4 hover:bg-gray-50">
                <div class="text-sm font-bold text-gray-900">${escapeHtml(row.nama)}</div>
                <div class="text-xs text-gray-500 mb-2">${escapeHtml(row.sekolah)}</div>
                <div class="bg-purple-50 p-2 rounded text-xs border border-purple-100">
                    <span class="font-semibold text-purple-700">Kategori Wakil:</span> ${escapeHtml(row.representative_name)}<br/>
                    <span class="font-semibold text-purple-700">Masa:</span> ${formatTime(row.attendance_time)}
                </div>
            </li>
        `;
    });

    if (wakilHtml === '') {
        if (wakilEmpty) wakilEmpty.classList.remove('hidden');
        if (wakilList) wakilList.innerHTML = `<li class="p-4 text-center text-gray-500 text-sm" id="wakilEmpty">Tiada rekod wakil berdasarkan tapisan.</li>`;
    } else {
        if (wakilList) wakilList.innerHTML = wakilHtml;
        if (wakilEmpty) wakilEmpty.classList.add('hidden');
    }
}

function eksportDataCSV() {
    if (currentRole !== 'SUPERADMIN') return;
    if (!allRecipients || allRecipients.length === 0) {
        showMsg('Maklumat', 'Tiada data untuk dimuat turun.');
        return;
    }
    
    showProcess('Menjana fail sandaran CSV...');
    
    try {
        const csvData = Papa.unparse(allRecipients);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        
        const downloadLink = document.createElement("a");
        downloadLink.href = url;
        downloadLink.download = `Backup_Data_${timestamp}.csv`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        hideProcess();
    } catch (err) {
        console.error("Ralat eksport CSV:", err);
        hideProcess();
        showMsg('Ralat', 'Gagal menjana fail sandaran CSV.');
    }
}

const csvFileInput = document.getElementById('csvFileInput');
if (csvFileInput) {
    csvFileInput.addEventListener('change', function(e) {
        if (currentRole !== 'SUPERADMIN') return;
        const file = e.target.files[0];
        if (!file) return;

        showProcess('Menganalisis fail CSV...');
        
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async function(results) {
                try {
                    const data = results.data;
                    if (data.length === 0) throw new Error("Fail CSV kosong.");

                    const mappedData = data.map((row, index) => {
                        const getVal = (possibleKeys) => {
                            for (let key of Object.keys(row)) {
                                if (possibleKeys.includes(key.trim().toUpperCase())) return row[key];
                            }
                            return '';
                        };
                        
                        const idVal = getVal(['ID']);
                        const bilStr = getVal(['BIL', 'NO', 'BILANGAN']);
                        let parsedBil = parseInt(bilStr);
                        if (isNaN(parsedBil)) parsedBil = index + 1; 

                        const attStatus = getVal(['ATTENDANCE_STATUS', 'STATUS KEHADIRAN']) || 'BELUM HADIR';
                        const attTimeStr = getVal(['ATTENDANCE_TIME', 'MASA']);
                        const attTime = attTimeStr && attTimeStr !== 'null' && attTimeStr !== '' ? attTimeStr : null;
                        const attType = getVal(['ATTENDANCE_TYPE', 'JENIS KEHADIRAN']);
                        const repName = getVal(['REPRESENTATIVE_NAME', 'NAMA WAKIL']);
                        const pentasStr = getVal(['NAIK_PENTAS_STATUS', 'STATUS PENTAS']);
                        const naikPentas = (pentasStr === 'true' || pentasStr === 'TRUE' || pentasStr === '1') ? true : false;
                        
                        const rsvpStatus = getVal(['RSVP_STATUS', 'STATUS RSVP']) || 'BELUM SAH';
                        const rsvpTimeStr = getVal(['RSVP_TIME', 'MASA RSVP']);
                        const rsvpTime = rsvpTimeStr && rsvpTimeStr !== 'null' && rsvpTimeStr !== '' ? rsvpTimeStr : null;

                        const mejaVal = getVal(['NO_MEJA', 'NO MEJA', 'MEJA', 'TABLE']);

                        const record = {
                            bil: parsedBil,
                            nama: getVal(['NAMA', 'NAMA PENERIMA', 'PENERIMA']),
                            kategori: getVal(['KATEGORI', 'KUMPULAN']),
                            sekolah: getVal(['SEKOLAH', 'NAMA SEKOLAH']),
                            no_meja: (mejaVal && mejaVal !== 'null' && mejaVal !== '') ? mejaVal : null,
                            attendance_status: attStatus,
                            attendance_time: attTime,
                            attendance_type: (attType && attType !== 'null' && attType !== '') ? attType : null,
                            representative_name: (repName && repName !== 'null' && repName !== '') ? repName : null,
                            naik_pentas_status: naikPentas,
                            rsvp_status: rsvpStatus,
                            rsvp_time: rsvpTime
                        };
                        
                        if (idVal && idVal !== '') {
                            record.id = idVal;
                        }

                        return record;
                    });

                    if (!mappedData[0].nama || !mappedData[0].sekolah) {
                        throw new Error("Format lajur tidak dikenali. Pastikan terdapat lajur NAMA dan SEKOLAH.");
                    }

                    showProcess(`Memproses ${mappedData.length} rekod (Upsert)...`);

                    const chunkSize = 500;
                    for (let i = 0; i < mappedData.length; i += chunkSize) {
                        const chunk = mappedData.slice(i, i + chunkSize);
                        const { error } = await supabaseClient.from('recipients').upsert(chunk, { onConflict: 'id' });
                        if (error) throw error;
                    }

                    hideProcess();
                    showMsg('Berjaya', `${mappedData.length} rekod telah berjaya dimuat naik/dikemaskini.`);
                    fetchData(); 
                    
                } catch (err) {
                    console.error(err);
                    hideProcess();
                    showMsg('Ralat Import', err.message || 'Gagal memproses fail CSV.');
                } finally {
                    csvFileInput.value = ''; 
                }
            },
            error: function(err) {
                hideProcess();
                showMsg('Ralat Parse', 'Fail CSV tidak sah.');
                csvFileInput.value = '';
            }
        });
    });
}

async function executeClearData() {
    if (currentRole !== 'SUPERADMIN') return;
    closeConfirmModal();
    showProcess('Memadam semua rekod...');
    try {
        const { error } = await supabaseClient.rpc('truncate_recipients');
        if (error) throw error;
        
        hideProcess();
        showMsg('Berjaya', 'Semua data telah dipadam.');
        fetchData(); 
    } catch (error) {
        console.error("Error truncate:", error);
        hideProcess();
        showMsg('Ralat', 'Gagal memadam data pangkalan data.');
    }
}

window.fetchData = fetchData;
window.confirmReset = confirmReset;
window.closeResetModal = closeResetModal;
window.executeResetData = executeResetData;
window.confirmResetAll = confirmResetAll;
window.closeConfirmResetAllModal = closeConfirmResetAllModal;
window.executeResetAll = executeResetAll;
window.confirmClearData = confirmClearData;
window.closeConfirmModal = closeConfirmModal;
window.executeClearData = executeClearData;
window.toggleNaikPentas = toggleNaikPentas;
window.eksportDataCSV = eksportDataCSV;
window.closeMsgModal = closeMsgModal;
window.clearAdminSearch = clearAdminSearch;