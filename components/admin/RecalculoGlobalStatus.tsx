'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

type JobStatus = {
  id: string
  status: 'processando' | 'concluido' | 'erro'
  total_processados: number | null
  erro_msg: string | null
  started_at: string
  finished_at: string | null
}

const TIMEOUT_AVISO_MS = 10 * 60 * 1000

export function RecalculoGlobalStatus() {
  const [jobAtual, setJobAtual] = useState<JobStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createSupabaseBrowserClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function limparSubscription() {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  function iniciarMonitoramento(jobId: string) {
    limparSubscription()

    const channel = supabase
      .channel(`recalculo-job-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'recalculo_jobs', filter: `id=eq.${jobId}` },
        (payload) => {
          const job = payload.new as JobStatus
          setJobAtual(job)
          if (job.status === 'concluido') {
            toast.success(`Recálculo concluído — ${job.total_processados ?? 0} palpites processados`)
            limparSubscription()
          } else if (job.status === 'erro') {
            toast.error(`Erro no recálculo: ${job.erro_msg}`)
            limparSubscription()
          }
        },
      )
      .subscribe()
    channelRef.current = channel

    // Polling de fallback a cada 5s — também aciona o watchdog via GET
    pollingRef.current = setInterval(async () => {
      const res = await fetch(`/api/admin/recalculo-jobs/${jobId}`)
      if (!res.ok) return
      const job: JobStatus = await res.json()
      setJobAtual(job)
      if (job.status !== 'processando') {
        limparSubscription()
        if (job.status === 'concluido') {
          toast.success(`Recálculo concluído — ${job.total_processados ?? 0} palpites processados`)
        } else {
          toast.error(`Erro no recálculo: ${job.erro_msg}`)
        }
      }
    }, 5_000)
  }

  useEffect(() => () => limparSubscription(), [])

  async function handleRecalcularTudo() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/recalcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'global' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao iniciar')
      const job: JobStatus = {
        id: data.jobId,
        status: 'processando',
        total_processados: null,
        erro_msg: null,
        started_at: new Date().toISOString(),
        finished_at: null,
      }
      setJobAtual(job)
      iniciarMonitoramento(data.jobId)
      toast.info('Recálculo global iniciado em background…')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao iniciar recálculo global')
    } finally {
      setLoading(false)
    }
  }

  const travado =
    jobAtual?.status === 'processando' &&
    Date.now() - new Date(jobAtual.started_at).getTime() > TIMEOUT_AVISO_MS

  return (
    <div className="space-y-3">
      <div>
        <button
          onClick={handleRecalcularTudo}
          disabled={loading || jobAtual?.status === 'processando'}
          className="btn-sm flex items-center gap-1.5"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Iniciando…' : 'Recalcular tudo'}
        </button>
        <p className="text-text-muted mt-1 text-xs">
          Reprocessa todos os palpites e bônus em background.
        </p>
      </div>

      {jobAtual && (
        <div className="bg-bg-base border-border rounded-lg border p-3 text-sm">
          {jobAtual.status === 'processando' && (
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="text-accent animate-spin" />
              <span className="text-text-primary">Em andamento…</span>
              {travado && (
                <span className="text-warning flex items-center gap-1 text-xs">
                  <AlertCircle size={12} />
                  Pode ter travado
                </span>
              )}
            </div>
          )}
          {jobAtual.status === 'concluido' && (
            <div className="text-success">
              ✓ {jobAtual.total_processados ?? 0} palpites recalculados
              {jobAtual.finished_at && (
                <span className="text-text-muted ml-2 text-xs">
                  em {new Date(jobAtual.finished_at).toLocaleTimeString('pt-BR')}
                </span>
              )}
            </div>
          )}
          {jobAtual.status === 'erro' && (
            <div className="text-danger flex items-center gap-1.5">
              <AlertCircle size={14} />
              Erro: {jobAtual.erro_msg}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
