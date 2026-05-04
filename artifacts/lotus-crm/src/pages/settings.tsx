import React from "react";
import { 
  useListUsers, useCreateUser, useDeleteUser, useUpdateUser,
  useListTags, useCreateTag, useDeleteTag,
  useListQuickReplies, useCreateQuickReply, useDeleteQuickReply,
  useGetSettings, useUpdateSettings,
  getListUsersQueryKey, getListTagsQueryKey, getListQuickRepliesQueryKey,
  getGetSettingsQueryKey
} from "@workspace/api-client-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { Trash2, Plus, Shield, Users, Tag as TagIcon, MessageSquare, Sliders, Palette, Upload, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsPage() {
  return (
    <div className="flex-1 space-y-6 p-8 overflow-y-auto bg-background">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">System Settings</h2>
        <p className="text-muted-foreground">Manage agents, workflow tags, and quick replies.</p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="users" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Users className="h-4 w-4 mr-2" /> Users & Roles</TabsTrigger>
          <TabsTrigger value="tags" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><TagIcon className="h-4 w-4 mr-2" /> Conversation Tags</TabsTrigger>
          <TabsTrigger value="replies" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><MessageSquare className="h-4 w-4 mr-2" /> Quick Replies</TabsTrigger>
          <TabsTrigger value="distribution" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Sliders className="h-4 w-4 mr-2" /> Chat Distribution</TabsTrigger>
          <TabsTrigger value="branding" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Palette className="h-4 w-4 mr-2" /> Branding</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6 m-0">
          <UsersSettings />
        </TabsContent>

        <TabsContent value="tags" className="space-y-6 m-0">
          <TagsSettings />
        </TabsContent>

        <TabsContent value="replies" className="space-y-6 m-0">
          <QuickRepliesSettings />
        </TabsContent>

        <TabsContent value="distribution" className="space-y-6 m-0">
          <ChatDistributionSettings />
        </TabsContent>

        <TabsContent value="branding" className="space-y-6 m-0">
          <BrandingSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// -----------------------------------------------------------------------------
// USERS
// -----------------------------------------------------------------------------
const createUserSchema = z.object({
  name: z.string().min(2, "Name required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password too short"),
  role: z.enum(["admin", "agent"]),
});

const editUserSchema = z.object({
  name: z.string().min(2, "Name required"),
  email: z.string().email("Valid email required"),
  role: z.enum(["admin", "agent"]),
  password: z.string().optional(),
});

type EditableUser = { id: number; name: string; email: string; role: string };

function EditUserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: EditableUser | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const updateMut = useUpdateUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const form = useForm<z.infer<typeof editUserSchema>>({
    resolver: zodResolver(editUserSchema),
    values: user
      ? { name: user.name, email: user.email, role: user.role as "admin" | "agent", password: "" }
      : { name: "", email: "", role: "agent", password: "" },
  });

  const onSubmit = (values: z.infer<typeof editUserSchema>) => {
    if (!user) return;
    const payload: { name: string; email: string; role: "admin" | "agent"; password?: string } = {
      name: values.name,
      email: values.email,
      role: values.role,
    };
    if (values.password && values.password.length >= 6) payload.password = values.password;
    updateMut.mutate(
      { id: user.id, data: payload },
      {
        onSuccess: () => {
          toast({ title: "User updated" });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          onOpenChange(false);
        },
        onError: () => toast({ title: "Could not update user", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Full Name</FormLabel>
                <FormControl><Input className="h-9 text-sm" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Email</FormLabel>
                <FormControl><Input type="email" className="h-9 text-sm" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Role</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}/>
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">New password (leave blank to keep)</FormLabel>
                <FormControl><Input type="password" className="h-9 text-sm" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMut.isPending}>
                {updateMut.isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function UsersSettings() {
  const { data: users, isLoading } = useListUsers();
  const createMut = useCreateUser();
  const deleteMut = useDeleteUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<EditableUser | null>(null);

  const form = useForm<z.infer<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", password: "", role: "agent" }
  });

  const onSubmit = (values: z.infer<typeof createUserSchema>) => {
    createMut.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "User created" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        form.reset();
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Remove this user?")) {
      deleteMut.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast({ title: "User removed" });
        }
      });
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <EditUserDialog user={editing} open={editing !== null} onOpenChange={(v) => { if (!v) setEditing(null); }} />
      <Card className="md:col-span-2 shadow-sm">
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Personnel with access to Lotus CRM</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                 <TableRow><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
              ) : users?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                  <TableCell>
                    {u.role === 'admin' ? (
                      <Badge variant="default" className="bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 border-0 text-[10px]"><Shield className="h-3 w-3 mr-1" /> Admin</Badge>
                    ) : (
                      <Badge variant="secondary" className="font-normal text-[10px]">Agent</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing({ id: u.id, name: u.name, email: u.email, role: u.role })} className="text-muted-foreground hover:text-primary h-8 w-8">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)} className="text-destructive hover:bg-destructive/10 h-8 w-8">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="shadow-sm h-fit">
        <CardHeader>
          <CardTitle className="text-base">Add New User</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Full Name</FormLabel>
                  <FormControl><Input className="h-9 text-sm" {...field} /></FormControl>
                </FormItem>
              )}/>
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Email</FormLabel>
                  <FormControl><Input type="email" className="h-9 text-sm" {...field} /></FormControl>
                </FormItem>
              )}/>
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Password</FormLabel>
                  <FormControl><Input type="password" className="h-9 text-sm" {...field} /></FormControl>
                </FormItem>
              )}/>
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}/>
              <Button type="submit" className="w-full" size="sm" disabled={createMut.isPending}>
                <Plus className="h-4 w-4 mr-2" /> Add User
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

// -----------------------------------------------------------------------------
// TAGS
// -----------------------------------------------------------------------------
const createTagSchema = z.object({
  name: z.string().min(2),
  color: z.string().min(4),
});

function TagsSettings() {
  const { data: tags, isLoading } = useListTags();
  const createMut = useCreateTag();
  const deleteMut = useDeleteTag();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof createTagSchema>>({
    resolver: zodResolver(createTagSchema),
    defaultValues: { name: "", color: "#2E7D32" }
  });

  const onSubmit = (values: z.infer<typeof createTagSchema>) => {
    createMut.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Tag created" });
        queryClient.invalidateQueries({ queryKey: getListTagsQueryKey() });
        form.reset();
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteMut.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTagsQueryKey() })
    });
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="md:col-span-2 shadow-sm">
        <CardHeader>
          <CardTitle>Global Tags</CardTitle>
          <CardDescription>Tags used to categorize patients and conversations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
             {isLoading ? <Skeleton className="h-8 w-24" /> : tags?.map((tag) => (
                <div key={tag.id} className="flex items-center gap-2 bg-card border border-border pl-3 pr-1 py-1 rounded-full shadow-sm">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm font-medium">{tag.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full ml-1 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(tag.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
             ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm h-fit">
        <CardHeader>
          <CardTitle className="text-base">Create Tag</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Tag Name</FormLabel>
                  <FormControl><Input className="h-9 text-sm" placeholder="e.g. VIP, Urgent..." {...field} /></FormControl>
                </FormItem>
              )}/>
              <FormField control={form.control} name="color" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Color Hex</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input type="color" className="h-9 w-12 p-1" {...field} />
                      <Input className="h-9 text-sm flex-1 font-mono uppercase" {...field} />
                    </div>
                  </FormControl>
                </FormItem>
              )}/>
              <Button type="submit" className="w-full" size="sm" disabled={createMut.isPending}>
                Create Tag
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

// -----------------------------------------------------------------------------
// QUICK REPLIES
// -----------------------------------------------------------------------------
const createReplySchema = z.object({
  title: z.string().min(2),
  body: z.string().min(5),
});

function QuickRepliesSettings() {
  const { data: replies, isLoading } = useListQuickReplies();
  const createMut = useCreateQuickReply();
  const deleteMut = useDeleteQuickReply();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof createReplySchema>>({
    resolver: zodResolver(createReplySchema),
    defaultValues: { title: "", body: "" }
  });

  const onSubmit = (values: z.infer<typeof createReplySchema>) => {
    createMut.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Template created" });
        queryClient.invalidateQueries({ queryKey: getListQuickRepliesQueryKey() });
        form.reset();
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteMut.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListQuickRepliesQueryKey() })
    });
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-4">
        {isLoading ? <Skeleton className="h-24 w-full" /> : replies?.map((qr) => (
          <Card key={qr.id} className="shadow-sm">
            <CardHeader className="py-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-semibold">{qr.title}</CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(qr.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="py-4 pt-0 text-sm text-muted-foreground">
              {qr.body}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm h-fit">
        <CardHeader>
          <CardTitle className="text-base">New Template</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Short Title</FormLabel>
                  <FormControl><Input className="h-9 text-sm" placeholder="e.g. Greeting" {...field} /></FormControl>
                </FormItem>
              )}/>
              <FormField control={form.control} name="body" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Message Body</FormLabel>
                  <FormControl>
                    <Textarea className="min-h-[100px] text-sm resize-none" placeholder="Hello, how can I help you today?" {...field} />
                  </FormControl>
                </FormItem>
              )}/>
              <Button type="submit" className="w-full" size="sm" disabled={createMut.isPending}>
                Save Template
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

// -----------------------------------------------------------------------------
// CHAT DISTRIBUTION
// -----------------------------------------------------------------------------
function ChatDistributionSettings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateMut = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [maxChats, setMaxChats] = React.useState<number>(5);
  const [autoAssign, setAutoAssign] = React.useState<boolean>(true);
  const [strategy, setStrategy] = React.useState<"round_robin" | "least_busy">("least_busy");
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (settings) {
      setMaxChats(settings.maxChatsPerAgent);
      setAutoAssign(settings.autoAssign);
      setStrategy(settings.assignmentStrategy as "round_robin" | "least_busy");
      setDirty(false);
    }
  }, [settings]);

  const save = () => {
    updateMut.mutate(
      { data: { maxChatsPerAgent: maxChats, autoAssign, assignmentStrategy: strategy } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
          toast({ title: "Settings saved" });
          setDirty(false);
        },
        onError: () => toast({ title: "Could not save settings", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="md:col-span-2 shadow-sm">
        <CardHeader>
          <CardTitle>Chat Distribution</CardTitle>
          <CardDescription>
            Control how incoming conversations are routed to your agents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              {/* Auto-assign toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Auto-assign new chats</Label>
                  <p className="text-xs text-muted-foreground">
                    When on, new conversations are automatically routed to the next available
                    agent. When all agents are full, chats wait in a queue.
                  </p>
                </div>
                <Switch
                  checked={autoAssign}
                  onCheckedChange={(v) => { setAutoAssign(v); setDirty(true); }}
                  data-testid="switch-auto-assign"
                />
              </div>

              {/* Max chats slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Max chats per agent</Label>
                  <span className="text-sm font-semibold text-primary">{maxChats}</span>
                </div>
                <Slider
                  min={1}
                  max={20}
                  step={1}
                  value={[maxChats]}
                  onValueChange={(v) => { setMaxChats(v[0]); setDirty(true); }}
                  data-testid="slider-max-chats"
                />
                <p className="text-xs text-muted-foreground">
                  An agent will not receive a new chat once they have this many open or pending
                  conversations.
                </p>
              </div>

              {/* Strategy */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Assignment strategy</Label>
                <Select
                  value={strategy}
                  onValueChange={(v) => { setStrategy(v as "round_robin" | "least_busy"); setDirty(true); }}
                >
                  <SelectTrigger className="h-10" data-testid="select-strategy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="least_busy">Least busy (lowest workload first)</SelectItem>
                    <SelectItem value="round_robin">Round-robin (longest idle agent first)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end">
                <Button onClick={save} disabled={!dirty || updateMut.isPending} data-testid="button-save-distribution">
                  {updateMut.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm h-fit">
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Available agents</strong> can receive new
            chats. Agents control their own status from the sidebar (Available / Busy / Offline).
          </p>
          <p>
            When a new conversation arrives, the system picks an available agent under the
            workload cap using the chosen strategy.
          </p>
          <p>
            When no agent is available, the chat waits in the queue. As soon as an agent
            resolves a chat or becomes available, the next queued chat is assigned to them
            automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// -----------------------------------------------------------------------------
// BRANDING — company name, logo, and SLA threshold
// -----------------------------------------------------------------------------
function BrandingSettings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateMut = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [companyName, setCompanyName] = React.useState("");
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [slaMinutes, setSlaMinutes] = React.useState<number>(15);
  const [dirty, setDirty] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (settings) {
      const s = settings as unknown as {
        companyName?: string;
        logoUrl?: string | null;
        slaMinutes?: number;
      };
      setCompanyName(s.companyName ?? "Lotus Pharmacies");
      setLogoUrl(s.logoUrl ?? null);
      setSlaMinutes(s.slaMinutes ?? 15);
      setDirty(false);
    }
  }, [settings]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file", variant: "destructive" });
      return;
    }
    if (file.size > 500 * 1024) {
      toast({
        title: "Image too large",
        description: "Maximum size is 500KB. Try a smaller PNG/SVG.",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(String(reader.result));
      setDirty(true);
    };
    reader.readAsDataURL(file);
  };

  const save = () => {
    updateMut.mutate(
      // Cast: companyName/logoUrl/slaMinutes are not in the generated openapi
      // types yet, but the API accepts them.
      { data: { companyName, logoUrl, slaMinutes } as never },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["/api/branding"] });
          toast({ title: "Branding saved" });
          setDirty(false);
        },
        onError: () => toast({ title: "Could not save branding", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="md:col-span-2 shadow-sm">
        <CardHeader>
          <CardTitle>Company Branding</CardTitle>
          <CardDescription>
            Customize how your workspace looks for both the sidebar and the login screen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              {/* Logo */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-xl border border-border bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo preview" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs text-muted-foreground">No logo</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {logoUrl ? "Replace logo" : "Upload logo"}
                    </Button>
                    {logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setLogoUrl(null);
                          setDirty(true);
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, or SVG. Max 500KB. Square images look best.
                    </p>
                  </div>
                </div>
              </div>

              {/* Company name */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Company name</Label>
                <Input
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="Lotus Pharmacies"
                  maxLength={80}
                  className="h-10"
                  data-testid="input-company-name"
                />
              </div>

              {/* SLA */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  SLA threshold (minutes)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={slaMinutes}
                  onChange={(e) => {
                    setSlaMinutes(Number(e.target.value) || 1);
                    setDirty(true);
                  }}
                  className="h-10 w-32"
                  data-testid="input-sla-minutes"
                />
                <p className="text-xs text-muted-foreground">
                  When a customer waits longer than this, the chat is flagged
                  <span className="text-rose-600 font-medium"> Late</span> in the inbox and
                  AI Insights.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={save} disabled={!dirty || updateMut.isPending} data-testid="button-save-branding">
                  {updateMut.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm h-fit">
        <CardHeader>
          <CardTitle className="text-base">Live preview</CardTitle>
          <CardDescription>How it appears in the sidebar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border bg-sidebar p-4 flex items-center gap-2.5">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-8 w-8 rounded-md object-cover ring-1 ring-border/50" />
            ) : (
              <div className="bg-primary rounded-md p-1.5">
                <MessageSquare className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <span className="font-bold text-lg tracking-tight truncate">
              {companyName || "Lotus Pharmacies"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}