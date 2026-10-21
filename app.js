const SUPABASE_URL = 'https://app.tech4ag.my';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYzMzczNjQ1LCJleHAiOjIwNzg3MzM2NDV9.vZOedqJzUn01PjwfaQp7VvRzSm4aRMr21QblPDK8AoY';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentTab = 'belum'; 
let allData = []; 

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

if(searchInput) {
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

if(filterKategori) filterKategori.addEventListener('change', processDataView);
if(resetSearchBtn) resetSearchBtn.addEventListener('click', clearSearch);
if(cancelWakilBtn) cancelWakilBtn.addEventListener('click', closeWakilModal);
if(saveWakilBtn) saveWakilBtn.addEventListener('click', saveWakil);

function clearSearch() {
    if(searchInput) searchInput.value = '';
    if(resetSearchBtn) resetSearchBtn.classList.add('hidden');
    processDataView();
    if(searchInput) searchInput.focus();
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

function showError(msg) {
    if(!errorText || !errorMessage) return;
    errorText.textContent = msg;
    errorMessage.classList.remove('hidden');
    setTimeout(() => errorMessage.classList.add('hidden'), 5000);
}

function switchTab(tab) {
    currentTab = tab;
    if (tab === 'belum') {
        if(tabBelum) {
            tabBelum.classList.add('bg-blue-50', 'text-blue-700', 'border-blue-600');
            tabBelum.classList.remove('text-gray-500', 'border-transparent', 'hover:bg-gray-50');
        }
        if(tabTelah) {
            tabTelah.classList.remove('bg-blue-50', 'text-blue-700', 'border-blue-600');
            tabTelah.classList.add('text-gray-500', 'border-transparent', 'hover:bg-gray-50');
        }
    } else {
        if(tabTelah) {
            tabTelah.classList.add('bg-blue-50', 'text-blue-700', 'border-blue-600');
            tabTelah.classList.remove('text-gray-500', 'border-transparent', 'hover:bg-gray-50');
        }
        if(tabBelum) {
            tabBelum.classList.remove('bg-blue-50', 'text-blue-700', 'border-blue-600');
            tabBelum.classList.add('text-gray-500', 'border-transparent', 'hover:bg-gray-50');
        }
    }
    processDataView();
}

// Make switchTab globally accessible for inline onclick
window.switchTab = switchTab;

async function fetchAllData() {
    if(loadingIndicator) loadingIndicator.classList.remove('hidden');
    if(resultsContainer) resultsContainer.innerHTML = '';
    
    try {
        const { data, error } = await supabaseClient
            .from('recipients')
            .select('*')
            .order('sekolah', { ascending: true })
            .order('bil', { ascending: true });

        if (error) throw error;
        allData = data || [];
        
        processDataView();

    } catch (error) {
        console.error("Fetch Error:", error);
        showError("Gagal memuat turun data.");
    } finally {
        if(loadingIndicator) loadingIndicator.classList.add('hidden');
    }
}

function updateCounts(filteredDataSet) {
    const b = filteredDataSet.filter(r => r.attendance_status !== 'HADIR').length;
    const t = filteredDataSet.filter(r => r.attendance_status === 'HADIR').length;
    if(countBelum) countBelum.textContent = b;
    if(countTelah) countTelah.textContent = t;

    let total = filteredDataSet.length;
    let hadir = 0;
    let wakil = 0;
    let belum = 0;
    let tidakHadir = 0;

    filteredDataSet.forEach(r => {
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

function processDataView() {
    if(!searchInput || !filterKategori) return;
    
    const query = searchInput.value.trim();
    const selectedKat = filterKategori.value;
    let currentDataSet = allData;

    if (selectedKat !== 'ALL') {
        currentDataSet = currentDataSet.filter(r => r.kategori && r.kategori.toUpperCase().includes(selectedKat));
    }
    
    updateCounts(currentDataSet);

    let dataToRender = currentDataSet;

    if (query) {
        if(searchIndicator) searchIndicator.classList.remove('hidden');
        if(tabContainer) tabContainer.classList.add('opacity-50', 'pointer-events-none');
        
        const qNum = parseInt(query);
        dataToRender = dataToRender.filter(r => 
            (r.nama && r.nama.includes(query)) || 
            (r.sekolah && r.sekolah.includes(query)) ||
            (!isNaN(qNum) && r.bil === qNum)
        );
    } else {
        if(searchIndicator) searchIndicator.classList.add('hidden');
        if(tabContainer) tabContainer.classList.remove('opacity-50', 'pointer-events-none');
        
        if (currentTab === 'belum') {
            dataToRender = dataToRender.filter(r => r.attendance_status !== 'HADIR');
        } else {
            dataToRender = dataToRender.filter(r => r.attendance_status === 'HADIR');
        }
    }
    
    renderResults(dataToRender, query, selectedKat);
}

function renderResults(recipients, query, category) {
    if(!resultsContainer) return;
    
    if (!recipients || recipients.length === 0) {
        let msg = 'Tiada rekod dalam kategori ini.';
        if (query) {
            msg = `Tiada rekod dijumpai untuk pencarian: "${escapeHtml(query)}"`;
        } else if (category !== 'ALL') {
            msg = `Tiada rekod dijumpai untuk tapisan kategori: ${escapeHtml(category)}`;
        }
        
        resultsContainer.innerHTML = `
            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div class="flex">
                    <div class="ml-3">
                        <p class="text-sm text-yellow-700">${msg}</p>
                    </div>
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

    for (const [sekolah, students] of Object.entries(groupedBySchool)) {
        const hasBelumHadir = students.some(s => s.attendance_status === 'BELUM HADIR');
        
        const btnPukal = hasBelumHadir && currentTab === 'belum' && !query ? 
            `<button onclick="openWakilModalPukal('${escapeHtml(sekolah.replace(/'/g, "\\'"))}')" class="bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-300 text-xs px-3 py-1.5 rounded shadow-sm font-bold flex items-center transition">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                TANDA PUKAL WAKIL
            </button>` : '';
            
        const btnPukalTidak = hasBelumHadir && currentTab === 'belum' && !query ? 
            `<button onclick="confirmPukalTidakHadir('${escapeHtml(sekolah.replace(/'/g, "\\'"))}')" class="bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 text-xs px-3 py-1.5 rounded shadow-sm font-bold flex items-center transition">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                TANDA PUKAL TIDAK HADIR
            </button>` : '';

        html += `
            <div class="mb-8 fade-in">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-200 px-4 py-3 rounded-t-lg border-b border-gray-300 gap-3">
                    <h2 class="text-xl font-bold text-gray-800 uppercase tracking-wide">
                        ${escapeHtml(sekolah)}
                    </h2>
                    <div class="flex gap-2 flex-wrap w-full sm:w-auto">
                        ${btnPukal}
                        ${btnPukalTidak}
                    </div>
                </div>
                <div class="bg-white shadow rounded-b-lg overflow-hidden">
        `;

        students.forEach((student, index) => {
            const isLast = index === students.length - 1;
            const borderClass = isLast ? '' : 'border-b border-gray-200';
            const safeNama = student.nama ? student.nama.replace(/'/g, "\\'") : '';
            const safeSekolah = student.sekolah ? student.sekolah.replace(/'/g, "\\'") : '';
            const noMejaDisplay = student.no_meja ? ` | <span class="font-semibold text-blue-600">Meja: ${escapeHtml(student.no_meja)}</span>` : '';
            
            let statusHtml = '';
            let actionHtml = '';

            if (student.attendance_status === 'HADIR') {
                statusHtml = `<div class="text-green-600 font-bold flex items-center"><span class="mr-1">🟢</span> Hadir ${formatTime(student.attendance_time)}</div>`;
                if(student.attendance_type === 'WAKIL') {
                     statusHtml = `
                     <div class="text-purple-600 font-bold flex items-center mb-1"><span class="mr-1">🟣</span> Wakil Hadir ${formatTime(student.attendance_time)}</div>
                     <div class="text-sm text-gray-600 font-medium">Kategori Wakil: ${escapeHtml(student.representative_name)}</div>
                     `;
                }
            } else if (student.attendance_status === 'TIDAK HADIR') {
                statusHtml = `<div class="text-red-600 font-bold flex items-center"><span class="mr-1">🔴</span> Tidak Hadir</div>`;
                actionHtml = generateActionButtons(student.id, safeNama, safeSekolah, student.attendance_status);
            } else {
                statusHtml = `<div class="text-yellow-600 font-bold flex items-center"><span class="mr-1">🟡</span> Belum Hadir</div>`;
                actionHtml = generateActionButtons(student.id, safeNama, safeSekolah, student.attendance_status);
            }

            html += `
                <div class="p-4 ${borderClass} flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-gray-50 transition duration-150">
                    <div class="mb-4 sm:mb-0 w-full sm:w-2/3">
                        <div class="flex items-baseline">
                            <span class="text-gray-500 font-mono text-sm mr-3">Bil: ${escapeHtml(student.bil)}</span>
                            <h3 class="text-lg font-bold text-gray-900">${escapeHtml(student.nama)}</h3>
                        </div>
                        <p class="text-sm text-gray-600 mb-2">${escapeHtml(student.kategori)}${noMejaDisplay}</p>
                        ${statusHtml}
                    </div>
                    <div class="w-full sm:w-auto flex flex-col sm:flex-row flex-wrap gap-2" id="actions-${student.id}">
                        ${actionHtml}
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
        <button onclick="markHadir('${id}', '${name}', '${sekolah}')" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded shadow font-semibold flex items-center justify-center transition duration-150">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            HADIR
        </button>
        <button onclick="openWakilModal('${id}', '${name}', '${sekolah}')" class="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded shadow font-semibold flex items-center justify-center transition duration-150">
            WAKIL
        </button>
    `;

    if (status !== 'TIDAK HADIR') {
        buttons += `
            <button onclick="markTidakHadir('${id}', '${name}', '${sekolah}')" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded shadow font-semibold flex items-center justify-center transition duration-150">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                TIDAK HADIR
            </button>
        `;
    }

    return buttons;
}

// Make functions globally accessible for inline onclick handlers
window.markHadir = markHadir;
window.markTidakHadir = markTidakHadir;
window.openWakilModal = openWakilModal;
window.openWakilModalPukal = openWakilModalPukal;
window.confirmPukalTidakHadir = confirmPukalTidakHadir;

async function markHadir(id, name, sekolah) {
    const actionContainer = document.getElementById(`actions-${id}`);
    if(actionContainer) actionContainer.innerHTML = '<span class="text-gray-500 text-sm">Menyimpan...</span>';
    const currentTime = new Date().toISOString();

    try {
        const { error } = await supabaseClient
            .from('recipients')
            .update({ 
                attendance_status: 'HADIR',
                attendance_time: currentTime,
                attendance_type: 'SENDIRI',
                representative_name: null
            })
            .eq('id', id);

        if (error) throw error;
        fetchAllData(); 

    } catch (error) {
        console.error("Ralat tanda hadir:", error);
        showError("Gagal mengemaskini status kehadiran.");
        if(actionContainer) actionContainer.innerHTML = generateActionButtons(id, name, sekolah, 'BELUM HADIR');
    }
}

async function markTidakHadir(id, name, sekolah) {
    if(!confirm(`Mengesahkan ${name} sebagai TIDAK HADIR?`)) return;
    
    const actionContainer = document.getElementById(`actions-${id}`);
    if(actionContainer) actionContainer.innerHTML = '<span class="text-gray-500 text-sm">Menyimpan...</span>';
    const currentTime = new Date().toISOString();

    try {
        const { error } = await supabaseClient
            .from('recipients')
            .update({ 
                attendance_status: 'TIDAK HADIR',
                attendance_time: currentTime,
                attendance_type: null,
                representative_name: null
            })
            .eq('id', id);

        if (error) throw error;
        fetchAllData(); 

    } catch (error) {
        console.error("Ralat tanda tidak hadir:", error);
        showError("Gagal mengemaskini status tidak hadir.");
        if(actionContainer) actionContainer.innerHTML = generateActionButtons(id, name, sekolah, 'BELUM HADIR');
    }
}

async function confirmPukalTidakHadir(sekolah) {
    if(!confirm(`Mengesahkan SEMUA yang belum hadir untuk sekolah ${sekolah} sebagai TIDAK HADIR?`)) return;
    
    const currentTime = new Date().toISOString();
    const selectedKat = filterKategori ? filterKategori.value : 'ALL';
    
    let pendingStudents = allData.filter(s => s.sekolah === sekolah && s.attendance_status === 'BELUM HADIR');
    if (selectedKat !== 'ALL') {
        pendingStudents = pendingStudents.filter(s => s.kategori && s.kategori.toUpperCase().includes(selectedKat));
    }
    
    const idsToUpdate = pendingStudents.map(s => s.id);
    
    if (idsToUpdate.length > 0) {
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
            fetchAllData();
        } catch (error) {
            console.error("Ralat pukal tidak hadir:", error);
            showError("Gagal mengemaskini pukal tidak hadir.");
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
    if(!modalMode || !modalRecipientId || !modalRecipientSekolah || !wakilModal) return;
    
    modalMode.value = 'INDIVIDU';
    modalRecipientId.value = id;
    modalRecipientSekolah.value = sekolah;
    
    const modalSubtitle = document.getElementById('modalSubtitle');
    if(modalSubtitle) {
        modalSubtitle.innerHTML = `Penerima asal: <span id="modalRecipientName" class="font-bold text-gray-800">${escapeHtml(name)}</span>`;
    }
    
    resetRadioButtons();
    wakilModal.classList.remove('hidden');
}

function openWakilModalPukal(sekolah) {
    if(!modalMode || !modalRecipientSekolah || !wakilModal) return;
    
    modalMode.value = 'PUKAL';
    modalRecipientSekolah.value = sekolah;
    
    const modalSubtitle = document.getElementById('modalSubtitle');
    if(modalSubtitle) {
        modalSubtitle.innerHTML = `Tanda wakil secara pukal untuk:<br><span class="font-bold text-gray-800 text-base uppercase">${escapeHtml(sekolah)}</span>`;
    }
    
    resetRadioButtons();
    wakilModal.classList.remove('hidden');
}

function closeWakilModal() {
    if(wakilModal) wakilModal.classList.add('hidden');
}

async function saveWakil() {
    if(!modalMode || !modalRecipientSekolah) return;
    
    const mode = modalMode.value;
    const sekolahToUpdate = modalRecipientSekolah.value;
    const selectedRadio = document.querySelector('input[name="wakilType"]:checked');

    if (!selectedRadio) {
        alert("Sila pilih jenis wakil.");
        return;
    }
    const wakilType = selectedRadio.value;

    if(saveWakilBtn) {
        saveWakilBtn.disabled = true;
        saveWakilBtn.innerHTML = 'Menyimpan...';
    }

    const currentTime = new Date().toISOString();

    try {
        if (mode === 'INDIVIDU') {
            const nameSpan = document.getElementById('modalRecipientName');
            const nameToUpdate = nameSpan ? nameSpan.innerText : '';
            
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
        fetchAllData(); 

    } catch (error) {
        console.error("Ralat daftar wakil:", error);
        showError("Gagal merekod maklumat wakil.");
    } finally {
        if(saveWakilBtn) {
            saveWakilBtn.disabled = false;
            saveWakilBtn.innerHTML = 'Simpan';
        }
    }
}