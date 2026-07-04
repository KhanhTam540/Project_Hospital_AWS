import axios from "../../api/axiosClient";
import { ensureArray, unwrapApiResponse } from "../../utils/apiResponse";

export async function getAllNhomThuoc() {
  const response = await axios.get("/thuoc/nhomthuoc");
  return ensureArray(unwrapApiResponse(response, []));
}

export async function getOneNhomThuoc(id) {
  const response = await axios.get(
    `/thuoc/nhomthuoc/${encodeURIComponent(id)}`,
  );
  return unwrapApiResponse(response, null);
}

export const createNhomThuoc = (data) => axios.post("/thuoc/nhomthuoc", data);
export const updateNhomThuoc = (id, data) =>
  axios.put(`/thuoc/nhomthuoc/${encodeURIComponent(id)}`, data);
export const deleteNhomThuoc = (id) =>
  axios.delete(`/thuoc/nhomthuoc/${encodeURIComponent(id)}`);
