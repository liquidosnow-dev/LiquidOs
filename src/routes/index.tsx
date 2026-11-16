import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowUpRight, Check, ChevronDown, Code2, Eye, LoaderCircle, Monitor, Plus, Sparkles, WandSparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { BlinkClientBoundary } from '@/components/BlinkClientBoundary'
import { blink } from '@/blink/client'

type AuthState = { user: { email?: string; displayName?: string } | null; isLoading: boolean }

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Liquid Studio — AI website builder' }, { name: 'description', content: 'Turn a clear idea into a live website preview with Liquid Studio.' }] }),
  component: Home,
})

function Home() {
  return <BlinkClientBoundary fallback={<div className="min-h-dvh bg-background" />}><Builder /></BlinkClientBoundary>
}

function Builder() {
  const [auth, setAuth] = useState<AuthState>({ user: null, isLoading: true })
  const [prompt, setPrompt] = useState('')
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [mobileView, setMobileView] = useState(false)

  useEffect(() => blink.auth.onAuthStateChanged((state) => {
    setAuth({ user: state.user, isLoading: false })
  }), [])

  const generate = async (idea = prompt) => {
    if (!idea.trim()) return toast.error('Add a little detail about your website first.')
    if (!auth.user) return blink.auth.login(window.location.href)
    setLoading(true)
    setPrompt(idea)
    try {
      const { text } = await blink.ai.generateText({
        prompt: `Create a complete, beautiful, responsive single-page website as one self-contained HTML document for this brief: ${idea}. Return ONLY raw HTML, no markdown fences or explanations. Use inline CSS in a style tag, real external Unsplash image URLs, meaningful copy, accessible semantic HTML, responsive layouts, polished typography, rich color, and functional anchor navigation. Make the page feel art-directed and specific to the brief. Do not include scripts, forms that submit data, or external dependencies besides Google Fonts and images.`,
        maxTokens: 5000,
      })
      const clean = text.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/, '')
      setHtml(clean)
      setShowCode(false)
      toast.success('Your first draft is ready to explore.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The draft could not be generated. Please try again.')
    } finally { setLoading(false) }
  }

  const examples = ['A quiet luxury skincare brand', 'A portfolio for a 3D artist', 'A neighborhood coffee shop']

  return <main className="flex min-h-dvh flex-col bg-background text-foreground">
    <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-border/70 px-5 md:px-8">
      <div className="flex items-center gap-3"><div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><WandSparkles size={17} /></div><span className="font-semibold tracking-tight">liquid<span className="text-primary">.</span>studio</span><span className="hidden rounded-md border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">Early access</span></div>
      <div className="flex items-center gap-2"><span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"><span className="size-1.5 rounded-full bg-primary"/>All systems ready</span>{auth.user ? <button onClick={() => blink.auth.logout()} className="ml-3 max-w-36 truncate rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">{auth.user.displayName || auth.user.email || 'Account'}</button> : <Button onClick={() => blink.auth.login(window.location.href)} variant="outline" className="ml-2 border-border bg-transparent text-foreground hover:bg-accent">Sign in <ArrowUpRight size={14}/></Button>}</div>
    </header>
    <section className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-8 md:py-10">
      <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.22em] text-primary"><span className="size-1.5 rounded-full bg-primary"/>Your creative workspace</div><h1 className="text-3xl font-medium tracking-[-.04em] sm:text-4xl">Make something <span className="font-serif italic text-primary">real.</span></h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Start with a thought. Shape it into a website worth remembering.</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="rounded-md bg-card px-2.5 py-1.5 font-mono">01</span><span>Describe</span><span className="text-border">/</span><span className="rounded-md bg-card px-2.5 py-1.5 font-mono">02</span><span>Generate</span><span className="text-border">/</span><span className="rounded-md bg-card px-2.5 py-1.5 font-mono">03</span><span>Refine</span></div></div>
      <div className="grid min-h-[640px] overflow-hidden rounded-2xl border border-border/80 bg-card shadow-lg lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="flex flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-border px-5 py-4"><div className="flex items-center gap-2 text-sm font-medium"><span className="size-2 rounded-full bg-primary"/>New project</div><button className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="New project" onClick={() => {setHtml('');setPrompt('')}}><Plus size={16}/></button></div>
          <div className="flex flex-1 flex-col p-5"><label htmlFor="brief" className="mb-2 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">01 / The brief</label><textarea id="brief" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="A warm, editorial website for a ceramic studio in Copenhagen. Show their handmade collection, tell the founder’s story, and invite visitors to book a visit…" className="min-h-32 flex-1 resize-none rounded-xl border border-border bg-background/70 p-4 text-sm leading-6 text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground/70 lg:min-h-[185px]" />
            <div className="mt-5"><div className="mb-3 flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">A little inspiration</span><ChevronDown size={13} className="text-muted-foreground"/></div><div className="flex flex-col gap-2">{examples.map((example,i)=><button key={example} onClick={()=>{setPrompt(example);generate(example)}} className="group flex items-center justify-between rounded-lg border border-border/70 px-3 py-2.5 text-left text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-background hover:text-foreground"><span><span className="mr-2 font-mono text-[10px] text-primary/70">0{i+1}</span>{example}</span><ArrowUpRight size={13} className="opacity-0 transition group-hover:opacity-100"/></button>)}</div></div>
            <div className="mt-5 rounded-xl border border-border/70 bg-background/70 p-3.5"><div className="flex items-center gap-2 text-xs font-medium"><Sparkles size={14} className="text-primary"/>A note on your prompt</div><p className="mt-1.5 pl-[22px] text-[11px] leading-5 text-muted-foreground">The more you share about the audience and feeling, the more distinctly yours the result will be.</p></div>
            <Button onClick={()=>generate()} disabled={loading || auth.isLoading} className="mt-5 h-11 w-full bg-primary font-semibold text-primary-foreground shadow-sm transition hover:scale-[1.01] hover:bg-primary/90 active:scale-[.98]">{loading?<><LoaderCircle size={16} className="animate-spin"/>Dreaming it up…</>:<><Sparkles size={16}/>Generate website<ArrowUpRight size={15} className="ml-auto"/></>}</Button>
            {!auth.user && <p className="mt-2 text-center text-[10px] text-muted-foreground">Sign in when you’re ready to create with AI.</p>}
          </div>
          <div className="flex items-center justify-between border-t border-border px-5 py-3 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"><span>Liquid Studio / 01</span><span>Private workspace</span></div>
        </aside>
        <section className="flex min-h-[510px] flex-col bg-[#111318]">
          <div className="flex min-h-[56px] flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5 sm:px-5"><div className="flex items-center gap-2 text-xs"><span className="flex size-7 items-center justify-center rounded-lg bg-white/[.07] text-primary"><Monitor size={14}/></span><span className="text-white/80">Live preview</span><span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] text-white/45">{html?'index.html':'canvas'}</span></div><div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[.03] p-1"><button onClick={()=>setMobileView(false)} aria-label="Desktop preview" className={`rounded p-1.5 ${!mobileView?'bg-white/10 text-white':'text-white/45 hover:text-white'}`}><Monitor size={14}/></button><button onClick={()=>setMobileView(true)} aria-label="Mobile preview" className={`rounded p-1.5 ${mobileView?'bg-white/10 text-white':'text-white/45 hover:text-white'}`}><div className="h-3.5 w-2.5 rounded-[3px] border border-current"/></button><span className="mx-1 h-4 w-px bg-white/10"/><button onClick={()=>setShowCode(false)} aria-label="Show preview" className={`rounded p-1.5 ${!showCode?'bg-white/10 text-primary':'text-white/45 hover:text-white'}`}><Eye size={14}/></button><button onClick={()=>setShowCode(true)} aria-label="Show generated code" className={`rounded p-1.5 ${showCode?'bg-white/10 text-primary':'text-white/45 hover:text-white'}`}><Code2 size={14}/></button></div></div>
          <div className="flex flex-1 items-start justify-center overflow-auto p-3 sm:p-6">{html ? showCode?<pre className="max-h-[560px] w-full overflow-auto rounded-xl border border-white/10 bg-[#0d0f12] p-5 font-mono text-xs leading-6 text-white/70">{html}</pre>:<div className={`min-h-[480px] overflow-hidden rounded-xl bg-white shadow-2xl transition-all duration-300 ${mobileView?'w-[390px] max-w-full':'w-full'}`}><iframe title="Generated website preview" srcDoc={html} sandbox="" className="h-[640px] w-full border-0" /></div>:<div className="flex min-h-[460px] w-full flex-col items-center justify-center px-6 text-center"><div className="relative mb-7 flex size-20 items-center justify-center rounded-[28px] border border-white/10 bg-white/[.035]"><div className="absolute inset-2 rounded-[20px] border border-dashed border-white/10"/><WandSparkles size={25} className="text-primary"/><span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-primary shadow-[0_0_18px_oklch(0.87_0.22_130/.65)]"/></div><div className="font-mono text-[10px] uppercase tracking-[.2em] text-white/40">Your canvas is ready</div><p className="mt-3 max-w-sm text-sm leading-6 text-white/65">Describe what you’re imagining and your first draft will take shape right here.</p><div className="mt-7 flex flex-wrap justify-center gap-2">{['Responsive by default','Made for your idea','Ready to refine'].map((tag)=><span key={tag} className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-white/45"><Check size={11} className="text-primary"/>{tag}</span>)}</div><button onClick={()=>document.getElementById('brief')?.focus()} className="mt-8 flex items-center gap-2 text-xs text-primary transition hover:gap-3">Start with a prompt <ArrowUpRight size={13}/></button></div>}</div>
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 font-mono text-[9px] uppercase tracking-wider text-white/35 sm:px-5"><span>{loading?'Generating your first draft':html?'Preview / sandboxed':'Waiting for your first prompt'}</span><span>100% canvas</span></div>
        </section>
      </div>
      <footer className="mt-5 flex flex-col justify-between gap-2 text-[10px] text-muted-foreground sm:flex-row sm:items-center"><span>Ideas are yours. Start messy, refine as you go.</span><span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-primary"/>Built for the next thing.</span></footer>
    </section>
  </main>
}
