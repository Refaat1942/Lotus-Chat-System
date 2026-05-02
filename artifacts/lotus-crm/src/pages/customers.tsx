import React, { useState } from "react";
import {
  useListCustomers,
  useCreateCustomer,
  useGetCustomer,
  useGetCustomerConversations,
  getListCustomersQueryKey,
  getGetCustomerQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import {
  Search, Plus, Phone, MapPin, FileText, User,
  MessageSquare, Clock, ChevronRight, ArrowLeft,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem,
  FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const createCustomerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(10, "Valid phone number required"),
  branch: z.string().optional(),
  tags: z.string().optional(),
  notes: z.string().optional(),
  prescriptionNotes: z.string().optional(),
});

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  const { data: customers, isLoading } = useListCustomers({
    search: search || undefined,
    branch: branchFilter === "all" ? undefined : branchFilter,
  });

  if (selectedCustomerId !== null) {
    return (
      <CustomerDetailView
        customerId={selectedCustomerId}
        onBack={() => setSelectedCustomerId(null)}
      />
    );
  }

  return (
    <div className="flex-1 space-y-6 p-8 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Patient Directory</h2>
          <p className="text-muted-foreground">
            Manage and view patient histories across all branches.
          </p>
        </div>
        <CreateCustomerDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or tags..."
            className="pl-9 bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-[180px] bg-background">
            <SelectValue placeholder="Branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            <SelectItem value="Downtown">Downtown</SelectItem>
            <SelectItem value="Westside">Westside</SelectItem>
            <SelectItem value="North">North Hills</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell />
                </TableRow>
              ))
              : customers?.length === 0
                ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      <User className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      No patients found matching your criteria.
                    </TableCell>
                  </TableRow>
                )
                : customers?.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className="hover:bg-muted/50 cursor-pointer transition-colors group"
                    onClick={() => setSelectedCustomerId(customer.id)}
                    data-testid={`customer-row-${customer.id}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border border-border/50">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {customer.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{customer.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-muted-foreground text-sm">
                        <Phone className="h-3 w-3 mr-2" />
                        {customer.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.branch
                        ? (
                          <div className="flex items-center text-sm">
                            <MapPin className="h-3 w-3 mr-1.5 text-muted-foreground" />
                            {customer.branch}
                          </div>
                        )
                        : <span className="text-muted-foreground text-sm">-</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {customer.tags?.map((tag, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="font-normal text-[10px] px-1.5 h-5 bg-background"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(parseISO(customer.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CustomerDetailView({
  customerId,
  onBack,
}: {
  customerId: number;
  onBack: () => void;
}) {
  const { data: customer, isLoading } = useGetCustomer(customerId, {
    query: { queryKey: getGetCustomerQueryKey(customerId) },
  });
  const { data: conversations, isLoading: convsLoading } = useGetCustomerConversations(customerId);

  if (isLoading) {
    return (
      <div className="flex-1 p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-6">
          <Skeleton className="h-48 col-span-1" />
          <Skeleton className="h-48 col-span-2" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Customer not found.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <h2 className="text-2xl font-bold tracking-tight">{customer.name}</h2>
        <div className="flex gap-1 ml-1">
          {customer.tags?.map((tag, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile card */}
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                    {customer.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base">{customer.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{customer.branch ?? "No branch"}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{customer.phone}</span>
              </div>
              {customer.branch && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{customer.branch}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>Joined {format(parseISO(customer.createdAt), "MMM d, yyyy")}</span>
              </div>
            </CardContent>
          </Card>

          {customer.prescriptionNotes && (
            <Card className="shadow-sm border-blue-200 bg-blue-50/30 dark:bg-blue-900/10 dark:border-blue-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                  <FileText className="h-3.5 w-3.5" />
                  Clinical / Prescription Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {customer.prescriptionNotes}
                </p>
              </CardContent>
            </Card>
          )}

          {customer.notes && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">General Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {customer.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Conversation history */}
        <div className="md:col-span-2 space-y-4">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Conversation History
            <span className="text-muted-foreground font-normal text-sm">
              ({conversations?.length ?? 0} total)
            </span>
          </h3>

          {convsLoading
            ? Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))
            : conversations?.length === 0
              ? (
                <Card className="shadow-sm">
                  <CardContent className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                    <div className="text-center">
                      <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-20" />
                      No conversations yet
                    </div>
                  </CardContent>
                </Card>
              )
              : conversations?.map((conv) => (
                <Card
                  key={conv.id}
                  className="shadow-sm hover:shadow-md transition-shadow cursor-default"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant={
                              conv.status === "open"
                                ? "default"
                                : conv.status === "resolved"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-[10px] h-5 px-1.5 capitalize"
                          >
                            {conv.status}
                          </Badge>
                          {conv.tags?.map((tag, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-[10px] h-5 px-1.5"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        {conv.lastMessage && (
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.lastMessage}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {conv.lastMessageAt
                          ? formatDistanceToNow(parseISO(conv.lastMessageAt), {
                            addSuffix: true,
                          })
                          : format(parseISO(conv.createdAt), "MMM d")}
                      </div>
                    </div>
                    {conv.assignedAgent && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                            {conv.assignedAgent.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{conv.assignedAgent.name}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
        </div>
      </div>
    </div>
  );
}

function CreateCustomerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMut = useCreateCustomer();

  const form = useForm<z.infer<typeof createCustomerSchema>>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      name: "",
      phone: "",
      branch: "",
      tags: "",
      notes: "",
      prescriptionNotes: "",
    },
  });

  const onSubmit = (values: z.infer<typeof createCustomerSchema>) => {
    const tagsArray = values.tags
      ? values.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    createMut.mutate(
      {
        data: {
          name: values.name,
          phone: values.phone,
          branch: values.branch,
          tags: tagsArray,
          notes: values.notes,
          prescriptionNotes: values.prescriptionNotes,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Patient profile created successfully" });
          queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
          form.reset();
          onOpenChange(false);
        },
        onError: () => {
          toast({ title: "Failed to create profile", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="btn-create-customer">
          <Plus className="h-4 w-4 mr-2" />
          Add Patient
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Create Patient Profile</DialogTitle>
          <DialogDescription>
            Add a new patient to the CRM. This allows agents to attach clinical notes to their profile.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 (555) 000-0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="branch"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Home Branch</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Downtown">Downtown</SelectItem>
                        <SelectItem value="Westside">Westside</SelectItem>
                        <SelectItem value="North">North Hills</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags (comma separated)</FormLabel>
                    <FormControl>
                      <Input placeholder="VIP, Diabetic, Delivery..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="prescriptionNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-blue-600 dark:text-blue-400">
                    <FileText className="h-3 w-3 mr-1.5" />
                    Clinical / Prescription Notes
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Medication allergies, current prescriptions, dosage instructions..."
                      className="resize-none border-blue-200 focus-visible:ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-900"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>General Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Delivery instructions, preferred contact times..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
