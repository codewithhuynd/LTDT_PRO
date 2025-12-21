/**
 * ============================================================================
 * 📁 FILE: coloring.js
 * 🎨 CHỨC NĂNG: THUẬT TOÁN TÔ MÀU (COLORING ALGORITHM)
 * 📝 Mô tả: Chứa bảng màu, thuật toán Welsh-Powell và logic Step-by-Step.
 * ============================================================================
 */

/* ----------------------------------------------------------------------------
    1. BẢNG MÀU "NGHỆ THUẬT" (20 màu Modern UI)
   ---------------------------------------------------------------------------- */
const COLOR_PALETTE = [
    // 1. Cam Hoàng Hôn (Rực rỡ mở màn)
    { bg: '#FF6B6B', border: '#C92A2A', name: 'Xe 1 (Sunset Orange)' },
    
    // 2. Xanh Biển Sâu (Tương phản mạnh với cam)
    { bg: '#4D96FF', border: '#1A5FBC', name: 'Xe 2 (Ocean Blue)' },
    
    // 3. Xanh Ngọc Lục Bảo (Mát mắt, sang trọng)
    { bg: '#06D6A0', border: '#048A66', name: 'Xe 3 (Emerald)' },
    
    // 4. Vàng Mật Ong (Sáng nhưng không chói, dễ đọc chữ)
    { bg: '#FFD166', border: '#B8860B', name: 'Xe 4 (Honey Yellow)' },
    
    // 5. Tím Vô Cực (Huyền bí, đậm đà)
    { bg: '#7209B7', border: '#48007A', name: 'Xe 5 (Deep Violet)' },
    
    // 6. Hồng San Hô (Nữ tính nhưng hiện đại)
    { bg: '#EF476F', border: '#AD1D40', name: 'Xe 6 (Coral Pink)' },
    
    // 7. Xanh Lơ (Tươi mới)
    { bg: '#118AB2', border: '#073B4C', name: 'Xe 7 (Cerulean)' },
    
    // 8. Đỏ Rượu Vang (Trầm ấm, quyền lực)
    { bg: '#9D0208', border: '#370617', name: 'Xe 8 (Wine Red)' },
    
    // 9. Xanh Lá Mạ (Năng động, nổi bật trên nền tối)
    { bg: '#80B918', border: '#4F772D', name: 'Xe 9 (Spring Green)' },
    
    // 10. Nâu Coffee (Trung tính, ấm áp)
    { bg: '#6F4E37', border: '#3E2723', name: 'Xe 10 (Coffee)' },
    
    // 11. Xanh Cổ Vịt (Teal - Màu "hot trend")
    { bg: '#2A9D8F', border: '#1D6D63', name: 'Xe 11 (Teal)' },
    
    // 12. Tím Pastel (Nhẹ nhàng, mộng mơ)
    { bg: '#B5179E', border: '#700B61', name: 'Xe 12 (Orchid)' },
    
    // 13. Cam Đất (Vintage)
    { bg: '#E76F51', border: '#9A3A23', name: 'Xe 13 (Burnt Sienna)' },
    
    // 14. Xanh Navy (Mạnh mẽ, nghiêm túc)
    { bg: '#264653', border: '#101D24', name: 'Xe 14 (Classic Navy)' },
    
    // 15. Vàng Chanh (Neon, rất nổi bật)
    { bg: '#D4D700', border: '#828500', name: 'Xe 15 (Acid Lime)' },
    
    // 16. Xám Ánh Xanh (Hiện đại, công nghệ)
    { bg: '#6C757D', border: '#343A40', name: 'Xe 16 (Cool Gray)' },
    
    // 17. Hồng Fuchsia (Rất đậm và rực)
    { bg: '#F72585', border: '#A3004C', name: 'Xe 17 (Fuchsia)' },
    
    // 18. Xanh Bạc Hà (Mint - Dịu mắt)
    { bg: '#4CC9F0', border: '#2186C4', name: 'Xe 18 (Sky Blue)' },
    
    // 19. Màu Olive (Độc đáo, ít đụng hàng)
    { bg: '#556B2F', border: '#283314', name: 'Xe 19 (Dark Olive)' },
    
    // 20. Đen Than Chì (Kết thúc mạnh mẽ)
    { bg: '#212529', border: '#000000', name: 'Xe 20 (Charcoal)' }
];

/* ----------------------------------------------------------------------------
    2. THUẬT TOÁN WELSH-POWELL (CORE LOGIC)
   ---------------------------------------------------------------------------- */
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
/* ----------------------------------------------------------------------------
    3. ÁP DỤNG MÀU LÊN D3.JS (VISUALIZATION UPDATE)
   ---------------------------------------------------------------------------- */
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
/* ----------------------------------------------------------------------------
    4.🛠️ LOGIC STEP-BY-STEP LOGIC (WELSH-POWELL)
   ---------------------------------------------------------------------------- */
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