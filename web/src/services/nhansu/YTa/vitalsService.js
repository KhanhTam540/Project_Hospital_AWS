import axios from "../../../api/axiosClient";

export const getNurseQueue = () => axios.get("/phieukham/nurse/queue");

export const saveVitals = (data) => axios.post("/phieukham/vitals", data);

export const updateVitals = (maPK, data) => axios.put(`/phieukham/${maPK}/vitals`, data);

export const getVitalsByPhieu = (maPK) => axios.get(`/phieukham/vitals/${maPK}`);
