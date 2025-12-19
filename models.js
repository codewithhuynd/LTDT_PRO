// ===============================================
// Cấu Trúc Dữ liệu Độc Lập cho Đơn hàng (Order)
// ===============================================
class Order {
    constructor(tenDonHang, diaChi, thoiGianGiao) {
        this.id = tenDonHang ? String(tenDonHang).trim() : ('order_' + Math.random().toString(36).slice(2,8));
        this.tenDonHang = tenDonHang ? String(tenDonHang).trim() : '';
        this.diaChi = diaChi ? String(diaChi).trim() : '';
        this.thoiGianGiao = thoiGianGiao || null; 
        
        this.lat = null;
        this.lng = null;
        this.trangThai = 'Chưa phân phối';
        this.mauSac = null;
    }
}

// App state
let appState = {
    orders: null,
    adjacencyMatrix: null, 
    graph: null,
    coloring: null,
    currentStep: 0,
    isStepMode: false,
    isPlaying: false,
    currentView: 'graph' // chỉ graph
};
