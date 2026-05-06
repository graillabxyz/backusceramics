"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Workshop } from "@/lib/classes-data"
import { MessageCircle, Users, Calendar as CalendarIcon, Clock } from "lucide-react"

interface BookingModalProps {
  workshop: Workshop
  children: React.ReactNode
}

export function BookingModal({ workshop, children }: BookingModalProps) {
  const [people, setPeople] = useState("1")
  const [time, setTime] = useState(workshop.schedule?.[0] || "")
  const [date, setDate] = useState("")
  const [isOpen, setIsOpen] = useState(false)

  const handleWhatsAppBooking = () => {
    const message = `Hi Backus Ceramics! I'd like to book the "${workshop.title}" for ${people} ${parseInt(people) === 1 ? 'person' : 'people'}.${date ? ` Requested date: ${date}.` : ''}${time ? ` Preferred time: ${time}.` : ''}`
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/6282145890402?text=${encodedMessage}`
    
    window.open(whatsappUrl, "_blank")
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading font-bold">Book your Class</DialogTitle>
          <DialogDescription>
            Select your preferred time and group size for {workshop.title}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="people" className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Number of People
            </Label>
            <Select value={people} onValueChange={setPeople}>
              <SelectTrigger id="people">
                <SelectValue placeholder="Select count" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} {num === 1 ? 'Person' : 'People'}
                  </SelectItem>
                ))}
                <SelectItem value="7+">7+ People (Group Inquiry)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="date" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              Preferred Date
            </Label>
            <Input 
              id="date" 
              type="date" 
              className="w-full"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {workshop.schedule && workshop.schedule.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="time" className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Available Sessions
              </Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger id="time">
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {workshop.schedule.map((session) => (
                    <SelectItem key={session} value={session}>
                      {session}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            onClick={handleWhatsAppBooking} 
            className="w-full h-12 text-lg gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white border-none"
          >
            <MessageCircle className="h-5 w-5" />
            Book via WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
