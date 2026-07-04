import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Megaphone,
  Plus,
  Send,
  Trash2,
  CheckCircle2,
  Info,
  PlugZap,
  Mail,
  AlertCircle,
  Clock,
} from "lucide-react";
import { FaWhatsapp, FaFacebookMessenger, FaInstagram, FaSms } from "react-icons/fa";
import { useListCustomers } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  useCampaigns,
  useCreateCampaign,
  useDeleteCampaign,
  useSendCampaign,
  type CampaignChannel,
  type CampaignStatus,
} from "@/lib/api-extra";

const CHANNELS: { value: CampaignChannel; label: string; icon: React.ReactNode }[] = [
  { value: "whatsapp", label: "WhatsApp", icon: <FaWhatsapp className="h-3.5 w-3.5 text-emerald-500" /> },
  { value: "messenger", label: "Messenger", icon: <FaFacebookMessenger className="h-3.5 w-3.5 text-blue-500" /> },
  { value: "instagram", label: "Instagram", icon: <FaInstagram className="h-3.5 w-3.5 text-pink-500" /> },
  { value: "sms", label: "SMS", icon: <FaSms className="h-3.5 w-3.5 text-slate-500" /> },
  { value: "email", label: "Email", icon: <Mail className="h-3.5 w-3.5 text-sky-500" /> },
];

function ChannelGlyph({ channel }: { channel: string }) {
  return CHANNELS.find((c) => c.value === channel)?.icon ?? <FaWhatsapp className="h-3.5 w-3.5 text-emerald-500" />;
}

function statusBadge(status: CampaignStatus, sent: number, failed: number, total: number) {
  if (status === "scheduled")
    return <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-500/40"><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
  if (status === "sent")
    return <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30"><CheckCircle2 className="h-3 w-3 mr-1" />Sent · {sent}/{total}</Badge>;
  if (status === "partial")
    return <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/40"><AlertCircle className="h-3 w-3 mr-1" />Partial · {sent} sent, {failed} failed</Badge>;
  if (status === "failed")
    return <Badge variant="destructive" className="text-[10px]">Failed · {failed} errors</Badge>;
  if (status === "sending")
    return <Badge variant="outline" className="text-[10px] animate-pulse">Sending…</Badge>;
  return <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/40">Draft</Badge>;
}

export default function MarketingPage() {
  const { toast } = useToast();
  const { data: campaigns, isLoading } = useCampaigns();
  const { data: customers } = useListCustomers({});
  const createMut = useCreateCampaign();
  const deleteMut = useDeleteCampaign();
  const sendMut = useSendCampaign();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("whatsapp");
  const [audienceMode, setAudienceMode] = useState<"all" | "selected">("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const reset = () => {
    setName("");
    setChannel("whatsapp");
    setAudienceMode("all");
    setSelectedIds([]);
    setMessage("");
    setScheduledAt("");
  };

  const toggleCustomer = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleCreate = () => {
    if (name.trim().length < 2) {
      toast({ title: "Name is too short", variant: "destructive" });
      return;
    }
    if (message.trim().length < 1) {
      toast({ title: "Message body is required", variant: "destructive" });
      return;
    }
    if (audienceMode === "selected" && selectedIds.length === 0) {
      toast({ title: "Select at least one customer", variant: "destructive" });
      return;
    }
    createMut.mutate(
      {
        name: name.trim(),
        channel,
        audience: audienceMode,
        message: message.trim(),
        customerIds: audienceMode === "selected" ? selectedIds : undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      },
      {
        onSuccess: () => {
          toast({
            title: scheduledAt && new Date(scheduledAt) > new Date()
              ? "Campaign scheduled"
              : "Campaign saved as draft",
          });
          reset();
          setOpen(false);
        },
        onError: () =>
          toast({ title: "Failed to save campaign", variant: "destructive" }),
      },
    );
  };

  const handleSend = (id: number) => {
    sendMut.mutate(id, {
      onSuccess: (res) =>
        toast({ title: "Campaign processed", description: res.message }),
      onError: () =>
        toast({ title: "Failed to send", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    deleteMut.mutate(id, {
      onSuccess: () => toast({ title: "Campaign deleted" }),
    });
  };

  return (
    <div className="flex-1 space-y-6 p-8 overflow-y-auto bg-background">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Megaphone className="h-7 w-7 text-primary" />
            Marketing Campaigns
          </h2>
          <p className="text-muted-foreground mt-1">
            Broadcast WhatsApp, email, and social messages to your contacts.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="btn-new-campaign">
              <Plus className="h-4 w-4 mr-2" /> New campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New campaign</DialogTitle>
              <DialogDescription>
                Select customers, pick a channel, and send instantly or schedule for later.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="camp-name">Name</Label>
                <Input
                  id="camp-name"
                  placeholder="e.g. May refill reminder"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="input-campaign-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as CampaignChannel)}>
                    <SelectTrigger data-testid="select-campaign-channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          <span className="inline-flex items-center gap-2">
                            {c.icon} {c.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Audience</Label>
                  <Select value={audienceMode} onValueChange={(v) => setAudienceMode(v as "all" | "selected")}>
                    <SelectTrigger data-testid="select-campaign-audience">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All customers</SelectItem>
                      <SelectItem value="selected">Selected customers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {audienceMode === "selected" && (
                <div className="space-y-2 border rounded-md p-3 max-h-40 overflow-y-auto">
                  <Label className="text-xs text-muted-foreground">Select customers ({selectedIds.length})</Label>
                  {(customers ?? []).map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                      <Checkbox
                        checked={selectedIds.includes(c.id)}
                        onCheckedChange={() => toggleCustomer(c.id)}
                      />
                      <span>{c.name}</span>
                      <span className="text-muted-foreground text-xs">{c.phone}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="camp-schedule">Schedule (optional)</Label>
                <Input
                  id="camp-schedule"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  data-testid="input-campaign-schedule"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="camp-message">Message</Label>
                <Textarea
                  id="camp-message"
                  rows={5}
                  placeholder="Hi {{name}}, your prescription is ready for pick-up…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  data-testid="textarea-campaign-message"
                />
                <p className="text-[11px] text-muted-foreground">
                  Tip: <code>{"{{name}}"}</code> is replaced per recipient.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMut.isPending} data-testid="btn-save-campaign">
                {createMut.isPending ? "Saving…" : scheduledAt ? "Schedule" : "Save draft"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <PlugZap className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Provider configuration</p>
            <p className="text-muted-foreground mt-0.5">
              Set <code>MESSAGING_PROVIDER_URL</code> for WhatsApp/SMS/social or <code>SMTP_HOST</code> for email.
              Without these, campaigns run in stub mode (status tracked, no external delivery).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">All campaigns</CardTitle>
          <CardDescription>Drafts, scheduled, and sent broadcasts</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : !campaigns || campaigns.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center">
              <Megaphone className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm font-medium text-foreground">No campaigns yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {campaigns.map((c) => (
                <li key={c.id} className="py-4 flex items-start gap-4" data-testid={`campaign-row-${c.id}`}>
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    <ChannelGlyph channel={c.channel} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <p className="font-medium text-sm">{c.name}</p>
                      <span className="text-[11px] text-muted-foreground">
                        {format(parseISO(c.createdAt), "MMM d, yyyy · h:mm a")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{c.message}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="outline" className="capitalize text-[10px]">{c.channel}</Badge>
                      <Badge variant="outline" className="text-[10px]">Audience: {c.audience}</Badge>
                      {statusBadge(c.status, c.sentCount ?? 0, c.failedCount ?? 0, c.recipientCount)}
                      {c.scheduledAt && c.status === "scheduled" && (
                        <span className="text-[10px] text-muted-foreground">
                          Due {format(parseISO(c.scheduledAt), "MMM d, h:mm a")}
                        </span>
                      )}
                      {c.sentAt && (
                        <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                          <Info className="h-3 w-3" />
                          Sent {format(parseISO(c.sentAt), "MMM d, h:mm a")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.status !== "scheduled" && (
                      <Button variant="outline" size="sm" onClick={() => handleSend(c.id)} disabled={sendMut.isPending} data-testid={`btn-send-${c.id}`}>
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        {["sent", "partial"].includes(c.status) ? "Resend" : "Send"}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(c.id)} data-testid={`btn-delete-${c.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
