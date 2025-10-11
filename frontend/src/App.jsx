// App.jsx
import React, { useState } from "react";
import { generateBundle, getPublicBundle, performX3DHInitiatorAndCreatePacket, performX3DHResponderAndDecrypt } from "./crypto/x3dh";
import { toB64 } from "./crypto/utils";

export default function App() {
  const [alice, setAlice] = useState(null);
  const [bob, setBob] = useState(null);
  const [serverStore, setServerStore] = useState({ users: {}, initialPackets: [] });
  const [logs, setLogs] = useState([]);

  function log(...args) {
    setLogs(l => [...l, args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")]);
  }

  // 💡 Detecta tema do SO para ajustar contraste automaticamente
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  // 🎨 Estilos com contraste explícito (não herda branco do body)
  const serverBoxStyle = {
    padding: 12,
    border: "1px solid #ddd",
    borderRadius: 8,
    minWidth: 420,
    background: prefersDark ? "#0b0b0b" : "#f9fafb",
    color: prefersDark ? "#e5e7eb" : "#111827",
  };

  const serverPreStyle = {
    maxHeight: 260,
    overflow: "auto",
    fontSize: 12,
    margin: 0,
    background: "transparent",
    color: "inherit",          // 👈 herda do container acima
    whiteSpace: "pre-wrap",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    lineHeight: 1.45,
  };

  const logsBoxStyle = {
    height: 300,
    overflow: "auto",
    border: "1px solid #ccc",
    padding: 8,
    borderRadius: 8,
    background: prefersDark ? "#0b0b0b" : "#f9fafb",
    color: prefersDark ? "#e5e7eb" : "#111827", // 👈 força a cor do texto
  };

  const logLineStyle = {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    whiteSpace: "pre-wrap",
    lineHeight: 1.45,
    marginBottom: 6,
    color: "inherit", // 👈 garante que não herda branco de fora
    background: "transparent",
  };

  // ... resto do código (handlers) permanece igual ...

  function handleGenerateAlice() {
    const b = generateBundle(3);
    setAlice(b);
    log("Alice: bundle gerado (pares privados).");
  }
  function handleGenerateBob() {
    const b = generateBundle(4);
    setBob(b);
    log("Bob: bundle gerado (pares privados).");
  }
  function handlePublishBob() {
    if (!bob) { log("Gerar Bob primeiro."); return; }
    const pub = getPublicBundle(bob);
    const opkRecords = pub.oneTimePreKeys.map((pubk, i) => ({ opk_id: `opk-${Date.now()}-${i}`, pub: pubk, consumed: false }));
    const userRecord = {
      username: "bob",
      identityKeyBox: pub.identityKeyBox,
      identityKeySign: pub.identityKeySign,
      signedPreKey: pub.signedPreKey,
      signature: pub.signature,
      opks: opkRecords
    };
    setServerStore(s => ({ ...s, users: { ...s.users, bob: userRecord } }));
    log("Servidor: bundle público do Bob publicado. OPKs:", opkRecords.length);
  }
  function fetchBobBundleFromServer() {
    const s = serverStore;
    const user = s.users["bob"];
    if (!user) { log("Servidor: Bob não encontrado (publique o bundle)."); return null; }
    const idx = user.opks.findIndex(o => !o.consumed);
    let opkItem = null;
    if (idx >= 0) {
      opkItem = { opk_id: user.opks[idx].opk_id, pub: user.opks[idx].pub, index: idx };
      const newOpks = user.opks.slice();
      newOpks[idx] = { ...newOpks[idx], consumed: true };
      const newUser = { ...user, opks: newOpks };
      setServerStore(s => ({ ...s, users: { ...s.users, bob: newUser } }));
      log("Servidor: entregou e marcou OPK como consumido:", opkItem.opk_id);
    } else {
      log("Servidor: nenhum OPK disponível, devolvendo bundle sem OPK.");
    }
    return {
      identityKeyBox: user.identityKeyBox,
      identityKeySign: user.identityKeySign,
      signedPreKey: user.signedPreKey,
      signature: user.signature,
      oneTimePreKeys: opkItem ? [opkItem.pub] : []
    };
  }
  async function handleAliceInitiate() {
    if (!alice) { log("Gerar Alice primeiro."); return; }
    const bobBundle = fetchBobBundleFromServer();
    if (!bobBundle) { log("Falha ao obter bundle de Bob."); return; }
    try {
      const { packet } = await performX3DHInitiatorAndCreatePacket(alice, bobBundle, 0);
      log("Alice: packet criado (ciphertext, EK_A_pub).");
      setServerStore(s => ({ ...s, initialPackets: [...s.initialPackets, { to: "bob", from: "alice", packet }] }));
      log("Alice: packet enviado ao servidor para Bob.");
    } catch (e) {
      log("Erro no initiator:", e.message);
    }
  }
  async function deliverPacketsToBob() {
    const s = serverStore;
    const queue = s.initialPackets.filter(p => p.to === "bob");
    if (queue.length === 0) { log("Servidor: sem packets para Bob."); return; }
    if (!bob) { log("Gerar Bob primeiro."); return; }
    for (const entry of queue) {
      log("Servidor: entregando packet para Bob...");
      const packet = entry.packet;
      try {
        const res = await performX3DHResponderAndDecrypt(bob, packet);
        log("Bob: payload decifrado:", res.payload);
        log("Bob: sessão estabelecida (rootKey derivada). OPK usado index:", res.used_opk_index);
      } catch (err) {
        log("Bob: erro ao processar packet:", err.message);
      }
    }
    setServerStore(s => ({ ...s, initialPackets: [] }));
  }

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h2>X3DH - Demo Frontend (simulado)</h2>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <h3>Ações Alice/Bob</h3>
          <button onClick={handleGenerateAlice}>Gerar Alice (pares)</button><br /><br />
          <button onClick={handleGenerateBob}>Gerar Bob (pares)</button><br /><br />
          <button onClick={handlePublishBob}>Publicar Bob no "banco" (simulado)</button><br /><br />
          <button onClick={handleAliceInitiate}>Alice inicia X3DH (cria & envia packet)</button><br /><br />
          <button onClick={deliverPacketsToBob}>Servidor entrega packets para Bob</button>
        </div>

        <div style={serverBoxStyle}>
          <h3>Servidor (simulado)</h3>
          <pre style={serverPreStyle}>
            {JSON.stringify(serverStore, null, 2)}
          </pre>
        </div>
      </div>

      <h3>Logs</h3>
      <div style={logsBoxStyle}>
        {logs.map((l, i) => (
          <div key={i} style={logLineStyle}>{l}</div>
        ))}
      </div>
    </div>
  );
}
