/**
 * ============================================================================
 * 📁 FILE: main.js
 * 🎮 CHỨC NĂNG: ĐIỀU KHIỂN CHÍNH (MAIN CONTROLLER)
 * 📝 Mô tả: Khởi tạo DOM, lắng nghe sự kiện nút bấm và điều phối luồng dữ liệu.
 * ============================================================================
 */

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
const nextBtn = document.getElementById('nextBtn');
const skipBtn = document.getElementById('skipBtn');
const stepStatus = document.getElementById('stepStatus');
const stepCount = document.getElementById('stepCount');
const stepColorBox = document.getElementById('stepColorBox');
const tabButtons = document.querySelectorAll('.tab-btn');
const orderTooltip = document.getElementById("orderTooltip");


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

/* ==========================================================================
    SỰ KIỆN NÚT "UPLOAD FILE"
   ========================================================================== */
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

/* ==========================================================================
    SỰ KIỆN NÚT "BUILD GRAPH"
   ========================================================================== */
buildGraphBtn.addEventListener('click', () => {
    if (!appState.orders || appState.orders.length === 0) {
        alert('Chưa có dữ liệu đơn hàng.');
        return;
    }

    vizCanvas.innerHTML = `
        <div class="viz-placeholder">
            <div style="font-size:4rem;">🔄</div>
            <p>Đang xây dựng đồ thị xung đột...</p>
        </div>`;

    // 1. Tính toán danh sách xung đột (Code cũ đã có)
    const conflicts = calculateConflicts(appState.orders);

    // 2. [THÊM MỚI] Tạo ma trận kề từ danh sách xung đột vừa tính được
    const matrix = createAdjacencyMatrix(appState.orders, conflicts); // <--- GỌI HÀM MỚI
    appState.adjacencyMatrix = matrix; // <--- LƯU VÀO APPSTATE

    // 3. Lưu dữ liệu để vẽ (Code cũ)
    appState.graph = {
        nodes: appState.orders,
        edges: conflicts
    };

    // 4. Vẽ đồ thị (Code cũ)
    setTimeout(() => renderGraph(appState.graph), 80);

    // 5. Hiển thị thông báo (Code cũ)
    conflictsPanel.innerHTML = conflicts.length === 0
        ? `<div class="empty-state">Không có xung đột</div>`
        : conflicts.map((c, i) => `
            <div style="
                padding:0.6rem;
                margin-bottom:0.5rem;
                background:#fff3cd;
                border-left:4px solid #ffc107;
                border-radius:4px;
                font-size:0.9rem;
            ">
                <b>#${i + 1}</b><br>
                ${c.orderA.tenDonHang} ⟷ ${c.orderB.tenDonHang}<br>
                ⏱️ ${c.travelMinutes} phút (Δ nhóm = ${c.groupDiff})
            </div>
        `).join('');
        
    // [THÊM MỚI] Log ra kiểm tra chơi (F12) xem có ma trận chưa
    console.log("Ma trận kề đã tạo:", appState.adjacencyMatrix);
});

/* ==========================================================================
    SỰ KIỆN NÚT "RUN COLORING"
   ========================================================================== */

if (runColoringBtn) {
    // Clone nút để xóa event cũ
    const newBtn = runColoringBtn.cloneNode(true);
    runColoringBtn.parentNode.replaceChild(newBtn, runColoringBtn);

    newBtn.addEventListener('click', () => {
        // 1. Kiểm tra điều kiện: Phải có Ma trận kề trong appState
        if (!appState.adjacencyMatrix || !appState.orders) {
            alert('⚠️ Vui lòng nhấn "Build Graph" trước để tạo ma trận kề!');
            return;
        }

        console.log("--- Bắt đầu thuật toán Welsh-Powell ---");
        const vizCanvas = document.getElementById('vizCanvas');
        
        // Hiển thị trạng thái đang chạy
        // (Lưu ý: Không xóa đồ thị cũ, chỉ hiện thông báo đè lên hoặc loading nhỏ)
        // Ở đây ta tính toán rất nhanh nên chạy luôn

        try {
            // 2. Chạy thuật toán
            const result = welshPowellAlgorithm(appState.adjacencyMatrix);
            
            // Lưu kết quả vào appState
            appState.coloring = result;
            appState.hasColoring = true; // Mở khóa Map View (nếu có logic đó)

            // 3. Cập nhật màu sắc lên đồ thị
            applyColorsToVisGraph(result.vertexColors);

            // 4. Hiển thị kết quả ra Panel
            if (resultsPanel) {
                resultsPanel.innerHTML = `
                    <div class="result-item" style="border-left-color: #2196F3;">
                        <strong>🎯 Kết quả tối ưu (Welsh-Powell):</strong><br>
                        Số màu sử dụng (Số xe): <h2>${result.totalColors}</h2>
                    </div>
                `;
            }

            // 5. Hiển thị chi tiết phân bổ xe
            if (detailsPanel) {
                let html = '';
                // Gom nhóm các đơn theo màu (xe)
                for(let c = 0; c < result.totalColors; c++) {
                    const group = result.vertexColors.filter(v => v.color === c);
                    const palette = COLOR_PALETTE[c] || { name: `Xe ${c+1}`, bg: '#ddd' };
                    
                    // Lấy tên đơn hàng từ appState.orders dựa vào ID
                    const orderNames = group.map(v => appState.orders[v.id].tenDonHang).join(', ');

                    html += `
                        <div class="detail-item" style="border-left: 5px solid ${palette.bg};">
                            <strong>${palette.name}:</strong> (${group.length} đơn)<br>
                            <small>${orderNames}</small>
                        </div>
                    `;
                }
                detailsPanel.innerHTML = html;
            }

            alert(`✅ Đã tô màu xong!\nSố xe cần thiết: ${result.totalColors}`);

        } catch (err) {
            console.error(err);
            alert("Lỗi thuật toán: " + err.message);
        }
    });
}
/* ==========================================================================
    🛠️ SỰ KIỆN NÚT "STEP-BY-STEP"
   ========================================================================== */

// Nút Bật/Tắt chế độ Step
stepByStepBtn.addEventListener('click', () => {
    if (!appState.adjacencyMatrix) {
        alert("⚠️ Chưa có đồ thị! Hãy bấm 'Build Graph' trước.");
        return;
    }

    appState.isStepMode = !appState.isStepMode;

    if (appState.isStepMode) {
        // --- VÀO CHẾ ĐỘ ---
        stepByStepBtn.textContent = '⏹️ Thoát Step Mode';
        simControls.classList.add('active'); // Hiện nút Next/Skip

        // 🔥 LỆNH QUAN TRỌNG NHẤT: BẬT THANH TRẠNG THÁI LÊN 🔥
        if(stepStatus) stepStatus.style.display = 'flex';
        
        // 1. Reset toàn bộ màu về mặc định
        d3.selectAll("circle")
            .attr("fill", "#2f80ed")
            .attr("stroke", "#1c4fa1")
            .attr("r", 20);

        // 2. Sinh kịch bản
        stepScenario = generateWelshPowellSteps(appState.adjacencyMatrix, appState.orders);
        stepIndex = 0;

        // Reset chữ và màu về ban đầu
        if(stepCount) stepCount.innerText = "Bước 1";
        if(stepColorBox) {
            const firstColor = COLOR_PALETTE[0];
            stepColorBox.style.backgroundColor = firstColor.bg;
            stepColorBox.title = "Chuẩn bị: " + firstColor.name;
        }
        
        // 3. Mở khóa nút
        nextBtn.disabled = false;
        skipBtn.disabled = false;

        const totalVehicles = stepScenario.filter(s => s.type === 'NEW_ROUND').length;
        alert(`🎖️ Đã vào chế độ Step Mode.\nTổng cộng sẽ có: ${totalVehicles} Bước chính (tương ứng ${totalVehicles} Xe).\nNhấn NEXT để bắt đầu.`);

    } else {
        // --- THOÁT CHẾ ĐỘ ---
        stepByStepBtn.textContent = '⏯️ Step-by-Step';
        simControls.classList.remove('active');
        // 🔥 TẮT THANH TRẠNG THÁI ĐI 🔥
        if(stepStatus) stepStatus.style.display = 'none';
        if (stepTimer) clearInterval(stepTimer);

    }
});

// Nút Next (Đi 1 bước)
nextBtn.addEventListener('click', () => {
    if (appState.isStepMode) {
        executeStep();
    }
});

// Nút Skip (Chạy nhanh hết lượt màu hiện tại)
skipBtn.addEventListener('click', () => {
    if (!appState.isStepMode) return;

    // Khóa nút để tránh bấm loạn
    skipBtn.disabled = true;
    nextBtn.disabled = true;

    // Chạy tự động tốc độ cao
    stepTimer = setInterval(() => {
        if (stepIndex >= stepScenario.length) {
            clearInterval(stepTimer);
            return;
        }

        const nextAction = stepScenario[stepIndex];
        
        // Nếu gặp tín hiệu 'NEW_ROUND' (Màu mới) và không phải bước đầu tiên -> Dừng lại
        if (nextAction.type === 'NEW_ROUND' && stepIndex > 0) {
            clearInterval(stepTimer);
            skipBtn.disabled = false;
            nextBtn.disabled = false;
            // alert("Đã xong một lượt xe. Nhấn Next/Skip để tiếp tục.");
        } else {
            executeStep();
        }
    }, 50); // 50ms mỗi bước
});

/* ==========================================================================
    SỰ KIỆN NÚT "EXPORT"
   ========================================================================== */
exportBtn.addEventListener('click', handleExport); // Gọi hàm từ exportExcel.js

/* ==========================================================================
    SỰ KIỆN NÚT "TAB SWITCHING"
   ========================================================================== */
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