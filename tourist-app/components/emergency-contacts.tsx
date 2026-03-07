"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Phone, User, ArrowLeft, Shield } from "lucide-react"

interface EmergencyContact {
  id: string
  name: string
  phone: string
  relationship: string
  priority: "high" | "medium" | "low"
}

interface EmergencyContactsProps {
  onBack: () => void
}

export function EmergencyContacts({ onBack }: EmergencyContactsProps) {
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [newContact, setNewContact] = useState<Omit<EmergencyContact, 'id'>>({
    name: "",
    phone: "",
    relationship: "",
    priority: "medium",
  })

  const handleAddContact = () => {
    if (newContact.name && newContact.phone) {
      const contact: EmergencyContact = {
        id: Date.now().toString(),
        ...newContact,
      }
      setContacts([...contacts, contact])
      setNewContact({ name: "", phone: "", relationship: "", priority: "medium" })
      setIsAdding(false)
    }
  }

  const handleDeleteContact = (id: string) => {
    setContacts(contacts.filter((c) => c.id !== id))
  }

  const handleCall = (phone: string) => {
    if (typeof window !== 'undefined') {
      window.location.href = `tel:${phone}`
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-destructive/20 text-destructive border-destructive/30"
      case "medium":
        return "bg-secondary/20 text-secondary border-secondary/30"
      case "low":
        return "bg-muted/20 text-muted-foreground border-muted/30"
      default:
        return "bg-muted/20 text-muted-foreground border-muted/30"
    }
  }

  // Load/save to localStorage so SOS can access these
  useEffect(() => {
    try {
      const raw = localStorage.getItem('emergency_contacts')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setContacts(parsed)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('emergency_contacts', JSON.stringify(contacts))
    } catch {}
  }, [contacts])

  return (
    <div className="min-h-screen p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="bg-card/30 backdrop-blur-md border border-border/50"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Emergency Contacts</h1>
          <p className="text-sm text-muted-foreground">Manage your emergency contact list</p>
        </div>
      </div>

      {/* Add Contact Button */}
      {!isAdding && (
        <Button onClick={() => setIsAdding(true)} className="w-full shadow-[0_0_20px_rgba(0,255,136,0.3)]" size="lg">
          <Plus className="w-5 h-5 mr-2" />
          Add Emergency Contact
        </Button>
      )}

      {/* Add Contact Form */}
      {isAdding && (
        <Card className="bg-card/40 backdrop-blur-xl border border-border/60 rounded-xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <h3 className="font-semibold mb-4">Add New Contact</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="Enter contact name"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                className="bg-card/30 backdrop-blur-md border border-border/50 bg-transparent"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                placeholder="+15550123 (E.164 format recommended)"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                className="bg-card/30 backdrop-blur-md border border-border/50 bg-transparent"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relationship">Relationship</Label>
              <Input
                id="relationship"
                placeholder="Family, Friend, Official, etc."
                value={newContact.relationship}
                onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                className="bg-card/30 backdrop-blur-md border border-border/50 bg-transparent"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority Level</Label>
              <select
                id="priority"
                value={newContact.priority}
                onChange={(e) =>
                  setNewContact({ ...newContact, priority: e.target.value as "high" | "medium" | "low" })
                }
                className="w-full p-2 bg-card/30 backdrop-blur-md border border-border/50 bg-transparent rounded-md"
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleAddContact} className="flex-1 bg-primary hover:bg-primary/90">
                Add Contact
              </Button>
              <Button
                onClick={() => setIsAdding(false)}
                variant="outline"
                className="flex-1 bg-card/30 backdrop-blur-md border border-border/50"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Contacts List */}
      <div className="space-y-4">
        {contacts.map((contact) => (
          <Card
            key={contact.id}
            className="bg-card/40 backdrop-blur-xl border border-border/60 rounded-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-sm text-muted-foreground">{contact.phone}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {contact.relationship}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${getPriorityColor(contact.priority)}`}>
                      {contact.priority} priority
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleCall(contact.phone)}
                  className="bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(0,255,136,0.3)]"
                  size="sm"
                >
                  <Phone className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => handleDeleteContact(contact.id)}
                  variant="outline"
                  className="bg-card/30 backdrop-blur-md border border-destructive/30 text-destructive hover:bg-destructive/10"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Emergency Services */}
      <Card className="bg-card/40 backdrop-blur-xl border border-border/60 rounded-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Emergency Services
        </h3>
        <div className="space-y-3">
          {[
            { name: "Police", number: "100", icon: "🚔" },
            { name: "Fire Department", number: "101", icon: "🚒" },
            { name: "Ambulance", number: "108", icon: "🚑" },
            { name: "Tourist Helpline", number: "1363", icon: "📞" },
          ].map((service, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-card/30 backdrop-blur-md border border-border/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{service.icon}</span>
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-sm text-muted-foreground">{service.number}</p>
                </div>
              </div>
              <Button
                onClick={() => handleCall(service.number)}
                className="bg-destructive hover:bg-destructive/90 shadow-[0_0_30px_rgba(255,68,68,0.4)]"
                size="sm"
              >
                Call
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
