"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LogOut, UserPlus, Users, MessageSquare, Trash2 } from "lucide-react"

export default function HomePage() {
  const { user, logout, addFriend, removeFriend } = useAuth()
  const router = useRouter()
  const [friendUsername, setFriendUsername] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    if (!user) {
      router.push("/login")
    }
  }, [user, router])

  if (!user) {
    return null
  }

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!friendUsername.trim()) {
      setError("Digite o nome de um usuário")
      return
    }

    const added = addFriend(friendUsername)
    if (added) {
      setSuccess(`${friendUsername} foi adicionado aos seus amigos!`)
      setFriendUsername("")
    } else {
      setError("Usuário não encontrado, já é seu amigo ou é você mesmo")
    }
  }

  const handleRemoveFriend = (friendName: string) => {
    removeFriend(friendName)
    setSuccess(`${friendName} foi removido dos seus amigos`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-balance">Olá, {user.username}!</h1>
            <p className="text-muted-foreground">Gerencie seus amigos e acesse o chat</p>
          </div>
          <Button variant="outline" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>

        {/* Ações Rápidas */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card
            className="border-primary/20 hover:border-primary/40 transition-colors cursor-pointer"
            onClick={() => router.push("/chat")}
          >
            <CardHeader>
              <MessageSquare className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Ir para o Chat</CardTitle>
              <CardDescription>Acesse seus grupos e converse com amigos</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-accent/20">
            <CardHeader>
              <Users className="h-8 w-8 text-accent mb-2" />
              <CardTitle>{user.friends.length} Amigos</CardTitle>
              <CardDescription>Adicione mais amigos para conversar</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Adicionar Amigo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Adicionar Amigo
            </CardTitle>
            <CardDescription>Digite o nome de usuário para adicionar aos seus amigos</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddFriend} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-500/50 bg-green-500/10">
                  <AlertDescription className="text-green-500">{success}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder="Nome do usuário"
                  value={friendUsername}
                  onChange={(e) => setFriendUsername(e.target.value)}
                />
                <Button type="submit">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Lista de Amigos */}
        <Card>
          <CardHeader>
            <CardTitle>Seus Amigos</CardTitle>
            <CardDescription>
              {user.friends.length === 0
                ? "Você ainda não tem amigos adicionados"
                : `${user.friends.length} amigo${user.friends.length > 1 ? "s" : ""} adicionado${user.friends.length > 1 ? "s" : ""}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.friends.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Adicione amigos para começar a conversar</p>
              </div>
            ) : (
              <div className="space-y-2">
                {user.friends.map((friend) => (
                  <div
                    key={friend}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary">{friend.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="font-medium">{friend}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveFriend(friend)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
