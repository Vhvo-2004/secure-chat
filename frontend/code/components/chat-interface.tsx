"use client"

import { useState } from "react"
import { GroupList } from "./group-list"
import { ChatArea } from "./chat-area"
import { CryptoPanel } from "./crypto-panel"
import { Button } from "./ui/button"
import { PanelRightClose, PanelRightOpen } from "lucide-react"

export function ChatInterface() {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [showCryptoPanel, setShowCryptoPanel] = useState(true)

  return (
    <div className="flex h-full w-full bg-background">
      {/* Lista de Grupos */}
      <div className="w-80 border-r border-border bg-card">
        <GroupList selectedGroup={selectedGroup} onSelectGroup={setSelectedGroup} />
      </div>

      {/* Área de Chat */}
      <div className="flex-1 flex flex-col">
        <ChatArea selectedGroup={selectedGroup} />
      </div>

      {/* Painel de Criptografia */}
      {showCryptoPanel ? (
        <div className="w-96 border-l border-border bg-card">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Diário Criptográfico</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowCryptoPanel(false)}>
              <PanelRightClose className="h-4 w-4" />
            </Button>
          </div>
          <CryptoPanel />
        </div>
      ) : (
        <div className="absolute top-4 right-4">
          <Button variant="outline" size="icon" onClick={() => setShowCryptoPanel(true)}>
            <PanelRightOpen className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
