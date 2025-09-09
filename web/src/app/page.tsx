"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Social Bored — Frontend Beta (No Backend)
 * -------------------------------------------------
 * UI refresh per your notes:
 * - Fun, purple/blue branding ("Social" purple, "Bored" blue)
 * - More/larger floating bubbles with stronger colors
 * - Cameras are REQUIRED in a room (no video-off in-call)
 * - When muted, a clear MUTED badge overlays the camera tile
 * - Functionality otherwise unchanged (mock matchmaking + local preview)
 * - COMPACT LAYOUT: Tighter spacing, smaller videos, reduced padding
 */

interface Participant { id: string; name: string; avatar: string; isYou?: boolean; }

type Stage = "idle" | "matching" | "incall" | "consent" | "waitingNewcomer";

export default function SocialBoredBeta() {
  // ---- Core UI state ----
  const [stage, setStage] = useState<Stage>("idle");
  const [status, setStatus] = useState<string>("Ready to start");
  const [participants, setParticipants] = useState<Participant[]>([]);

  // ---- Camera state (separate refs to avoid double‑binding) ----
  const [stream, setStream] = useState<MediaStream|null>(null);
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const lobbyVideoRef = useRef<HTMLVideoElement>(null);
  const callVideoRef  = useRef<HTMLVideoElement>(null);

  // ---- Bubble animations ----
  const [bubbleKey, setBubbleKey] = useState<number>(0);
  const triggerBubbles = () => setBubbleKey(k => k + 1);

  // --- Helpers ---
  function initials(name: string){ return name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase(); }
  function uuid(){ return (typeof crypto!=='undefined' && 'randomUUID' in crypto ? (crypto as any).randomUUID(): Math.random().toString(36).slice(2)); }

  // You user
  const you: Participant = { id: "you", name: "You", avatar: "YOU", isYou: true };

  // Attach a stream to a <video> element safely
  async function attachStream(el: HTMLVideoElement | null, media: MediaStream | null){
    if (!el) return;
    // @ts-ignore
    el.srcObject = media;
    if (media){
      el.muted = true; el.playsInline = true;
      const tryPlay = () => { el.play().catch(()=>{}); };
      el.onloadedmetadata = tryPlay; // Safari/iOS
      tryPlay();
    } else {
      el.pause();
      // @ts-ignore
      el.srcObject = null;
    }
  }

  // Keep the correct video element bound depending on stage
  useEffect(()=>{ attachStream(stage === "idle" ? lobbyVideoRef.current : callVideoRef.current, stream); }, [stream, stage]);

  // ---- Camera controls ----
  async function startCamera(): Promise<boolean>{
    try{
      const s = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
      setStream(s);
      const v = s.getVideoTracks()[0];
      const a = s.getAudioTracks()[0];
      setCamOn(!!v && v.enabled);
      setMicOn(!!a && a.enabled);
      setStatus("Camera ready — preview should be visible.");
      return true;
    }catch(err){
      console.error(err);
      setStatus("Cannot access camera/mic. Allow permissions (lock icon), close Zoom/Discord/FaceTime, then reload.");
      alert("Camera/mic blocked or busy. Check site permissions and close other apps using the camera.");
      return false;
    }
  }
  function stopCamera(){
    if (lobbyVideoRef.current) attachStream(lobbyVideoRef.current, null);
    if (callVideoRef.current)  attachStream(callVideoRef.current, null);
    if (stream) stream.getTracks().forEach(t=>t.stop());
    setStream(null); setCamOn(false); setMicOn(false);
  }
  // No toggleVideo in-room (cameras required). Keep lobby preview controls.
  function toggleAudio(){ if (!stream) return; const t = stream.getAudioTracks()[0]; if (!t) return; t.enabled = !t.enabled; setMicOn(t.enabled); }

  // ---- Mock matching flow ----
  const handleStart = async () => {
    // Enforce: camera must be ON to join a room
    if (!stream || !camOn){
      const ok = await startCamera();
      if (!ok){ return; }
    }
    setStage("matching"); setStatus("Matching you with someone…");
    setTimeout(()=>{
      const partner: Participant = { id: uuid(), name: "Alex Smith", avatar: initials("Alex Smith") };
      setParticipants([you, partner]);
      setStage("incall"); setStatus("Connected — say hi! 👋");
      triggerBubbles(); // enter call bubbles
    }, 800);
  };

  const startAddOne = () => {
    setStage("consent"); setStatus("Everyone must consent to add a newcomer…");
    setTimeout(()=>{ // auto-consent in mock
      setStage("waitingNewcomer"); setStatus("Seat opened. Finding someone new…");
      setTimeout(()=>{
        const n = { id: uuid(), name: "Jordan Lee", avatar: initials("Jordan Lee") };
        setParticipants(prev => prev.length>=3 ? prev : [...prev, n]);
        setStage("incall"); setStatus("Newcomer joined! 🎉");
        triggerBubbles(); // join bubbles
      }, 1000);
    }, 900);
  };

  const leaveBoard = () => {
    setParticipants([]); setStage("idle"); setStatus("Left the board. Ready when you are.");
    triggerBubbles(); // leave bubbles
  };

  // ---- Render ----
  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 grid grid-rows-[auto,1fr]">
      <Header />

      <main className="relative w-full min-h-0 flex-1 p-3 grid grid-rows-[auto,1fr] gap-3">
        {/* Bubble layer */}
        <BubbleLayer key={`bubbles-${bubbleKey}`} count={32} />

        <StatusBar text={status} hint={stage === "idle"} />

        {stage === "idle" && (
          <Lobby
            lobbyVideoRef={lobbyVideoRef}
            onStart={handleStart}
            onStartCam={startCamera}
            onStopCam={stopCamera}
            camActive={!!stream}
          />
        )}

        {stage === "matching" && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 grid place-items-center gap-3">
            <Spinner/>
            <p className="text-neutral-300">Matching…</p>
          </div>
        )}

        {(stage === "incall" || stage === "consent" || stage === "waitingNewcomer") && (
          <div className="flex flex-col gap-3">
            <CallArea
              participants={participants}
              callVideoRef={callVideoRef}
              streamActive={!!stream}
              camOn={camOn}
              micOn={micOn}
              toggleAudio={toggleAudio}
              startCam={startCamera}
              stopCam={stopCamera}
            />

            <ControlBar
              stage={stage}
              onAddOne={startAddOne}
              onLeave={leaveBoard}
            />
          </div>
        )}
      </main>
    </div>
  );
}

// ===== UI components =====
function Header(){
  return (
    <header className="border-b border-neutral-800">
      <div className="max-w-6xl mx-auto px-4 h-12 flex items-center gap-3">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500"/>
        <h1 className="text-lg font-semibold tracking-tight">
          <span className="bg-gradient-to-r from-purple-400 to-purple-200 bg-clip-text text-transparent">Social</span>
          <span className="mx-1"/> 
          <span className="bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-transparent">Bored</span>
        </h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300">Frontend Beta</span>
      </div>
    </header>
  );
}

function StatusBar({ text, hint }:{ text:string; hint?:boolean }){
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/90 backdrop-blur px-3 py-2 text-sm text-neutral-200">
      {text}
      {hint && (
        <div className="text-xs text-neutral-400 mt-1">If video doesn't appear: allow permissions (lock icon), close Zoom/Discord/FaceTime, reload the page.</div>
      )}
    </div>
  );
}

function Lobby({ lobbyVideoRef, onStart, onStartCam, onStopCam, camActive }:{ lobbyVideoRef: React.RefObject<HTMLVideoElement>; onStart:()=>void; onStartCam:()=>Promise<boolean>; onStopCam:()=>void; camActive:boolean; }){
  return (
    <div className="grid gap-3 md:grid-cols-[1fr,150px] items-start">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Talk to someone new</h2>
        <p className="text-neutral-400 text-sm">Click Start to join a room. Your camera must be on to enter.</p>
        <div className="flex items-center gap-2">
          <button onClick={onStart} className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-400 hover:to-blue-400 text-neutral-900 font-semibold text-sm">Start</button>
          {!camActive ? (
            <button onClick={()=>onStartCam()} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm">Preview Camera</button>
          ):(
            <button onClick={onStopCam} className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-sm text-white">Stop Camera</button>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
        <div className="relative bg-black rounded-xl overflow-hidden aspect-video w-full max-w-[1000px] mx-auto">
          <video ref={lobbyVideoRef} className="w-full h-full object-cover"/>
          <div className="absolute top-2 left-2 text-xs px-2 py-1 rounded-full bg-neutral-800/70 text-neutral-200">You (preview)</div>
        </div>
      </div>
    </div>
  );
}

function CallArea({ participants, callVideoRef, streamActive, camOn, micOn, toggleAudio, startCam, stopCam }:{ participants:Participant[]; callVideoRef: React.RefObject<HTMLVideoElement>; streamActive:boolean; camOn:boolean; micOn:boolean; toggleAudio:()=>void; startCam:()=>Promise<boolean>; stopCam:()=>void; }){
  const cols = participants.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2";
  return (
    <div className={`grid ${cols} grid-cols-1 gap-3`}>
      {/* You */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
        <div className="aspect-[4/3] relative bg-black">
          <video ref={callVideoRef} className="w-full h-full object-cover"/>
          <div className="absolute top-1.5 left-1.5 text-xs px-2 py-0.5 rounded-full bg-neutral-800/70 text-neutral-200">You</div>
          {/* MUTED badge visible to everyone when your mic is off */}
          {!micOn && (
            <div className="absolute top-1.5 right-1.5 text-[10px] tracking-wide px-2 py-0.5 rounded-full bg-rose-600/90 text-white shadow">MUTED</div>
          )}
          <div className="absolute bottom-1.5 left-1.5 text-[10px] text-neutral-200/90">
            {streamActive ? `Video On • Mic ${micOn?"On":"Off"}` : "Camera required — click Start Camera"}
          </div>
        </div>
        <div className="p-2 border-t border-neutral-800 flex items-center gap-2">
          {/* Enforce cameras-on in room: only show Start if somehow off; no video toggle/stop here */}
          {!streamActive && <button onClick={startCam} className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-neutral-900 text-xs font-semibold">Start Camera</button>}
          <button onClick={toggleAudio} className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs">{micOn?"Mute":"Unmute"}</button>
        </div>
      </div>

      {/* Peers */}
      {participants.filter(p=>!p.isYou).map(p => (
        <div key={p.id} className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
          <div className="aspect-[4/3] relative grid place-items-center">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-600/50 to-blue-600/50 grid place-items-center text-base font-bold">{p.avatar}</div>
            <div className="absolute top-1.5 left-1.5 text-xs px-2 py-0.5 rounded-full bg-neutral-800/70 text-neutral-200">{p.name}</div>
            {/* Demo: show a tiny pulse in corner to feel "alive" */}
            <div className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse"/>
          </div>
          <div className="p-2 border-t border-neutral-800 text-xs text-neutral-400">Live (mock)</div>
        </div>
      ))}

      {participants.length === 2 && (
        <div className="rounded-xl border border-dashed border-neutral-700 bg-gradient-to-br from-purple-900/20 to-blue-900/20 grid place-items-center p-4 text-neutral-300">
          <div className="text-center text-sm">
            Seat open — use <span className="mx-1 px-2 py-0.5 rounded bg-neutral-800 text-xs">Add +1</span> to invite someone new
          </div>
        </div>
      )}
    </div>
  );
}

function ControlBar({ stage, onAddOne, onLeave }:{ stage:Stage; onAddOne:()=>void; onLeave:()=>void; }){
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-2.5 flex items-center justify-between">
      <div className="text-sm text-neutral-300">
        {stage === "incall" && "You're in a 1‑on‑1 board. Cameras required."}
        {stage === "consent" && "Consent in progress…"}
        {stage === "waitingNewcomer" && "Open seat published. Matching a newcomer…"}
      </div>
      <div className="flex items-center gap-2">
        {stage === "incall" && (
          <button onClick={onAddOne} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-400 hover:to-blue-400 text-neutral-900 text-sm font-semibold">Add +1</button>
        )}
        <button onClick={onLeave} className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm">Leave</button>
      </div>
    </div>
  );
}

function Spinner(){
  return <div className="h-8 w-8 rounded-full border-2 border-neutral-700 border-t-blue-400 animate-spin"/>;
}

// ===== Bubble animation layer =====
function BubbleLayer({ count = 28 }:{ count?: number }){
  const bubbles = Array.from({length:count}).map((_,i)=>{
    const size = Math.floor(Math.random()*22)+10; // 10—32px (bigger)
    const left = Math.random()*100;              // percent
    const delay = Math.random()*1.2;             // seconds
    const duration = 2.2 + Math.random()*3.2;    // 2.2—5.4s (linger longer)
    const opacity = 0.45 + Math.random()*0.4;    // 0.45—0.85 (more visible)
    return (
      <span key={i} className="bubble" style={{
        left: `${left}%`, width: size, height: size,
        animationDelay: `${delay}s`, animationDuration: `${duration}s`, opacity
      }}/>
    );
  });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        .bubble { position:absolute; bottom:-28px; border-radius:9999px; 
          background: radial-gradient(ellipse at 30% 30%, rgba(168, 85, 247, .85), rgba(59, 130, 246, .35));
          box-shadow: 0 0 8px rgba(147, 197, 253, 0.25);
          filter: saturate(1.1);
        }
        @keyframes floatUp { 
          0% { transform: translateY(0) scale(.9); }
          100% { transform: translateY(-120vh) scale(1.08); opacity: 0; }
        }
        .bubble { animation-name: floatUp; animation-timing-function: cubic-bezier(.22,.61,.36,1); }
      `}</style>
      {bubbles}
    </div>
  );
}