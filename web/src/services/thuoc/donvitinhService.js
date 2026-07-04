import axios from "../../api/axiosClient";
import { ensureArray, unwrapApiResponse } from "../../utils/apiResponse";

export async function getAllDonViTinh() {
  const response = await axios.get("/thuoc/donvitinh");
  return ensureArray(unwrapApiResponse(response, []));
}

export async function getOneDonViTinh(id) {
  const response = await axios.get(
    `/thuoc/donvitinh/${encodeURIComponent(id)}`,
  );
  return unwrapApiResponse(response, null);
}

export const createDonViTinh = (data) => axios.post("/thuoc/donvitinh", data);
export const updateDonViTinh = (id, data) =>
  axios.put(`/thuoc/donvitinh/${encodeURIComponent(id)}`, data);
export const deleteDonViTinh = (id) =>
  axios.delete(`/thuoc/donvitinh/${encodeURIComponent(id)}`);
