"use client"

import { useState } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { ScrollArea } from "./ui/scroll-area"
import { Plus, Users, Search } from "lucide-react"
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

interface Group {
  id: string
  name: string
  members: string[]
}

interface GroupListProps {
  selectedGroup: string | null
  onSelectGroup: (groupId: string) => void
}

export function GroupList({ selectedGroup, onSelectGroup }: GroupListProps) {
  const [groups, setGroups] = useState<Group[]>([
    { id: "1", name: "Equipe de Desenvolvimento", members: ["João", "Maria", "Pedro"] },
    { id: "2", name: "Projeto Alpha", members: ["Ana", "Carlos"] },
    { id: "3", name: "Discussão Geral", members: ["João", "Maria", "Ana", "Carlos", "Pedro"] },
  ])
  const [newGroupName, setNewGroupName] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleCreateGroup = () => {
    if (newGroupName.trim()) {
      const newGroup: Group = {
        id: Date.now().toString(),
        name: newGroupName,
        members: [],
      }
      setGroups([...groups, newGroup])
      setNewGroupName("")
      setIsDialogOpen(false)
    }
  }

  const filteredGroups = groups.filter((group) => group.name.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-foreground">Grupos</h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="default">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Grupo</DialogTitle>
                <DialogDescription>Digite o nome do novo grupo de chat</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome do Grupo</Label>
                  <Input
                    id="name"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Ex: Equipe de Marketing"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateGroup}>Criar Grupo</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar grupos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredGroups.map((group) => (
            <button
              key={group.id}
              onClick={() => onSelectGroup(group.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                selectedGroup === group.id ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-full ${selectedGroup === group.id ? "bg-primary-foreground/20" : "bg-muted"}`}
                >
                  <Users className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{group.name}</div>
                  <div
                    className={`text-sm truncate ${
                      selectedGroup === group.id ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {group.members.length} membros
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
