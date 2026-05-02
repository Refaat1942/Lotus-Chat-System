import React from "react";
import { 
  useListUsers, useCreateUser, useDeleteUser,
  useListTags, useCreateTag, useDeleteTag,
  useListQuickReplies, useCreateQuickReply, useDeleteQuickReply,
  getListUsersQueryKey, getListTagsQueryKey, getListQuickRepliesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { Trash2, Plus, Shield, Users, Tag as TagIcon, MessageSquare } from "lucide-react";

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

function UsersSettings() {
  const { data: users, isLoading } = useListUsers();
  const createMut = useCreateUser();
  const deleteMut = useDeleteUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)} className="text-destructive hover:bg-destructive/10 h-8 w-8">
                      <Trash2 className="h-4 w-4" />
                    </Button>
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