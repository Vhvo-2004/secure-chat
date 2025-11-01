"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"

interface User {
  id: string
  username: string
  friends: string[]
}

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => boolean
  register: (username: string, password: string) => boolean
  logout: () => void
  addFriend: (friendUsername: string) => boolean
  removeFriend: (friendUsername: string) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Verificar se há usuário logado no localStorage
    const storedUser = localStorage.getItem("currentUser")
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
  }, [])

  const register = (username: string, password: string): boolean => {
    const users = JSON.parse(localStorage.getItem("users") || "[]")

    // Verificar se usuário já existe
    if (users.find((u: any) => u.username === username)) {
      return false
    }

    const newUser = {
      id: Date.now().toString(),
      username,
      password,
      friends: [],
    }

    users.push(newUser)
    localStorage.setItem("users", JSON.stringify(users))
    return true
  }

  const login = (username: string, password: string): boolean => {
    const users = JSON.parse(localStorage.getItem("users") || "[]")
    const foundUser = users.find((u: any) => u.username === username && u.password === password)

    if (foundUser) {
      const userWithoutPassword = {
        id: foundUser.id,
        username: foundUser.username,
        friends: foundUser.friends || [],
      }
      setUser(userWithoutPassword)
      localStorage.setItem("currentUser", JSON.stringify(userWithoutPassword))
      return true
    }
    return false
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("currentUser")
    router.push("/login")
  }

  const addFriend = (friendUsername: string): boolean => {
    if (!user) return false

    const users = JSON.parse(localStorage.getItem("users") || "[]")
    const friendUser = users.find((u: any) => u.username === friendUsername)

    if (!friendUser || friendUser.username === user.username) {
      return false
    }

    if (user.friends.includes(friendUsername)) {
      return false
    }

    const updatedFriends = [...user.friends, friendUsername]
    const updatedUser = { ...user, friends: updatedFriends }

    // Atualizar no localStorage
    const userIndex = users.findIndex((u: any) => u.id === user.id)
    users[userIndex].friends = updatedFriends
    localStorage.setItem("users", JSON.stringify(users))
    localStorage.setItem("currentUser", JSON.stringify(updatedUser))

    setUser(updatedUser)
    return true
  }

  const removeFriend = (friendUsername: string) => {
    if (!user) return

    const updatedFriends = user.friends.filter((f) => f !== friendUsername)
    const updatedUser = { ...user, friends: updatedFriends }

    // Atualizar no localStorage
    const users = JSON.parse(localStorage.getItem("users") || "[]")
    const userIndex = users.findIndex((u: any) => u.id === user.id)
    users[userIndex].friends = updatedFriends
    localStorage.setItem("users", JSON.stringify(users))
    localStorage.setItem("currentUser", JSON.stringify(updatedUser))

    setUser(updatedUser)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, addFriend, removeFriend }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
