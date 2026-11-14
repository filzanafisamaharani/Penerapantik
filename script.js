// Inisialisasi Lucide Icons
lucide.createIcons();

// ==========================================
// 1. KONFIGURASI FIREBASE REALTIME DATABASE
// ==========================================
// Ganti objek di bawah ini dengan kredensial proyek Firebase Anda sendiri
const firebaseConfig = {
    apiKey: "MASUKKAN_API_KEY_ANDA",
    authDomain: "sistem-piket-kelas.firebaseapp.com",
    databaseURL: "https://sistem-piket-kelas-default-rtdb.firebaseio.com",
    projectId: "sistem-piket-kelas",
    storageBucket: "sistem-piket-kelas.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
};

let db = null;
let isFirebaseConnected = false;

// Data Default (Fallback otomatis jika kredensial Firebase belum diisi)
let appState = {
    tasks: [
        { id: 't1', title: 'Menyapu lantai ruang kelas utama', area: 'Lantai', done: true },
        { id: 't2', title: 'Menghapus papan tulis & isi spidol', area: 'Papan Tulis', done: true },
        { id: 't3', title: 'Merapikan barisan meja dan kursi', area: 'Furnitur', done: true },
        { id: 't4', title: 'Mengosongkan tempat sampah kelas', area: 'Sanitasi', done: true },
        { id: 't5', title: 'Membersihkan kaca jendela & ventilasi', area: 'Jendela', done: true },
        { id: 't6', title: 'Mengepel area depan pintu masuk', area: 'Koridor', done: false }
    ],
    roster: [
        { nama: 'Andi Pratama', area: 'Menyapu & Mengepel', checkin: '06:35 WIB', status: 'Selesai' },
        { nama: 'Siti Rahmawati', area: 'Papan Tulis & Meja Guru', checkin: '06:38 WIB', status: 'Selesai' },
        { nama: 'Budi Santoso', area: 'Sanitasi & Tempat Sampah', checkin: '06:40 WIB', status: 'Selesai' },
        { nama: 'Nadia Putri', area: 'Jendela & Ventilasi', checkin: '06:42 WIB', status: 'Proses' }
    ],
    chartLabels: ['07:00', '08:30', '10:00', '11:30', '13:00', '14:30'],
    chartValues: [78, 82, 85, 88, 90, 92]
};

// Cek apakah konfigurasi Firebase sudah valid
if (firebaseConfig.apiKey !== "MASUKKAN_API_KEY_ANDA") {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        isFirebaseConnected = true;
        addLog("Terhubung ke Firebase Realtime Database.");
        listenToFirebaseData();
    } catch (err) {
        console.error("Firebase init error:", err);
        setOfflineMode("Gagal inisialisasi Firebase, beralih ke mode lokal.");
    }
} else {
    setOfflineMode("Mode Demo Lokal (Isi firebaseConfig untuk Cloud Sync)");
}

function setOfflineMode(msg) {
    document.getElementById('fb-dot').classList.add('offline');
    document.getElementById('fb-status-text').textContent = "Local Sandbox Mode";
    document.getElementById('fb-mode-desc').textContent = msg;
    addLog(msg);
}

// ==========================================
// 2. SINKRONISASI DATA FIREBASE REALTIME
// ==========================================
function listenToFirebaseData() {
    if (!db) return;

    // Mendengarkan perubahan daftar tugas secara real-time
    db.ref('piket_kelas/tasks').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            appState.tasks = Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            }));
            renderTasks();
            updateKPIs();
            addLog("Sinkronisasi tugas dari Firebase diterima.");
        } else {
            // Inisialisasi data awal ke Firebase jika database masih kosong
            appState.tasks.forEach(t => {
                db.ref(`piket_kelas/tasks/${t.id}`).set({
                    title: t.title,
                    area: t.area,
                    done: t.done
                });
            });
        }
    });
}

function toggleTaskStatus(taskId) {
    const taskIndex = appState.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const newStatus = !appState.tasks[taskIndex].done;
    appState.tasks[taskIndex].done = newStatus;

    if (isFirebaseConnected && db) {
        db.ref(`piket_kelas/tasks/${taskId}/done`).set(newStatus);
    }

    renderTasks();
    updateKPIs();
    addLog(`Tugas "${appState.tasks[taskIndex].title}" -> ${newStatus ? 'Selesai' : 'Belum Selesai'}`);
}

// ==========================================
// 3. JAM REALTIME & TANGGAL INDONESIA
// ==========================================
function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });
    const dateStr = now.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    document.getElementById('live-clock').textContent = `${timeStr} WIB`;
    document.getElementById('current-date-display').textContent = dateStr;
}
setInterval(updateClock, 1000);
updateClock();

// ==========================================
// 4. INISIALISASI GRAFIK REALTIME (CHART.JS)
// ==========================================
const ctx = document.getElementById('realtimeChart').getContext('2d');
const gradientFill = ctx.createLinearGradient(0, 0, 0, 280);
gradientFill.addColorStop(0, 'rgba(0, 240, 255, 0.32)');
gradientFill.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

const realtimeChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: appState.chartLabels,
        datasets: [{
            label: 'Indeks Kebersihan Kelas (%)',
            data: appState.chartValues,
            borderColor: '#00f0ff',
            backgroundColor: gradientFill,
            borderWidth: 2.5,
            pointBackgroundColor: '#060913',
            pointBorderColor: '#00f0ff',
            pointBorderWidth: 2,
            pointRadius: 4,
            fill: true,
            tension: 0.4
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            x: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 } }
            },
            y: {
                min: 50,
                max: 100,
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 } }
            }
        }
    }
});

// ==========================================
// 5. RENDER UI & INTERAKSI PENGGUNA
// ==========================================
function renderTasks() {
    const container = document.getElementById('task-list-container');
    container.innerHTML = '';

    appState.tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.done ? 'done' : ''}`;
        li.innerHTML = `
            <div class="task-left">
                <div class="task-checkbox">${task.done ? '✓' : ''}</div>
                <span class="task-title">${task.title}</span>
            </div>
            <span class="task-badge">${task.area}</span>
        `;
        li.addEventListener('click', () => toggleTaskStatus(task.id));
        container.appendChild(li);
    });
}

function renderRoster() {
    const tbody = document.getElementById('roster-table-body');
    tbody.innerHTML = appState.roster.map(item => `
        <tr>
            <td><strong>${item.nama}</strong></td>
            <td>${item.area}</td>
            <td style="font-family: var(--font-mono); font-size: 0.8rem;">${item.checkin}</td>
            <td><span class="status-pill ${item.status.toLowerCase()}">${item.status}</span></td>
        </tr>
    `).join('');
}

function updateKPIs() {
    const total = appState.tasks.length;
    const completed = appState.tasks.filter(t => t.done).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('kpi-tugas').textContent = `${completed} / ${total}`;
    document.getElementById('kpi-kebersihan').textContent = `${percentage}%`;

    const statusEl = document.getElementById('kpi-status');
    if (percentage >= 85) {
        statusEl.textContent = "Sangat Baik";
        statusEl.style.color = "var(--accent-emerald)";
    } else if (percentage >= 60) {
        statusEl.textContent = "Cukup Bersih";
        statusEl.style.color = "var(--accent-cyan)";
    } else {
        statusEl.textContent = "Perlu Tindakan";
        statusEl.style.color = "var(--accent-amber)";
    }
}

function addLog(message) {
    const logContainer = document.getElementById('activity-log');
    const now = new Date().toLocaleTimeString('id-ID', { hour12: false });
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span class="time">[${now}]</span> ${message}`;
    logContainer.prepend(entry);
}

// Form Tambah Tugas Baru
document.getElementById('add-task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('new-task-input');
    const title = input.value.trim();
    if (!title) return;

    const newId = 't' + Date.now();
    const newTask = { id: newId, title: title, area: 'Umum', done: false };

    if (isFirebaseConnected && db) {
        db.ref(`piket_kelas/tasks/${newId}`).set({
            title: newTask.title,
            area: newTask.area,
            done: newTask.done
        });
    } else {
        appState.tasks.push(newTask);
        renderTasks();
        updateKPIs();
    }

    addLog(`Tugas baru ditambahkan: "${title}"`);
    input.value = '';
});

// Tombol Simulasi Pembaruan Grafik Realtime
document.getElementById('btn-simulasi').addEventListener('click', () => {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const total = appState.tasks.length;
    const completed = appState.tasks.filter(t => t.done).length;
    const currentScore = total > 0 ? Math.round((completed / total) * 100) : 80;

    if (realtimeChart.data.labels.length >= 8) {
        realtimeChart.data.labels.shift();
        realtimeChart.data.datasets[0].data.shift();
    }

    realtimeChart.data.labels.push(timeLabel);
    realtimeChart.data.datasets[0].data.push(currentScore);
    realtimeChart.update();

    addLog(`Grafik diperbarui secara realtime (Skor: ${currentScore}%)`);
});

// Inisialisasi Tampilan Awal
renderTasks();
renderRoster();
updateKPIs();
addLog("Sistem PiketOS berhasil dimuat.");
