/* DOM references */
const fileInput = document.getElementById('fileInput');
const vizCanvas = document.getElementById('vizCanvas');
const resultsPanel = document.getElementById('resultsPanel');
const detailsPanel = document.getElementById('detailsPanel');
const conflictsPanel = document.getElementById('conflictsPanel');
const buildGraphBtn = document.getElementById('buildGraphBtn');
const runColoringBtn = document.getElementById('runColoringBtn');
const stepByStepBtn = document.getElementById('stepByStepBtn');
const exportBtn = document.getElementById('exportBtn');
const simControls = document.getElementById('simControls');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const nextBtn = document.getElementById('nextBtn');
const tabButtons = document.querySelectorAll('.tab-btn');

/* Utility: loại bỏ dấu/chuẩn hóa chuỗi để so sánh header */
function normalizeHeader(str) {
    if (!str && str !== 0) return '';
    const s = String(str);
    // Remove diacritics (unicode NFD) and normalize to lower-case, remove spaces and punctuation
    return s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove diacritics
        .replace(/[^a-zA-Z0-9]/g, '') // remove non-alphanumeric
        .toLowerCase();
}

/* Utility: chuyển serial date Excel -> JS Date */
function excelDateToJSDate(serial) {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;                
    const fractional_day = serial - Math.floor(serial);
    let total_seconds = Math.round(86400 * fractional_day);
    const seconds = total_seconds % 60;
    total_seconds = Math.floor(total_seconds / 60);
    const minutes = total_seconds % 60;
    const hours = Math.floor(total_seconds / 60);
    const date = new Date(utc_value * 1000);
    date.setHours(hours, minutes, seconds, 0);
    return date;
}

/* Hàm chính: đọc file Excel/CSV và trả về Promise -> mảng Order */
const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) return reject('Không có tệp được chọn.');
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                    return reject('Không tìm thấy trang tính trong tệp.');
                }

                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (!json || json.length === 0) {
                    return reject('Tệp không có dữ liệu.');
                }

                // Lấy hàng header (dòng đầu tiên)
                const rawHeaders = json[0].map(h => h === undefined || h === null ? '' : String(h));
                const normalizedHeaders = rawHeaders.map(h => normalizeHeader(h));

                // Các tiêu đề bắt buộc (normalised)
                const required = ['tendonhang', 'diachi', 'thoigiangiao'];
                const headerConcat = normalizedHeaders.join('|');
                
                // Cố gắng tìm index của các cột
                const colIndices = {
                    tenDonHang: normalizedHeaders.findIndex(h => h.includes('tendonhang') || h.includes('tendon') || h.includes('donhang') || h.includes('ten')),
                    diaChi: normalizedHeaders.findIndex(h => h.includes('diachi') || h.includes('address') || h.includes('addr')),
                    thoiGianGiao: normalizedHeaders.findIndex(h => h.includes('thoigiangiao') || h.includes('thoigian') || h.includes('time') || h.includes('gio'))
                };

                const missingCols = required.filter(r => colIndices[r.replace(/[^a-zA-Z]/g, '')] === -1);
                
                if (colIndices.tenDonHang === -1 || colIndices.diaChi === -1 || colIndices.thoiGianGiao === -1) {
                    return reject("Tệp không đúng định dạng. Cần có các cột: 'Tên đơn hàng', 'Địa chỉ', 'Thời gian giao' (hoặc biến thể tương đương).");
                }


                // Map từng hàng dữ liệu thành Order
                const dataRows = json.slice(1).map((row) => {
                    let tenDonHang = null, diaChi = null, thoiGianGiao = null;

                    // Lấy giá trị theo index đã tìm thấy
                    const rawTenDonHang = row[colIndices.tenDonHang];
                    const rawDiaChi = row[colIndices.diaChi];
                    const rawThoiGianGiao = row[colIndices.thoiGianGiao];

                    // Xử lý giá trị
                    if (rawTenDonHang !== undefined && rawTenDonHang !== null && String(rawTenDonHang).trim() !== '') {
                        tenDonHang = rawTenDonHang;
                    }

                    diaChi = rawDiaChi;
                    
                    if (rawThoiGianGiao !== undefined && rawThoiGianGiao !== null) {
                        if (typeof rawThoiGianGiao === 'number') {
                            try {
                                thoiGianGiao = excelDateToJSDate(rawThoiGianGiao);
                            } catch (err) {
                                thoiGianGiao = String(rawThoiGianGiao);
                            }
                        } else if (rawThoiGianGiao instanceof Date) {
                            thoiGianGiao = rawThoiGianGiao;
                        } else {
                            thoiGianGiao = String(rawThoiGianGiao).trim();
                        }
                    }

                    // Nếu hàng không có tên đơn thì bỏ qua
                    if (!tenDonHang || String(tenDonHang).trim() === '') return null;
                    return new Order(tenDonHang, diaChi, thoiGianGiao);
                }).filter(r => r !== null);

                resolve(dataRows);
            } catch (err) {
                console.error('Error parsing file:', err);
                reject('Lỗi trong quá trình đọc/parse tệp: ' + (err.message || err));
            }
        };

        reader.onerror = (err) => {
            reject('Lỗi đọc tệp: ' + err);
        };

        reader.readAsArrayBuffer(file);
    });
};

/* Hiển thị tóm tắt dữ liệu vào giao diện */
function displayDataSummary(orders) {
    if (!orders || orders.length === 0) {
        resultsPanel.innerHTML = `<div class="empty-state">Không có đơn hàng nào.</div>`;
        detailsPanel.innerHTML = `<div class="empty-state">Chưa có kết quả phân bổ</div>`;
        conflictsPanel.innerHTML = `<div class="empty-state">Chưa có dữ liệu xung đột</div>`;
        return;
    }

    const total = orders.length;
    const first10 = orders.slice(0, 10);

    let resultsHtml = `<div class="result-item"><strong>Tổng đơn hàng:</strong> ${total}</div>`;
    resultsHtml += `<div style="margin-top:0.5rem;"><strong>Một vài đơn mẫu:</strong></div>`;
    first10.forEach(o => {
        const timeLabel = o.thoiGianGiao ? (o.thoiGianGiao instanceof Date ? o.thoiGianGiao.toLocaleString() : String(o.thoiGianGiao)) : '<i>Không có</i>';
        resultsHtml += `<div style="padding:0.6rem; margin-top:0.4rem; background:#f8f9fa; border-left:3px solid #48cfad; border-radius:4px;">
            <strong>${o.tenDonHang}</strong><div style="font-size:0.9rem; color:#555;">${o.diaChi || '<i>Không có địa chỉ</i>'} — ${timeLabel}</div>
        </div>`;
    });
    resultsPanel.innerHTML = resultsHtml;

    // Details panel: danh sách đầy đủ
    let detailsHtml = '';
    orders.forEach((o, idx) => {
        const timeLabel = o.thoiGianGiao ? (o.thoiGianGiao instanceof Date ? o.thoiGianGiao.toLocaleString() : String(o.thoiGianGiao)) : '—';
        detailsHtml += `<div class="detail-item"><strong>${idx+1}. ${o.tenDonHang}</strong><div style="font-size:0.9rem; color:#555;">Địa chỉ: ${o.diaChi || '<i>Không có</i>'} • Thời gian: ${timeLabel}</div></div>`;
    });
    detailsPanel.innerHTML = detailsHtml;

    // Conflicts: phát hiện trùng khung giờ đơn giản & thiếu địa chỉ
    const timezoneMap = {}; 
    const missingAddress = [];
    orders.forEach(o => {
        const timeKey = o.thoiGianGiao ? (o.thoiGianGiao instanceof Date ? o.thoiGianGiao.toISOString() : String(o.thoiGianGiao).trim()) : 'NO_TIME';
        if (!timezoneMap[timeKey]) timezoneMap[timeKey] = [];
        timezoneMap[timeKey].push(o);
        if (!o.diaChi || String(o.diaChi).trim() === '') missingAddress.push(o);
    });

    let conflictsHtml = '';
    // trùng khung giờ
    Object.keys(timezoneMap).forEach(k => {
        const arr = timezoneMap[k];
        if (arr.length > 1 && k !== 'NO_TIME') {
            const displayKey = arr[0].thoiGianGiao instanceof Date ? arr[0].thoiGianGiao.toLocaleString() : k;
            conflictsHtml += `<div class="conflict-item"><strong>Trùng khung giờ ${displayKey}:</strong> ${arr.map(x => x.tenDonHang).join(', ')}</div>`;
        }
    });
    // thiếu địa chỉ
    if (missingAddress.length) {
        conflictsHtml += `<div class="conflict-item"><strong>Thiếu địa chỉ:</strong> ${missingAddress.map(x => x.tenDonHang).join(', ')}</div>`;
    }
    if (!conflictsHtml) conflictsHtml = `<div class="empty-state">Không phát hiện xung đột sơ bộ</div>`;
    conflictsPanel.innerHTML = conflictsHtml;
}

/* Xử lý khi người dùng chọn file */
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Cập nhật trạng thái tải
    vizCanvas.innerHTML = '<div class="viz-placeholder"><div style="font-size: 4rem;">⏳</div><p>Đang tải và xử lý dữ liệu...</p></div>';
    resultsPanel.innerHTML = `<div class="empty-state">Đang phân tích dữ liệu...</div>`;
    detailsPanel.innerHTML = `<div class="empty-state">Vui lòng chờ...</div>`;
    conflictsPanel.innerHTML = `<div class="empty-state">Đang kiểm tra xung đột...</div>`;

    try {
        const orderData = await readExcelFile(file);

        // Lưu vào state
        appState.orders = orderData;
        appState.graph = null;
        appState.coloring = null;
        appState.currentStep = 0;

        // Cập nhật UI
        vizCanvas.innerHTML = `<div class="viz-placeholder"><div style="font-size: 4rem;">📄</div><p>Đã tải <strong>${orderData.length}</strong> đơn hàng.<br>Nhấn "Build Graph" để tiếp tục.</p></div>`;
        displayDataSummary(orderData);
        console.log('Orders loaded:', orderData);
        alert(`Đã tải và xử lý thành công ${orderData.length} đơn hàng.`);
    } catch (err) {
        console.error('Lỗi tải dữ liệu:', err);
        vizCanvas.innerHTML = '<div class="viz-placeholder"><div style="font-size: 4rem;">❌</div><p>Lỗi tải tệp. Kiểm tra console.</p></div>';
        resultsPanel.innerHTML = `<div class="empty-state">Lỗi: ${err}</div>`;
        detailsPanel.innerHTML = `<div class="empty-state">Không có dữ liệu</div>`;
        conflictsPanel.innerHTML = `<div class="empty-state">Không có dữ liệu</div>`;
        appState.orders = null;
        alert('Lỗi khi xử lý tệp: ' + err);
    } finally {
        // reset input để người dùng có thể tải lại cùng file nếu muốn
        fileInput.value = '';
    }
});


/* =======================================
   Xử lý Sự kiện Nút (Logic mô phỏng/stub)
   ======================================= */

// Build Graph
buildGraphBtn.addEventListener('click', (ev) => {
    if (!appState.orders || appState.orders.length === 0) {
        alert('Chưa có dữ liệu đơn hàng. Vui lòng upload file trước khi xây dựng đồ thị.');
        vizCanvas.innerHTML = '<div class="viz-placeholder"><div style="font-size: 4rem;">📁</div><p>Vui lòng tải dữ liệu trước.</p></div>';
        return;
    }
    
    console.log('Building graph...');
    vizCanvas.innerHTML = '<div class="viz-placeholder"><div style="font-size: 4rem;">🔄</div><p>Đang xây dựng đồ thị...</p></div>';
    
    // Giả lập xử lý
    setTimeout(() => {
        vizCanvas.innerHTML = '<div class="viz-placeholder"><div style="font-size: 4rem;">✅</div><p>Đồ thị đã được xây dựng</p></div>';
        
        // Cập nhật Conflicts Panel với kết quả giả định (nếu chưa được cập nhật từ hàm displayDataSummary)
        // Lưu ý: Logic này nên được thực hiện sau khi Geocoding và tính toán xung đột thực tế.
        // conflictsPanel.innerHTML = ... (sẽ được cập nhật sau)
        
    }, 1500);
});

// Run Coloring
runColoringBtn.addEventListener('click', () => {
    if (!appState.orders || appState.orders.length === 0 || !appState.graph) {
        alert('Vui lòng xây dựng đồ thị trước khi chạy thuật toán tô màu.');
        return;
    }
    
    console.log('Running coloring algorithm...');
    vizCanvas.innerHTML = '<div class="viz-placeholder"><div style="font-size: 4rem;">🎨</div><p>Đang chạy thuật toán Welsh-Powell...</p></div>';
    
    // Giả lập xử lý
    setTimeout(() => {
        vizCanvas.innerHTML = '<div class="viz-placeholder"><div style="font-size: 4rem;">🎉</div><p>Thuật toán hoàn thành!</p></div>';
        
        // Show results (Giả lập)
        resultsPanel.innerHTML = `
            <div class="result-item"><strong>Số màu tối thiểu:</strong> 3</div>
            <div class="result-item"><strong>Số xe cần thiết:</strong> 3 xe</div>
            <div class="result-item"><strong>Hiệu suất:</strong> 87%</div>
        `;
        
        // Show details (Giả lập)
        detailsPanel.innerHTML = `
            <div class="detail-item"><strong>Xe 1 (Màu Đỏ):</strong> #A1, #B3, #C2</div>
            <div class="detail-item"><strong>Xe 2 (Màu Xanh):</strong> #A2, #C1, #D4</div>
            <div class="detail-item"><strong>Xe 3 (Màu Vàng):</strong> #A3, #B1, #C3</div>
        `;
    }, 2000);
});

// Step-by-Step Mode
stepByStepBtn.addEventListener('click', () => {
    appState.isStepMode = !appState.isStepMode;
    simControls.classList.toggle('active');
    stepByStepBtn.textContent = appState.isStepMode ? '⏸️ Exit Step Mode' : '⏯️ Step-by-Step';
    
    if (appState.isStepMode) {
        playBtn.disabled = false;
        nextBtn.disabled = false;
    } else {
        playBtn.disabled = true;
        pauseBtn.disabled = true;
        nextBtn.disabled = true;
    }
});

// Play button, Pause button, Next button, Export button, Tab switching
// (Giữ nguyên logic mô phỏng đã có)

playBtn.addEventListener('click', () => {
    appState.isPlaying = true;
    playBtn.disabled = true;
    pauseBtn.disabled = false;
    console.log('Playing animation...');
});

pauseBtn.addEventListener('click', () => {
    appState.isPlaying = false;
    playBtn.disabled = false;
    pauseBtn.disabled = true;
    console.log('Paused');
});

nextBtn.addEventListener('click', () => {
    appState.currentStep++;
    console.log('Next step:', appState.currentStep);
});

exportBtn.addEventListener('click', () => {
    console.log('Exporting results...');
    alert('Xuất kết quả ra file Excel/PDF\n(Chức năng đang được phát triển)');
});

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        appState.currentView = btn.dataset.tab;
        
        const icon = appState.currentView === 'map' ? '📍' : '🔴';
        vizCanvas.innerHTML = `<div class="viz-placeholder"><div style="font-size: 4rem;">${icon}</div><p>Hiển thị ${appState.currentView === 'map' ? 'bản đồ' : 'đồ thị'}</p></div>`;
    });
});

console.log('ShipColor Dashboard initialized');