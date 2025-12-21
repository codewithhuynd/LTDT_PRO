/**
 * ============================================================================
 * 📁 FILE: fileIO.js
 * 📂 CHỨC NĂNG: XỬ LÝ ĐỌC FILE (INPUT/OUTPUT)
 * 📝 Mô tả: Chứa logic đọc file Excel/CSV và chuyển đổi thành mảng đối tượng.
 * ============================================================================
 */
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