'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

test('admin management pages use the shared pagination component', () => {
  const component = read('web/src/components/admin/AdminPagination.jsx');
  assert.match(component, /export function useAdminPagination/);
  assert.match(component, /pageSizeOptions/);
  assert.match(component, /ChevronFirst/);
  assert.match(component, /ChevronLast/);

  const pages = [
    'web/src/pages/admin/AdminUserList.jsx',
    'web/src/pages/admin/AssignRole.jsx',
    'web/src/pages/admin/ManageBacSi.jsx',
    'web/src/pages/admin/ManageNhanSu.jsx',
    'web/src/pages/admin/ManageBenhNhan.jsx',
    'web/src/pages/admin/ManageLichKham.jsx',
    'web/src/pages/admin/ManageLoaiXN.jsx',
    'web/src/pages/admin/ManageXetNghiem.jsx',
    'web/src/pages/admin/ManageKhoa.jsx',
    'web/src/pages/admin/ManagePhongKham.jsx',
    'web/src/pages/admin/ManagePhanHoiPage.jsx',
    'web/src/pages/admin/ManageTinTucPage.jsx',
    'web/src/pages/admin/nhansu/QuanLyCaTrucPage.jsx',
    'web/src/pages/admin/thuoc/QuanLyThuocPage.jsx',
    'web/src/pages/admin/thuoc/QuanLyNhomThuoc.jsx',
    'web/src/pages/admin/thuoc/QuanLyDonViTinh.jsx',
  ];

  for (const page of pages) {
    const source = read(page);
    assert.match(source, /useAdminPagination/, `${page} thiếu hook phân trang`);
    assert.match(source, /<AdminPagination/, `${page} thiếu thanh phân trang`);
    assert.match(source, /pagination\.pageItems/, `${page} vẫn render toàn bộ danh sách`);
  }
});

test('admin medical record page keeps cover-only privacy and book presentation', () => {
  const source = read('web/src/pages/admin/ManageHoSoBenhAn.jsx');

  assert.match(source, /Chế độ chỉ xem bìa/);
  assert.match(source, /Nội dung bên trong được bảo vệ/);
  assert.match(source, /Admin chỉ xem bìa và thông tin hành chính/);
  assert.match(source, /pagination\.pageItems\.map/);
  assert.doesNotMatch(source, /to=.*hosobenhan\//);
  assert.doesNotMatch(source, /onClick=.*chi tiết/i);
});
