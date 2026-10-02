// Repcheck: physios build home exercise programmes, patients follow them with a guided rep counter and report back.
import { useEffect, useRef, useState } from "react";
import { shareLink, openLater, waLink } from "./lib/share";
import { uid, useStored } from "./lib/store";
import { useShared } from "./lib/useShared";
import { todayISO } from "./lib/time";
import { Section, Stat, Stats } from "./ui/kit";

const T = "repcheck";
type Ex = { id: string; name: string; sets: number; reps: number; hold: number; rest: number; cue: string; video: string };
type Program = { id: string; patient: string; phone: string; clinic: string; clinician: string; clinicPhone: string; perWeek: number; exercises: Ex[]; created: string };
type Session = { date: string; done: Record<string, number>; pain: number; note: string };
const LIB: Omit<Ex, "id">[] = [
  { name: "Heel slides", sets: 3, reps: 10, hold: 0, rest: 30, cue: "Slide the heel towards you slowly, keep the knee pointing up.", video: "" },
  { name: "Straight leg raise", sets: 3, reps: 10, hold: 3, rest: 30, cue: "Tighten the thigh first, lift to the height of the other knee.", video: "" },
  { name: "Glute bridge", sets: 3, reps: 12, hold: 2, rest: 45, cue: "Push through the heels, do not arch the lower back.", video: "" },
  { name: "Wall sit", sets: 3, reps: 1, hold: 30, rest: 60, cue: "Knees behind the toes. Stop if pain goes above 4 out of 10.", video: "" },
  { name: "Calf raises", sets: 3, reps: 15, hold: 1, rest: 30, cue: "Slow on the way down.", video: "" },
  { name: "Shoulder external rotation with band", sets: 3, reps: 12, hold: 1, rest: 30, cue: "Elbow tucked to your side.", video: "" },
  { name: "Chin tucks", sets: 2, reps: 10, hold: 5, rest: 20, cue: "Make a double chin, keep eyes level.", video: "" },
];
const SAMPLE: Program = { id: "p1", patient: "Mr. Trabelsi", phone: "", clinic: "Physio Plus Menzah", clinician: "Ines", clinicPhone: "21671000000", perWeek: 5, created: todayISO(), exercises: LIB.slice(0, 4).map(e => ({ ...e, id: uid() })) };

function Runner({ p, onFinish }: { p: Program; onFinish: (s: Session) => void }) {
  const [i, setI] = useState(0), [set, setSet] = useState(1), [rep, setRep] = useState(0), [phase, setPhase] = useState<"ready" | "hold" | "rest" | "done">("ready"), [left, setLeft] = useState(0);
  const [done, setDone] = useState<Record<string, number>>({}), [pain, setPain] = useState(2), [note, setNote] = useState("");
  const ex = p.exercises[i];
  const beep = useRef<AudioContext | null>(null);
  const ping = (f = 880) => { try { beep.current ??= new AudioContext(); const o = beep.current.createOscillator(), g = beep.current.createGain(); o.frequency.value = f; o.connect(g); g.connect(beep.current.destination); g.gain.value = 0.08; o.start(); o.stop(beep.current.currentTime + 0.15); } catch { /* no audio */ } };
  useEffect(() => {
    if (phase !== "hold" && phase !== "rest") return;
    if (left <= 0) { ping(phase === "hold" ? 660 : 990); if (phase === "hold") countRep(); else setPhase("ready"); return; }
    const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t);
  });
  function countRep() {
    const n = rep + 1; setRep(n); setDone(d => ({ ...d, [ex.id]: (d[ex.id] ?? 0) + 1 }));
    if (n >= ex.reps) { if (set < ex.sets) { setSet(set + 1); setRep(0); setPhase("rest"); setLeft(ex.rest); } else next(); } else setPhase("ready");
  }
  function next() { if (i + 1 < p.exercises.length) { setI(i + 1); setSet(1); setRep(0); setPhase("ready"); } else setPhase("done"); }
  if (phase === "done") return (
    <div className="stack" style={{ gap: 12 }}>
      <h2>All done. Well done.</h2>
      <label className="field"><span>Pain during exercises: {pain} out of 10</span><input type="range" min={0} max={10} value={pain} onChange={e => setPain(+e.target.value)} /></label>
      <label className="field"><span>Anything to tell your physio?</span><input className="input" value={note} onChange={e => setNote(e.target.value)} /></label>
      <button className="btn primary" onClick={() => onFinish({ date: todayISO(), done, pain, note })}>Save session</button>
    </div>
  );
  return (
    <div className="rc-run">
      <p className="eyebrow">Exercise {i + 1} of {p.exercises.length} · set {set} of {ex.sets}</p>
      <h2>{ex.name}</h2>
      <p className="note">{ex.cue}</p>
      {ex.video && <a href={ex.video} target="_blank" rel="noreferrer">Watch how</a>}
      <div className="rc-big num">{phase === "rest" ? `Rest ${left}s` : phase === "hold" ? `Hold ${left}` : `${rep} / ${ex.reps}`}</div>
      <div className="row" style={{ justifyContent: "center" }}>
        {phase === "ready" && <button className="btn primary rc-tap" onClick={() => { ping(); if (ex.hold > 0) { setPhase("hold"); setLeft(ex.hold); } else countRep(); }}>{ex.hold > 0 ? "Start rep" : "Done one rep"}</button>}
        {phase === "rest" && <button className="btn" onClick={() => setPhase("ready")}>Skip rest</button>}
        <button className="btn ghost" onClick={next}>Skip exercise</button>
      </div>
    </div>
  );
}

export default function Repcheck() {
  const shared = useShared<Program>();
  const [programs, setPrograms] = useStored<Program[]>(T, "programs", [SAMPLE]);
  const [openId, setOpenId] = useStored(T, "open", SAMPLE.id);
  const [mine, setMine] = useStored<Program | null>(T, "mine", null);
  const [sessions, setSessions] = useStored<Session[]>(T, "sessions", []);
  const [running, setRunning] = useState(false);
  useEffect(() => { if (shared.data) setMine(shared.data); }, [shared.data, setMine]);
  const css = <style>{`.rc-run{text-align:center;display:grid;gap:10px;justify-items:center}.rc-big{font-family:var(--serif);font-size:84px;line-height:1}.rc-tap{font-size:22px;padding:22px 32px}.rc-ex{display:grid;grid-template-columns:1fr repeat(4,70px) auto;gap:8px;align-items:end;padding:10px 0;border-bottom:1px solid var(--line)}@media(max-width:640px){.rc-ex{grid-template-columns:1fr 1fr}}`}</style>;

  // Patient side: a programme opened from the physio's link is kept on the patient's phone.
  const patientProg = shared.data ?? mine;
  if (shared.loading) return <p className="empty-note">Opening your programme…</p>;
  if (patientProg && new URLSearchParams(location.search).get("m") !== "physio") {
    const p = patientProg;
    const week = sessions.filter(s => s.date >= new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10));
    const report = () => `Hi ${p.clinician}, ${p.patient} here. This week I did ${week.length} of ${p.perWeek} sessions. Pain on average ${week.length ? (week.reduce((a, s) => a + s.pain, 0) / week.length).toFixed(1) : "–"}/10.${week.filter(s => s.note).map(s => `\n${s.date}: ${s.note}`).join("")}`;
    return (
      <div className="stack">{css}
        <Section title={`Your exercises, ${p.patient}`} aside={p.clinicPhone && <a className="btn small" href={waLink(report(), p.clinicPhone)} target="_blank" rel="noreferrer">Send progress to {p.clinician}</a>}>
          <Stats><Stat value={`${week.length}/${p.perWeek}`} label="Sessions this week" tone={week.length >= p.perWeek ? "good" : undefined} /><Stat value={sessions.length} label="Sessions in total" /></Stats>
        </Section>
        <section className="panel">{running ? <Runner p={p} onFinish={s => { setSessions([s, ...sessions]); setRunning(false); }} /> : (
          <div className="stack" style={{ gap: 10 }}>
            {p.exercises.map(e => <div key={e.id}><strong>{e.name}</strong> <span className="note">{e.sets} × {e.reps}{e.hold ? `, hold ${e.hold}s` : ""}</span><p className="note">{e.cue}</p></div>)}
            <button className="btn primary rc-tap" style={{ alignSelf: "flex-start" }} onClick={() => setRunning(true)}>Start today's session</button>
          </div>)}
        </section>
        <p className="note">From {p.clinic}. Stop and call your physio if pain goes above 5 out of 10. <a href="/t/repcheck?m=physio">Physio view</a></p>
      </div>
    );
  }

  const prog = programs.find(p => p.id === openId) ?? programs[0];
  const set = (patch: Partial<Program>) => setPrograms(programs.map(p => (p.id === prog.id ? { ...p, ...patch } : p)));
  const setEx = (id: string, patch: Partial<Ex>) => set({ exercises: prog.exercises.map(e => (e.id === id ? { ...e, ...patch } : e)) });
  return (
    <div className="stack">{css}
      <div className="row" style={{ alignItems: "flex-end" }}>
        <label className="field" style={{ flex: "0 1 300px" }}><span>Patient</span><select id="rc-open" className="input" value={prog.id} onChange={e => setOpenId(e.target.value)}>{programs.map(p => <option key={p.id} value={p.id}>{p.patient}</option>)}</select></label>
        <button className="btn small" onClick={() => { const p = { ...SAMPLE, id: uid(), patient: "New patient", exercises: [], created: todayISO() }; setPrograms([...programs, p]); setOpenId(p.id); }}>New patient</button>
      </div>
      <div className="grid2">
        <Section title="Patient and clinic">
          <div className="stack" style={{ gap: 10 }}>
            <div className="row"><label className="field"><span>Patient</span><input id="rc-pn" className="input" value={prog.patient} onChange={e => set({ patient: e.target.value })} /></label><label className="field"><span>Patient WhatsApp</span><input id="rc-pp" className="input" value={prog.phone} onChange={e => set({ phone: e.target.value })} /></label></div>
            <div className="row"><label className="field"><span>Clinic</span><input id="rc-cl" className="input" value={prog.clinic} onChange={e => set({ clinic: e.target.value })} /></label><label className="field"><span>Physio</span><input id="rc-ph" className="input" value={prog.clinician} onChange={e => set({ clinician: e.target.value })} /></label></div>
            <div className="row"><label className="field"><span>Clinic WhatsApp (for reports)</span><input id="rc-cp" className="input" value={prog.clinicPhone} onChange={e => set({ clinicPhone: e.target.value })} /></label><label className="field"><span>Sessions per week</span><input id="rc-pw" className="input num" value={prog.perWeek} onChange={e => set({ perWeek: parseInt(e.target.value) || 1 })} /></label></div>
            <button className="btn primary" style={{ alignSelf: "flex-start" }} disabled={!prog.exercises.length} onClick={() => openLater(async () => waLink(`Hello ${prog.patient}, here are your home exercises from ${prog.clinic}. Open the link on your phone and tap "Start today's session":\n${await shareLink(T, { ...prog, created: new Date().toISOString() }, "m=patient")}`, prog.phone))}>Send programme to patient</button>
          </div>
        </Section>
        <Section title="Exercise library">
          <div className="row" style={{ gap: 6 }}>{LIB.map(e => <button key={e.name} className="btn small" onClick={() => set({ exercises: [...prog.exercises, { ...e, id: uid() }] })}>+ {e.name}</button>)}</div>
          <button className="btn small" style={{ marginTop: 10 }} onClick={() => set({ exercises: [...prog.exercises, { id: uid(), name: "New exercise", sets: 3, reps: 10, hold: 0, rest: 30, cue: "", video: "" }] })}>Custom exercise</button>
        </Section>
      </div>
      <Section title="Programme">
        {prog.exercises.length === 0 ? <p className="empty-note">Add exercises from the library.</p> : prog.exercises.map(e => (
          <div key={e.id}>
            <div className="rc-ex">
              <label className="field"><span>Exercise</span><input className="input" value={e.name} onChange={x => setEx(e.id, { name: x.target.value })} /></label>
              {(["sets", "reps", "hold", "rest"] as const).map(k => <label key={k} className="field"><span>{k === "hold" ? "Hold s" : k === "rest" ? "Rest s" : k}</span><input className="input num" value={e[k]} onChange={x => setEx(e.id, { [k]: parseInt(x.target.value) || 0 })} /></label>)}
              <button className="btn ghost small danger" onClick={() => set({ exercises: prog.exercises.filter(x => x.id !== e.id) })}>Remove</button>
            </div>
            <div className="row" style={{ paddingBottom: 10 }}><input className="input" style={{ flex: 2 }} aria-label="Coaching cue" placeholder="Coaching cue" value={e.cue} onChange={x => setEx(e.id, { cue: x.target.value })} /><input className="input" style={{ flex: 1 }} aria-label="Video link" placeholder="Video link (optional)" value={e.video} onChange={x => setEx(e.id, { video: x.target.value })} /></div>
          </div>
        ))}
      </Section>
      <Section title="Try it as the patient">{running ? <Runner p={prog} onFinish={() => setRunning(false)} /> : <button className="btn" onClick={() => setRunning(true)}>Preview the guided session</button>}</Section>
    </div>
  );
}
