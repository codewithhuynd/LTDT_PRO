/**
 * ============================================================================
 * 📁 FILE: graph.js
 * 🕸️ CHỨC NĂNG: LOGIC ĐỒ THỊ & HIỂN THỊ (VISUALIZATION)
 * 📝 Mô tả: Xử lý địa lý, tính toán xung đột, tạo ma trận kề và vẽ D3.js.
 * ============================================================================
 */

/* ----------------------------------------------------------------------------
    PHẦN 1: LOGIC ĐỊA LÝ & TÍNH XUNG ĐỘT (CONFLICT CALCULATION)
   ---------------------------------------------------------------------------- */

// =====================================================
// 2️⃣ EXTRACT DISTRICT (THEO FORMAT CHUẨN)
// [Số nhà] [Đường], [Phường], [Quận], [TP]
function extractDistrict(address) {
    if (!address) return null;

    const parts = address.split(',').map(p => p.trim());
    if (parts.length < 3) return null;

    // phần thứ 3 là Quận/Huyện
    return normalizeText(parts[2]);
}

// =====================================================
// 3️⃣ MAP QUẬN → NHÓM (19 QUẬN TP.HCM CŨ)
// Map Quận -> Nhóm (19 Quận TP.HCM Cũ)
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
function getGroupFromAddress(address) {
    const district = extractDistrict(address);
    if (!district) return null;
    return DISTRICT_GROUP[district] ?? null;
}

// =====================================================
// 5️⃣ THỜI GIAN DI CHUYỂN GIẢ ĐỊNH
// Thời gian di chuyển giả định
function travelMinutesByGroup(g1, g2) {
    const d = Math.abs(g1 - g2);
    if (d === 0) return 15;
    if (d === 1) return 35;
    if (d === 2) return 50;
    return 70;
}

// =====================================================
// 6️⃣ TIME UTILS
function toMinutes(timeObj) {
    if (!timeObj) return null;
    return timeObj.hour * 60 + timeObj.minute;
}
// =====================================================
// 7️⃣ CHECK TIME CONFLICT
// Kiểm tra xung đột thời gian
function isTimeConflict(orderA, orderB, travelMinutes) {
    const tA = toMinutes(orderA.thoiGianGiao);
    const tB = toMinutes(orderB.thoiGianGiao);

    if (tA === null || tB === null) return false;

    const buffer = 5;
    return Math.abs(tA - tB) < (travelMinutes + buffer);
}

// =====================================================
// 8️⃣ CHECK 1 CẶP ĐƠN (THEO NHÓM)
// Kiểm tra 1 cặp đơn
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
// Xây dựng danh sách xung đột (All Pairs)
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
// HÀM PHỤ TRỢ: TẠO MA TRẬN KỀ TỪ DANH SÁCH XUNG ĐỘT (Adjacency Matrix)
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

/* ----------------------------------------------------------------------------
    🎨PHẦN 2: HIỂN THỊ ĐỒ THỊ VỚI D3.JS (GRAPH VISUALIZATION)
   ---------------------------------------------------------------------------- */
function clearViz() {
    vizCanvas.innerHTML = "";
}

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

document.addEventListener("click", () => {
    orderTooltip.style.display = "none";
});

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