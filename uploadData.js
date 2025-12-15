 const fileInput = document.getElementById('fileInput');
  // --- Bổ sung hoặc Thay thế hàm fileInput.addEventListener hiện tại ---

// Hàm xử lý chính để đọc tệp Excel/CSV
const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Lấy trang tính đầu tiên
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                // Chuyển đổi trang tính thành mảng JSON
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                // Giả sử hàng đầu tiên (json[0]) là tiêu đề
                if (json.length === 0) {
                    reject("Tệp không có dữ liệu.");
                    return;
                }

                // Tiêu đề: ['Tên đơn hàng', 'địa chỉ', 'thời gian giao', ...]
                const headers = json[0].map(h => h.trim());
                
                // Kiểm tra xem các cột cần thiết có tồn tại không
                const requiredHeaders = ['Tên đơn hàng', 'địa chỉ', 'thời gian giao'];
                const allFound = requiredHeaders.every(h => headers.includes(h));

                if (!allFound) {
                    reject("Tệp không đúng định dạng. Cần có các cột: Tên đơn hàng, địa chỉ, thời gian giao.");
                    return;
                }

                // Chuyển đổi phần còn lại của dữ liệu (từ hàng 1 trở đi)
                // và ÁNH XẠ tới cấu trúc Order mới
                const dataRows = json.slice(1).map(row => {
                    let tenDonHang, diaChi, thoiGianGiao;
                    
                    headers.forEach((header, index) => {
                        // Lấy giá trị dựa trên tiêu đề cột
                        if (header.includes('Tên đơn hàng')) tenDonHang = row[index];
                        else if (header.includes('địa chỉ')) diaChi = row[index];
                        else if (header.includes('thời gian giao')) thoiGianGiao = row[index];
                    });
                    
                    // Chỉ tạo đối tượng Order nếu có Tên đơn hàng
                    if (tenDonHang) {
                        return new Order(tenDonHang, diaChi, thoiGianGiao);
                    }
                    return null;
                }).filter(order => order); // Loại bỏ các giá trị null

                resolve(dataRows);
            } catch (error) {
                console.error("Lỗi khi đọc tệp:", error);
                reject("Lỗi trong quá trình đọc và phân tích tệp.");
            }
        };

        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

// Hàm hiển thị tóm tắt dữ liệu trong Results Panel
const displayDataSummary = (data) => {
    // ... (Không thay đổi)
};

// Thay thế hàm xử lý sự kiện fileInput hiện tại
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    vizCanvas.innerHTML = '<div class="viz-placeholder"><div style="font-size: 4rem;">⏳</div><p>Đang tải và xử lý dữ liệu...</p></div>';

    try {
        const orderData = await readExcelFile(file);
        
        // --- BƯỚC QUAN TRỌNG: Lưu mảng các đối tượng Order vào appState.orders ---
        appState.orders = orderData;
        
        console.log('Dữ liệu đơn hàng đã được tải và xử lý:', appState.orders);

        // Cập nhật giao diện người dùng
        vizCanvas.innerHTML = `<div class="viz-placeholder"><div style="font-size: 4rem;">📄</div><p>Đã tải ${orderData.length} đơn hàng. <br>Nhấn "Build Graph" để tiếp tục.</p></div>`;
        displayDataSummary(orderData);
        alert(`Đã tải và xử lý thành công ${orderData.length} đơn hàng.`);

    } catch (error) {
        console.error('Lỗi tải dữ liệu:', error);
        vizCanvas.innerHTML = '<div class="viz-placeholder"><div style="font-size: 4rem;">❌</div><p>Lỗi tải tệp. Kiểm tra console.</p></div>';
        resultsPanel.innerHTML = `<div class="empty-state">Lỗi: ${error}</div>`;
        alert(`Lỗi khi xử lý tệp: ${error}`);
        appState.orders = null; // Đảm bảo state sạch nếu lỗi
    }
});