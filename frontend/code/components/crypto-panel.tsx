"use client"

import { useState } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { ScrollArea } from "./ui/scroll-area"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Lock, Unlock, Key, Shield } from "lucide-react"

interface CryptoLog {
  id: string
  operation: string
  input: string
  output: string
  timestamp: Date
  algorithm: string
}

export function CryptoPanel() {
  const [plainText, setPlainText] = useState("")
  const [encryptedText, setEncryptedText] = useState("")
  const [cryptoLogs, setCryptoLogs] = useState<CryptoLog[]>([])

  // Função simples de criptografia Caesar Cipher para demonstração
  const caesarCipher = (text: string, shift: number): string => {
    return text
      .split("")
      .map((char) => {
        if (char.match(/[a-z]/i)) {
          const code = char.charCodeAt(0)
          const isUpperCase = code >= 65 && code <= 90
          const base = isUpperCase ? 65 : 97
          return String.fromCharCode(((code - base + shift) % 26) + base)
        }
        return char
      })
      .join("")
  }

  // Função simples de Base64 para demonstração
  const base64Encode = (text: string): string => {
    return btoa(unescape(encodeURIComponent(text)))
  }

  const base64Decode = (text: string): string => {
    try {
      return decodeURIComponent(escape(atob(text)))
    } catch {
      return "Erro ao decodificar"
    }
  }

  const handleEncrypt = (algorithm: "caesar" | "base64") => {
    let result = ""
    let algName = ""

    if (algorithm === "caesar") {
      result = caesarCipher(plainText, 3)
      algName = "Caesar Cipher (shift 3)"
    } else {
      result = base64Encode(plainText)
      algName = "Base64"
    }

    setEncryptedText(result)

    const log: CryptoLog = {
      id: Date.now().toString(),
      operation: "Criptografia",
      input: plainText,
      output: result,
      timestamp: new Date(),
      algorithm: algName,
    }

    setCryptoLogs([log, ...cryptoLogs])
  }

  const handleDecrypt = (algorithm: "caesar" | "base64") => {
    let result = ""
    let algName = ""

    if (algorithm === "caesar") {
      result = caesarCipher(encryptedText, -3)
      algName = "Caesar Cipher (shift -3)"
    } else {
      result = base64Decode(encryptedText)
      algName = "Base64"
    }

    setPlainText(result)

    const log: CryptoLog = {
      id: Date.now().toString(),
      operation: "Descriptografia",
      input: encryptedText,
      output: result,
      timestamp: new Date(),
      algorithm: algName,
    }

    setCryptoLogs([log, ...cryptoLogs])
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Shield className="h-5 w-5 text-crypto-highlight" />
                Operações de Criptografia
              </CardTitle>
              <CardDescription>Demonstração de algoritmos de criptografia</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="encrypt" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="encrypt">
                    <Lock className="h-4 w-4 mr-2" />
                    Criptografar
                  </TabsTrigger>
                  <TabsTrigger value="decrypt">
                    <Unlock className="h-4 w-4 mr-2" />
                    Descriptografar
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="encrypt" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="plain">Texto Original</Label>
                    <Input
                      id="plain"
                      value={plainText}
                      onChange={(e) => setPlainText(e.target.value)}
                      placeholder="Digite o texto para criptografar"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="encrypted-output">Texto Criptografado</Label>
                    <Input
                      id="encrypted-output"
                      value={encryptedText}
                      readOnly
                      placeholder="Resultado aparecerá aqui"
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleEncrypt("caesar")} className="flex-1" variant="default">
                      Caesar Cipher
                    </Button>
                    <Button onClick={() => handleEncrypt("base64")} className="flex-1" variant="secondary">
                      Base64
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="decrypt" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="encrypted">Texto Criptografado</Label>
                    <Input
                      id="encrypted"
                      value={encryptedText}
                      onChange={(e) => setEncryptedText(e.target.value)}
                      placeholder="Digite o texto para descriptografar"
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plain-output">Texto Original</Label>
                    <Input id="plain-output" value={plainText} readOnly placeholder="Resultado aparecerá aqui" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleDecrypt("caesar")} className="flex-1" variant="default">
                      Caesar Cipher
                    </Button>
                    <Button onClick={() => handleDecrypt("base64")} className="flex-1" variant="secondary">
                      Base64
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Key className="h-5 w-5 text-crypto-highlight" />
                Histórico de Operações
              </CardTitle>
              <CardDescription>Registro de todas as operações realizadas</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {cryptoLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma operação realizada ainda</p>
                  ) : (
                    cryptoLogs.map((log) => (
                      <div key={log.id} className="p-3 rounded-lg bg-muted border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-foreground">{log.operation}</span>
                          <span className="text-xs text-muted-foreground">
                            {log.timestamp.toLocaleTimeString("pt-BR")}
                          </span>
                        </div>
                        <div className="text-xs text-crypto-highlight mb-2">{log.algorithm}</div>
                        <div className="space-y-1">
                          <div className="text-xs">
                            <span className="text-muted-foreground">Entrada: </span>
                            <span className="font-mono text-foreground break-all">
                              {log.input.substring(0, 30)}
                              {log.input.length > 30 ? "..." : ""}
                            </span>
                          </div>
                          <div className="text-xs">
                            <span className="text-muted-foreground">Saída: </span>
                            <span className="font-mono text-foreground break-all">
                              {log.output.substring(0, 30)}
                              {log.output.length > 30 ? "..." : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}
