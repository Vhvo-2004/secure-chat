import { useState } from 'react';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import Tabs from '../ui/Tabs.jsx';
import Badge from '../ui/Badge.jsx';

function caesarCipher(text, shift) {
  return text
    .split('')
    .map((char) => {
      if (!/[a-z]/i.test(char)) return char;
      const code = char.charCodeAt(0);
      const base = code >= 65 && code <= 90 ? 65 : 97;
      return String.fromCharCode(((code - base + shift + 26) % 26) + base);
    })
    .join('');
}

function base64Encode(text) {
  try {
    return btoa(unescape(encodeURIComponent(text)));
  } catch (error) {
    console.warn('Erro ao codificar Base64', error);
    return '';
  }
}

function base64Decode(text) {
  try {
    return decodeURIComponent(escape(atob(text)));
  } catch (error) {
    console.warn('Erro ao decodificar Base64', error);
    return 'Entrada inválida para Base64';
  }
}

export default function CryptoPanel() {
  const [plainText, setPlainText] = useState('');
  const [encryptedText, setEncryptedText] = useState('');
  const [logs, setLogs] = useState([]);

  const appendLog = (operation, input, output, algorithm) => {
    const entry = {
      id: crypto.randomUUID(),
      operation,
      input,
      output,
      algorithm,
      timestamp: new Date(),
    };
    setLogs((prev) => [entry, ...prev]);
  };

  const handleEncrypt = (algorithm) => {
    if (!plainText) return;
    if (algorithm === 'caesar') {
      const result = caesarCipher(plainText, 3);
      setEncryptedText(result);
      appendLog('Criptografia', plainText, result, 'Cifra de César (+3)');
    } else {
      const result = base64Encode(plainText);
      setEncryptedText(result);
      appendLog('Criptografia', plainText, result, 'Base64');
    }
  };

  const handleDecrypt = (algorithm) => {
    if (!encryptedText) return;
    if (algorithm === 'caesar') {
      const result = caesarCipher(encryptedText, -3);
      setPlainText(result);
      appendLog('Descriptografia', encryptedText, result, 'Cifra de César (-3)');
    } else {
      const result = base64Decode(encryptedText);
      setPlainText(result);
      appendLog('Descriptografia', encryptedText, result, 'Base64');
    }
  };

  return (
    <div className="crypto-panel">
      <div className="crypto-header">
        <h2 style={{ margin: 0 }}>Diário criptográfico</h2>
        <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>
          Experimente operações simples de criptografia durante as conversas.
        </p>
      </div>
      <div className="crypto-body">
        <div className="crypto-entry">
          <Tabs
            defaultValue="encrypt"
            tabs={[
              {
                value: 'encrypt',
                label: 'Criptografar',
                content: (
                  <div style={{ display: 'grid', gap: '0.9rem' }}>
                    <div>
                      <label className="label" htmlFor="plain-text">
                        Texto original
                      </label>
                      <Input
                        id="plain-text"
                        value={plainText}
                        onChange={(event) => setPlainText(event.target.value)}
                        placeholder="Digite algo para criptografar"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="encrypted-output">
                        Saída
                      </label>
                      <Input
                        id="encrypted-output"
                        value={encryptedText}
                        readOnly
                        placeholder="Resultado aparecerá aqui"
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <Button onClick={() => handleEncrypt('caesar')}>Cifra de César</Button>
                      <Button variant="secondary" onClick={() => handleEncrypt('base64')}>
                        Base64
                      </Button>
                    </div>
                  </div>
                ),
              },
              {
                value: 'decrypt',
                label: 'Descriptografar',
                content: (
                  <div style={{ display: 'grid', gap: '0.9rem' }}>
                    <div>
                      <label className="label" htmlFor="encrypted-input">
                        Texto criptografado
                      </label>
                      <Input
                        id="encrypted-input"
                        value={encryptedText}
                        onChange={(event) => setEncryptedText(event.target.value)}
                        placeholder="Cole aqui um texto criptografado"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="plain-output">
                        Resultado
                      </label>
                      <Input id="plain-output" value={plainText} readOnly placeholder="Resultado aparecerá aqui" />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <Button onClick={() => handleDecrypt('caesar')}>Cifra de César</Button>
                      <Button variant="secondary" onClick={() => handleDecrypt('base64')}>
                        Base64
                      </Button>
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </div>

        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Histórico de operações <Badge variant="outline">{logs.length}</Badge>
          </h3>
          <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>
            As ações ficam registradas apenas localmente para fins educativos.
          </p>
          <div className="crypto-log">
            {logs.length === 0 ? (
              <div className="text-muted">Nenhuma operação registrada ainda.</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="crypto-log-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <strong>{log.operation}</strong>
                    <small>{log.timestamp.toLocaleTimeString('pt-BR')}</small>
                  </div>
                  <div className="text-muted">{log.algorithm}</div>
                  <div style={{ fontSize: '0.85rem' }}>
                    <div>
                      <strong>Entrada:</strong> {log.input || '—'}
                    </div>
                    <div>
                      <strong>Saída:</strong> {log.output || '—'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

