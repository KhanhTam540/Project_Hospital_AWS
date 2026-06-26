const buildDataset = () => {
  const items = [];
  const now = new Date().toISOString();
// 1. DANH SÁCH 4 KHOA (DEPARTMENT) - Gồm Profile và cấu trúc danh sách
const departments = [
    { id: "KHOA-NOI", name: "Khoa Nội Tổng Quát", location: "Tầng 2 - Tòa nhà A" },
    { id: "KHOA-NGOAI", name: "Khoa Ngoại Chấn Thương", location: "Tầng 1 - Tòa nhà B" },
    { id: "KHOA-NHI", name: "Khoa Nhi", location: "Tầng 3 - Tòa nhà A" },
    { id: "KHOA-XN", name: "Khoa Xét Nghiệm & Cận Lâm Sàng", location: "Tầng trệt - Tòa nhà C" }
  ];
  departments.forEach(dept => {
    items.push({
      pk: "DEPARTMENT",
      sk: `DEPARTMENT#${dept.id}`,
      entityType: "DEPARTMENT",
      ten_khoa: dept.name,
      createdAt: now,
      updatedAt: now
    });
    items.push({
      pk: `DEPARTMENT#${dept.id}`,
      sk: "PROFILE",
      entityType: "DEPARTMENT",
      ten_khoa: dept.name,
      vi_tri: dept.location,
      createdAt: now,
      updatedAt: now
    });
  });
  // 2. DANH SÁCH 5 BÁC SĨ (DOCTOR) - Gồm Profile và Liên kết Khoa
  const doctors = [
    { id: "BS001", name: "Nguyễn Minh An", specialty: "Nội tổng quát", room: "Phòng P201", deptId: "KHOA-NOI" },
    { id: "BS002", name: "Trần Hoàng Bách", specialty: "Chấn thương chỉnh hình", room: "Phòng P105", deptId: "KHOA-NGOAI" },
    { id: "BS003", name: "Lê Thị Cẩm Tú", specialty: "Nhi khoa hành vi", room: "Phòng P302", deptId: "KHOA-NHI" },
    { id: "BS004", name: "Phạm Đức Minh", specialty: "Tim mạch chuyên sâu", room: "Phòng P204", deptId: "KHOA-NOI" },
    { id: "BS005", name: "Vũ Ngân Hà", specialty: "Siêu âm tổng quát", room: "Phòng XN01", deptId: "KHOA-XN" }
  ];

  doctors.forEach(doc => {
    items.push({
      pk: `DOCTOR#${doc.id}`,
      sk: "PROFILE",
      entityType: "DOCTOR",
      ho_ten: doc.name,
      chuyen_nganh: doc.specialty,
      phong_kham: doc.room,
      createdAt: now,
      updatedAt: now
    });
    // Truy vấn danh sách bác sĩ thuộc một khoa cụ thể
    items.push({
      pk: `DEPARTMENT#${doc.deptId}`,
      sk: `DOCTOR#${doc.id}`,
      entityType: "DOCTOR",
      ho_ten: doc.name,
      chuyen_nganh: doc.specialty,
      createdAt: now,
      updatedAt: now
    });
  });
  // 3. DANH SÁCH 3 BỆNH NHÂN GIẢ LẬP (PATIENT) - Có mã hóa KMS giả định
  const patients = [
    { id: "BN001", name: "Nguyễn Văn Bình", dob: "1995-05-12", gender: "Nam", cccd: "kms_encrypted_cccd_001" },
    { id: "BN002", name: "Lê Thị Mai", dob: "1988-11-23", gender: "Nữ", cccd: "kms_encrypted_cccd_002" },
    { id: "BN003", name: "Trần Minh Quân", dob: "2015-04-02", gender: "Nam", cccd: "kms_encrypted_cccd_003" }
  ];

  patients.forEach(pat => {
    items.push({
      pk: `PATIENT#${pat.id}`,
      sk: "PROFILE",
      entityType: "PATIENT",
      ho_ten: pat.name,
      ngay_sinh: pat.dob,
      gioi_tinh: pat.gender,
      cccd_ma_hoa: pat.cccd,
      createdAt: now,
      updatedAt: now
    });
  });
  // 4. DANH SÁCH 5 DỊCH VỤ KHÁM (SERVICE)
  const services = [
    { id: "DV001", name: "Khám nội tổng quát", price: 150000, duration: 30, deptId: "KHOA-NOI" },
    { id: "DV002", name: "Khám chuyên khoa ngoại", price: 200000, duration: 30, deptId: "KHOA-NGOAI" },
    { id: "DV003", name: "Khám nhi tổng hợp", price: 120000, duration: 20, deptId: "KHOA-NHI" },
    { id: "DV004", name: "Siêu âm 4D màu", price: 400000, duration: 15, deptId: "KHOA-XN" },
    { id: "DV005", name: "Chụp X-Quang phổi", price: 250000, duration: 10, deptId: "KHOA-XN" }
  ];

  services.forEach(srv => {
    items.push({
      pk: `DEPARTMENT#${srv.deptId}`,
      sk: `SERVICE#${srv.id}`,
      entityType: "SERVICE",
      ten_dich_vu: srv.name,
      gia: srv.price,
      thoi_gian_uoc_tinh: srv.duration,
      createdAt: now,
      updatedAt: now
    });
  });
  // 5. DANH SÁCH 5 LOẠI THUỐC (MEDICINE)
  const medicines = [
    { id: "THUOC001", name: "Paracetamol 500mg", unit: "Viên", price: 2000, stock: 500 },
    { id: "THUOC002", name: "Amoxicillin 500mg", unit: "Viên", price: 5000, stock: 300 },
    { id: "THUOC003", name: "Ibuprofen 400mg", unit: "Viên", price: 3500, stock: 200 },
    { id: "THUOC004", name: "Siro ho Prospan", unit: "Chai", price: 75000, stock: 50 },
    { id: "THUOC005", name: "Vitamin C 500mg", unit: "Viên", price: 1500, stock: 1000 }
  ];

  medicines.forEach(med => {
    items.push({
      pk: "MEDICINE",
      sk: `MEDICINE#${med.id}`,
      entityType: "MEDICINE",
      ten_thuoc: med.name,
      don_vi: med.unit,
      gia: med.price,
      ton_kho: med.stock,
      createdAt: now,
      updatedAt: now
    });
    items.push({
      pk: `MEDICINE#${med.id}`,
      sk: "PROFILE",
      entityType: "MEDICINE",
      ten_thuoc: med.name,
      don_vi: med.unit,
      gia: med.price,
      ton_kho: med.stock,
      createdAt: now,
      updatedAt: now
    });
  });
  // 6. LỊCH LÀM VIỆC CỦA BÁC SĨ (SCHEDULE) - 5 bản ghi ngày kế tiếp
  const schedules = [
    { docId: "BS001", date: "2026-07-01", shift: "CA-SANG", room: "Phòng Khám Nội 101" },
    { docId: "BS001", date: "2026-07-01", shift: "CA-CHIEU", room: "Phòng Khám Nội 101" },
    { docId: "BS002", date: "2026-07-01", shift: "CA-SANG", room: "Phòng Khám Ngoại 105" },
    { docId: "BS003", date: "2026-07-02", shift: "CA-SANG", room: "Phòng Khám Nhi 302" },
    { docId: "BS004", date: "2026-07-02", shift: "CA-CHIEU", room: "Phòng Khám Nội 102" }
  ];

  schedules.forEach(sch => {
    items.push({
      pk: `DOCTOR#${sch.docId}`,
      sk: `SCHEDULE#${sch.date}#${sch.shift}`,
      entityType: "SCHEDULE",
      ngay: sch.date,
      ca: sch.shift,
      phong: sch.room,
      trang_thai: "AVAILABLE",
      createdAt: now,
      updatedAt: now
    });
  });
  // 7. LỊCH HẸN KHÁM (APPOINTMENT) - 3 bản ghi liên kết chéo các chiều truy vấn
  const appointments = [
    { id: "LH001", patId: "BN001", docId: "BS001", date: "2026-07-01", srvId: "DV001", status: "CONFIRMED", payment: "PAID" },
    { id: "LH002", patId: "BN002", docId: "BS001", date: "2026-07-01", srvId: "DV001", status: "PENDING", payment: "UNPAID" },
    { id: "LH003", patId: "BN003", docId: "BS003", date: "2026-07-02", srvId: "DV003", status: "CONFIRMED", payment: "PAID" }
  ];

  appointments.forEach(app => {
    const appData = {
      entityType: "APPOINTMENT",
      patientId: app.patId,
      doctorId: app.docId,
      ngay_kham: app.date,
      serviceId: app.srvId,
      trang_thai: app.status,
      trang_thai_thanh_toán: app.payment,
      createdAt: now,
      updatedAt: now
    };
    //1: Xem lịch hẹn độc lập
    items.push({ pk: `APPOINTMENT#${app.id}`, sk: "PROFILE", ...appData });
    //2: Xem lịch hẹn theo bác sĩ và ngày
    items.push({ pk: `DOCTOR#${app.docId}`, sk: `APPOINTMENT#${app.date}#${app.id}`, ...appData });
    //3: Xem lịch hẹn theo bệnh nhân và ngày
    items.push({ pk: `PATIENT#${app.patId}`, sk: `APPOINTMENT#${app.date}#${app.id}`, ...appData });
  });

  return items;
};

module.exports = { buildDataset };