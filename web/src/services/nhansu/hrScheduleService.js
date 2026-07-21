import axios from "../../api/axiosClient";

export const getAllSchedules = () => axios.get("/lichlamviec");

export const getSchedulesByDoctor = (maBS) => axios.get(`/lichlamviec/bacsi/${maBS}`);

export const getSchedulesByStaff = (maNS) => axios.get(`/lichlamviec/nhansu/${maNS}`);

export const createSchedule = (data) => axios.post("/lichlamviec", data);

export const updateSchedule = (id, data) => axios.put(`/lichlamviec/${id}`, data);

export const deleteSchedule = (id) => axios.delete(`/lichlamviec/${id}`);

export const getPatientCount = (params) =>
  axios.get("/lichlamviec/soluong", { params });

export const getShiftList = () => axios.get("/catruc");

export const getDoctorList = () => axios.get("/bacsi");

export const getStaffByAccount = (maTK) => axios.get(`/nhansu/maTK/${maTK}`);
