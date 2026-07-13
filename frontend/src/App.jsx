import { useState, useEffect, useRef } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [site, setSite] = useState("pixelglobalit.com");
  const [keywordsText, setKeywordsText] = useState("");
  const [maxPages, setMaxPages] = useState(10);
  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const pollRef = useRef(null);

  const keywords = keywordsText.split("\n").map(k => k.trim()).filter(Boolean);

  const startCheck = async () => {
    if (!keywords.length) return;
    setLoading(true);
    setJob(null);
    setJobId(null);

    try {
      const res = await fetch(`${API}/check-rank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site, keywords, max_pages: maxPages }),
      });
      const data = await res.json();
      setJobId(data.job_id);
    } catch (e) {
      alert("Backend se connect nahi ho pa raha: " + e.message);
      setLoading(false);
    }
  };

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
          if (data.status === "done") {
            setHistory(prev => [{ ...data, checked_at: new Date().toLocaleTimeString() }, ...prev.slice(0, 4)]);
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

  const s = {
    page: { minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", fontFamily: "'Inter', sans-serif" },
    header: { background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", padding: "20px 32px", borderBottom: "1px solid #1e3a5f" },
    headerInner: { maxWidth: 860, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 },
    icon: { width: 40, height: 40, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 },
    wrap: { maxWidth: 860, margin: "0 auto", padding: "28px 20px" },
    card: { background: "#111827", border: "1px solid #1f2937", borderRadius: 16, padding: 24, marginBottom: 20 },
    label: { display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 },
    input: { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" },
    textarea: { width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "vertical", minHeight: 110, lineHeight: 1.6 },
    btn: (active) => ({
      flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid", cursor: "pointer", fontSize: 13, fontWeight: 600,
      background: active ? "#3b82f6" : "#1f2937",
      borderColor: active ? "#3b82f6" : "#374151",
      color: active ? "#fff" : "#94a3b8"
    }),
    runBtn: (dis) => ({
      width: "100%", padding: "13px", borderRadius: 10, border: "none",
      cursor: dis ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 700,
      background: dis ? "#1f2937" : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
      color: dis ? "#4b5563" : "#fff"
    }),
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.headerInner}>
          <div style={s.icon}>🔍</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#fff" }}>Google USA Rank Checker</h1>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>PixelGlobal Internal Tool · Multiple Keywords · USA Region</p>
          </div>
        </div>
      </div>

      <div style={s.wrap}>

        {/* Input Card */}
        <div style={s.card}>
          <h2 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 600, color: "#94a3b8" }}>🎯 Setup</h2>
          <div style={{ display: "grid", gap: 14 }}>

            <div>
              <label style={s.label}>Target Domain</label>
              <input value={site} onChange={e => setSite(e.target.value)}
                placeholder="pixelglobalit.com" style={s.input} />
            </div>

            <div>
              <label style={s.label}>
                Keywords — ONE LINE 1 KEYWORD ({keywords.length} keyword{keywords.length !== 1 ? "s" : ""})
              </label>
              <textarea
                value={keywordsText}
                onChange={e => setKeywordsText(e.target.value)}
                placeholder={"pixel global\npixel global marketing\npixelglobal seo\nweb design agency"}
                style={s.textarea}
              />
              {/* Preview chips */}
              {keywords.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {keywords.map((k, i) => (
                    <span key={i} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 20, padding: "3px 10px", fontSize: 12, color: "#94a3b8" }}>
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label style={s.label}>Pages to scan per keyword</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[5, 10, 20, 50].map(p => (
                  <button key={p} onClick={() => setMaxPages(p)} style={s.btn(maxPages === p)}>
                    {p} <span style={{ fontSize: 11, opacity: 0.7 }}>({p * 10})</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={startCheck} disabled={loading || !keywords.length} style={s.runBtn(loading || !keywords.length)}>
              {loading
                ? `⏳ Checking... (${job?.current_keyword_index || 0}/${job?.total_keywords || keywords.length})`
                : `🚀 Check ${keywords.length} Keyword${keywords.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>

        {/* Progress */}
        {loading && job && (
          <div style={{ ...s.card, borderColor: "#1e3a5f" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 22 }}>⏳</div>
              <div>
                <div style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 600 }}>
                  Keyword {job.current_keyword_index}/{job.total_keywords}: <span style={{ color: "#3b82f6" }}>{job.current_keyword}</span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{job.progress}</div>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ background: "#1f2937", borderRadius: 99, height: 6, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 99, transition: "width 0.4s",
                background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                width: `${((job.current_keyword_index - 1) / job.total_keywords) * 100}%`
              }} />
            </div>
            {/* Partial results */}
            {job.results?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Abhi tak ke results:</div>
                {job.results.map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", background: "#1f2937", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: "#94a3b8" }}>{r.keyword}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: getRankColor(r.rank) }}>
                      {r.found ? `#${r.rank}` : "N/F"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Final Results */}
        {!loading && job?.status === "done" && job?.results?.length > 0 && (
          <div style={s.card}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "#94a3b8" }}>
              📊 Results — {job.results.filter(r => r.found).length}/{job.results.length} Ranked
            </h3>

            {/* Summary stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Total Keywords", value: job.results.length, color: "#e2e8f0" },
                { label: "Ranked", value: job.results.filter(r => r.found).length, color: "#22c55e" },
                { label: "Not Found", value: job.results.filter(r => !r.found).length, color: "#ef4444" },
              ].map(s => (
                <div key={s.label} style={{ background: "#1f2937", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Per keyword result */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {job.results.map((r, i) => (
                <div key={i} style={{
                  background: "#1f2937", borderRadius: 12, padding: "14px 16px",
                  borderLeft: `3px solid ${getRankColor(r.rank)}`
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{r.keyword}</div>
                      {r.found ? (
                        <>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                            Page {r.page} · Position {r.position} · {r.total_scanned} results scanned
                          </div>
                          <a href={r.url} target="_blank" rel="noreferrer"
                            style={{ fontSize: 12, color: "#3b82f6", display: "block", marginTop: 4, wordBreak: "break-all" }}>
                            {r.url?.slice(0, 70)}{r.url?.length > 70 ? "..." : ""}
                          </a>
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{r.status}</div>
                      )}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: getRankColor(r.rank), marginLeft: 16, flexShrink: 0 }}>
                      {r.found ? `#${r.rank}` : "N/F"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && job?.status === "error" && (
          <div style={{ ...s.card, borderColor: "#7f1d1d", textAlign: "center", color: "#ef4444" }}>
            ⚠️ Error: {job.progress}
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div style={s.card}>
            <h3 style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b", fontWeight: 600 }}>📋 Recent Checks</h3>
            {history.map((h, i) => (
              <div key={i} style={{ background: "#1f2937", borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#e2e8f0" }}>{h.site}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{h.total_keywords} keywords · {h.checked_at}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "#22c55e", fontWeight: 700 }}>
                    {h.results?.filter(r => r.found).length}/{h.results?.length} ranked
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
