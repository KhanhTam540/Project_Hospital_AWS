import axios from "../../api/axiosClient";

const unwrap = (response, fallback = null) => {
  const body = response?.data;
  if (body && typeof body === "object" && "data" in body) {
    return body.data ?? fallback;
  }
  return body ?? fallback;
};

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
};

export async function getLichByBS(maBS) {
  if (!maBS) return [];
  const response = await axios.get(
    `/lichlamviec/bacsi/${encodeURIComponent(maBS)}`,
  );
  return toArray(unwrap(response, []));
}

export async function createLich(data) {
  const response = await axios.post("/lichlamviec", data);
  return unwrap(response);
}

export async function updateLich(id, data) {
  const response = await axios.put(
    `/lichlamviec/${encodeURIComponent(id)}`,
    data,
  );
  return unwrap(response);
}

export async function deleteLich(id) {
  const response = await axios.delete(
    `/lichlamviec/${encodeURIComponent(id)}`,
  );
  return unwrap(response);
}

export async function getCaTruc() {
  const response = await axios.get("/catruc");
  return toArray(unwrap(response, []));
}

export async function getSoLuongBenhNhan({ maBS, maCa, ngayLamViec }) {
  const response = await axios.get("/lichlamviec/soluong", {
    params: { maBS, maCa, ngayLamViec },
  });
  return unwrap(response, { soLuong: 0, toiDa: 10, conLai: 10 });
}
