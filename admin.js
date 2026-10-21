const SUPABASE_URL = 'https://app.tech4ag.my';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYzMzczNjQ1LCJleHAiOjIwNzg3MzM2NDV9.vZOedqJzUn01PjwfaQp7VvRzSm4aRMr21QblPDK8AoY';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRecipients = [];

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const mainContent = document.getElementById('mainContent');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginError = document.getElementById('loginError');

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
const tableLoading = document.getElementById('tableLoading');
const reportTableBody = document.getElementById('reportTableBody');
const wakilList = document.getElementById('wakilList');
const wakilEmpty = document.getElementById('wakilEmpty');

const statTotal = document.getElementById('statTotal');
const statHadir = document.getElementById('statHadir');
const statWakil = document.getElementById('statWakil');
const statTidakHadir = document.getElementById('statTidakHadir');
const statBelum = document.getElementById('statBelum');

function checkSession() {
    if (localStorage.getItem('isAdminLoggedIn') === 'true') {
        if(loginScreen) loginScreen.classList.add('hidden');
        if(mainContent) mainContent.classList.remove('hidden');
        fetchData();
    } else {
        if(loginScreen) loginScreen.classList.remove('hidden');
        if(mainContent) mainContent.classList.add('hidden');
        if(passwordInput) passwordInput.value = '';
    }
}

window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
        checkSession();
    }
});

if(loginBtn) loginBtn.addEventListener('click', handleLogin);
if(passwordInput) passwordInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') handleLogin();
});

function handleLogin() {
    if (passwordInput.value === 'ppdag@12345') {
        localStorage.setItem('isAdminLoggedIn', 'true');
        loginError.classList.add('hidden');
        checkSession();
    } else {
        loginError.classList.remove('hidden');
    }
}

if(logoutBtn) logoutBtn.addEventListener('click', function() {
    localStorage.removeItem('isAdminLoggedIn');
    checkSession();
});

// Initialize on load
document.addEventListener('DOMContentLoaded', checkSession);

function showMsg(title, msg) {
    msgTitle.textContent = title;
    msgBody.textContent = msg;
    msgModal.classList.remove('hidden');
}

function closeMsgModal() {
    msgModal.classList.add('hidden');
}

function confirmClearData() {
    confirmModal.classList.remove('hidden');
}

function closeConfirmModal() {
    confirmModal.classList.add('hidden');
}

function confirmResetAll() {
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

function confirmReset(id, name) {
    resetTargetId.value = id;
    resetTargetName.textContent = name;
    confirmResetModal.classList.remove('hidden');
}

function closeResetModal() {
    confirmResetModal.classList.add('hidden');
    btnConfirmReset.innerHTML = 'Reset Status';
    btnConfirmReset.disabled = false;
}

async function executeResetAll() {
    closeConfirmResetAllModal();
    showProcess('Melaksanakan reset pukal...');
    try {
        const { error } = await supabaseClient
            .from('recipients')
            .update({
                attendance_status: 'BELUM HADIR',
                attendance_time: null,
                attendance_type: null,
                representative_name: null,
                naik_pentas_status: false
            })
            .neq('id', '00000000-0000-0000-0000-000000000000'); 

        if (error) throw error;
        
        hideProcess();
        showMsg('Berjaya', 'Semua status kehadiran & pentas telah dikembalikan kepada asal.');
        fetchData(); 
    } catch (error) {
        console.error("Error reset pukal:", error);
        hideProcess();
        showMsg('Ralat', 'Gagal melaksanakan reset pukal pangkalan data.');
    }
}

async function executeResetData() {
    const id = resetTargetId.value;
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
                naik_pentas_status: false
            })
            .eq('id', id);

        if (error) throw error;
        
        closeResetModal();
        showMsg('Berjaya', 'Status kehadiran telah dikembalikan kepada Belum Hadir.');
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

async function fetchData() {
    if(localStorage.getItem('isAdminLoggedIn') !== 'true') return;

    if(reportTableBody) reportTableBody.innerHTML = '';
    if(tableLoading) tableLoading.classList.remove('hidden');

    try {
        const { data, error } = await supabaseClient
            .from('recipients')
            .select('*')
            .order('bil', { ascending: true })
            .order('sekolah', { ascending: true });

        if (error) throw error;
        allRecipients = data || [];
        updateDashboard();
        renderTables();
    } catch (error) {
        console.error("Error fetching:", error);
        showMsg('Ralat', 'Gagal memuat turun data dari pelayan.');
    } finally {
        if(tableLoading) tableLoading.classList.add('hidden');
    }
}

function updateDashboard() {
    let total = allRecipients.length;
    let hadir = 0;
    let wakil = 0;
    let tidakHadir = 0;
    let belum = 0;

    allRecipients.forEach(r => {
        if (r.attendance_status === 'HADIR') {
            if (r.attendance_type === 'WAKIL') wakil++;
            else hadir++;
        } else if (r.attendance_status === 'TIDAK HADIR') {
            tidakHadir++;
        } else {
            belum++;
        }
    });

    if(statTotal) statTotal.textContent = total;
    if(statHadir) statHadir.textContent = hadir;
    if(statWakil) statWakil.textContent = wakil;
    if(statTidakHadir) statTidakHadir.textContent = tidakHadir;
    if(statBelum) statBelum.textContent = belum;
}

if(filterStatus) filterStatus.addEventListener('change', renderTables);
if(filterPentasStatus) filterPentasStatus.addEventListener('change', renderTables);
if(filterKategori) filterKategori.addEventListener('change', renderTables);

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
    if(!reportTableBody) return;
    
    const filterKehadiran = filterStatus ? filterStatus.value : 'ALL';
    const filterPentas = filterPentasStatus ? filterPentasStatus.value : 'ALL';
    const filterKat = filterKategori ? filterKategori.value : 'ALL';
    
    let filteredData = allRecipients;
    
    if (filterKat !== 'ALL') {
        filteredData = filteredData.filter(r => r.kategori && r.kategori.toUpperCase().includes(filterKat));
    }

    if (filterKehadiran !== 'ALL') {
        filteredData = filteredData.filter(r => r.attendance_status === filterKehadiran);
    }

    if (filterPentas === 'BELUM_NAIK') {
        filteredData = filteredData.filter(r => !r.naik_pentas_status);
    } else if (filterPentas === 'SUDAH_NAIK') {
        filteredData = filteredData.filter(r => r.naik_pentas_status);
    }

    let html = '';
    filteredData.forEach(row => {
        let statusBadge = '';
        let extraInfo = '';
        let isModified = false;
        
        const isHadir = row.attendance_status === 'HADIR';
        const noMejaText = row.no_meja ? `Meja: ${escapeHtml(row.no_meja)}` : 'Meja: -';
        
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

        const resetBtn = isModified ? 
            `<button onclick="confirmReset('${row.id}', '${escapeHtml(row.nama.replace(/'/g, "\\'"))}')" class="mt-2 text-[10px] md:text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300 py-1 px-2 rounded transition-colors inline-flex items-center w-max">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                Reset
            </button>` : '';

        const isNaikPentas = !!row.naik_pentas_status;
        const rowClass = isNaikPentas ? 'naik-pentas-row' : 'hover:bg-gray-50 transition-colors';
        const pentasLabel = isNaikPentas ? '<span class="text-[10px] md:text-xs font-bold text-green-600 block mt-1">SELESAI</span>' : '';
        const notPresentMsg = !isHadir ? `<span class="text-[9px] md:text-[10px] text-gray-500 mt-1 italic block text-center leading-tight">Belum lapor<br>hadir</span>` : '';
        const disabledAttr = !isHadir ? 'disabled' : '';
        
        const giliranCircle = `<div class="inline-flex h-10 w-10 ${isNaikPentas ? 'bg-green-200 border-green-400 text-green-800' : 'bg-blue-100 border-blue-300 text-blue-800'} rounded-full items-center justify-center border-2 text-sm font-black mx-auto mb-2">
                        ${escapeHtml(row.bil)}
                    </div>`;

        html += `
            <tr id="row-${row.id}" class="${rowClass} border-b border-gray-100">
                
                <!-- MOBILE VIEW (2 Columns) -->
                <td class="md:hidden px-2 py-4 align-top w-20 text-center border-r border-gray-100 bg-gray-50/50">
                    ${giliranCircle}
                    <div id="pentas-container-mb-${row.id}" class="flex flex-col items-center justify-center">
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
                    <div class="text-sm font-bold text-gray-900 leading-tight mb-1 ${isNaikPentas ? 'line-through text-gray-500' : ''}">${escapeHtml(row.nama)}</div>
                    <div class="text-[11px] text-gray-700 leading-tight mb-1">${escapeHtml(row.sekolah)}</div>
                    <div class="text-[11px] font-semibold text-blue-600 mb-2">${noMejaText}</div>
                    
                    <div class="bg-gray-50 p-2 rounded border border-gray-100">
                        <div class="flex items-center justify-between">
                            <div>${statusBadge}</div>
                            ${!isHadir ? `<span class="text-[10px] text-red-500 italic">*Tanda disekat</span>` : ''}
                        </div>
                        ${extraInfo}
                        ${resetBtn}
                    </div>
                </td>

                <!-- DESKTOP VIEW (4 Columns) -->
                <td class="hidden md:table-cell px-4 py-4 whitespace-nowrap text-center align-middle">
                    <div class="inline-flex h-10 w-10 ${isNaikPentas ? 'bg-green-200 border-green-400 text-green-800' : 'bg-blue-100 border-blue-300 text-blue-800'} rounded-full items-center justify-center border-2 text-sm font-black">
                        ${escapeHtml(row.bil)}
                    </div>
                </td>
                <td class="hidden md:table-cell px-6 py-4 align-middle">
                    <div class="text-sm font-bold text-gray-900 ${isNaikPentas ? 'line-through text-gray-500' : ''}">${escapeHtml(row.nama)}</div>
                    <div class="text-sm text-gray-700">${escapeHtml(row.sekolah)}</div>
                    <div class="text-xs text-gray-500">${escapeHtml(row.kategori)}</div>
                    <div class="text-xs font-semibold text-blue-600 mt-1">${noMejaText}</div>
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
    
    if(html === '') {
        html = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-500 text-sm">Tiada rekod ditemui untuk tapisan ini.</td></tr>`;
    }
    reportTableBody.innerHTML = html;

    let wakilHtml = '';
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
        if(wakilEmpty) wakilEmpty.classList.remove('hidden');
        if(wakilList) wakilList.innerHTML = `<li class="p-4 text-center text-gray-500 text-sm" id="wakilEmpty">Tiada rekod wakil berdasarkan tapisan.</li>`;
    } else {
        if(wakilList) wakilList.innerHTML = wakilHtml;
        if(wakilEmpty) wakilEmpty.classList.add('hidden');
    }
}

function eksportDataCSV() {
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
                            for(let key of Object.keys(row)) {
                                if(possibleKeys.includes(key.trim().toUpperCase())) return row[key];
                            }
                            return '';
                        };
                        
                        const idVal = getVal(['ID']);
                        const bilStr = getVal(['BIL', 'NO', 'BILANGAN']);
                        let parsedBil = parseInt(bilStr);
                        if(isNaN(parsedBil)) parsedBil = index + 1; 

                        const attStatus = getVal(['ATTENDANCE_STATUS', 'STATUS KEHADIRAN']) || 'BELUM HADIR';
                        const attTimeStr = getVal(['ATTENDANCE_TIME', 'MASA']);
                        const attTime = attTimeStr && attTimeStr !== 'null' && attTimeStr !== '' ? attTimeStr : null;
                        const attType = getVal(['ATTENDANCE_TYPE', 'JENIS KEHADIRAN']);
                        const repName = getVal(['REPRESENTATIVE_NAME', 'NAMA WAKIL']);
                        const pentasStr = getVal(['NAIK_PENTAS_STATUS', 'STATUS PENTAS']);
                        const naikPentas = (pentasStr === 'true' || pentasStr === 'TRUE' || pentasStr === '1') ? true : false;
                        
                        // Menambah sokongan lajur no_meja
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
                            naik_pentas_status: naikPentas
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