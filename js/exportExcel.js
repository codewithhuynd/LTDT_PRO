/**
 * ============================================================================
 * 📁 FILE: exportExcel.js
 * 💾 CHỨC NĂNG: XUẤT BÁO CÁO EXCEL (EXPORT)
 * 📝 Mô tả: Xử lý dữ liệu đã tô màu, định dạng và xuất ra file .xlsx.
 * ============================================================================
 */

function handleExport() {
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
        
        const orderIds = group.map(v => orders[v.id].tenDonHang).join(', ');

        summaryData.push({
            "Xe": palette.name,
            "Số đơn": group.length,
            "Danh sách mã đơn": orderIds
        });
    }

    // --- SHEET 2: DANH SÁCH ĐƠN CHI TIẾT ---
    const detailData = orders.map((order, index) => {
        const colorInfo = vertexColors.find(v => v.id === index);
        const vehicleName = colorInfo !== undefined 
            ? (COLOR_PALETTE[colorInfo.color % COLOR_PALETTE.length]?.name || `Xe ${colorInfo.color + 1}`)
            : 'Chưa phân bổ';

        return {
            "Mã đơn (Order ID)": order.tenDonHang,
            "Địa chỉ": order.diaChi,
            "Thời gian yêu cầu": formatTime(order.thoiGianGiao).replace(/<\/?[^>]+(>|$)/g, ""),
            "Nhóm": extractDistrict(order.diaChi) || "N/A",
            "Xe được phân": vehicleName
        };
    });

    try {
        // Tạo workbook
        const wb = XLSX.utils.book_new();

        const ws1 = XLSX.utils.json_to_sheet(summaryData);
        const ws2 = XLSX.utils.json_to_sheet(detailData);

        // ======================================================
        //                ⭐ THÊM TRANG TRÍ CHO ĐẸP ⭐
        // ======================================================

        // Auto-fit chiều rộng
        function autofitColumns(ws, jsonData) {
            const colWidths = Object.keys(jsonData[0]).map(key => ({
                wch: Math.max(
                    key.length,
                    ...jsonData.map(r => (r[key] ? r[key].toString().length : 0))
                ) + 2
            }));
            ws['!cols'] = colWidths;
        }

        // Style header
        function styleHeader(ws) {
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let C = range.s.c; C <= range.e.c; C++) {
                const cellAddr = XLSX.utils.encode_cell({ r: 0, c: C });
                if (ws[cellAddr]) {
                    ws[cellAddr].s = {
                        font: { bold: true, color: { rgb: "FFFFFF" } },
                        fill: { fgColor: { rgb: "4F81BD" } },
                        alignment: { horizontal: "center", vertical: "center" },
                        border: {
                            top:    { style: "thin", color: { rgb: "000000" } },
                            left:   { style: "thin", color: { rgb: "000000" } },
                            right:  { style: "thin", color: { rgb: "000000" } },
                            bottom: { style: "thin", color: { rgb: "000000" } }
                        }
                    };
                }
            }
        }

        // Style body
        function styleBody(ws) {
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let R = 1; R <= range.e.r; R++) {
                for (let C = range.s.c; C <= range.e.c; C++) {
                    const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
                    if (ws[cellAddr]) {
                        ws[cellAddr].s = {
                            alignment: { vertical: "center", wrapText: true },
                            border: {
                                top:    { style: "thin", color: { rgb: "CCCCCC" } },
                                left:   { style: "thin", color: { rgb: "CCCCCC" } },
                                right:  { style: "thin", color: { rgb: "CCCCCC" } },
                                bottom: { style: "thin", color: { rgb: "CCCCCC" } }
                            }
                        };
                    }
                }
            }
        }

        // Áp dụng vào sheet 1 + 2
        autofitColumns(ws1, summaryData);
        autofitColumns(ws2, detailData);

        styleHeader(ws1);
        styleHeader(ws2);

        styleBody(ws1);
        styleBody(ws2);

        // ======================================================
        //                 HOÀN TẤT EXPORT
        // ======================================================

        XLSX.utils.book_append_sheet(wb, ws1, "Tổng hợp phân bổ");
        XLSX.utils.book_append_sheet(wb, ws2, "Danh sách đơn chi tiết");

        const fileName = `Ket_Qua_Phan_Bo_Xe_${new Date().getTime()}.xlsx`;
        XLSX.writeFile(wb, fileName);

        alert(`✅ Đã xuất file thành công: ${fileName}`);
    } catch (error) {
        console.error("Lỗi xuất Excel:", error);
        alert("Có lỗi xảy ra khi tạo file Excel.");
    }
}