import axios from "../../api/axiosClient";

export const getDoctorQueue = (maBS) =>
  axios.get(maBS ? `/queue/doctor/${maBS}` : "/queue/doctor");

export const callNextPatient = (maLich) =>
  axios.post("/queue/doctor/call-next", { maLich });

export const completePatient = (maBS, maLich) =>
  axios.post(`/queue/doctor/${maBS}/complete/${maLich}`);

export const getQueueStreamUrl = (maBS) => {
  const token = localStorage.getItem("token");
  const base = import.meta.env.VITE_API_BASE_URL || "";
  const prefix = base || `${window.location.origin}/api`;
  return `${prefix}/queue/stream/${maBS}?token=${encodeURIComponent(token || "")}`;
};
