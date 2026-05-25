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
import { Trash2, Plus, Shield, Users, Tag as TagIcon, MessageSquare, Sliders, Palette, Upload, X, Lock, MessageCircle, FolderOpen, Coffee } from "lucide-react";
import {
  useRolePermissions, useUpdateRolePermissions, type RolePermissions as RolePerms, type RoleName,
  useChatReasons, useCreateChatReason, useUpdateChatReason, useDeleteChatReason,
  useChatReasonCategories, useCreateChatReasonCategory, useUpdateChatReasonCategory, useDeleteChatReasonCategory,
  useNotReadyReasons, useCreateNotReadyReason, useUpdateNotReadyReason, useDeleteNotReadyReason,
} from "@/lib/api-extra";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

type SettingsSection = {
  value: string;
  label: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  Component: React.ComponentType;
};

const SETTINGS_SECTIONS: SettingsSection[] = [
  { value: "users",                   group: "Team",          label: "Users & Roles",       icon: Users,         Component: UsersSettings },
  { value: "permissions",             group: "Team",          label: "Permissions",         icon: Lock,          Component: PermissionsSettings },
  { value: "tags",                    group: "Workflow",      label: "Conversation Tags",   icon: TagIcon,       Component: TagsSettings },
  { value: "replies",                 group: "Workflow",      label: "Quick Replies",       icon: MessageSquare, Component: QuickRepliesSettings },
  { value: "distribution",            group: "Workflow",      label: "Chat Distribution",   icon: Sliders,       Component: ChatDistributionSettings },
  { value: "chat-reason-categories",  group: "Reasons",       label: "Reason Categories",   icon: FolderOpen,    Component: ChatReasonCategoriesSettings },
  { value: "chat-reasons",            group: "Reasons",       label: "Chat Reasons",        icon: MessageCircle, Component: ChatReasonsSettings },
  { value: "not-ready",               group: "Reasons",       label: "Not Ready Reasons",   icon: Coffee,        Component: NotReadyReasonsSettings },
  { value: "branding",                group: "Appearance",    label: "Branding",            icon: Palette,       Component: BrandingSettings },
];

const SETTINGS_GROUPS = ["Team", "Workflow", "Reasons", "Appearance"] as const;

export default function SettingsPage() {
  const [active, setActive] = React.useState<string>("users");
  const Active = SETTINGS_SECTIONS.find((s) => s.value === active) ?? SETTINGS_SECTIONS[0];
  const ActiveComponent = Active.Component;
  const ActiveIcon = Active.icon;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <div className="px-8 pt-8 pb-4 border-b border-border/60 shrink-0">
        <h2 className="text-3xl font-bold tracking-tight">System Settings</h2>
        <p className="text-muted-foreground">Manage agents, workflow tags, and quick replies.</p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_1fr] grid-rows-[minmax(0,1fr)] gap-0 min-h-0">
        {/* Sidebar nav (vertical, grouped — no horizontal cramming) */}
        <aside className="lg:border-r border-border/60 bg-muted/20 lg:overflow-y-auto p-4 lg:p-5 space-y-5 shrink-0">
          {SETTINGS_GROUPS.map((group) => {
            const items = SETTINGS_SECTIONS.filter((s) => s.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <p className="px-2 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </p>
                <div className="space-y-1">
                  {items.map((s) => {
                    const Icon = s.icon;
                    const isActive = s.value === active;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setActive(s.value)}
                        data-testid={`settings-tab-${s.value}`}
                        className={
                          "w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors " +
                          (isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground/80 hover:bg-accent hover:text-foreground")
                        }
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </aside>

        {/* Active section content (this is the only scrolling region) */}
        <main className="overflow-y-auto p-6 lg:p-8 min-h-0">
          <div className="mb-5 flex items-center gap-2">
            <ActiveIcon className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-semibold">{Active.label}</h3>
          </div>
          <div className="space-y-6 max-w-5xl">
            <ActiveComponent />
          </div>
        </main>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// PERMISSIONS — fixed booleans per role
// -----------------------------------------------------------------------------
const PERMISSION_FIELDS: { key: keyof Omit<RolePerms, "role" | "updatedAt">; label: string; description: string }[] = [
  { key: "canViewChats", label: "View chats", description: "See and open conversations in the inbox." },
  { key: "canSendMessages", label: "Send messages", description: "Reply to customers in conversations." },
  { key: "canViewReports", label: "View reports", description: "Access analytics and reporting screens." },
  { key: "canManageCustomers", label: "Manage customers", description: "Create, edit, and delete customer records." },
  { key: "canManageSettings", label: "Manage settings", description: "Change system settings (admin always retains this)." },
];

function PermissionsSettings() {
  const { data, isLoading } = useRolePermissions();
  const updateMut = useUpdateRolePermissions();
  const { toast } = useToast();

  const handleToggle = (
    role: RoleName,
    key: keyof Omit<RolePerms, "role" | "updatedAt">,
    value: boolean,
  ) => {
    if (role === "admin" && key === "canManageSettings" && !value) {
      toast({
        title: "Admins must keep settings access",
        description: "This safeguard prevents accidental lockout.",
        variant: "destructive",
      });
      return;
    }
    updateMut.mutate(
      { role, data: { [key]: value } },
      {
        onError: () =>
          toast({ title: "Failed to update permission", variant: "destructive" }),
      },
    );
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const adminPerms = data?.find((r) => r.role === "admin");
  const agentPerms = data?.find((r) => r.role === "agent");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {(["admin", "agent"] as const).map((role) => {
        const row = role === "admin" ? adminPerms : agentPerms;
        return (
          <Card key={role}>
            <CardHeader className="pb-4">
              <CardTitle className="text-base capitalize flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                {role} permissions
              </CardTitle>
              <CardDescription>
                {role === "admin"
                  ? "Full-control role. Settings access is locked on."
                  : "What agents can do across the workspace."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {PERMISSION_FIELDS.map((field) => {
                const enabled = row ? row[field.key] : (role === "admin");
                const isAdminLocked = role === "admin" && field.key === "canManageSettings";
                return (
                  <div
                    key={field.key}
                    className="flex items-start justify-between gap-4 p-3 rounded-md border border-border/60 bg-muted/20"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{field.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {field.description}
                      </p>
                    </div>
                    <Switch
                      checked={!!enabled}
                      disabled={updateMut.isPending || isAdminLocked}
                      onCheckedChange={(v) => handleToggle(role, field.key, v)}
                      data-testid={`switch-${role}-${field.key}`}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
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
      setCompanyName(s.companyName ?? "Fratelanza Chating System");
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
                  placeholder="Fratelanza Chating System"
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
              {companyName || "Fratelanza Chating System"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
// -----------------------------------------------------------------------------
// CHAT REASON CATEGORIES (Awfar-inspired) — admin CRUD with EN/AR titles
// -----------------------------------------------------------------------------
function ChatReasonCategoriesSettings() {
  const { data: cats, isLoading } = useChatReasonCategories();
  const createMut = useCreateChatReasonCategory();
  const deleteMut = useDeleteChatReasonCategory();
  const updateMut = useUpdateChatReasonCategory();
  const { toast } = useToast();
  const [titleEn, setTitleEn] = React.useState("");
  const [titleAr, setTitleAr] = React.useState("");
  const [editing, setEditing] = React.useState<{ id: number; titleEn: string; titleAr: string } | null>(null);

  const handleAdd = () => {
    if (!titleEn.trim() || !titleAr.trim()) return;
    createMut.mutate(
      { titleEn: titleEn.trim(), titleAr: titleAr.trim() },
      { onSuccess: () => { toast({ title: "Category created" }); setTitleEn(""); setTitleAr(""); } },
    );
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="md:col-span-2 shadow-sm">
        <CardHeader>
          <CardTitle>Chat Reason Categories</CardTitle>
          <CardDescription>Group chat reasons (e.g. Sales, Support) — bilingual.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>English</TableHead>
                  <TableHead>Arabic</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cats?.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.titleEn}</TableCell>
                    <TableCell dir="rtl" className="font-medium">{c.titleAr}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing({ id: c.id, titleEn: c.titleEn, titleAr: c.titleAr })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteMut.mutate(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {cats?.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No categories yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card className="shadow-sm h-fit">
        <CardHeader><CardTitle className="text-base">Add Category</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">English Title</Label>
            <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="e.g. Sales" className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Arabic Title</Label>
            <Input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} placeholder="مثال: مبيعات" dir="rtl" className="h-9 text-sm" />
          </div>
          <Button className="w-full" size="sm" onClick={handleAdd} disabled={createMut.isPending}>
            <Plus className="h-4 w-4 mr-2" /> Add Category
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Category</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">English Title</Label>
                <Input value={editing.titleEn} onChange={(e) => setEditing({ ...editing, titleEn: e.target.value })} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Arabic Title</Label>
                <Input value={editing.titleAr} onChange={(e) => setEditing({ ...editing, titleAr: e.target.value })} dir="rtl" className="h-9 text-sm" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => editing && updateMut.mutate(editing, { onSuccess: () => { setEditing(null); toast({ title: "Updated" }); } })}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -----------------------------------------------------------------------------
// CHAT REASONS — admin CRUD with EN/AR names, color, optional category
// -----------------------------------------------------------------------------
function ChatReasonsSettings() {
  const { data: reasons, isLoading } = useChatReasons();
  const { data: cats } = useChatReasonCategories();
  const createMut = useCreateChatReason();
  const deleteMut = useDeleteChatReason();
  const updateMut = useUpdateChatReason();
  const { toast } = useToast();
  const [form, setForm] = React.useState({ nameEn: "", nameAr: "", color: "#2E7D32", categoryId: "" });
  const [editing, setEditing] = React.useState<null | { id: number; nameEn: string; nameAr: string; color: string; categoryId: string }>(null);

  const handleAdd = () => {
    if (!form.nameEn.trim() || !form.nameAr.trim()) return;
    createMut.mutate(
      { nameEn: form.nameEn.trim(), nameAr: form.nameAr.trim(), color: form.color, categoryId: form.categoryId ? Number(form.categoryId) : null },
      { onSuccess: () => { toast({ title: "Chat reason created" }); setForm({ nameEn: "", nameAr: "", color: "#2E7D32", categoryId: "" }); } },
    );
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="md:col-span-2 shadow-sm">
        <CardHeader>
          <CardTitle>Chat Reasons</CardTitle>
          <CardDescription>Tag every conversation with the reason (e.g. Refill, Complaint). Bilingual + colored.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reason</TableHead>
                  <TableHead>Arabic</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reasons?.map((r) => {
                  const cat = cats?.find((c) => c.id === r.categoryId);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                          <span className="font-medium">{r.nameEn}</span>
                        </div>
                      </TableCell>
                      <TableCell dir="rtl" className="font-medium">{r.nameAr}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{cat?.titleEn ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing({ id: r.id, nameEn: r.nameEn, nameAr: r.nameAr, color: r.color, categoryId: r.categoryId ? String(r.categoryId) : "" })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteMut.mutate(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {reasons?.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No chat reasons yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card className="shadow-sm h-fit">
        <CardHeader><CardTitle className="text-base">Add Chat Reason</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">English Name</Label>
            <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder="e.g. Refill" className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Arabic Name</Label>
            <Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} dir="rtl" className="h-9 text-sm" placeholder="مثال: إعادة صرف" />
          </div>
          <div>
            <Label className="text-xs">Color</Label>
            <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-9 p-1" />
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={form.categoryId || "none"} onValueChange={(v) => setForm({ ...form, categoryId: v === "none" ? "" : v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {cats?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.titleEn}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" size="sm" onClick={handleAdd} disabled={createMut.isPending}>
            <Plus className="h-4 w-4 mr-2" /> Add Reason
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Chat Reason</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label className="text-xs">English Name</Label><Input value={editing.nameEn} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} className="h-9 text-sm" /></div>
              <div><Label className="text-xs">Arabic Name</Label><Input value={editing.nameAr} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })} dir="rtl" className="h-9 text-sm" /></div>
              <div><Label className="text-xs">Color</Label><Input type="color" value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} className="h-9 p-1" /></div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={editing.categoryId || "none"} onValueChange={(v) => setEditing({ ...editing, categoryId: v === "none" ? "" : v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {cats?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.titleEn}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => editing && updateMut.mutate({ id: editing.id, nameEn: editing.nameEn, nameAr: editing.nameAr, color: editing.color, categoryId: editing.categoryId ? Number(editing.categoryId) : null }, { onSuccess: () => { setEditing(null); toast({ title: "Updated" }); } })}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -----------------------------------------------------------------------------
// NOT-READY REASONS — admin CRUD; agents pick when going off-shift
// -----------------------------------------------------------------------------
function NotReadyReasonsSettings() {
  const { data: reasons, isLoading } = useNotReadyReasons();
  const createMut = useCreateNotReadyReason();
  const deleteMut = useDeleteNotReadyReason();
  const updateMut = useUpdateNotReadyReason();
  const { toast } = useToast();
  const [form, setForm] = React.useState({ key: "", value: "" });
  const [editing, setEditing] = React.useState<null | { id: number; key: string; value: string }>(null);

  const handleAdd = () => {
    if (!form.key.trim() || !form.value.trim()) return;
    createMut.mutate(
      { key: form.key.trim().toUpperCase(), value: form.value.trim() },
      { onSuccess: () => { toast({ title: "Reason created" }); setForm({ key: "", value: "" }); } },
    );
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="md:col-span-2 shadow-sm">
        <CardHeader>
          <CardTitle>Not-Ready Reasons</CardTitle>
          <CardDescription>Reasons agents can pick when toggling themselves off-shift (Break, Meeting, Training…).</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Key</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reasons?.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><Badge variant="secondary" className="font-mono text-xs">{r.key}</Badge></TableCell>
                    <TableCell className="font-medium">{r.value}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteMut.mutate(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {reasons?.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No reasons yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card className="shadow-sm h-fit">
        <CardHeader><CardTitle className="text-base">Add Reason</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label className="text-xs">Key</Label><Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="BREAK" className="h-9 text-sm font-mono uppercase" /></div>
          <div><Label className="text-xs">Display Label</Label><Input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="Break" className="h-9 text-sm" /></div>
          <Button className="w-full" size="sm" onClick={handleAdd} disabled={createMut.isPending}>
            <Plus className="h-4 w-4 mr-2" /> Add Reason
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Reason</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label className="text-xs">Key</Label><Input value={editing.key} onChange={(e) => setEditing({ ...editing, key: e.target.value.toUpperCase() })} className="h-9 text-sm font-mono uppercase" /></div>
              <div><Label className="text-xs">Display Label</Label><Input value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} className="h-9 text-sm" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => editing && updateMut.mutate({ id: editing.id, key: editing.key, value: editing.value }, { onSuccess: () => { setEditing(null); toast({ title: "Updated" }); } })}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
