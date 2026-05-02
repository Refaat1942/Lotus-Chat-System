import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  useListConversations, 
  useGetConversation, 
  useListMessages, 
  useSendMessage,
  useAssignConversation,
  useResolveConversation,
  useListQuickReplies,
  useGetMe,
  getListMessagesQueryKey,
  getListConversationsQueryKey,
  getGetConversationQueryKey
} from "@workspace/api-client-react";
import { useConversationSocket, useTypingEmit, useTypingIndicator } from "@/hooks/use-socket";
import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  MoreVertical,
  Paperclip,
  Send,
  User,
  Phone,
  MapPin,
  Tag as TagIcon,
  ChevronRight,
  Info,
  MessageSquarePlus,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function ChatPage() {
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved" | "pending">("open");
  const [message, setMessage] = useState("");
  const { data: user } = useGetMe();

  const insertReply = useCallback((text: string) => {
    setMessage((prev) => {
      const trimmed = (prev ?? "").trim();
      return trimmed.length ? `${trimmed}\n${text}` : text;
    });
  }, []);

  const { data: conversations, isLoading: convLoading } = useListConversations({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined
  });

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* Left Sidebar - Conversation List */}
      <div className="w-80 flex-shrink-0 border-r border-border flex flex-col bg-sidebar">
        <div className="p-4 border-b border-border flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg tracking-tight">Inbox</h2>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-[110px] h-8 text-xs bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search patients..."
              className="pl-8 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-chat-search"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {convLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
              <MessageSquare className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm">No conversations found.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {conversations?.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`w-full text-left p-4 hover:bg-muted/50 transition-colors flex gap-3 ${selectedConvId === conv.id ? 'bg-muted' : ''}`}
                  data-testid={`btn-select-conv-${conv.id}`}
                >
                  <Avatar className="h-10 w-10 border border-border/50">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {conv.customer?.name?.substring(0, 2).toUpperCase() || 'CU'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex justify-between items-baseline mb-1">
                      <p className="text-sm font-semibold truncate text-foreground">{conv.customer?.name}</p>
                      <p className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                        {conv.lastMessageAt ? format(parseISO(conv.lastMessageAt), "h:mm a") : ''}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mb-2">
                      {conv.lastMessage || "No messages yet"}
                    </p>
                    <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                      <StatusBadge status={conv.status} />
                      {conv.tags?.slice(0, 2).map((tag, idx) => (
                        <Badge key={idx} variant="outline" className="text-[9px] px-1 h-4 bg-background">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {conv.unreadCount > 0 && (
                    <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center flex-shrink-0 self-center">
                      {conv.unreadCount}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Center - Chat Area */}
      {selectedConvId ? (
        <ChatCenter conversationId={selectedConvId} currentUserId={user?.id} currentUserName={user?.name ?? undefined} message={message} setMessage={setMessage} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-muted/10 text-muted-foreground border-r border-border">
          <MessageSquarePlus className="h-12 w-12 mb-4 opacity-20" />
          <h3 className="text-lg font-medium text-foreground">Select a conversation</h3>
          <p className="text-sm">Choose a patient from the list to start messaging</p>
        </div>
      )}

      {/* Right - Context Panel */}
      {selectedConvId && (
        <ChatContextPanel conversationId={selectedConvId} onInsertReply={insertReply} />
      )}
    </div>
  );
}

function ChatCenter({ conversationId, currentUserId, currentUserName, message, setMessage }: { conversationId: number, currentUserId?: number, currentUserName?: string, message: string, setMessage: React.Dispatch<React.SetStateAction<string>> }) {
  const [isNote, setIsNote] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: conv, isLoading: convLoading } = useGetConversation(conversationId, {
    query: { enabled: !!conversationId, queryKey: getGetConversationQueryKey(conversationId) }
  });
  
  const { data: messages, isLoading: msgsLoading } = useListMessages(conversationId, {
    query: { enabled: !!conversationId, queryKey: getListMessagesQueryKey(conversationId) }
  });

  // Typing indicator state
  const { typingAgent, handleTyping } = useTypingIndicator();

  // Real-time: listen for new messages on this conversation via Socket.io
  const handleNewMessage = useCallback((msg: unknown) => {
    queryClient.setQueryData(
      getListMessagesQueryKey(conversationId),
      (old: unknown[] | undefined) => old ? [...old, msg] : [msg],
    );
    queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
  }, [conversationId, queryClient]);

  useConversationSocket(conversationId, handleNewMessage, handleTyping, currentUserName);

  // Emit typing events using the authenticated current user's name
  const emitTyping = useTypingEmit(conversationId, currentUserName);

  const sendMessageMut = useSendMessage();
  const resolveMut = useResolveConversation();
  const assignMut = useAssignConversation();

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMut.mutate(
      { id: conversationId, data: { body: message, senderType: "agent", isNote } },
      {
        onSuccess: () => {
          setMessage("");
          setIsNote(false);
          queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(conversationId) });
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        },
        onError: () => toast({ title: "Failed to send message", variant: "destructive" })
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleResolve = () => {
    resolveMut.mutate({ id: conversationId }, {
      onSuccess: () => {
        toast({ title: "Conversation resolved" });
        queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(conversationId) });
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      }
    });
  };

  const handleAssignToMe = () => {
    if (!currentUserId) return;
    assignMut.mutate({ id: conversationId, data: { agentId: currentUserId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(conversationId) });
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      }
    });
  };

  if (convLoading || msgsLoading) {
    return <div className="flex-1 flex items-center justify-center border-r border-border"><Skeleton className="h-8 w-8 rounded-full" /></div>;
  }

  return (
    <div className="flex-1 flex flex-col border-r border-border min-w-[400px]">
      {/* Header */}
      <div className="h-16 px-6 border-b border-border flex items-center justify-between bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary">{conv?.customer?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-sm font-semibold">{conv?.customer?.name}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {conv?.assignedAgent ? (
                <>Assigned to {conv.assignedAgent.name}</>
              ) : (
                <span className="text-amber-500">Unassigned</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {conv?.status !== "resolved" && (
            <Button size="sm" variant="outline" onClick={handleResolve} disabled={resolveMut.isPending} data-testid="btn-resolve">
              <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" />
              Resolve
            </Button>
          )}
          {!conv?.assignedAgentId && conv?.status !== "resolved" && (
            <Button size="sm" variant="default" onClick={handleAssignToMe} disabled={assignMut.isPending} data-testid="btn-assign-me">
              Assign to me
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 bg-muted/10" ref={scrollRef}>
        <div className="space-y-4 max-w-3xl mx-auto pb-4">
          {typingAgent && (
            <div className="flex justify-start" data-testid="typing-indicator">
              <div className="flex flex-col gap-1 items-start">
                <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm bg-card border border-border shadow-sm flex items-center gap-2">
                  <span className="text-xs text-muted-foreground italic">{typingAgent} is typing</span>
                  <span className="flex gap-0.5 items-center">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                    <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                    <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            </div>
          )}
          {messages?.map((msg) => {
            const isMe = msg.senderType === "agent";
            const isSystem = msg.senderType === "system";
            
            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-4">
                  <span className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                    {msg.body}
                  </span>
                </div>
              );
            }

            if (msg.isNote) {
              return (
                <div key={msg.id} className="flex justify-center my-4">
                  <div className="bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 rounded-lg px-4 py-3 max-w-lg w-full">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Internal Note</span>
                      <span className="text-[10px] text-amber-700/70 dark:text-amber-400/70 ml-auto">{format(parseISO(msg.createdAt), "MMM d, h:mm a")}</span>
                    </div>
                    <p className="text-sm text-amber-900 dark:text-amber-100">{msg.body}</p>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex flex-col gap-1 max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <div 
                    className={`px-4 py-2.5 rounded-2xl ${
                      isMe 
                        ? 'bg-primary text-primary-foreground rounded-br-sm shadow-sm' 
                        : 'bg-card border border-border rounded-bl-sm shadow-sm'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground px-1">
                    {format(parseISO(msg.createdAt), "h:mm a")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Input Area */}
      {conv?.status !== "resolved" ? (
        <div className="p-4 bg-card border-t border-border">
          <div className="max-w-3xl mx-auto relative rounded-xl border border-border bg-background focus-within:ring-1 focus-within:ring-ring overflow-hidden shadow-sm">
            {isNote && (
              <div className="bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 border-b border-amber-200 dark:border-amber-800/50 flex items-center">
                <Clock className="h-3 w-3 mr-1.5" />
                Drafting Internal Note (Not visible to patient)
              </div>
            )}
            <Textarea
              value={message}
              onChange={(e) => { setMessage(e.target.value); emitTyping(); }}
              onKeyDown={handleKeyDown}
              placeholder={isNote ? "Type an internal note..." : "Type a message..."}
              className="min-h-[80px] border-0 focus-visible:ring-0 resize-none rounded-none text-sm p-3 bg-transparent"
              data-testid="input-chat-message"
            />
            <div className="flex items-center justify-between p-2 bg-muted/20 border-t border-border">
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`h-8 px-2 text-xs ${isNote ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-100' : 'text-muted-foreground'}`}
                  onClick={() => setIsNote(!isNote)}
                >
                  <Clock className="h-3 w-3 mr-1.5" />
                  Note
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                  <Paperclip className="h-4 w-4" />
                </Button>
              </div>
              <Button 
                size="sm" 
                className="h-8 px-4" 
                onClick={handleSend} 
                disabled={!message.trim() || sendMessageMut.isPending}
                data-testid="btn-send-message"
              >
                {sendMessageMut.isPending ? <Skeleton className="h-4 w-4" /> : <Send className="h-4 w-4 mr-2" />}
                Send
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-muted text-center text-sm text-muted-foreground border-t border-border">
          This conversation is resolved. 
        </div>
      )}
    </div>
  );
}

function ChatContextPanel({ conversationId, onInsertReply }: { conversationId: number, onInsertReply: (text: string) => void }) {
  const { data: conv } = useGetConversation(conversationId, {
    query: { enabled: !!conversationId, queryKey: getGetConversationQueryKey(conversationId) }
  });
  const { data: quickReplies } = useListQuickReplies();
  const [replySearch, setReplySearch] = useState("");
  const customer = conv?.customer;

  const filteredReplies = (quickReplies ?? []).filter((qr) => {
    if (!replySearch.trim()) return true;
    const q = replySearch.toLowerCase();
    return qr.title.toLowerCase().includes(q) || qr.body.toLowerCase().includes(q);
  });

  return (
    <div className="w-80 flex-shrink-0 flex flex-col bg-sidebar overflow-hidden">
      <Tabs defaultValue="details" className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start h-12 rounded-none border-b border-border bg-transparent px-4">
          <TabsTrigger value="details" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4">Details</TabsTrigger>
          <TabsTrigger value="replies" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4">Quick Replies</TabsTrigger>
        </TabsList>
        
        <TabsContent value="details" className="flex-1 overflow-y-auto m-0 p-0">
          <div className="p-6 space-y-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-20 w-20 mb-3 border-2 border-border shadow-sm">
                <AvatarFallback className="text-xl bg-primary/10 text-primary">{customer?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <h3 className="font-semibold text-lg">{customer?.name}</h3>
              <p className="text-sm text-muted-foreground">Patient</p>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact Info</h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{customer?.phone}</span>
                </div>
                {customer?.branch && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{customer.branch} Branch</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</h4>
                <Button variant="ghost" size="icon" className="h-6 w-6"><TagIcon className="h-3 w-3" /></Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {customer?.tags?.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="font-normal text-xs">{tag}</Badge>
                ))}
                {!customer?.tags?.length && <span className="text-xs text-muted-foreground">No tags</span>}
              </div>
            </div>

            {(customer?.notes || customer?.prescriptionNotes) && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clinical Notes</h4>
                  {customer.prescriptionNotes && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-100 dark:border-blue-800/50">
                      <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">Prescription Data</p>
                      <p className="text-sm text-blue-900 dark:text-blue-100">{customer.prescriptionNotes}</p>
                    </div>
                  )}
                  {customer.notes && (
                    <div className="bg-muted/50 p-3 rounded-md">
                      <p className="text-xs font-semibold mb-1">General Notes</p>
                      <p className="text-sm">{customer.notes}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="replies" className="flex-1 m-0 p-0 min-h-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-4 pb-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search replies..."
                className="pl-8 h-9 text-sm bg-background"
                value={replySearch}
                onChange={(e) => setReplySearch(e.target.value)}
                data-testid="input-quick-reply-search"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-3">
              {filteredReplies.map((qr) => (
                <button
                  key={qr.id}
                  type="button"
                  onClick={() => onInsertReply(qr.body)}
                  className="w-full text-left p-3 border border-border rounded-lg bg-card hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-colors group focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid={`btn-quick-reply-${qr.id}`}
                >
                  <h5 className="font-medium text-sm mb-1">{qr.title}</h5>
                  <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{qr.body}</p>
                  <span className="block w-full mt-2 h-7 leading-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity text-primary text-center font-medium">
                    Click to insert
                  </span>
                </button>
              ))}
              {filteredReplies.length === 0 && (
                <p className="text-sm text-muted-foreground text-center mt-8">
                  {replySearch ? "No matching replies." : "No quick replies configured."}
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "open":
      return <Badge variant="default" className="text-[9px] px-1 h-4 bg-primary text-primary-foreground hover:bg-primary">Open</Badge>;
    case "resolved":
      return <Badge variant="secondary" className="text-[9px] px-1 h-4 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400">Resolved</Badge>;
    case "pending":
      return <Badge variant="secondary" className="text-[9px] px-1 h-4 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400">Pending</Badge>;
    default:
      return null;
  }
}