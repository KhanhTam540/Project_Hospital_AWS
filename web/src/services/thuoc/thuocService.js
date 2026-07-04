import axios from "../../api/axiosClient";
import { ensureArray, unwrapApiResponse } from "../../utils/apiResponse";

export async function getAllThuoc() {
  const response = await axios.get("/thuoc");
  return ensureArray(unwrapApiResponse(response, []));
}

export async function getOneThuoc(id) {
  const response = await axios.get(`/thuoc/${encodeURIComponent(id)}`);
  return unwrapApiResponse(response, null);
}

export const createThuoc = (data) => axios.post("/thuoc", data);
export const updateThuoc = (id, data) =>
  axios.put(`/thuoc/${encodeURIComponent(id)}`, data);
export const deleteThuoc = (id) =>
  axios.delete(`/thuoc/${encodeURIComponent(id)}`);
