"use client"

import { useState, useEffect } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { ScrollArea } from "./ui/scroll-area"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { Send, UserPlus, UserMinus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog"
import { Label } from "./ui/label"
import { Badge } from "./ui/badge"

interface Message {
  id: string
  sender: string
  content: string
  timestamp: Date
  encrypted?: boolean
}

interface ChatAreaProps {
  selectedGroup: string | null
}

export function ChatArea({ selectedGroup }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [members, setMembers] = useState<string[]>(["João", "Maria", "Pedro"])
  const [newMember, setNewMember] = useState("")
  const [removeMember, setRemoveMember] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)

  useEffect(() => {
    if (selectedGroup) {
      // Simular mensagens do grupo
      setMessages([
        {
          id: "1",
          sender: "João",
          content: "Olá pessoal! Como estão?",
          timestamp: new Date(Date.now() - 3600000),
        },
        {
          id: "2",
          sender: "Maria",
          content: "Tudo bem! Trabalhando no projeto.",
          timestamp: new Date(Date.now() - 1800000),
          encrypted: true,
        },
        {
          id: "3",
          sender: "Pedro",
          content: "Ótimo! Vamos alinhar os próximos passos.",
          timestamp: new Date(Date.now() - 900000),
        },
      ])
    }
  }, [selectedGroup])

  const handleSendMessage = () => {
    if (newMessage.trim() && selectedGroup) {
      const message: Message = {
        id: Date.now().toString(),
        sender: "Você",
        content: newMessage,
        timestamp: new Date(),
        encrypted: Math.random() > 0.5, // Simular criptografia aleatória
      }
      setMessages([...messages, message])
      setNewMessage("")
    }
  }

  const handleAddMember = () => {
    if (newMember.trim() && !members.includes(newMember)) {
      setMembers([...members, newMember])
      setNewMember("")
      setIsAddDialogOpen(false)
    }
  }

  const handleRemoveMember = () => {
    if (removeMember) {
      setMembers(members.filter((m) => m !== removeMember))
      setRemoveMember("")
      setIsRemoveDialogOpen(false)
    }
  }

  if (!selectedGroup) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">💬</div>
          <h2 className="text-2xl font-semibold text-foreground mb-2">Selecione um Grupo</h2>
          <p className="text-muted-foreground">Escolha um grupo na lista para começar a conversar</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Grupo Selecionado</h2>
            <p className="text-sm text-muted-foreground">{members.length} membros</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <UserPlus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Membro</DialogTitle>
                  <DialogDescription>Digite o nome do usuário para adicionar ao grupo</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="member">Nome do Usuário</Label>
                    <Input
                      id="member"
                      value={newMember}
                      onChange={(e) => setNewMember(e.target.value)}
                      placeholder="Ex: Carlos"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddMember}>Adicionar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <UserMinus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Remover Membro</DialogTitle>
                  <DialogDescription>Selecione um membro para remover do grupo</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="remove-member">Membros</Label>
                    <select
                      id="remove-member"
                      value={removeMember}
                      onChange={(e) => setRemoveMember(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="">Selecione um membro</option>
                      {members.map((member) => (
                        <option key={member} value={member}>
                          {member}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleRemoveMember} variant="destructive">
                    Remover
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {members.map((member) => (
            <Badge key={member} variant="secondary">
              {member}
            </Badge>
          ))}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.sender === "Você" ? "flex-row-reverse" : ""}`}>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {message.sender[0]}
                </AvatarFallback>
              </Avatar>
              <div className={`flex flex-col ${message.sender === "Você" ? "items-end" : "items-start"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground">{message.sender}</span>
                  <span className="text-xs text-muted-foreground">
                    {message.timestamp.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {message.encrypted && (
                    <Badge
                      variant="outline"
                      className="text-xs bg-crypto-highlight/10 text-crypto-highlight border-crypto-highlight/30"
                    >
                      🔒 Criptografado
                    </Badge>
                  )}
                </div>
                <div
                  className={`rounded-lg px-4 py-2 max-w-md ${
                    message.sender === "Você" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-2">
          <Input
            placeholder="Digite sua mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            className="flex-1"
          />
          <Button onClick={handleSendMessage} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
