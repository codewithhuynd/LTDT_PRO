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
//build graph
// =====================================================
// 1️⃣ NORMALIZE TEXT
// =====================================================
function normalizeText(str) {
    return str
        .toLowerCase()
        .replace(/đ/g, 'd')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}


// =====================================================
// 2️⃣ EXTRACT DISTRICT (THEO FORMAT CHUẨN)
// [Số nhà] [Đường], [Phường], [Quận], [TP]
// =====================================================
function extractDistrict(address) {
    if (!address) return null;

    const parts = address.split(',').map(p => p.trim());
    if (parts.length < 3) return null;

    // phần thứ 3 là Quận/Huyện
    return normalizeText(parts[2]);
}

// =====================================================
// 3️⃣ MAP QUẬN → NHÓM (19 QUẬN TP.HCM CŨ)
// =====================================================
const DISTRICT_GROUP = {
    // 🟢 A – Trung tâm
    "quan 1": 0,
    "quan 3": 0,
    "quan 4": 0,
    "quan 5": 0,
    "quan 10": 0,
    "quan phu nhuan": 0,

    // 🔵 B – Cận trung tâm
    "quan 6": 1,
    "quan 7": 1,
    "quan 8": 1,
    "quan 11": 1,
    "quan tan binh": 1,
    "quan binh thanh": 1,

    // 🟡 C – Vành đai
    "quan go vap": 2,
    "quan tan phu": 2,
    "quan binh tan": 2,
    "quan 12": 2,

    // 🔴 D – Xa trung tâm
    "quan 2": 3,
    "quan 9": 3,
    "quan thu duc": 3
};

// =====================================================
// 4️⃣ LẤY GROUP TỪ ĐỊA CHỈ
// =====================================================
function getGroupFromAddress(address) {
    const district = extractDistrict(address);
    if (!district) return null;
    return DISTRICT_GROUP[district] ?? null;
}

// =====================================================
// 5️⃣ THỜI GIAN DI CHUYỂN GIẢ ĐỊNH
// =====================================================
function travelMinutesByGroup(g1, g2) {
    const d = Math.abs(g1 - g2);
    if (d === 0) return 15;
    if (d === 1) return 35;
    if (d === 2) return 50;
    return 70;
}

// =====================================================
// 6️⃣ TIME UTILS
// =====================================================
function toMinutes(timeObj) {
    if (!timeObj) return null;
    return timeObj.hour * 60 + timeObj.minute;
}

// =====================================================
// 7️⃣ CHECK TIME CONFLICT
// =====================================================
function isTimeConflict(orderA, orderB, travelMinutes) {
    const tA = toMinutes(orderA.thoiGianGiao);
    const tB = toMinutes(orderB.thoiGianGiao);

    if (tA === null || tB === null) return false;

    const buffer = 5;
    return Math.abs(tA - tB) < (travelMinutes + buffer);
}

// =====================================================
// 8️⃣ CHECK 1 CẶP ĐƠN (THEO NHÓM)
// =====================================================
function checkOrderConflict(orderA, orderB) {
    const gA = getGroupFromAddress(orderA.diaChi);
    const gB = getGroupFromAddress(orderB.diaChi);

    if (gA === null || gB === null) return null;

    const travelMinutes = travelMinutesByGroup(gA, gB);

    return {
        conflict: isTimeConflict(orderA, orderB, travelMinutes),
        travelMinutes,
        groupDiff: Math.abs(gA - gB)
    };
}

// =====================================================
// 9️⃣ BUILD GRAPH (ALL PAIRS)
// =====================================================
function calculateConflicts(orders) {
    const conflicts = [];

    for (let i = 0; i < orders.length; i++) {
        for (let j = i + 1; j < orders.length; j++) {

            const res = checkOrderConflict(orders[i], orders[j]);
            if (!res || !res.conflict) continue;

            conflicts.push({
                orderA: orders[i],
                orderB: orders[j],
                travelMinutes: res.travelMinutes,
                groupDiff: res.groupDiff
            });
        }
    }
    return conflicts;
}

// =====================================================
// 🔟 BUILD GRAPH BUTTON
// =====================================================
/* =====================================================
   🎨 GRAPH RENDERING – D3 (STATIC + AUTO FIT)
===================================================== */

function clearViz() {
    vizCanvas.innerHTML = "";
}

// màu node
function renderGraph(graph) {
    if (!graph || !graph.nodes || graph.nodes.length === 0) return;

    // clear canvas
    vizCanvas.innerHTML = "";

    const width = vizCanvas.clientWidth || 800;
    const height = 520;

    /* ===== 1️⃣ CHUẨN BỊ DATA ===== */
    const nodes = graph.nodes.map((o, i) => ({
        ...o,
        _index: i
    }));

    const idMap = new Map(nodes.map((n, i) => [n.id, i]));

    const links = graph.edges.map(e => ({
        source: idMap.get(e.orderA.id),
        target: idMap.get(e.orderB.id)
    }));

    /* ===== 2️⃣ SVG ===== */
    const svg = d3.select(vizCanvas)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("cursor", "grab");

    /* ROOT GROUP (để zoom) */
    const graphRoot = svg.append("g");

    /* ZOOM & PAN */
    const zoom = d3.zoom()
        .scaleExtent([0.4, 2.5]) // 👈 min – max zoom
        .on("zoom", (event) => {
            graphRoot.attr("transform", event.transform);
        });

    svg.call(zoom);

    /* đổi cursor khi kéo */
    svg.on("mousedown", () => svg.style("cursor", "grabbing"));
    svg.on("mouseup", () => svg.style("cursor", "grab"));


    /* ===== 3️⃣ CẠNH ===== */
    const link = graphRoot.append("g")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", "#111")
        .attr("stroke-opacity", 0.9)
        .attr("stroke-width", 3.5);


    /* ===== 4️⃣ NODE (TO – CÙNG MÀU XANH) ===== */
    const node = graphRoot.append("g")
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", 20)
        .attr("fill", "#2f80ed")
        .attr("stroke", "#1c4fa1")
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .on("click", (event, d) => {
            event.stopPropagation();     // 🔥 ngăn click lan ra ngoài
            showOrderTooltip(event, d);
        });

    // Tính degree (số cạnh nối)
    const degreeMap = new Map();
    nodes.forEach(n => degreeMap.set(n.id, 0));

    links.forEach(l => {
        degreeMap.set(nodes[l.source].id, degreeMap.get(nodes[l.source].id) + 1);
        degreeMap.set(nodes[l.target].id, degreeMap.get(nodes[l.target].id) + 1);
    });

    // Đánh dấu node cô lập
    nodes.forEach(n => {
        n.isIsolated = degreeMap.get(n.id) === 0;
    });


    const nodeNumber = graphRoot.append("g")
        .selectAll("text.node-number")
        .data(nodes)
        .join("text")
        .attr("class", "node-number")
        .text(d => d._index + 1)     // 🔢 số thứ tự
        .attr("font-size", 12)
        .attr("font-weight", "bold")
        .attr("fill", "#ffffff")    // chữ trắng nổi trên nền xanh
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("pointer-events", "none");



    /* ===== 6️⃣ FORCE LAYOUT (GÔM – DỄ NHÌN) ===== */
    const simulation = d3.forceSimulation(nodes)
        .force(
            "link",
            d3.forceLink(links)
                .distance(400)
                .strength(0.5)
        )
        .force(
            "charge",
            d3.forceManyBody()
                .strength(d => d.isIsolated ? -60 : -10)
        )
        .force(
            "collision",
            d3.forceCollide()
                .radius(150)
                .strength(1)
        )
        .force(
            "center",
            d3.forceCenter(width / 2, height / 2)
        )
        .force(
            "isolateRing",
            d3.forceRadial(
                d => d.isIsolated ? 350 : 0,
                width / 2,
                height / 2
            ).strength(d => d.isIsolated ? 0.4 : 0)
        );


    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

        nodeNumber
            .attr("x", d => d.x)
            .attr("y", d => d.y);
    });


    /* ===== 7️⃣ AUTO FIT VÀO VIEW ===== */
    function fitToView() {
        const bbox = graphRoot.node().getBBox();
        const padding = 40;

        if (!bbox.width || !bbox.height) return;

        const scale = Math.min(
            (width - padding) / bbox.width,
            (height - padding) / bbox.height,
            1
        );

        const tx = width / 2 - scale * (bbox.x + bbox.width / 2);
        const ty = height / 2 - scale * (bbox.y + bbox.height / 2);

        graphRoot.attr(
            "transform",
            `translate(${tx},${ty}) scale(${scale})`
        );
    }

    /* ===== 8️⃣ CHẠY → FIT → DỪNG ===== */
    setTimeout(() => {
        simulation.stop();
        fitToView();

        // set zoom transform theo fit
        svg.call(
            zoom.transform,
            d3.zoomIdentity
        );
    }, 800);

}

document.addEventListener("click", () => {
    orderTooltip.style.display = "none";
});


function showOrderTooltip(event, order) {
    orderTooltip.innerHTML = `
        <div style="font-weight:bold; margin-bottom:6px;">
            📦 Đơn #${order._index + 1}
        </div>
        <div style="margin-bottom:4px;">
            <b>Mã đơn:</b> ${order.tenDonHang}
        </div>
        <div style="margin-bottom:4px;">
            <b>📍 Địa điểm:</b><br>
            ${order.diaChi || "<i>Không có</i>"}
        </div>
        <div>
            <b>⏰ Thời gian:</b> ${formatTime(order.thoiGianGiao)}
        </div>
    `;

    orderTooltip.style.left = event.pageX + 12 + "px";
    orderTooltip.style.top = event.pageY + 12 + "px";
    orderTooltip.style.display = "block";
}

// =====================================================
// 1️⃣1️⃣ HÀM PHỤ TRỢ: TẠO MA TRẬN KỀ TỪ DANH SÁCH XUNG ĐỘT
// (Thêm đoạn này vào trước phần xử lý sự kiện nút Build Graph)
// =====================================================
function createAdjacencyMatrix(orders, conflictList) {
    const n = orders.length;
    // Tạo ma trận n x n toàn số 0
    const matrix = Array.from({ length: n }, () => Array(n).fill(0));

    // Tạo bảng tra cứu: ID đơn hàng -> Số thứ tự (Index) trong mảng
    // Mục đích: Để biết đơn hàng ID "DH001" nằm ở hàng thứ mấy trong ma trận
    const idToIndex = new Map();
    orders.forEach((order, index) => {
        idToIndex.set(order.id, index);
    });

    // Duyệt qua danh sách xung đột để đánh dấu số 1 vào ma trận
    conflictList.forEach(c => {
        const indexA = idToIndex.get(c.orderA.id);
        const indexB = idToIndex.get(c.orderB.id);

        if (indexA !== undefined && indexB !== undefined) {
            matrix[indexA][indexB] = 1;
            matrix[indexB][indexA] = 1; // Đồ thị vô hướng (A xung đột B thì B cũng xung đột A)
        }
    });

    return matrix;
}

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

/* =====================================================
   📊 CHỨC NĂNG EXPORT EXCEL (2 SHEETS)
   ===================================================== */
exportBtn.addEventListener('click', () => {
    // 1. Kiểm tra xem đã có kết quả tô màu chưa
    if (!appState.coloring || !appState.orders) {
        alert('⚠️ Vui lòng chạy "Run Coloring" trước khi xuất dữ liệu!');
        return;
    }

    const { vertexColors, totalColors } = appState.coloring;
    const orders = appState.orders;

    // --- SHEET 1: TỔNG HỢP PHÂN BỔ THEO XE ---
    const summaryData = [];
    for (let c = 0; c < totalColors; c++) {
        const group = vertexColors.filter(v => v.color === c);
        const palette = COLOR_PALETTE[c] || { name: `Xe ${c + 1}` };
        
        // Lấy danh sách mã đơn
        const orderIds = group.map(v => orders[v.id].tenDonHang).join(', ');

        summaryData.push({
            "Xe": palette.name,
            "Số đơn": group.length,
            "Danh sách mã đơn": orderIds
        });
    }

    // --- SHEET 2: DANH SÁCH ĐƠN CHI TIẾT ---
    const detailData = orders.map((order, index) => {
        // Tìm thông tin xe từ kết quả coloring
        const colorInfo = vertexColors.find(v => v.id === index);
        const vehicleName = colorInfo !== undefined 
            ? (COLOR_PALETTE[colorInfo.color % COLOR_PALETTE.length]?.name || `Xe ${colorInfo.color + 1}`)
            : 'Chưa phân bổ';

        return {
            "Mã đơn (Order ID)": order.tenDonHang,
            "Địa chỉ": order.diaChi,
            "Thời gian yêu cầu": formatTime(order.thoiGianGiao).replace(/<\/?[^>]+(>|$)/g, ""), // Xóa tag HTML nếu có
            "Nhóm": extractDistrict(order.diaChi) || "N/A",
            "Xe được phân": vehicleName
        };
    });

    // --- TẠO WORKBOOK VÀ XUẤT FILE ---
    try {
        // Tạo workbook mới
        const wb = XLSX.utils.book_new();

        // Chuyển đổi dữ liệu JSON thành Sheet
        const ws1 = XLSX.utils.json_to_sheet(summaryData);
        const ws2 = XLSX.utils.json_to_sheet(detailData);

        // Thêm sheet vào workbook
        XLSX.utils.book_append_sheet(wb, ws1, "Tổng hợp phân bổ");
        XLSX.utils.book_append_sheet(wb, ws2, "Danh sách đơn chi tiết");

        // Xuất file (Lưu file)
        const fileName = `Ket_Qua_Phan_Bo_Xe_${new Date().getTime()}.xlsx`;
        XLSX.writeFile(wb, fileName);

        alert(`✅ Đã xuất file thành công: ${fileName}`);
    } catch (error) {
        console.error("Lỗi xuất Excel:", error);
        alert("Có lỗi xảy ra khi tạo file Excel.");
    }
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

/* ==========================================================================
   PHẦN BỔ SUNG MỚI: THUẬT TOÁN WELSH-POWELL & RUN COLORING
   (Dán tiếp vào cuối file main.js)
   ========================================================================== */

// 1. BẢNG MÀU (Dùng để tô cho các xe khác nhau)
const COLOR_PALETTE = [
    { bg: '#FF5722', border: '#BF360C', name: 'Xe 1 (Đỏ)' },
    { bg: '#FFC107', border: '#FF6F00', name: 'Xe 2 (Vàng)' },
    { bg: '#4CAF50', border: '#1B5E20', name: 'Xe 3 (Xanh lá)' },
    { bg: '#2196F3', border: '#0D47A1', name: 'Xe 4 (Xanh dương)' },
    { bg: '#9C27B0', border: '#4A148C', name: 'Xe 5 (Tím)' },
    { bg: '#00BCD4', border: '#006064', name: 'Xe 6 (Cyan)' },
    { bg: '#795548', border: '#3E2723', name: 'Xe 7 (Nâu)' },
    { bg: '#607D8B', border: '#263238', name: 'Xe 8 (Xám)' }
];

// 2. THUẬT TOÁN WELSH-POWELL (CORE LOGIC)
function welshPowellAlgorithm(matrix) {
    const numVertices = matrix.length;
    
    // Bước 1: Tính bậc (degree) của từng đỉnh
    let vertices = [];
    for (let i = 0; i < numVertices; i++) {
        let degree = 0;
        for (let j = 0; j < numVertices; j++) {
            if (matrix[i][j] === 1) degree++;
        }
        vertices.push({ id: i, degree: degree, color: null });
    }

    // Bước 2: Sắp xếp các đỉnh theo thứ tự bậc giảm dần
    // (Theo lý thuyết: Chọn đỉnh bậc cao nhất tô trước)
    vertices.sort((a, b) => b.degree - a.degree);

    // Bước 3: Tô màu tham lam (Greedy Coloring)
    let colorIndex = 0;
    let coloredCount = 0;

    // Lặp cho đến khi tất cả các đỉnh đều có màu
    while (coloredCount < numVertices) {
        // Lấy danh sách các đỉnh chưa được tô màu
        let uncoloredNodes = vertices.filter(v => v.color === null);
        if (uncoloredNodes.length === 0) break;

        // Gán màu mới (colorIndex) cho đỉnh đầu tiên trong danh sách chưa tô (có bậc cao nhất)
        let root = uncoloredNodes[0];
        root.color = colorIndex;
        coloredCount++;

        // Tìm các đỉnh khác không kề với root và cũng không kề với các đỉnh đã tô màu này
        // Danh sách các đỉnh đã tô màu hiện tại (trong lượt màu này)
        let currentGroup = [root.id];

        for (let i = 1; i < uncoloredNodes.length; i++) {
            let candidate = uncoloredNodes[i];
            
            // Kiểm tra xem candidate có kề với bất kỳ đỉnh nào trong currentGroup không
            let isAdjacent = false;
            for (let nodeId of currentGroup) {
                // Kiểm tra ma trận kề: matrix[candidate.id][nodeId]
                if (matrix[candidate.id][nodeId] === 1) {
                    isAdjacent = true;
                    break;
                }
            }

            // Nếu không kề với ai trong nhóm màu hiện tại -> Tô cùng màu
            if (!isAdjacent) {
                candidate.color = colorIndex;
                currentGroup.push(candidate.id);
                coloredCount++;
            }
        }

        // Chuyển sang màu tiếp theo cho lượt sau
        colorIndex++;
    }

    // Trả về kết quả: Danh sách đỉnh đã sắp xếp lại theo Index ban đầu để dễ map
    return {
        totalColors: colorIndex,
        vertexColors: vertices.sort((a, b) => a.id - b.id) // Sort lại theo ID để map vào orders
    };
}


    /* =====================================================
   3️⃣ CẬP NHẬT MÀU LÊN ĐỒ THỊ D3.JS (ĐÃ FIX LỖI ID)
   ===================================================== */
function applyColorsToVisGraph(vertexColors) {
    console.log("Đang cập nhật màu cho đồ thị D3...");

    // 1. Cập nhật thuộc tính màu vào appState.orders để lưu trữ dữ liệu
    vertexColors.forEach(v => {
        // v.id ở đây chính là số thứ tự (index) trong mảng
        if (appState.orders[v.id]) {
            appState.orders[v.id].mauSac = v.color;
        }
    });

    // 2. Chọn tất cả các vòng tròn (node) trong SVG
    const circles = d3.select("#vizCanvas svg g").selectAll("circle");

    if (circles.empty()) {
        console.warn("⚠️ Không tìm thấy các node D3 để tô màu. Có thể đồ thị chưa được vẽ.");
        return;
    }

    // 3. Thực hiện tô màu
    circles.transition()
        .duration(1000) // Hiệu ứng chuyển màu mượt mà trong 1 giây
        .attr("fill", d => {
            // LƯU Ý QUAN TRỌNG: 
            // d._index là số thứ tự tôi đã gán lúc renderGraph (0, 1, 2...)
            // v.id từ thuật toán cũng là số thứ tự (0, 1, 2...)
            // => Phải so sánh d._index với v.id mới khớp nhau!
            
            const vertex = vertexColors.find(v => v.id === d._index);
            
            if (vertex) {
                // Lấy màu từ bảng màu, dùng toán tử % để quay vòng nếu hết màu
                const colorObj = COLOR_PALETTE[vertex.color % COLOR_PALETTE.length];
                return colorObj.bg; 
            }
            return "#2f80ed"; // Màu gốc nếu không tìm thấy (Fallback)
        })
        .attr("stroke", d => {
            const vertex = vertexColors.find(v => v.id === d._index);
            if (vertex) {
                const colorObj = COLOR_PALETTE[vertex.color % COLOR_PALETTE.length];
                return colorObj.border; // Viền đậm hơn
            }
            return "#1c4fa1";
        })
        // Hiệu ứng phụ: Node nào tô xong thì to lên một chút để dễ nhìn
        .attr("r", 25);
        
    console.log("✅ Đã tô màu xong các node trên đồ thị.");
}

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

// =====================================================
// 🛠️ STEP-BY-STEP LOGIC (WELSH-POWELL)
// =====================================================

// Biến lưu trạng thái chạy từng bước
let stepScenario = []; 
let stepIndex = 0;
let stepTimer = null;

// 1️⃣ HÀM SINH KỊCH BẢN (SCRIPT WRITER)
// Chạy ngầm thuật toán để ghi lại các bước sẽ diễn ra
function generateWelshPowellSteps(matrix, orders) {
    let steps = [];
    
    // Tạo danh sách đỉnh kèm bậc (degree)
    let nodes = orders.map((o, i) => {
        let degree = 0;
        matrix[i].forEach(val => degree += val);
        return { id: i, degree: degree, color: null }; // id là index (0,1,2...)
    });

    // Sắp xếp giảm dần theo bậc
    let sortedNodes = [...nodes].sort((a, b) => b.degree - a.degree);
    
    let colorIndex = 0;
    let coloredCount = 0;

    // Vòng lặp tô màu
    while (coloredCount < nodes.length) {
        // Đánh dấu bắt đầu màu mới (để Skip biết đường dừng lại)
        steps.push({ type: 'NEW_ROUND', colorIndex: colorIndex });

        let uncolored = sortedNodes.filter(n => n.color === null);
        if (uncolored.length === 0) break;

        // Danh sách các đỉnh đã tô trong lượt màu này (để kiểm tra xung đột)
        let currentGroup = [];

        for (let node of uncolored) {
            // HÀNH ĐỘNG 1: Đang xét (Nhấp nháy)
            steps.push({ type: 'CHECKING', nodeId: node.id, colorIndex: colorIndex });

            // Kiểm tra xung đột với các đỉnh đã tô trong nhóm hiện tại
            let isConflict = currentGroup.some(doneId => matrix[node.id][doneId] === 1);

            if (!isConflict) {
                // HÀNH ĐỘNG 2: Hợp lệ -> Tô màu
                node.color = colorIndex;
                currentGroup.push(node.id);
                coloredCount++;
                steps.push({ type: 'COLOR_IT', nodeId: node.id, colorIndex: colorIndex });
            } else {
                // HÀNH ĐỘNG 3: Xung đột -> Trả về cũ
                steps.push({ type: 'REVERT', nodeId: node.id, colorIndex: colorIndex });
            }
        }
        colorIndex++;
    }
    return steps;
}

// 2️⃣ HÀM THỰC THI VISUAL (ACTOR)
// Thực hiện 1 bước dựa trên kịch bản
function executeStep() {
    if (stepIndex >= stepScenario.length) {
        alert("✅ Đã hoàn thành mô phỏng!");
        if (stepTimer) clearInterval(stepTimer);
        nextBtn.disabled = true;
        skipBtn.disabled = true;
        return;
    }

    const step = stepScenario[stepIndex];
    
    /* --- [CHÈN ĐOẠN NÀY VÀO ĐÂY] --- */
    // 1. Cập nhật chữ "B1, B2..."
    if(stepCount && step.colorIndex !== undefined) stepCount.innerText = `Bước ${step.colorIndex + 1}`;
    
    // 2. Cập nhật Ô Màu (Nếu bước đó có thông tin màu)
    if(stepColorBox && step.colorIndex !== undefined) {
        const pal = COLOR_PALETTE[step.colorIndex % COLOR_PALETTE.length];
        stepColorBox.style.backgroundColor = pal.bg;
        stepColorBox.title = `Bước ${step.colorIndex + 1}: Đang xếp ${pal.name}`;
    }
    /* -------------------------------- */

    // Tìm node trên màn hình D3 (dựa vào _index)
    const d3Node = d3.selectAll("circle").filter(d => d._index === step.nodeId);

    switch (step.type) {
        case 'CHECKING':
            d3Node.transition().duration(200)
                .attr("fill", "#bdc3c7").attr("r", 28).attr("stroke", "#7f8c8d");
            break;

        case 'COLOR_IT':
            const c = COLOR_PALETTE[step.colorIndex % COLOR_PALETTE.length];
            d3Node.transition().duration(400)
                .attr("fill", c.bg).attr("stroke", "#fff").attr("r", 25);
            break;

        case 'REVERT':
            d3Node.transition().duration(200)
                .attr("fill", "#2f80ed").attr("stroke", "#1c4fa1").attr("r", 20);
            break;
    }
    stepIndex++;
}

// 3️⃣ BỘ ĐIỀU KHIỂN (CONTROLLERS)

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


