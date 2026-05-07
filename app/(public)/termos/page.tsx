import Link from 'next/link';

export const metadata = {
  title: 'Termos de Uso · Mala na Copa',
  description: 'Termos de uso do bolão Mala na Copa — Copa do Mundo 2026.',
};

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/"
        className="text-text-muted hover:text-accent font-mono text-xs transition"
      >
        ← Voltar para a página inicial
      </Link>

      <h1 className="font-display text-text-primary mt-6 mb-2 text-4xl tracking-wide">
        Termos de Uso
      </h1>
      <p className="text-text-muted font-mono text-xs mb-10">
        Última atualização: 07/05/2026
      </p>

      <p className="text-text-secondary font-body mb-8 leading-relaxed">
        Bem-vindo ao <strong className="text-text-primary font-semibold">Mala na Copa</strong>.
        Estes termos regulam o uso da plataforma e a participação no bolão da Copa do Mundo
        FIFA 2026. Leia com atenção — ao se cadastrar e utilizar nossos serviços, você
        concorda integralmente com os termos abaixo.
      </p>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">1. Apresentação</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        O Mala na Copa é um bolão da Copa do Mundo FIFA 2026 organizado pela{' '}
        <strong className="text-text-primary font-semibold">Equipe Mala na Copa</strong>,
        operada por pessoa física, com finalidade de entretenimento e competição privada
        entre conhecidos. Não somos uma casa de apostas, não somos afiliados à FIFA e não
        estamos vinculados a qualquer entidade desportiva oficial.
      </p>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Nossa atividade observa as disposições da Lei nº 14.790/2023, do Código de Defesa
        do Consumidor (Lei nº 8.078/1990) e da Lei Geral de Proteção de Dados (Lei nº
        13.709/2018), tratando os participantes como consumidores e protegendo seus
        direitos.
      </p>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">2. Aceite dos termos</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Ao criar uma conta, comprar uma tabela ou utilizar qualquer funcionalidade da
        plataforma, você declara ter lido, entendido e aceito integralmente estes Termos
        de Uso e nossa Política de Privacidade. Caso você não concorde com qualquer
        cláusula, deve cessar imediatamente o uso do serviço.
      </p>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">3. Cadastro</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Para participar do bolão, você precisa criar uma conta com email e senha. Ao se
        cadastrar, você declara que:
      </p>
      <ul className="list-disc pl-6 text-text-secondary font-body mb-4 leading-relaxed space-y-1">
        <li>É maior de 18 anos.</li>
        <li>Os dados informados são verídicos, completos e atualizados.</li>
        <li>Manterá apenas uma conta ativa, vinculada à sua identidade.</li>
        <li>É integralmente responsável pelo sigilo de suas credenciais e por todas as ações praticadas em sua conta.</li>
      </ul>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Detectada qualquer irregularidade no cadastro — como duplicidade de contas,
        informações falsas ou tentativa de fraude — a conta poderá ser suspensa ou
        cancelada, sem prejuízo de outras medidas cabíveis.
      </p>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">4. Funcionamento do bolão</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        O bolão funciona com base em <strong className="text-text-primary font-semibold">tabelas</strong>.
        Cada tabela custa R$ 20,00 e dá direito a um conjunto independente de palpites
        sobre os 104 jogos da Copa do Mundo FIFA 2026 (fase de grupos e mata-mata) e os
        bônus pré-Copa (campeão, vice, terceiro, quarto, artilheiro e revelação).
      </p>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Os palpites de cada jogo podem ser editados livremente até o apito inicial do jogo
        em questão; após o início, o palpite fica congelado. Os bônus pré-Copa têm
        deadline único, antes do primeiro jogo da Copa.
      </p>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        A pontuação é calculada automaticamente conforme o sistema descrito na página de
        regras: placar exato, vencedor com saldo, vencedor simples e bônus aplicáveis,
        com multiplicadores progressivos no mata-mata. Em caso de empate na soma final,
        critérios de desempate são aplicados em cascata, conforme as regras públicas do
        site.
      </p>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">5. Pagamentos</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Os pagamentos são realizados exclusivamente via PIX, processados pelo Mercado
        Pago. O valor por tabela é de R$ 20,00. A confirmação do pagamento é automática:
        assim que o Mercado Pago notifica a aprovação, a tabela é liberada para inserção
        de palpites.
      </p>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Cada cobrança PIX possui prazo de expiração. Pagamentos efetuados após a
        expiração do PIX poderão não ser reconhecidos automaticamente — neste caso,
        entre em contato pelo email indicado na seção 14.
      </p>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">6. Premiação</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        O prêmio total é de <strong className="text-text-primary font-semibold">R$ 10.000,00</strong>,
        distribuído entre os três primeiros colocados do ranking final:
      </p>
      <ul className="list-disc pl-6 text-text-secondary font-body mb-4 leading-relaxed space-y-1">
        <li>1º lugar: R$ 7.000,00</li>
        <li>2º lugar: R$ 2.000,00</li>
        <li>3º lugar: R$ 1.000,00</li>
      </ul>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        O ranking é fechado após o término oficial da Copa do Mundo FIFA 2026 e a
        homologação dos resultados pelo operador. O pagamento dos prêmios é realizado
        via PIX, na chave informada pelo ganhador, em até{' '}
        <strong className="text-text-primary font-semibold">30 (trinta) dias</strong>{' '}
        contados da homologação.
      </p>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">7. Cashback (bônus)</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Em adição à premiação principal, oferecemos um bônus de cashback condicional. As
        regras são:
      </p>
      <ul className="list-disc pl-6 text-text-secondary font-body mb-4 leading-relaxed space-y-1">
        <li>Aplica-se apenas a bilhetes com valor pago igual ou superior a R$ 100,00.</li>
        <li>O participante escolhe, no momento da compra, uma seleção entre as 13 elegíveis.</li>
        <li>Cada seleção elegível possui um multiplicador (1×, 2×, 3× ou 5×), exibido no momento da escolha.</li>
        <li>Se a seleção escolhida for a campeã da Copa do Mundo FIFA 2026, o participante recebe um cashback equivalente ao valor pago no bilhete multiplicado pelo multiplicador da seleção (por exemplo: bilhete de R$ 100,00 × seleção com multiplicador 5× = R$ 500,00 de cashback).</li>
        <li>Caso a seleção escolhida não seja campeã, nenhum valor é devolvido a título de cashback.</li>
      </ul>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        O multiplicador da seleção, vigente no momento da compra, é registrado no bilhete
        e prevalece sobre eventuais alterações posteriores. O pagamento do cashback é
        realizado via PIX, na chave informada pelo participante, após o término oficial
        da Copa.
      </p>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">8. Reembolso</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        O participante pode solicitar o reembolso integral de uma tabela em até{' '}
        <strong className="text-text-primary font-semibold">24 (vinte e quatro) horas</strong>{' '}
        após a confirmação do pagamento, desde que a solicitação seja feita{' '}
        <strong className="text-text-primary font-semibold">antes do início do primeiro jogo da Copa do Mundo FIFA 2026</strong>{' '}
        (11/06/2026). A solicitação deve ser feita pelo email indicado na seção 14, e o
        reembolso é processado via PIX na mesma chave/conta de origem do pagamento.
      </p>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Após o início do primeiro jogo da Copa, o produto é considerado consumido e não
        há mais possibilidade de reembolso, ressalvadas hipóteses legais aplicáveis ao
        Código de Defesa do Consumidor.
      </p>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">9. Conduta do usuário</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Ao usar a plataforma, você se compromete a não:
      </p>
      <ul className="list-disc pl-6 text-text-secondary font-body mb-4 leading-relaxed space-y-1">
        <li>Criar mais de uma conta para si mesmo ou usar identidade falsa.</li>
        <li>Tentar fraudar o sistema de palpites, pagamentos ou ranking.</li>
        <li>Automatizar a inserção de palpites por meio de scripts, bots ou ferramentas similares.</li>
        <li>Realizar engenharia reversa, sondar vulnerabilidades ou tentar acessar áreas restritas.</li>
        <li>Usar a marca, o nome ou o conteúdo do site sem autorização expressa.</li>
        <li>Praticar qualquer ato ilícito, ofensivo ou que viole direitos de terceiros.</li>
      </ul>

      {/* TODO_LEGAL: revisar com advogado — cláusula de suspensão e cancelamento */}
      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">
        10. Suspensão e cancelamento
      </h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        O operador poderá suspender ou cancelar, a qualquer tempo e sem aviso prévio, a
        conta de qualquer participante que viole estes Termos de Uso, a legislação
        vigente ou que adote conduta incompatível com a finalidade do bolão. Em casos de
        violação grave — como fraude comprovada — o operador poderá ainda reter
        eventuais valores devidos ao participante, sem prejuízo de medidas legais
        cabíveis.
      </p>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        O participante poderá, a qualquer momento, solicitar o cancelamento de sua conta
        pelo email indicado na seção 14. O cancelamento da conta não afeta as regras de
        reembolso descritas na seção 8.
      </p>

      {/* TODO_LEGAL: revisar com advogado — exclusão de responsabilidade */}
      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">11. Responsabilidades</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Atuamos com diligência para manter a plataforma estável e segura. No entanto,
        nossa responsabilidade não se estende a falhas decorrentes de:
      </p>
      <ul className="list-disc pl-6 text-text-secondary font-body mb-4 leading-relaxed space-y-1">
        <li>Instabilidade de internet ou indisponibilidade do dispositivo do usuário.</li>
        <li>Falhas, atrasos ou indisponibilidade do Mercado Pago no processamento de pagamentos.</li>
        <li>Falhas, atrasos ou indisponibilidade dos provedores de infraestrutura (Supabase, Vercel) ou de fontes de dados oficiais (API-Football).</li>
        <li>Eventos de força maior, incluindo, mas não limitados a, ataques cibernéticos, decisões judiciais, alterações regulatórias ou cancelamento da Copa do Mundo pela FIFA.</li>
      </ul>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Em caso de cancelamento integral da Copa pela FIFA antes do primeiro jogo, os
        valores pagos serão devolvidos aos participantes via PIX, no prazo razoável a
        ser comunicado.
      </p>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">12. Propriedade intelectual</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        A marca, o logo, a identidade visual, os textos e o código-fonte da plataforma
        Mala na Copa são de titularidade exclusiva da Equipe Mala na Copa. Qualquer uso
        não autorizado — incluindo reprodução, distribuição, modificação ou criação de
        obras derivadas — é vedado e sujeita o infrator às sanções civis e criminais
        cabíveis.
      </p>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Marcas, logotipos e expressões de terceiros eventualmente exibidos no site —
        como nomes de seleções nacionais e da própria FIFA — pertencem a seus
        respectivos titulares e são utilizados apenas para fins de identificação dos
        eventos esportivos, sem qualquer vínculo de afiliação.
      </p>

      {/* TODO_LEGAL: revisar com advogado — cláusula de foro */}
      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">13. Foro</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Fica eleito o foro do domicílio do consumidor para dirimir quaisquer
        controvérsias decorrentes destes Termos, em conformidade com o artigo 101,
        inciso I, da Lei nº 8.078/1990 (Código de Defesa do Consumidor).
      </p>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">14. Contato e atualização dos termos</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Para qualquer dúvida, solicitação ou notificação relacionada a estes Termos —
        incluindo cancelamento de conta, pedido de reembolso ou exercício de direitos —
        entre em contato pelo email{' '}
        <strong className="text-text-primary font-semibold">contato@malanacopa.com.br</strong>.
      </p>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Estes Termos podem ser atualizados a qualquer tempo para refletir mudanças
        legais, operacionais ou estratégicas. Atualizações relevantes serão comunicadas
        aos usuários cadastrados, e a data da última revisão consta sempre no topo desta
        página. O uso continuado da plataforma após a publicação de uma atualização
        configura aceitação tácita da nova versão.
      </p>
    </main>
  );
}
