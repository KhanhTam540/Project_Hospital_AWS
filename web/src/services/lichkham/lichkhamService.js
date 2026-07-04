import axios from "../../api/axiosClient";
import {
  checkDoctorAppointmentSlot,
  createPatientAppointment,
  getBookingDepartments,
  getBookingDoctors,
  getCurrentPatientProfile,
  getPatientAppointments,
} from "../benhnhan/patientWorkflowService";

export const getAllLich = () => axios.get("/lichkham");
export const createLich = (data) => axios.post("/lichkham", data);
export const updateLich = (id, data) => axios.put(`/lichkham/${id}`, data);
export const deleteLich = (id) => axios.delete(`/lichkham/${id}`);
export const getLichByBenhNhan = (maBN) =>
  axios.get(`/lichkham/benhnhan/${encodeURIComponent(maBN)}`);

export {
  checkDoctorAppointmentSlot,
  createPatientAppointment,
  getBookingDepartments,
  getBookingDoctors,
  getCurrentPatientProfile,
  getPatientAppointments,
};
