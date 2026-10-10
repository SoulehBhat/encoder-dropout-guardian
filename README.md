# Encoder Dropout Guardian

Encoder Dropout Guardian is a React/Vite monitoring prototype for recognizing a specific feedback mismatch:

> A motor is commanded to run and drawing current, but encoder pulses suddenly stop or become irregular.

The project makes that relationship visible through a responsive dark monitoring website. It is designed for simulation, explanation, and early validation—not for controlling a real motor.

## What the project demonstrates

- Three-signal monitoring:
  - **Motor command** shows intent to run.
  - **Motor current** indicates that the motor is energized.
  - **Encoder pulses** provide movement feedback.
- Dropout detection when command and current remain present while pulses are absent or unusually low.
- A 0–100 confidence score for comparing simulated signal conditions.
- Virtual movement estimates that are explicitly labeled as virtual, not measured encoder data.
- Normal-running, encoder-dropout, and motor-stopped examples.
- Session-local fault history.
- Reduced-motion support and responsive layouts for desktop and mobile.

## Pages

| Page | Purpose |
| --- | --- |
| Home | Project overview and animated signal preview |
| How It Works | Signal roles, dropout signature, and example readings |
| Features | Detection logic, confidence scoring, and virtual sensing |
| Live Monitor | Run or sample simulated scenarios |
| Fault History | Review simulated dropout events from the current browser session |
| Settings | Review display preferences and prototype thresholds |
| About / Help | Project guidance, developer information, and interpretation notes |
| Log In | Prototype navigation form with local demo credentials |

## Run locally

Requirements:

- Node.js 18 or newer
- npm

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL shown by Vite, usually `http://localhost:5173`.

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Try the simulation

1. Open **Live Monitor**.
2. Choose **Normal running** and select **Sample once** to see consistent signals.
3. Choose **Encoder dropout** and select **Sample once** to see command and current remain present while encoder pulses fall away.
4. Choose **Motor stopped** to see why zero pulses alone are not a fault.
5. Use **Start simulation** to stream samples at roughly 900 ms intervals.
6. Open **Fault History** to review dropout events created during the browser session.

The current prototype rule treats a sample as a possible dropout when:

- Motor command is above 10%.
- Motor current is above 0.8 A.
- Encoder pulses are below 3 pulses per second.

The confidence score is a monitoring aid, not a probability, safety certification, or replacement for electrical and mechanical diagnostics.

## Login behavior

The login page is currently a local prototype flow. It does not authenticate users against a production service or store passwords.

Demo credentials:

```text
Username: Souleh
Password: asdfghjkl;'
```

```text
Username: user1
Password: 1
```

A successful prototype login stores a browser-local session flag and changes the header action to **Log Out**. Logging out clears that flag and returns to the login page.

## Optional Supabase setup

The project includes an example environment file for a future Supabase Auth integration:

```bash
copy .env.example .env.local
```

Add real project values only to `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Do not commit `.env.local` or any private credentials. The current UI remains a prototype flow unless authentication wiring is intentionally enabled and tested.

## Project structure

```text
.
├── index.html
├── src/
│   ├── components/
│   │   ├── PatternWaves.jsx
│   │   └── React Bits components
│   ├── lib/
│   │   └── supabase.js
│   ├── index.css
│   └── main.jsx
├── styles.css
├── components.json
├── vite.config.js
└── package.json
```

## Scope and safety

This repository contains a simulated monitoring interface only. It does not:

- connect to a physical motor, drive, or encoder;
- issue motor commands;
- guarantee fault diagnosis;
- provide production authentication;
- treat virtual estimates as measured movement.

## Developer

Developed by **Mohmmad Souleh Bhat**.

- GitHub: <https://github.com/SoulehBhat>
- Engineering portfolio repository: <https://github.com/SoulehBhat/Souleh-s-Engineer-Portfolio>

## License

No license has been selected for this project yet. Add a license before distributing or accepting external contributions.
