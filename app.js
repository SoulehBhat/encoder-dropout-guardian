const $ = (id) => document.getElementById(id);

const state = {
  samples: [],
  faults: [],
  running: false,
  timer: null,
  lastFault: false,
  measuredRevolutions: 0,
  virtualRevolutions: 0,
  settings: { command: 10, current: 0.8, pulse: 3 },
};

const elements = {
  pages: [...document.querySelectorAll(".page-view")],
  navLinks: [...document.querySelectorAll("[data-route]")],
  nav: $("mainNav"),
  menuButton: $("menuButton"),
  headerStatus: $("headerStatus"),
  scenario: $("scenarioSelect"),
  start: $("startButton"),
  step: $("stepButton"),
  clear: $("clearButton"),
  statusCard: $("statusCard"),
  statusTitle: $("statusTitle"),
  statusMessage: $("statusMessage"),
  stream: $("streamLabel"),
  commandMetric: $("commandMetric"),
  currentMetric: $("currentMetric"),
  pulseMetric: $("pulseMetric"),
  confidence: $("confidenceValue"),
  confidenceBar: $("confidenceBar"),
  confidenceReason: $("confidenceReason"),
  monitorBadge: $("monitorBadge"),
  machineState: $("machineState"),
  motorGraphic: $("motorGraphic"),
  pulseActivity: $("pulseActivity"),
  pulseHint: $("pulseHint"),
  sampleCount: $("sampleCount"),
  estimated: $("estimatedMovement"),
  measured: $("measuredMovement"),
  virtual: $("virtualMovement"),
  inputCommand: $("inputCommand"),
  inputCurrent: $("inputCurrent"),
  inputPps: $("inputPps"),
  canvas: $("signalChart"),
  historyList: $("historyList"),
  historyTotal: $("historyTotal"),
  historyHighest: $("historyHighest"),
  historyStatus: $("historyStatus"),
  commandThreshold: $("commandThreshold"),
  currentThreshold: $("currentThreshold"),
  pulseThreshold: $("pulseThreshold"),
  animationToggle: $("animationToggle"),
  compactToggle: $("compactToggle"),
  settingsSaved: $("settingsSaved"),
};

function route() {
  return location.hash.replace("#", "") || "home";
}

function showPage() {
  const current = elements.pages.some((page) => page.dataset.page === route()) ? route() : "home";
  elements.pages.forEach((page) => page.classList.toggle("active", page.dataset.page === current));
  elements.navLinks.forEach((link) => link.classList.toggle("active", link.dataset.route === current));
  elements.nav.classList.remove("open");
  elements.menuButton.setAttribute("aria-expanded", "false");
  if (current === "history") renderHistory();
}

function inputValues() {
  const samples = state.samples;
  const latest = samples.at(-1);
  return latest ? { command: latest.command, current: latest.current, pps: latest.expectedPps } : { command: 80, current: 6.4, pps: 120 };
}

function jitter(amount) {
  return Math.round((Math.random() * 2 - 1) * amount);
}

function scenarioSample() {
  const base = inputValues();
  const scenario = elements.scenario.value;
  if (scenario === "stopped") return { command: 0, current: 0, pps: 0, expectedPps: 0 };
  if (scenario === "dropout") {
    const phase = state.samples.length % 12;
    const missing = phase < 4 || phase === 8;
    return { command: base.command || 80, current: base.current || 6.4, pps: missing ? 0 : Math.max(2, (base.pps || 120) + jitter(8)), expectedPps: base.pps || 120 };
  }
  return { command: base.command || 80, current: base.current || 6.4, pps: Math.max(0, (base.pps || 120) + jitter(5)), expectedPps: base.pps || 120 };
}

function assess(sample) {
  const commanded = sample.command >= state.settings.command;
  const energized = sample.current >= state.settings.current;
  const recent = state.samples.filter((item) => item.scenario === elements.scenario.value).slice(-5);
  const lowPulses = recent.filter((item) => item.pps < state.settings.pulse).length;
  const pulseDropout = commanded && energized && sample.pps < state.settings.pulse;
  const irregular = commanded && energized && recent.length >= 3 && lowPulses >= 2;
  let confidence = 0;
  if (commanded) confidence += 18;
  if (energized) confidence += 18;
  if (pulseDropout) confidence += 42;
  if (irregular) confidence += 22;
  if (!commanded || !energized) confidence = 0;
  return { confidence: Math.min(100, confidence), fault: confidence >= 55, commanded, energized, irregular };
}

function addSample(sample) {
  const assessment = assess(sample);
  state.samples.push({ ...sample, scenario: elements.scenario.value, confidence: assessment.confidence, fault: assessment.fault });
  if (sample.pps > 0) state.measuredRevolutions += sample.pps / 60 / 10;
  if (assessment.fault) state.virtualRevolutions += sample.expectedPps / 60 / 10;
  if (assessment.fault && !state.lastFault) state.faults.unshift({ time: new Date(), message: assessment.irregular ? "Encoder pulses are intermittent while motor remains energized." : "Encoder pulses stopped during commanded, energized run.", confidence: assessment.confidence });
  state.lastFault = assessment.fault;
  render(sample, assessment);
}

function render(sample, assessment) {
  const stopped = !assessment.commanded && !assessment.energized;
  const running = assessment.commanded && assessment.energized;
  elements.statusCard.classList.toggle("fault", assessment.fault);
  elements.statusTitle.textContent = assessment.fault ? "Possible encoder dropout" : stopped ? "Motor stopped" : "Normal running";
  elements.statusMessage.textContent = assessment.fault ? "The motor is commanded and drawing current, but encoder feedback is absent or irregular." : stopped ? "No command or motor current is present; missing pulses are expected." : "Command, current, and encoder feedback are consistent with a normal run.";
  elements.stream.textContent = state.running ? "Streaming" : "Sampled";
  elements.stream.className = `chip ${assessment.fault ? "chip-fault" : stopped ? "chip-neutral" : "chip-ok"}`;
  elements.commandMetric.textContent = `${sample.command.toFixed(0)}%`;
  elements.currentMetric.textContent = `${sample.current.toFixed(1)} A`;
  elements.pulseMetric.textContent = `${sample.pps.toFixed(0)} pps`;
  elements.confidence.textContent = assessment.confidence;
  elements.confidence.classList.toggle("fault", assessment.fault);
  elements.confidenceBar.style.width = `${assessment.confidence}%`;
  elements.confidenceBar.classList.toggle("fault", assessment.fault);
  elements.confidenceReason.textContent = assessment.fault ? "High confidence: command and current are present while pulse feedback is missing or irregular." : "Confidence is based on command, current, pulse absence, and pulse irregularity.";
  elements.monitorBadge.textContent = assessment.fault ? "Fault" : running ? "Running" : "Idle";
  elements.monitorBadge.className = `state-badge ${assessment.fault ? "state-fault" : running ? "state-normal" : "state-idle"}`;
  elements.machineState.textContent = assessment.fault ? "Fault" : running ? "Running" : "Idle";
  elements.machineState.className = `state-badge ${assessment.fault ? "state-fault" : running ? "state-normal" : "state-idle"}`;
  elements.motorGraphic.classList.toggle("is-running", running);
  elements.motorGraphic.classList.toggle("is-fault", assessment.fault);
  elements.motorGraphic.classList.toggle("is-idle", !running);
  elements.pulseActivity.textContent = assessment.fault ? "Irregular" : sample.pps > 0 ? "Active" : "No signal";
  elements.pulseHint.textContent = assessment.fault ? "Pulse stream paused or flickering — feedback is not trustworthy." : sample.pps > 0 ? "Pulse stream is tracking the commanded run." : "No pulses expected while the motor is stopped.";
  elements.sampleCount.textContent = `${state.samples.length} samples`;
  elements.estimated.textContent = (state.measuredRevolutions + state.virtualRevolutions).toFixed(2);
  elements.measured.textContent = `${state.measuredRevolutions.toFixed(2)} rev`;
  elements.virtual.textContent = `${state.virtualRevolutions.toFixed(2)} rev`;
  elements.inputCommand.textContent = `${sample.command.toFixed(0)}%`;
  elements.inputCurrent.textContent = `${sample.current.toFixed(1)} A`;
  elements.inputPps.textContent = `${sample.expectedPps.toFixed(0)} pps`;
  elements.headerStatus.textContent = assessment.fault ? "Fault detected" : state.running ? "Monitoring live" : running ? "Motor running" : "Monitor idle";
  renderHistory();
  drawChart();
}

function renderHistory() {
  const highest = state.faults.reduce((max, item) => Math.max(max, item.confidence), 0);
  elements.historyTotal.textContent = state.faults.length;
  elements.historyHighest.textContent = state.faults.length ? `${highest}/100` : "—";
  elements.historyStatus.textContent = state.faults.length ? "Review required" : "Clear";
  elements.historyList.innerHTML = state.faults.length
    ? state.faults.map((fault) => `<div class="history-item"><time>${fault.time.toLocaleTimeString()}</time><span class="chip chip-fault">Possible dropout</span><strong>${fault.message}</strong><span>Confidence ${fault.confidence}/100</span></div>`).join("")
    : '<div class="empty-state">No fault events recorded yet. Run the dropout simulation to create one.</div>';
}

function drawChart() {
  if (!elements.canvas) return;
  const context = elements.canvas.getContext("2d");
  const width = elements.canvas.width;
  const height = elements.canvas.height;
  context.clearRect(0, 0, width, height);
  context.strokeStyle = "#263c31";
  context.lineWidth = 1;
  for (let row = 1; row < 5; row++) { const y = (height / 5) * row; context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
  if (!state.samples.length) return;
  const maxPps = Math.max(150, ...state.samples.map((sample) => sample.pps));
  const draw = (key, color, max) => {
    context.strokeStyle = color; context.lineWidth = 3; context.beginPath();
    state.samples.slice(-50).forEach((sample, index, samples) => { const x = index * (width / Math.max(1, samples.length - 1)); const y = height - (sample[key] / max) * (height - 22) - 11; index ? context.lineTo(x, y) : context.moveTo(x, y); });
    context.stroke();
  };
  draw("command", "#f0f0f0", 100); draw("current", "#b6b6b6", 20); draw("pps", "#777777", maxPps);
}

function resetMonitor() {
  state.samples = []; state.faults = []; state.lastFault = false; state.measuredRevolutions = 0; state.virtualRevolutions = 0;
  state.running = false; clearInterval(state.timer); elements.start.textContent = "Start simulation"; elements.headerStatus.textContent = "Monitor idle";
  elements.statusTitle.textContent = "Awaiting samples"; elements.statusMessage.textContent = "Start a scenario to evaluate encoder health."; elements.statusCard.classList.remove("fault");
  elements.stream.textContent = "Stopped"; elements.stream.className = "chip chip-neutral"; elements.confidence.textContent = "0"; elements.confidenceBar.style.width = "0%"; elements.confidenceBar.classList.remove("fault");
  elements.monitorBadge.textContent = "Idle"; elements.monitorBadge.className = "state-badge state-idle"; elements.machineState.textContent = "Idle"; elements.machineState.className = "state-badge state-idle";
  elements.motorGraphic.classList.remove("is-running", "is-fault"); elements.motorGraphic.classList.add("is-idle"); elements.pulseActivity.textContent = "—"; elements.pulseHint.textContent = "Awaiting encoder samples.";
  elements.sampleCount.textContent = "0 samples"; elements.estimated.textContent = "0.00"; elements.measured.textContent = "0.00 rev"; elements.virtual.textContent = "0.00 rev";
  elements.commandMetric.textContent = "—"; elements.currentMetric.textContent = "—"; elements.pulseMetric.textContent = "—"; renderHistory(); drawChart();
}

function saveSettings() {
  state.settings.command = Number(elements.commandThreshold.value) || 10;
  state.settings.current = Number(elements.currentThreshold.value) || .8;
  state.settings.pulse = Number(elements.pulseThreshold.value) || 3;
  elements.settingsSaved.textContent = "Saved locally"; setTimeout(() => { elements.settingsSaved.textContent = "Saved locally"; }, 500);
}

elements.navLinks.forEach((link) => link.addEventListener("click", showPage));
window.addEventListener("hashchange", showPage);
elements.menuButton.addEventListener("click", () => { const open = elements.nav.classList.toggle("open"); elements.menuButton.setAttribute("aria-expanded", String(open)); });
elements.start.addEventListener("click", () => {
  state.running = !state.running; elements.start.textContent = state.running ? "Stop simulation" : "Start simulation";
  if (state.running) { addSample(scenarioSample()); state.timer = setInterval(() => addSample(scenarioSample()), 900); } else clearInterval(state.timer);
});
elements.step.addEventListener("click", () => addSample(scenarioSample()));
elements.clear.addEventListener("click", resetMonitor);
elements.scenario.addEventListener("change", () => {
  state.lastFault = false;
  if (elements.scenario.value === "stopped") addSample({ command: 0, current: 0, pps: 0, expectedPps: 0 });
});
$("saveSettings").addEventListener("click", saveSettings);
elements.animationToggle.addEventListener("change", () => document.body.classList.toggle("animations-off", !elements.animationToggle.checked));
elements.compactToggle.addEventListener("change", () => document.body.classList.toggle("compact", elements.compactToggle.checked));
showPage();
