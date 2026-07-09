import { useState, useEffect, useRef } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [site, setSite] = useState("pixelglobalit.com");
  const [keyword, setKeyword] = useState("");
  const [maxPages, setMaxPages] = useState(10);
  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const pollRef = useRef(null);

  const startCheck = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    setJob(null);
    setJobId(null);

    try {
      const res = await fetch(`${API}/check-rank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site, keyword, max_pages: maxPages }),
      });
      const data = await res.json();
      setJobId(data.job_id);
    } catch (e) {
      alert("Backend se connect nahi ho pa raha: " + e.message);
      setLoading(false);
    }
  };

  // Poll job status
  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/status/${jobId}`);
        const data = await res.json();
        setJob(data);
        if (data.status === "done" || data.status === "error") {
          clearInterval(pollRef.current);
          setLoading(false);
          if (data.status === "done" && data.result) {
            setHistory(prev => [{ ...data, checked_at: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
          }
        }
      } catch (e) {}
    }, 2000);
    return () => clearInterval(pollRef.current);
  }, [jobId]);

  const getRankColor = (rank) => {
    if (!rank) return "#ef4444";
    if (rank <= 10) return "#22c55e";
    if (rank <= 30) return "#f59e0b";
    return "#f97316";
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", fontFamily: "'Inter', sans-serif", padding: "0" }}>
      
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", padding: "24px 32px", borderBottom: "1px solid #1e3a5f" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🔍</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#fff" }}>Google USA Rank Checker</h1>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>PixelGlobal Internal Tool · USA Region</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>

        {/* Input Card */}
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 16, padding: 28, marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 600, color: "#94a3b8" }}>🎯 Rank Check Setup</h2>
          
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Target Domain</label>
              <input
                value={site}
                onChange={e => setSite(e.target.value)}
                placeholder="pixelglobalit.com"
                style={{ width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Keyword</label>
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !loading && startCheck()}
                placeholder="pixel global marketing"
                style={{ width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Pages to scan (1 page = 10 results)</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[5, 10, 20, 50].map(p => (
                  <button key={p} onClick={() => setMaxPages(p)}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s",
                      background: maxPages === p ? "#3b82f6" : "#1f2937",
                      borderColor: maxPages === p ? "#3b82f6" : "#374151",
                      color: maxPages === p ? "#fff" : "#94a3b8"
                    }}>
                    {p} <span style={{ fontSize: 11, opacity: 0.7 }}>({p*10})</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={startCheck} disabled={loading || !keyword.trim()}
              style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 700,
                background: loading ? "#1f2937" : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                color: loading ? "#4b5563" : "#fff", transition: "all 0.2s"
              }}>
              {loading ? "⏳ Checking..." : "🚀 Check Ranking"}
            </button>
          </div>
        </div>

        {/* Progress / Result */}
        {(loading || job) && (
          <div style={{ background: "#111827", border: `1px solid ${job?.status === "done" && job?.result?.found ? "#166534" : job?.status === "error" ? "#7f1d1d" : "#1f2937"}`, borderRadius: 16, padding: 28, marginBottom: 24 }}>
            
            {loading && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 12, animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</div>
                <p style={{ color: "#94a3b8", margin: 0, fontSize: 14 }}>{job?.progress || "Starting..."}</p>
                <p style={{ color: "#4b5563", margin: "8px 0 0", fontSize: 12 }}>Job ID: {jobId}</p>
              </div>
            )}

            {!loading && job?.status === "done" && job?.result && (
              <div>
                {job.result.found ? (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
                    <div style={{ fontSize: 56, fontWeight: 800, color: getRankColor(job.result.rank), lineHeight: 1 }}>#{job.result.rank}</div>
                    <div style={{ color: "#94a3b8", marginTop: 4, fontSize: 14 }}>Google USA Ranking</div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 24 }}>
                      {[
                        { label: "Page", value: job.result.page },
                        { label: "Position on Page", value: job.result.position },
                        { label: "Total Scanned", value: job.result.total_scanned },
                      ].map(s => (
                        <div key={s.label} style={{ background: "#1f2937", borderRadius: 10, padding: "14px 10px", textAlign: "center" }}>
                          <div style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0" }}>{s.value}</div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: "#1f2937", borderRadius: 10, padding: 14, marginTop: 16, textAlign: "left" }}>
                      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Ranked URL</div>
                      <a href={job.result.url} target="_blank" rel="noreferrer" style={{ color: "#3b82f6", fontSize: 13, wordBreak: "break-all" }}>{job.result.url}</a>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>{job.result.title}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "20px 0" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
                    <div style={{ color: "#ef4444", fontSize: 20, fontWeight: 700 }}>Not Ranked</div>
                    <div style={{ color: "#64748b", marginTop: 8, fontSize: 14 }}>{job.result.message || `Top ${job.result.total_scanned} results mein nahi mila`}</div>
                  </div>
                )}
              </div>
            )}

            {!loading && job?.status === "error" && (
              <div style={{ textAlign: "center", color: "#ef4444" }}>
                <div style={{ fontSize: 36 }}>⚠️</div>
                <div style={{ marginTop: 8 }}>Error: {job?.progress}</div>
              </div>
            )}
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 16, padding: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 14, color: "#94a3b8", fontWeight: 600 }}>📋 Recent Checks</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {history.map((h, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1f2937", borderRadius: 10, padding: "12px 16px" }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 500 }}>{h.keyword}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{h.site} · {h.checked_at}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: getRankColor(h.result?.rank) }}>
                    {h.result?.found ? `#${h.result.rank}` : "N/F"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
