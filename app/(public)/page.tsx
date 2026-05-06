import { HeroSection } from '@/components/landing/HeroSection'
import { HowItWorksSection } from '@/components/landing/HowItWorksSection'
import { PrizesSection } from '@/components/landing/PrizesSection'
import { PontuacaoSection } from '@/components/landing/PontuacaoSection'
import { CashbackSection } from '@/components/landing/CashbackSection'
import { SocialProofSection } from '@/components/landing/SocialProofSection'

function SectionDivider({ variant }: { variant: 'yg' | 'gy' }) {
  const gradient =
    variant === 'yg'
      ? 'linear-gradient(90deg, transparent, rgba(250,204,21,0.4), rgba(16,185,129,0.4), transparent)'
      : 'linear-gradient(90deg, transparent, rgba(16,185,129,0.4), rgba(250,204,21,0.4), transparent)'
  return (
    <div
      aria-hidden="true"
      className="mx-auto h-px w-3/5 max-w-2xl"
      style={{ background: gradient }}
    />
  )
}

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <SectionDivider variant="yg" />
      <HowItWorksSection />
      <SectionDivider variant="gy" />
      <PrizesSection />
      <SectionDivider variant="yg" />
      <PontuacaoSection />
      <SectionDivider variant="gy" />
      <CashbackSection />
      <SectionDivider variant="yg" />
      <SocialProofSection />
    </>
  )
}
