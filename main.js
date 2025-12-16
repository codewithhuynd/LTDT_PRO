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
    if (str === undefined || str === null) return '';

    return String(str)
        .trim()
        .toLowerCase()
        .replace(/đ/g, 'd')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function parseTimeHM(value) {
    if (value === undefined || value === null || value === '') return null;

    // 👉 Trường hợp Excel lưu giờ dưới dạng số
    if (typeof value === 'number') {
        const totalMinutes = Math.round(value * 24 * 60);
        const hour = Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;
        return { hour, minute };
    }

    // 👉 Trường hợp chuỗi "HH:MM"
    const str = String(value).trim();
    const match = str.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!match) return null;

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (hour < 0 || hour > 24) return null;
    if (minute < 0 || minute > 59) return null;
    if (hour === 24 && minute !== 0) return null;

    return { hour, minute };
}
function formatTime(timeObj) {
    if (!timeObj) return '<i>Không có</i>';
    const h = String(timeObj.hour).padStart(2, '0');
    const m = String(timeObj.minute).padStart(2, '0');
    return `${h}:${m}`;
}
function formatTime(timeObj) {
    if (!timeObj) return '<i>Không có</i>';
    const h = String(timeObj.hour).padStart(2, '0');
    const m = String(timeObj.minute).padStart(2, '0');
    return `${h}:${m}`;
}



/* Hàm chính: đọc file Excel/CSV và trả về Promise -> mảng Order */
const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) return reject('Không có tệp được chọn.');

        //FileReader là API đọc file trong JS, dùng để đọc nội dung file người dùng chọn
        const reader = new FileReader();

        //reader.onload là hàm xử lý sự kiện khi file được đọc xong
        //e lúc này là đối tượng reader
        reader.onload = (e) => {
            try {
                //nên e.target.result là nội dung file đã đọc được
                //lấy dữ liệu nhị phân rồi bọc nó thành mảng byte để dễ xử lý
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                //sheetNames là mảng tên các sheet trong file Excel
                if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                    return reject('Không tìm thấy trang tính trong tệp.');
                }

                const sheetName = workbook.SheetNames[0]; //chọn sheet đầu tiên
                const worksheet = workbook.Sheets[sheetName]; //lấy dữ liệu sheet đó
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); //chuyển sheet thành mảng 2 chiều

                if (!json || json.length === 0) {
                    return reject('Tệp không có dữ liệu.');
                }

                // Header
                //map là duyệt qua mảng json[0] nếu gặp undefined hoặc null thì thay bằng chuỗi rỗng '', còn nếu có dữ liệu thì chuyển thành chuỗi
                const rawHeaders = json[0].map(h =>
                    h === undefined || h === null ? '' : String(h)
                );
                const normalizedHeaders = rawHeaders.map(h => normalizeHeader(h));// duyệt qua từng phần tử trong mảng headers chuyển nó thành chuỗi viết liền không dấu, không cách, viết thường

                // Tìm cột của những header để map đúng dữ liệu, và khi cột trong file excel thay đổi vị trí thì vẫn đúng
                //findIndex là hàm tìm vị trí phần tử trong mảng thỏa mãn điều kiện
                const colIndices = {
                    tenDonHang: normalizedHeaders.findIndex(h =>
                        h.includes('ordername') || h.includes('tendonhang')
                    ),
                    diaChi: normalizedHeaders.findIndex(h =>
                        h.includes('address') || h.includes('diachi')
                    ),
                    thoiGianGiao: normalizedHeaders.findIndex(h =>
                        h.includes('time') || h.includes('thoigian')
                    )
                };

                // ✅ CHECK ĐÚNG
                if (
                    colIndices.tenDonHang === -1 ||
                    colIndices.diaChi === -1 ||
                    colIndices.thoiGianGiao === -1
                ) {
                    return reject(
                        "Tệp không đúng định dạng. Cần có các cột: 'Tên đơn hàng', 'Địa chỉ', 'Thời gian giao'."
                    );
                }

                // Map dữ liệu
                //json.slice(1) là lấy từ dòng thứ 2 trở đi (bỏ header)
                //map là để duyệt từng dòng dữ liệu
                //string.trim() là để loại bỏ khoảng trắng thừa
                const dataRows = json.slice(1).map(row => {
                    const tenDonHang = row[colIndices.tenDonHang];
                    if (!tenDonHang || String(tenDonHang).trim() === '') return null;

                    const diaChi = row[colIndices.diaChi];

                    let thoiGianGiao = null;
                    const rawTime = row[colIndices.thoiGianGiao];

                    thoiGianGiao = parseTimeHM(rawTime);

                    return new Order(tenDonHang, diaChi, thoiGianGiao);
                }).filter(Boolean);

                resolve(dataRows);

            } catch (err) {
                console.error(err);
                reject('Lỗi parse file: ' + err.message);
            }
        };

        //readAsArrayBuffer để đọc file dưới dạng ArrayBuffer là đọc dưới dạng dữ liệu nhị phân
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

    /* ===== PANEL TỔNG QUAN ===== */
    let resultsHtml = `
        <div class="result-item">
            <strong>Tổng đơn hàng:</strong> ${total}
        </div>
    `;

    orders.forEach(o => {
        const timeLabel = formatTime(o.thoiGianGiao);
        resultsHtml += `
            <div style="
                padding:0.6rem;
                margin-top:0.4rem;
                background:#f8f9fa;
                border-left:3px solid #48cfad;
                border-radius:4px;
            ">
                <strong>${o.tenDonHang}</strong>
                <div style="font-size:0.9rem; color:#555;">
                    ${o.diaChi || '<i>Không có địa chỉ</i>'} — ${formatTime(o.thoiGianGiao)}

                </div>
            </div>
        `;
    });

    resultsPanel.innerHTML = resultsHtml;
}


/* Xử lý khi người dùng chọn file */
//element.addEventListener(eventName,eventHandler) khi eventName xảy ra trên element đó thì chạy handler
//vậy có nghĩa khi có sự kiện change (thay đổi) trên fileInput thì chạy hàm async (e) => {...}
//hàm là async(e) => {...} nhận tham số e (event) để lấy file người dùng chọn
//e là sự kiện vừa xảy ra
//event object chứa mọi thông tin về sự kiện xảy ra e.target là phần tử bị tác động tức là phần tử html gây ra sự kiện
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    //e.target sẽ trả về cái html input
    //e.target.files là thuộc tính files của thẻ input đó nhưng nó gồm nhiều file vì có thể chọn được nhiều file
    //nên ta chỉ lấy file đầu tiên với [0]
    //lúc này file chứa file.name, file.size, file.type,...
    if (!file) return;

    // Cập nhật trạng thái tải
    vizCanvas.innerHTML = '<div class="viz-placeholder"><div style="font-size: 4rem;">⏳</div><p>Đang tải và xử lý dữ liệu...</p></div>';
    resultsPanel.innerHTML = `<div class="empty-state">Đang phân tích dữ liệu...</div>`;

    try {
        //khai báo biến orderData để lưu dữ liệu đơn hàng đọc được từ file
        // hàm readExcelFile(file) trả về Promise nên ta dùng await để chờ kết quả
        //promise là 1 đối tượng trả về resoleve hoặc reject
        //await là từ khóa chỉ dùng trong hàm async để chờ 1 promise hoàn thành
        //khi promise hoàn thành nó trả về giá trị resolve là mảng Order(dataRows)
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
        //nếu await readExcelFile(file) bị lỗi thì chạy vào catch
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