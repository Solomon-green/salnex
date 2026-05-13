"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, ToggleLeft, ToggleRight, Filter } from "lucide-react";
import type { JobFilter } from "@/lib/types";

const UPWORK_CATEGORIES = [
  "Web Development", "Mobile Development", "Design & Creative",
  "Writing & Translation", "Admin & Customer Support", "Data Science & Analytics",
  "Engineering & Architecture", "Finance & Accounting", "Legal", "Marketing",
];

const EXPERIENCE_LEVELS = ["ENTRY", "INTERMEDIATE", "EXPERT"];
const JOB_TYPES = ["HOURLY", "FIXED_PRICE"];

export default function FiltersPage() {
  const [filters, setFilters] = useState<JobFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    skills: "",
    categories: [] as string[],
    job_types: [] as string[],
    experience_levels: [] as string[],
    keywords: "",
    excluded_keywords: "",
    min_budget: "",
    max_budget: "",
    min_hourly_rate: "",
    max_hourly_rate: "",
  });

  useEffect(() => {
    fetchFilters();
  }, []);

  async function fetchFilters() {
    const res = await fetch("/api/filters");
    if (res.ok) {
      const data = await res.json();
      setFilters(data);
    }
    setLoading(false);
  }

  function toggleArray(arr: string[], value: string) {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        keywords: form.keywords.split(",").map((s) => s.trim()).filter(Boolean),
        excluded_keywords: form.excluded_keywords.split(",").map((s) => s.trim()).filter(Boolean),
        min_budget: form.min_budget ? parseFloat(form.min_budget) : undefined,
        max_budget: form.max_budget ? parseFloat(form.max_budget) : undefined,
        min_hourly_rate: form.min_hourly_rate ? parseFloat(form.min_hourly_rate) : undefined,
        max_hourly_rate: form.max_hourly_rate ? parseFloat(form.max_hourly_rate) : undefined,
      }),
    });
    if (res.ok) {
      setOpen(false);
      fetchFilters();
    }
  }

  async function toggleFilter(id: string, is_active: boolean) {
    await fetch(`/api/filters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !is_active }),
    });
    fetchFilters();
  }

  async function deleteFilter(id: string) {
    await fetch(`/api/filters/${id}`, { method: "DELETE" });
    fetchFilters();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Job Filters</h1>
          <p className="text-muted-foreground">Configure what types of jobs you want to receive</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="h-4 w-4 mr-2" /> New Filter
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Job Filter</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-1">
                <Label>Filter Name</Label>
                <Input placeholder="e.g. React Dev Jobs" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Skills (comma-separated)</Label>
                <Input placeholder="React, TypeScript, Node.js" value={form.skills}
                  onChange={(e) => setForm({ ...form, skills: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Keywords (comma-separated)</Label>
                <Input placeholder="e.g. dashboard, SaaS" value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Exclude Keywords (comma-separated)</Label>
                <Input placeholder="e.g. crypto, NFT" value={form.excluded_keywords}
                  onChange={(e) => setForm({ ...form, excluded_keywords: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>Categories</Label>
                <div className="flex flex-wrap gap-2">
                  {UPWORK_CATEGORIES.map((cat) => (
                    <Badge
                      key={cat}
                      variant={form.categories.includes(cat) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setForm({ ...form, categories: toggleArray(form.categories, cat) })}
                    >
                      {cat}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Job Types</Label>
                <div className="flex gap-2">
                  {JOB_TYPES.map((t) => (
                    <Badge
                      key={t}
                      variant={form.job_types.includes(t) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setForm({ ...form, job_types: toggleArray(form.job_types, t) })}
                    >
                      {t === "HOURLY" ? "Hourly" : "Fixed Price"}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Experience Level</Label>
                <div className="flex gap-2">
                  {EXPERIENCE_LEVELS.map((lvl) => (
                    <Badge
                      key={lvl}
                      variant={form.experience_levels.includes(lvl) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setForm({ ...form, experience_levels: toggleArray(form.experience_levels, lvl) })}
                    >
                      {lvl.charAt(0) + lvl.slice(1).toLowerCase()}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Min Budget ($)</Label>
                  <Input type="number" placeholder="0" value={form.min_budget}
                    onChange={(e) => setForm({ ...form, min_budget: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Max Budget ($)</Label>
                  <Input type="number" placeholder="10000" value={form.max_budget}
                    onChange={(e) => setForm({ ...form, max_budget: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Min Hourly Rate ($/hr)</Label>
                  <Input type="number" placeholder="20" value={form.min_hourly_rate}
                    onChange={(e) => setForm({ ...form, min_hourly_rate: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Max Hourly Rate ($/hr)</Label>
                  <Input type="number" placeholder="200" value={form.max_hourly_rate}
                    onChange={(e) => setForm({ ...form, max_hourly_rate: e.target.value })} />
                </div>
              </div>

              <Button type="submit" className="w-full">Create Filter</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading filters...</p>
      ) : filters.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No filters yet</h3>
            <p className="text-muted-foreground mt-1">Create a filter to start receiving matched Upwork jobs.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filters.map((filter) => (
            <Card key={filter.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{filter.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleFilter(filter.id, filter.is_active)}>
                      {filter.is_active
                        ? <ToggleRight className="h-6 w-6 text-primary" />
                        : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                    </button>
                    <Button variant="ghost" size="icon" onClick={() => deleteFilter(filter.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 text-sm">
                  {filter.skills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                  {filter.categories.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}
                  {filter.job_types.map((t) => <Badge key={t}>{t}</Badge>)}
                  {filter.min_budget && (
                    <Badge variant="outline">Budget: ${filter.min_budget}+</Badge>
                  )}
                  {filter.min_hourly_rate && (
                    <Badge variant="outline">Rate: ${filter.min_hourly_rate}+/hr</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
