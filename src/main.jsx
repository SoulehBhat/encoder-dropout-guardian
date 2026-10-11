import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import PatternWaves from "./components/PatternWaves";
import "./index.css";

const scenarios = {
  normal: { command: 80, current: 6.4, pps: 120, label: "Normal running" },
  dropout: { command: 80, current: 6.4, pps: 0, label: "Encoder dropout" },
  stopped: { command: 0, current: 0, pps: 0, label: "Motor stopped" },
};

function App() {
  const [page, setPage] = useState(location.hash.slice(1) || "home");
  const [scenario, setScenario] = useState("normal");
  const [running, setRunning] = useState(false);
  const [sample, setSample] = useState(null);
  const [faults, setFaults] = useState([]);
  const [recordedData, setRecordedData] = useState([]);
  const [recordedIndex, setRecordedIndex] = useState(0);
  const [dataError, setDataError] = useState("");
  const [loggedIn, setLoggedIn] = useState(() => localStorage.getItem("encoderGuardianLoggedIn") === "true");

  useEffect(() => {
    const onHash = () => setPage(location.hash.slice(1) || "home");
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    fetch("/data/motor-data.csv")
      .then((response) => {
        if (!response.ok) throw new Error(`Recorded motor data could not be loaded (${response.status}).`);
        return response.text();
      })
      .then((text) => {
        const rows = parseMotorCsv(text);
        setRecordedData(rows);
        setRecordedIndex(Math.max(0, rows.findIndex((row) => row.PWM > 0 && row.Current > 0.8)));
      })
      .catch((error) => setDataError(error.message));
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => takeSample(), 900);
    return () => clearInterval(timer);
  });

  const takeSample = () => {
    const base = scenarios[scenario];
    let next;
    if (scenario === "normal" && recordedData.length) {
      const source = recordedData[recordedIndex % recordedData.length];
      setRecordedIndex((index) => (index + 1) % recordedData.length);
      next = {
        ...base,
        command: source.commandPercent,
        current: source.Current,
        pps: Math.abs(source.Velocity),
        encoderCount: source.encoderCount,
        sourceTime: source.time,
        dataSource: "Recorded sample data",
        time: new Date(),
      };
    } else {
      next = { ...base, pps: scenario === "normal" ? base.pps : base.pps, dataSource: "Simulated data", time: new Date() };
    }
    setSample(next);
    if (scenario === "dropout") {
      setFaults((items) => [{ time: next.time, confidence: 78 }, ...items].slice(0, 25));
    }
  };

  const assessment = useMemo(() => {
    if (!sample) return { title: "Awaiting samples", confidence: 0, state: "Idle", fault: false };
    const fault = sample.command > 10 && sample.current > 0.8 && sample.pps < 3;
    return {
      title: fault ? "Possible encoder dropout" : sample.command ? "Normal running" : "Motor stopped",
      confidence: fault ? 78 : sample.command ? 36 : 0,
      state: fault ? "Fault" : sample.command ? "Running" : "Idle",
      fault,
    };
  }, [sample]);

  const navigate = (next) => {
    location.hash = next;
    setPage(next);
  };

  const handleLogout = () => {
    localStorage.removeItem("encoderGuardianLoggedIn");
    setLoggedIn(false);
    navigate("login");
  };

  return (
    <div className="site-shell react-site">
      <div className="site-background" aria-hidden="true">
        <PatternWaves
          preset="silk"
          color="#ffffff"
          backgroundColor="transparent"
          fade="edges"
          fadeSize={0.65}
          opacity={0.34}
          interactive
          cursorSize={55}
          cursorStrength={0.45}
        />
      </div>
      <header className="site-header">
        <a className="brand" href="#home"><span className="brand-mark"><span /><i /></span><span><strong>Encoder Dropout</strong><small>Guardian</small></span></a>
        <nav className="main-nav" aria-label="Main navigation">
          {["home", "how-it-works", "features", "monitor", "history", "settings", "about"].map((item) => (
            <a className={page === item ? "active" : ""} href={`#${item}`} key={item}>{item === "how-it-works" ? "How It Works" : item === "about" ? "About / Help" : item.replace("-", " ").replace(/^\w/, (char) => char.toUpperCase())}</a>
          ))}
        </nav>
        <div className="header-actions">
          <a className="header-status" href="#monitor"><span className="status-dot" />{assessment.fault ? "Fault detected" : running ? "Monitoring live" : "Monitor idle"}</a>
          <button className="user-profile" type="button" aria-label={loggedIn ? "Log out" : "Log in"} onClick={loggedIn ? handleLogout : () => navigate("login")}>
            <span className="user-profile-inner">
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="m15.626 11.769a6 6 0 1 0-7.252 0A9.008 9.008 0 0 0 3 20a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 9.008 9.008 0 0 0-5.374-8.231ZM8 7a4 4 0 1 1 4 4 4 4 0 0 1-4-4Zm10 14H6a1 1 0 0 1-1-1 7 7 0 0 1 14 0 1 1 0 0 1-1 1Z" />
              </svg>
              <span>{loggedIn ? "Log Out" : "Log In"}</span>
            </span>
          </button>
        </div>
      </header>

      {page === "home" && <Home navigate={navigate} recordedData={recordedData} />}
      {page === "how-it-works" && <InfoPage title="How it works" kicker="THE DETECTION MODEL" text="It is not enough to see zero pulses. The Guardian asks whether zero pulses make sense." />}
      {page === "features" && <InfoPage title="Features that make faults easier to trust." kicker="BUILT FOR CLARITY" text="A focused monitoring toolkit for prototyping, validation, and operator conversations." />}
      {page === "monitor" && <Monitor scenario={scenario} setScenario={setScenario} running={running} setRunning={setRunning} takeSample={takeSample} sample={sample} assessment={assessment} recordedData={recordedData} dataError={dataError} />}
      {page === "history" && <History faults={faults} />}
      {page === "settings" && <Settings />}
      {page === "about" && <About />}
      {page === "login" && <LoginPage onLogin={() => { localStorage.setItem("encoderGuardianLoggedIn", "true"); setLoggedIn(true); navigate("home"); }} />}

      <footer className="site-footer"><div className="footer-brand"><span className="brand-mark"><span /><i /></span><span><strong>Encoder Dropout Guardian</strong><small>Motion integrity, made visible.</small></span></div><span className="footer-note">Simulated prototype · no motor control output</span></footer>
    </div>
  );
}

function parseMotorCsv(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",");
  return lines.map((line) => {
    const values = line.split(",");
    const row = Object.fromEntries(headers.map((header, index) => [header, Number(values[index])]));
    return { ...row, commandPercent: (row.PWM / 255) * 100 };
  }).filter((row) => Number.isFinite(row.time));
}

function Home({ navigate, recordedData }) {
  return <main className="page-view active react-page home-react"><div className="hero hero-home"><div className="hero-copy"><span className="kicker">MOTION INTEGRITY / 01</span><h1>Know when the motor moves but the encoder goes quiet.</h1><p className="lead">Encoder Dropout Guardian watches command, current, and pulse signals together to surface feedback faults before they become mysterious motion problems.</p><div className="hero-actions"><button className="button button-primary home-monitor-button" onClick={() => navigate("monitor")}><span className="button-inner">Open live monitor →</span></button><a className="text-link" href="#how-it-works">See how it works ↗</a></div><div className="hero-trust"><span>✓ Recorded sample data</span><span>✓ Confidence scored</span><span>✓ No motor control output</span></div></div><SignalPreview recordedData={recordedData} /></div><div className="section-intro"><div><span className="kicker">A SIMPLE SIGNAL STORY</span><h2>Three signals. One clearer answer.</h2></div><p>Recorded motor readings provide the normal reference. A separate simulated dropout removes encoder activity while keeping command and current present.</p></div><section className="home-detail-grid"><article><span className="kicker">01 / INTENT</span><h2>Command says the motor should move.</h2><p>The recorded <strong>PWM</strong> column is displayed as command percentage. It establishes expected behavior, not proof of shaft movement.</p></article><article><span className="kicker">02 / ENERGY</span><h2>Current says the drive is engaged.</h2><p>The recorded <strong>Current</strong> column shows motor current. It remains visible in the simulated dropout scenario.</p></article><article><span className="kicker">03 / FEEDBACK</span><h2>Encoder data provides the movement witness.</h2><p>The recorded <strong>encoderCount</strong> column is shown as encoder activity. In simulated dropout mode, that activity is deliberately removed.</p></article></section><section className="home-callout"><div><span className="kicker">WHAT YOU CAN TEST</span><h2>Compare recorded data with a simulated fault.</h2><p>Recorded sample data is not live motor data. Choose the separate simulated dropout mode in Live Monitor to see encoder pulses disappear while the recorded command and current context continues.</p></div><div className="home-callout-stats"><div><strong>{recordedData.length || "—"}</strong><span>recorded rows loaded</span></div><div><strong>PWM</strong><span>command source</span></div><div><strong>Current</strong><span>energy source</span></div></div></section></main>;
}

function SignalPreview({ recordedData }) {
  const [mode, setMode] = useState("normal");
  const isDropout = mode === "dropout";
  const recordedPoint = recordedData.find((row) => row.PWM > 0 && row.Current > 0.8) || recordedData[0];
  const command = recordedPoint ? recordedPoint.commandPercent : 0;
  const current = recordedPoint ? recordedPoint.Current : 0;
  const encoderCount = recordedPoint ? recordedPoint.encoderCount : 0;
  const pulseBars = isDropout ? [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0] : Array.from({ length: 12 }, (_, index) => Math.abs(encoderCount + index) % 3 !== 0 ? 1 : 0);

  return <div className={`signal-preview ${isDropout ? "preview-dropout" : ""}`}>
    <div className="preview-heading"><div><span className="kicker">{isDropout ? "SIMULATED DROPOUT" : "RECORDED SAMPLE DATA"}</span><strong>{isDropout ? "Possible encoder dropout" : "Recorded motor sample"}</strong></div><span className={`preview-status ${isDropout ? "preview-status-fault" : ""}`}><i />{isDropout ? "Simulated" : "Recorded"}</span></div>
    <div className="preview-plot" aria-label="Animated motor command, current, and encoder pulse visualization">
      <div className="plot-grid" />
      <div className="plot-row plot-command"><span>PWM</span><div className="plot-line"><b /></div><strong>{command.toFixed(1)}%</strong></div>
      <div className="plot-row plot-current"><span>AMP</span><div className="plot-line"><b /></div><strong>{current.toFixed(2)} A</strong></div>
      <div className="plot-row plot-pulses"><span>ENC</span><div className="pulse-preview">{pulseBars.map((active, index) => <i className={active ? "pulse-on" : "pulse-off"} style={{ "--pulse-delay": `${index * 90}ms` }} key={index} />)}</div><strong>{isDropout ? "0 count" : `${Math.abs(encoderCount).toFixed(0)} count`}</strong></div>
    </div>
    <div className="preview-footer"><span>{isDropout ? "Command + current remain present while pulses pause." : "All three signals agree: the motor is moving."}</span><div className="preview-switch"><button className={!isDropout ? "selected" : ""} onClick={() => setMode("normal")}><span className="button-inner">Normal</span></button><button className={isDropout ? "selected" : ""} onClick={() => setMode("dropout")}><span className="button-inner">Dropout</span></button></div></div>
  </div>;
}

function InfoPage({ title, kicker, text }) {
  const isFeatures = title.startsWith("Features");
  return <main className="page-view active react-page"><div className="page-heading"><div><span className="kicker">{kicker}</span><h1>{title}</h1><p>{text}</p></div></div>{isFeatures ? <><div className="feature-grid"><article className="large-feature"><span className="feature-icon">!</span><h2>Fault detection</h2><p>Correlates command above 10%, current above 0.8 A, and fewer than 3 pulses per second. This avoids treating a deliberately stopped motor as a fault.</p><span className="mini-label">Decision rule</span><strong>Intent + energy, missing feedback</strong></article><article className="large-feature"><span className="feature-icon">%</span><h2>Confidence scoring</h2><p>The score is a readable 0–100 indicator, not a probability or a safety certification. It helps operators compare samples and decide what to inspect next.</p><span className="mini-label">Example</span><strong>78 / 100 · possible dropout</strong></article><article className="large-feature"><span className="feature-icon">∿</span><h2>Virtual sensing</h2><p>When pulses disappear, the app can estimate movement from the last known pulse rate and elapsed time. Estimates are always labeled virtual, never measured.</p><span className="mini-label">Data boundary</span><strong>Measured signals stay separate</strong></article></div><div className="explain-panel"><div><span className="kicker">WHY IT HELPS</span><h2>Evidence before escalation.</h2><p>Use the score and signal relationship to distinguish a feedback problem from a normal stop, wiring issue, or low-load reading.</p></div><div className="logic-flow"><span>Command 80%</span><b>+</b><span>Current 6.4 A</span><b>→</b><strong>Check encoder</strong><b>→</b><span>0 pps = inspect</span></div></div></> : <><div className="process-grid"><article className="process-card"><span className="process-num">01</span><div className="signal-icon">↗</div><h2>Motor command</h2><p>The command is intent: a requested run, speed, or duty level. A high command means motion should be possible, but it does not prove the shaft moved.</p><span className="mini-label">Sample · 80%</span></article><article className="process-card"><span className="process-num">02</span><div className="signal-icon">≈</div><h2>Motor current</h2><p>Current is the energy witness. Sustained current while commanded suggests the drive and motor are engaged, even if feedback is missing.</p><span className="mini-label">Sample · 6.4 A</span></article><article className="process-card"><span className="process-num">03</span><div className="signal-icon">⌁</div><h2>Encoder pulses</h2><p>Pulses are the movement witness. Normal running produces a steady stream; a sudden gap or irregular pattern creates a mismatch.</p><span className="mini-label">Sample · 120 pps</span></article></div><div className="explain-panel"><div><span className="kicker">DROPOUT SIGNATURE</span><h2>What changes during a fault?</h2><p>Command and current remain present while encoder pulses fall to zero or become sporadic. A stopped motor has low command and low current, so it should not raise the same alert.</p></div><div className="comparison-table"><div><span>Normal run</span><strong>80% · 6.4 A · 120 pps</strong></div><div><span>Dropout</span><strong>80% · 6.4 A · 0 pps</strong></div><div><span>Stopped</span><strong>0% · 0.0 A · 0 pps</strong></div></div></div></>}</main>;
}

function Monitor({ scenario, setScenario, running, setRunning, takeSample, sample, assessment, recordedData, dataError }) {
  const command = sample?.command || 0;
  const current = sample?.current || 0;
  const pulses = sample?.pps || 0;
  return <main className="page-view active react-page"><div className="page-heading"><div><span className="kicker">MONITOR / RECORDED + SIMULATED</span><h1>Encoder health at a glance.</h1><p>Normal mode uses recorded workbook samples. Dropout mode is simulated and removes encoder activity while command and current continue.</p></div><span className={`state-badge ${assessment.fault ? "state-fault" : assessment.state === "Running" ? "state-normal" : "state-idle"}`}>{assessment.state}</span></div><div className="monitor-controls card"><div><span className="kicker">DATA MODE</span><h2>{running ? "Streaming demo samples" : "Ready for a sample"}</h2><p>{dataError ? dataError : `Recorded rows loaded: ${recordedData.length}. No live motor connection.`}</p></div><div className="control-actions"><select value={scenario} onChange={(event) => setScenario(event.target.value)}><option value="normal">Recorded motor data</option><option value="dropout">Simulated encoder dropout</option><option value="stopped">Simulated motor stopped</option></select><button className="button button-primary" onClick={() => { setRunning(!running); if (!running) takeSample(); }}><span className="button-inner">{running ? "Stop simulation" : "Start simulation"}</span></button><button className="button button-secondary" onClick={takeSample}><span className="button-inner">Sample once</span></button></div></div><div className="monitor-grid"><article className={`card state-card ${assessment.fault ? "fault" : ""}`}><div className="card-top"><div><span className="kicker">CURRENT ASSESSMENT</span><h2>{assessment.title}</h2></div><span className={`chip ${assessment.fault ? "chip-fault" : "chip-neutral"}`}>{running ? "Streaming" : "Sampled"}</span></div><p>{assessment.fault ? "The motor command and current are retained while encoder feedback is simulated away." : sample?.command ? `${sample.dataSource || "Simulated data"} is consistent with this scenario.` : "Start a scenario to evaluate encoder health."}</p><div className="metric-stack"><div><span>Motor command</span><strong>{sample ? `${sample.command.toFixed(1)}%` : "—"}</strong></div><div><span>Motor current</span><strong>{sample ? `${sample.current.toFixed(2)} A` : "—"}</strong></div><div><span>Encoder activity</span><strong>{sample ? `${sample.encoderCount ?? sample.pps} count` : "—"}</strong></div></div></article><article className="card confidence-card"><div className="card-top"><div><span className="kicker">FAULT CONFIDENCE</span><h2>Dropout likelihood</h2></div><strong className="confidence-value">{assessment.confidence}</strong></div><div className="confidence-track"><div style={{ width: `${assessment.confidence}%` }} /></div><div className="confidence-scale"><span>0 · clear</span><span>100 · likely dropout</span></div><p>Confidence uses the recorded command/current context and simulated encoder loss.</p><div className="confidence-guide"><span><b>0–39</b> normal or idle</span><span><b>40–69</b> inspect trend</span><span><b>70–100</b> possible dropout</span></div></article></div><div className="telemetry-grid"><TelemetryBar label="PWM command" value={command} max={100} unit="%" /><TelemetryBar label="Current" value={current} max={8} unit=" A" /><TelemetryBar label="Encoder count" value={pulses} max={140} unit="" /></div><div className="virtual-card card"><div><span className="kicker">VIRTUAL SENSING</span><h2>Movement estimate</h2><p>{assessment.fault ? "Encoder activity has been removed by the simulated dropout mode. The estimate below is virtual and should not be treated as measured position." : "A virtual estimate is only a derived demonstration value; recorded encoderCount remains the measured source column."}</p></div><strong>{sample && sample.command ? (assessment.fault ? "≈ 0.0 mm" : "≈ 12.4 mm") : "—"}</strong><span className="virtual-label">VIRTUAL ESTIMATE · NOT MEASURED</span></div></main>;
}

function TelemetryBar({ label, value, max, unit }) {
  return <div className="telemetry-bar card"><div><span>{label}</span><strong>{value ? `${value.toFixed(1)}${unit}` : `0${unit}`}</strong></div><div className="telemetry-track"><i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div></div>;
}

function History({ faults }) { return <main className="page-view active react-page"><div className="page-heading"><div><span className="kicker">AUDIT TRAIL</span><h1>Fault history</h1><p>Review detected events from this browser session. Events are created by the simulated dropout scenario.</p></div></div><div className="history-summary"><div><span>Events recorded</span><strong>{faults.length}</strong></div><div><span>Highest confidence</span><strong>{faults.length ? "78/100" : "—"}</strong></div><div><span>Data source</span><strong>Simulated</strong></div></div><div className="card history-table-wrap"><div className="table-head"><span>TIME</span><span>STATUS</span><span>CONFIDENCE</span></div>{faults.length ? faults.map((fault) => <div className="history-item" key={fault.time.toISOString()}><time>{fault.time.toLocaleTimeString()}</time><span className="chip chip-fault">Possible dropout</span><strong>Confidence {fault.confidence}/100</strong></div>) : <div className="empty-state">No fault events recorded yet. Go to Live Monitor, choose Encoder dropout, and sample once to create an example.</div>}</div></main>; }
function Settings() { return <main className="page-view active react-page"><div className="page-heading"><div><span className="kicker">WORKSPACE SETTINGS</span><h1>Settings</h1><p>Choose how this browser presents the monitoring prototype. Detection values remain fixed for this demo.</p></div></div><div className="settings-layout"><div className="card settings-card"><span className="kicker">DISPLAY</span><h2>Visual preferences</h2><p className="helper">Animations respect the operating system reduced-motion preference automatically.</p><label className="toggle-row"><span><b>Show animated signals</b><small>Keep the drape and motor motion active</small></span><input type="checkbox" defaultChecked /></label><label className="toggle-row"><span><b>Show simulated-data labels</b><small>Keep measurement boundaries visible</small></span><input type="checkbox" defaultChecked /></label></div><div className="card settings-card"><span className="kicker">DETECTION REFERENCE</span><h2>Current prototype thresholds</h2><div className="threshold-list"><div><span>Command required</span><strong>&gt; 10%</strong></div><div><span>Current required</span><strong>&gt; 0.8 A</strong></div><div><span>Pulse concern</span><strong>&lt; 3 pps</strong></div></div></div></div></main>; }
function About() { return <main className="page-view active react-page"><div className="page-heading"><div><span className="kicker">PROJECT GUIDE</span><h1>About / Help</h1><p>A focused prototype for making encoder feedback faults easier to understand before connecting a real control system.</p></div></div><div className="about-grid"><article className="card about-card"><span className="kicker">ABOUT THE PROJECT</span><h2>Making encoder health visible.</h2><p>Encoder Dropout Guardian compares motor command, motor current, and encoder pulse activity to highlight cases where a motor appears energized but feedback has gone quiet. It is designed for monitoring and demonstration, not real motor control.</p><p>The central idea is signal agreement. A command indicates intent, current indicates that energy is being delivered, and encoder pulses provide evidence of movement. Looking at all three together gives a clearer explanation than treating a missing pulse as a fault on its own.</p></article><article className="card about-card"><span className="kicker">DEVELOPER</span><h2>Developed by Mohmmad Souleh Bhat.</h2><p>This project was developed by Mohmmad Souleh Bhat as a focused prototype for understanding encoder feedback health.</p><p>The prototype brings detection, visualization, confidence scoring, history, and virtual-sensing boundaries into one small monitoring experience so the reasoning behind a possible fault is easy to inspect.</p><div className="profile-links"><a href="https://github.com/SoulehBhat" target="_blank" rel="noreferrer">GitHub · @SoulehBhat ↗</a><a href="https://github.com/SoulehBhat/Souleh-s-Engineer-Portfolio" target="_blank" rel="noreferrer">Engineering portfolio repository ↗</a></div></article><article className="card about-card"><span className="kicker">ENGINEERING PROFILE</span><h2>AI, data, and full-stack development.</h2><p>The public engineering portfolio describes Mohammad Souleh Bhat as an aspiring AI Engineer and Full Stack Developer from Srinagar, Kashmir, pursuing a B.Tech in Artificial Intelligence and Data Science at KL University.</p><p>The portfolio also reflects an interest in applying software engineering, data, and intelligent systems to practical problems. Encoder Dropout Guardian follows that same focus by turning raw signal relationships into an understandable operator view.</p><div className="profile-facts"><span>AI Engineering</span><span>Machine Learning</span><span>Data Science</span><span>Backend Engineering</span><span>System Design</span></div></article><article className="card about-card"><span className="kicker">TOOLS &amp; TECHNOLOGIES</span><h2>Building across the stack.</h2><p>Portfolio-listed technologies include Java, Spring Boot, React.js, FastAPI, Python, and PostgreSQL, alongside modern web development and data-structures work.</p><p>Those technologies represent the broader engineering context around the project; this website itself remains a focused React/Vite prototype with simulated readings and browser-local demonstration behavior.</p></article><article className="card about-card"><span className="kicker">QUICK START</span><p>Open Live Monitor, select Encoder dropout, and sample once. Compare the command and current values with the missing pulse stream and confidence score.</p><p>For a normal reference, choose Normal running and sample again. To see the stopped case, choose Motor stopped and confirm that low command and low current produce an idle state rather than a dropout alert.</p></article><article className="card about-card"><span className="kicker">HOW TO READ RESULTS</span><h2>Use confidence as a guide.</h2><p>A higher score means the simulated signals match the prototype’s dropout rule more strongly. It is not a probability, certification, or replacement for electrical, mechanical, and encoder diagnostics.</p><p>Use the history page to review when simulated dropout events were created, and treat the virtual movement estimate as an approximation rather than measured position.</p></article><article className="card about-card about-placeholder"><span className="kicker">OPTIONAL PROFILE</span><h2>Short bio or contact</h2><p>Space reserved for a short developer bio, email, LinkedIn, or another contact link if you choose to add one later.</p></article><article className="card about-card"><span className="kicker">INTERPRETATION</span><p>A high score means the simulated signals match the dropout rule. Confirm wiring, encoder power, and mechanical movement before treating any real-world event as proven.</p><p>No physical motor, encoder, drive, or production login service is connected to this prototype. Its purpose is to make the monitoring concept clear and testable before those integrations exist.</p></article></div></main>; }
function LoginPage({ onLogin }) {
  const [showPassword, setShowPassword] = useState(false);
  const [loginStatus, setLoginStatus] = useState("");
  const handleSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") || "").trim();
    const password = String(form.get("password") || "").trim();
    const validCredentials = (username === "Souleh" && password === "asdfghjkl;'") || (username === "user1" && password === "1");
    if (!validCredentials) {
      setLoginStatus("Enter a valid prototype username and password.");
      return;
    }
    setLoginStatus("Prototype login accepted. Opening Home...");
    onLogin();
  };

  return <main className="page-view active react-page login-page"><div className="login-panel">
    <a className="login-back-link" href="#home">← Back to home</a>
    <div className="login-heading"><span className="kicker">ENCODER DROPOUT GUARDIAN</span><h1>Welcome back.</h1><p>Log in to continue to your monitoring workspace.</p></div>
    <form className="login-form" onSubmit={handleSubmit}>
      <label htmlFor="login-username">Username</label>
      <input id="login-username" name="username" type="text" autoComplete="username" placeholder="Enter your username" />
      <div className="login-password-label"><label htmlFor="login-password">Password</label><a href="#login">Forgot password?</a></div>
      <div className="password-field"><input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" /><button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></div>
      <label className="remember-row"><input type="checkbox" name="remember" /><span>Remember me</span></label>
      <button className="login-submit" type="submit"><span className="button-inner">Log In</span></button>
    </form>
    {loginStatus && <p className="login-status" role="status">{loginStatus}</p>}
    <p className="login-note">Prototype navigation only. No account authentication is connected.</p>
  </div></main>;
}

const root = createRoot(document.getElementById("root"));
root.render(<StrictMode><App /></StrictMode>);

if (import.meta.hot) {
  import.meta.hot.dispose(() => root.unmount());
}
