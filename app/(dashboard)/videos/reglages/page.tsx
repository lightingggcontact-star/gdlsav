"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Settings, Save, ToggleLeft, ToggleRight, Copy, Check } from "lucide-react"
import type { StoriesSettings } from "@/lib/types"

const COLOR_SWATCHES = [
  { label: "Violet", value: "#9333ea" },
  { label: "Rose", value: "#ec4899" },
  { label: "Orange", value: "#f97316" },
  { label: "Bleu", value: "#007AFF" },
  { label: "Vert", value: "#047B5D" },
]

function SubNav() {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
      <Link
        href="/videos"
        className="rounded-md px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Bibliothèque
      </Link>
      <Link
        href="/videos/produits"
        className="rounded-md px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Par produit
      </Link>
      <Link
        href="/videos/reglages"
        className="rounded-md bg-card px-3 py-1.5 text-[12px] font-medium shadow-sm"
      >
        Réglages
      </Link>
    </div>
  )
}

function generateSnippet(apiBase: string) {
  return `<!-- GDL Video Stories -->
<div id="gdl-stories" data-product-id="{{ product.id }}" style="margin: 16px 0;"></div>
<script>
(function(){
  var API='${apiBase}';
  var c=document.getElementById('gdl-stories');
  if(!c)return;
  var pid=c.dataset.productId;
  if(!pid)return;

  // Styles
  var s=document.createElement('style');
  s.textContent=\`
    .gdl-sr{display:flex;gap:12px;padding:16px 0;overflow-x:auto;scrollbar-width:none}
    .gdl-sr::-webkit-scrollbar{display:none}
    .gdl-sc{flex-shrink:0;cursor:pointer;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px}
    .gdl-ring{border-radius:50%;padding:3px;background:linear-gradient(135deg,#9333ea,#ec4899,#f97316)}
    .gdl-th{width:var(--gdl-cs,80px);height:var(--gdl-cs,80px);border-radius:50%;object-fit:cover;border:3px solid #fff;display:block;background:#f3f3f3}
    .gdl-lb{font-size:11px;color:#666;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .gdl-po{position:fixed;bottom:20px;right:20px;z-index:99999;width:350px;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.3);background:#000;aspect-ratio:9/16}
    @media(max-width:768px){.gdl-po{position:fixed;inset:0;width:100%;height:100%;border-radius:0;bottom:auto;right:auto}}
    .gdl-pv{width:100%;height:100%;object-fit:cover}
    .gdl-px{position:absolute;top:12px;right:12px;background:rgba(0,0,0,.5);border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center}
    .gdl-pn{position:absolute;top:0;bottom:0;width:40%;background:transparent;border:none;cursor:pointer}
    .gdl-pp{left:0}.gdl-pnx{right:0}
    .gdl-pb{display:flex;gap:4px;position:absolute;top:8px;left:12px;right:12px}
    .gdl-ps{flex:1;height:3px;background:rgba(255,255,255,.3);border-radius:2px;overflow:hidden}
    .gdl-pf{height:100%;background:#fff;width:0%;transition:width .1s linear}
    .gdl-pl{position:absolute;bottom:20px;left:16px;right:60px;color:#fff;font-size:14px;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,.5)}
    .gdl-pm{position:absolute;bottom:20px;right:16px;background:rgba(0,0,0,.5);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center}
  \`;
  document.head.appendChild(s);

  // Fetch
  fetch(API+'/api/videos/product/'+pid)
    .then(function(r){return r.json()})
    .then(function(d){
      if(!d.videos||!d.videos.length)return;
      if(d.settings&&d.settings.circle_size)c.style.setProperty('--gdl-cs',d.settings.circle_size+'px');
      render(d.videos);
    })
    .catch(function(e){console.warn('GDL Stories:',e)});

  function render(videos){
    var row=document.createElement('div');row.className='gdl-sr';
    videos.forEach(function(v,i){
      var el=document.createElement('div');el.className='gdl-sc';
      el.innerHTML='<div class="gdl-ring"><img class="gdl-th" src="'+(v.thumbnail||'')+'" alt="'+v.label+'" onerror="this.style.background=\\'#9333ea40\\'"></div><span class="gdl-lb">'+(v.emoji||'')+' '+v.label+'</span>';
      el.addEventListener('click',function(){open(videos,i)});
      row.appendChild(el);
    });
    c.appendChild(row);
  }

  var pl=null,ci=0,mt=true,pi=null;
  function open(videos,si){
    ci=si;if(pl)pl.remove();
    pl=document.createElement('div');pl.className='gdl-po';
    pl.innerHTML='<div class="gdl-pb">'+videos.map(function(){return'<div class="gdl-ps"><div class="gdl-pf"></div></div>'}).join('')+'</div><video class="gdl-pv" playsinline muted autoplay></video><button class="gdl-px">&times;</button><button class="gdl-pn gdl-pp"></button><button class="gdl-pn gdl-pnx"></button><div class="gdl-pl"></div><button class="gdl-pm">\\uD83D\\uDD07</button>';
    document.body.appendChild(pl);
    var ve=pl.querySelector('.gdl-pv'),lb=pl.querySelector('.gdl-pl'),mb=pl.querySelector('.gdl-pm'),xb=pl.querySelector('.gdl-px'),pb=pl.querySelector('.gdl-pn.gdl-pp'),nb=pl.querySelector('.gdl-pn.gdl-pnx');
    function ld(idx){ci=idx;var v=videos[idx];ve.src=v.url;ve.muted=mt;ve.play().catch(function(){});lb.textContent=(v.emoji||'')+' '+v.label;up(videos.length,idx)}
    function up(t,a){var segs=pl.querySelectorAll('.gdl-pf');segs.forEach(function(s,i){s.style.width=i<a?'100%':'0%'});if(pi)clearInterval(pi);pi=setInterval(function(){if(ve.duration){segs[a].style.width=(ve.currentTime/ve.duration*100)+'%'}},100)}
    ve.addEventListener('ended',function(){if(ci<videos.length-1)ld(ci+1);else cls()});
    xb.addEventListener('click',cls);
    pb.addEventListener('click',function(){if(ci>0)ld(ci-1)});
    nb.addEventListener('click',function(){if(ci<videos.length-1)ld(ci+1);else cls()});
    mb.addEventListener('click',function(){mt=!mt;ve.muted=mt;mb.textContent=mt?'\\uD83D\\uDD07':'\\uD83D\\uDD0A'});
    var tx=0;
    pl.addEventListener('touchstart',function(e){tx=e.touches[0].clientX},{passive:true});
    pl.addEventListener('touchend',function(e){var d=e.changedTouches[0].clientX-tx;if(Math.abs(d)>50){if(d<0&&ci<videos.length-1)ld(ci+1);else if(d>0&&ci>0)ld(ci-1)}},{passive:true});
    document.addEventListener('keydown',esc);
    ld(si);
  }
  function esc(e){if(e.key==='Escape')cls()}
  function cls(){if(pi)clearInterval(pi);document.removeEventListener('keydown',esc);if(pl){pl.remove();pl=null}}
})();
</script>`
}

export default function ReglagesPage() {
  const [settings, setSettings] = useState<StoriesSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/stories/settings")
        if (res.ok) {
          const data = await res.json()
          setSettings(data.settings)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch("/api/stories/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: settings.enabled,
          circle_size: settings.circle_size,
          border_color: settings.border_color,
          border_style: settings.border_style,
          position: settings.position,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  function handleCopySnippet() {
    const apiBase = typeof window !== "undefined" ? window.location.origin : ""
    navigator.clipboard.writeText(generateSnippet(apiBase))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-card" />
        <div className="h-[300px] animate-pulse rounded-lg border border-border bg-card" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-12">
        <Settings className="h-8 w-8 text-muted-foreground" />
        <p className="text-[13px] text-muted-foreground">
          Réglages non trouvés. Exécutez le SQL de création des tables.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Video Stories</h1>
          <p className="text-[13px] text-muted-foreground">Réglages et snippet</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-[#007AFF] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#0066DD] disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Sauvegarde..." : saved ? "Sauvegardé !" : "Sauvegarder"}
        </button>
      </div>

      <SubNav />

      {/* Toggle on/off */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-foreground">État des stories</h3>
            <p className="text-[12px] text-muted-foreground">
              {settings.enabled
                ? "Les stories sont visibles sur les pages produit."
                : "Les stories sont masquées."}
            </p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
            className="text-foreground transition-colors"
          >
            {settings.enabled ? (
              <ToggleRight className="h-10 w-10 text-[#047B5D]" />
            ) : (
              <ToggleLeft className="h-10 w-10 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Taille des ronds */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
        <h3 className="text-[14px] font-semibold text-foreground mb-3">Taille des ronds</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground">Diamètre</span>
            <span className="text-[13px] font-semibold">{settings.circle_size}px</span>
          </div>
          <input
            type="range"
            min={50}
            max={120}
            step={5}
            value={settings.circle_size}
            onChange={(e) => setSettings({ ...settings, circle_size: parseInt(e.target.value) })}
            className="w-full accent-[#007AFF]"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>50px</span>
            <span>120px</span>
          </div>
        </div>

        {/* Preview */}
        <div className="mt-4 flex items-center gap-3">
          <div
            className="rounded-full p-[3px] bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400"
          >
            <div
              className="rounded-full border-[3px] border-white bg-secondary"
              style={{ width: settings.circle_size, height: settings.circle_size }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground">Preview</span>
        </div>
      </div>

      {/* Couleur de bordure */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
        <h3 className="text-[14px] font-semibold text-foreground mb-3">Couleur de bordure</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {COLOR_SWATCHES.map((sw) => (
            <button
              key={sw.value}
              onClick={() => setSettings({ ...settings, border_color: sw.value })}
              className={`h-8 w-8 rounded-full border-2 transition-all ${
                settings.border_color === sw.value
                  ? "border-foreground scale-110"
                  : "border-transparent hover:border-muted-foreground"
              }`}
              style={{ backgroundColor: sw.value }}
              title={sw.label}
            />
          ))}
          <input
            type="text"
            value={settings.border_color}
            onChange={(e) => setSettings({ ...settings, border_color: e.target.value })}
            className="ml-2 w-24 rounded-lg border border-border bg-background px-2 py-1 text-[12px] font-mono outline-none focus:border-[#007AFF]"
            placeholder="#hex"
          />
        </div>
      </div>

      {/* Style de bordure */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
        <h3 className="text-[14px] font-semibold text-foreground mb-3">Style de bordure</h3>
        <div className="flex gap-2">
          {["gradient", "solid", "dashed"].map((style) => (
            <button
              key={style}
              onClick={() => setSettings({ ...settings, border_style: style })}
              className={`rounded-lg px-4 py-2 text-[12px] font-medium border transition-colors ${
                settings.border_style === style
                  ? "border-[#007AFF] bg-[#EAF3FF] text-[#007AFF]"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {style === "gradient" ? "Dégradé" : style === "solid" ? "Uni" : "Pointillé"}
            </button>
          ))}
        </div>
      </div>

      {/* Position */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
        <h3 className="text-[14px] font-semibold text-foreground mb-3">Position sur la page</h3>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: "below-title", label: "Sous le titre" },
            { value: "below-price", label: "Sous le prix" },
            { value: "below-images", label: "Sous les images" },
          ].map((pos) => (
            <button
              key={pos.value}
              onClick={() => setSettings({ ...settings, position: pos.value })}
              className={`rounded-lg px-4 py-2 text-[12px] font-medium border transition-colors ${
                settings.position === pos.value
                  ? "border-[#007AFF] bg-[#EAF3FF] text-[#007AFF]"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {pos.label}
            </button>
          ))}
        </div>
      </div>

      {/* Snippet */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,.05)]">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-foreground">Snippet Shopify</h3>
            <p className="text-[12px] text-muted-foreground">
              Copie ce code et colle-le dans ton thème Shopify (section Custom Liquid sur la page produit)
            </p>
          </div>
          <button
            onClick={handleCopySnippet}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-secondary"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#047B5D]" />
                Copié !
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copier
              </>
            )}
          </button>
        </div>
        <pre className="max-h-60 overflow-auto rounded-lg bg-[#1a1a1a] p-4 text-[11px] text-green-400 font-mono leading-relaxed">
          {generateSnippet(typeof window !== "undefined" ? window.location.origin : "https://gdl-sav.vercel.app")}
        </pre>
      </div>

      {/* Last updated */}
      <p className="text-[11px] text-muted-foreground">
        Dernière modification :{" "}
        {new Date(settings.updated_at).toLocaleString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  )
}
