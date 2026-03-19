
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { auditContent } from './audit-content';
import { 
    CheckCircle2, 
    AlertCircle, 
    Cpu, 
    TrendingUp, 
    DollarSign, 
    Map, 
    Drama, 
    ArrowRight,
    Search,
    ShieldCheck,
    Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function AuditDisplay() {
    const data = auditContent;

    return (
        <div className="space-y-12 pb-24">
            {/* A. EXECUTIVE SUMMARY */}
            <section className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <Drama className="h-6 w-6" />
                    </div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter italic">Executive Summary</h2>
                </div>
                <Card className="rounded-[2.5rem] border-0 shadow-xl bg-indigo-900 text-white p-8">
                    <p className="text-lg font-bold leading-relaxed opacity-90 italic">
                        "{data.executiveSummary.trim()}"
                    </p>
                </Card>
            </section>

            {/* B. FEATURE INVENTORY */}
            <section className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 px-1">Feature Inventory (Detected & Inferred)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {data.featureInventory.map(f => (
                        <Card key={f.title} className="rounded-3xl border-0 shadow-lg bg-white overflow-hidden group hover:shadow-2xl transition-all">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <Badge variant="outline" className="text-[8px] font-black uppercase border-green-200 text-green-600">{f.status}</Badge>
                                    <CheckCircle2 className="h-4 w-4 text-primary opacity-20 group-hover:opacity-100" />
                                </div>
                                <CardTitle className="text-sm font-black uppercase mt-2">{f.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-[10px] font-bold text-gray-500 leading-tight">{f.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* C. SYSTEM ARCHITECTURE */}
            <div className="grid md:grid-cols-2 gap-8">
                <section className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 px-1">Technical Stack (Reverse-Engineered)</h3>
                    <Card className="rounded-[2.5rem] border-0 shadow-xl p-8 space-y-6 bg-slate-900 text-white">
                        {Object.entries(data.architecture).map(([key, val]) => (
                            <div key={key} className="space-y-1">
                                <p className="text-[8px] font-black uppercase tracking-widest text-primary/60">{key}</p>
                                <p className="text-xs font-bold">{val}</p>
                            </div>
                        ))}
                    </Card>
                </section>

                <section className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 px-1">Performance & Cost Risks</h3>
                    <div className="space-y-4">
                        {data.costRisks.map(r => (
                            <Card key={r.area} className="rounded-[2rem] border-0 shadow-lg p-6 bg-white border-l-4 border-amber-500">
                                <div className="flex gap-4">
                                    <AlertCircle className="h-6 w-6 text-amber-500 shrink-0" />
                                    <div className="space-y-2">
                                        <p className="font-black uppercase text-xs tracking-tight">{r.area}</p>
                                        <p className="text-[11px] font-bold text-gray-600 leading-tight">{r.risk}</p>
                                        <div className="p-2 bg-green-50 rounded-lg border border-green-100 flex items-center gap-2">
                                            <Zap className="h-3 w-3 text-green-600" />
                                            <p className="text-[9px] font-black text-green-800 uppercase tracking-tighter">Fix: {r.fix}</p>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </section>
            </div>

            {/* G. GROWTH ENGINE */}
            <section className="space-y-4">
                <div className="flex items-center gap-3">
                    <TrendingUp className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl font-black uppercase tracking-tight">Growth & Scale Engine</h2>
                </div>
                <Card className="rounded-[2.5rem] border-0 shadow-xl p-8 bg-white whitespace-pre-wrap text-sm font-bold text-gray-700 leading-relaxed">
                    {data.growthEngine.trim()}
                </Card>
            </section>

            {/* J. ROADMAP */}
            <section className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 px-1">The 3-Phase Roadmap</h3>
                <div className="space-y-4">
                    {data.roadmap.map((r, i) => (
                        <div key={r.phase} className="flex gap-6 items-start">
                            <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-white font-black shrink-0 shadow-lg shadow-primary/20">
                                {i + 1}
                            </div>
                            <Card className="flex-1 rounded-3xl border-0 shadow-lg p-6 group hover:border-primary/30 border-2 border-transparent transition-all">
                                <CardTitle className="text-base font-black uppercase tracking-tight mb-4">{r.phase}</CardTitle>
                                <div className="flex flex-wrap gap-2">
                                    {r.items.map(item => (
                                        <Badge key={item} variant="secondary" className="rounded-lg font-bold text-[10px] uppercase h-8 px-3">{item}</Badge>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    ))}
                </div>
            </section>

            {/* K. FINAL VERDICT */}
            <section className="pt-10 border-t border-black/5">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-4xl font-black uppercase tracking-tighter italic">Final Verdict</h2>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase opacity-40">Founder/Investor Score</p>
                        <p className="text-5xl font-black text-primary tracking-tighter">{data.verdict.score}</p>
                    </div>
                </div>
                <Card className="rounded-[3rem] border-0 shadow-2xl bg-gray-950 text-white p-10 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
                        <ShieldCheck className="h-48 w-48 text-primary" />
                    </div>
                    <div className="relative z-10 space-y-4">
                        <p className="text-xl font-bold leading-relaxed text-primary/90">
                            "The platform is Investor-Ready."
                        </p>
                        <p className="text-sm font-medium text-white/60 leading-relaxed max-w-2xl">
                            {data.verdict.summary}
                        </p>
                    </div>
                </Card>
            </section>
        </div>
    );
}
