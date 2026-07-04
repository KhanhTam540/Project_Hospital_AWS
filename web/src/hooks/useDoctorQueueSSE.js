import { useCallback, useEffect, useRef, useState } from "react";
import { getDoctorQueue, getQueueStreamUrl } from "../services/bacsi/queueService";

export const useDoctorQueueSSE = (maBS) => {
  const [queue, setQueue] = useState([]);
  const [connected, setConnected] = useState(false);
  const [useRedis, setUseRedis] = useState(false);
  const [loading, setLoading] = useState(true);
  const esRef = useRef(null);

  const fetchQueue = useCallback(async () => {
    if (!maBS) return;
    try {
      const res = await getDoctorQueue(maBS);
      setQueue(res.data.data || []);
    } catch {
      /* keep last state */
    } finally {
      setLoading(false);
    }
  }, [maBS]);

  useEffect(() => {
    if (!maBS) return;

    fetchQueue();

    const url = getQueueStreamUrl(maBS);
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") {
          setUseRedis(Boolean(data.redis));
        }
        if (data.items) {
          setQueue(data.items);
          setLoading(false);
        }
      } catch {
        /* ignore parse errors */
      }
    };

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [maBS, fetchQueue]);

  return { queue, connected, useRedis, loading, refresh: fetchQueue };
};

export default useDoctorQueueSSE;
