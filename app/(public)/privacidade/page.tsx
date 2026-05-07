import Link from 'next/link';

export const metadata = {
  title: 'Política de Privacidade',
  description: 'Como tratamos seus dados pessoais no bolão Mala na Copa, conforme a LGPD.',
};

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/"
        className="text-text-muted hover:text-accent font-mono text-xs transition"
      >
        ← Voltar para a página inicial
      </Link>

      <h1 className="font-display text-text-primary mt-6 mb-2 text-4xl tracking-wide">
        Política de Privacidade
      </h1>
      <p className="text-text-muted font-mono text-xs mb-10">
        Última atualização: 07/05/2026
      </p>

      <p className="text-text-secondary font-body mb-8 leading-relaxed">
        Esta Política de Privacidade descreve como a{' '}
        <strong className="text-text-primary font-semibold">Equipe Mala na Copa</strong>{' '}
        coleta, usa, armazena e protege os dados pessoais dos participantes do bolão da
        Copa do Mundo FIFA 2026, em conformidade com a Lei Geral de Proteção de Dados
        (Lei nº 13.709/2018 — LGPD).
      </p>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">1. Quem somos</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        A Equipe Mala na Copa é a operadora do bolão e atua como{' '}
        <strong className="text-text-primary font-semibold">controladora dos dados pessoais</strong>{' '}
        coletados na plataforma, nos termos do artigo 5º, inciso VI, da LGPD. As decisões
        sobre o tratamento dos seus dados são tomadas por nós.
      </p>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">2. Dados que coletamos</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Coletamos apenas os dados necessários para operar o bolão e cumprir nossas
        obrigações legais:
      </p>
      <ul className="list-disc pl-6 text-text-secondary font-body mb-4 leading-relaxed space-y-1">
        <li><strong className="text-text-primary font-semibold">Dados de cadastro:</strong> nome, email, senha (armazenada de forma criptografada).</li>
        <li><strong className="text-text-primary font-semibold">Dados opcionais:</strong> telefone e CPF, quando informados pelo usuário para fins de pagamento de prêmio ou cashback.</li>
        <li><strong className="text-text-primary font-semibold">Dados de participação:</strong> tabelas adquiridas, palpites realizados, pontuação, histórico de transações.</li>
        <li><strong className="text-text-primary font-semibold">Dados técnicos:</strong> endereço IP, data e hora de acesso, tipo de dispositivo e navegador, registros de log de segurança.</li>
        <li><strong className="text-text-primary font-semibold">Dados de pagamento:</strong> processados diretamente pelo Mercado Pago. <strong className="text-text-primary font-semibold">Não armazenamos</strong> dados de cartão, chave PIX completa ou credenciais bancárias — recebemos apenas a confirmação do pagamento e um identificador da transação.</li>
      </ul>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">3. Finalidade do tratamento</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Tratamos seus dados exclusivamente para:
      </p>
      <ul className="list-disc pl-6 text-text-secondary font-body mb-4 leading-relaxed space-y-1">
        <li>Operar o bolão — registrar palpites, calcular pontuação, manter o ranking.</li>
        <li>Comunicar resultados, alertas de pagamento e informações relevantes do bolão.</li>
        <li>Processar pagamentos de tabelas, prêmios e cashback.</li>
        <li>Prevenir fraude e garantir a integridade do sistema.</li>
        <li>Cumprir obrigações legais, fiscais e regulatórias.</li>
      </ul>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">4. Base legal</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        O tratamento dos seus dados está fundamentado nas seguintes hipóteses do artigo
        7º da LGPD:
      </p>
      <ul className="list-disc pl-6 text-text-secondary font-body mb-4 leading-relaxed space-y-1">
        <li><strong className="text-text-primary font-semibold">Execução de contrato (inciso V):</strong> para que possamos prestar o serviço contratado por você ao adquirir uma tabela.</li>
        <li><strong className="text-text-primary font-semibold">Consentimento (inciso I):</strong> para tratamentos que extrapolam a execução do contrato, sempre que aplicável e sempre revogável.</li>
        <li><strong className="text-text-primary font-semibold">Cumprimento de obrigação legal (inciso II):</strong> retenção de dados para fins fiscais e atendimento a autoridades.</li>
        <li><strong className="text-text-primary font-semibold">Legítimo interesse (inciso IX):</strong> prevenção de fraude e garantia da integridade do bolão, sempre observado o equilíbrio com seus direitos fundamentais.</li>
      </ul>

      {/* TODO_LEGAL: revisar com advogado — compartilhamento com terceiros */}
      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">5. Compartilhamento de dados</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Não comercializamos seus dados. O único compartilhamento de dados pessoais com
        terceiros ocorre com o{' '}
        <strong className="text-text-primary font-semibold">Mercado Pago</strong>,
        exclusivamente para processamento dos pagamentos via PIX — os dados financeiros
        transitam diretamente entre você e o Mercado Pago, sob a política de
        privacidade do próprio Mercado Pago.
      </p>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Eventual compartilhamento adicional só ocorrerá mediante obrigação legal,
        ordem judicial ou consentimento expresso do titular.
      </p>

      {/* TODO_LEGAL: revisar com advogado — direitos do titular e procedimento de revogação */}
      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">6. Seus direitos como titular</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Conforme o artigo 18 da LGPD, você tem direito a, a qualquer tempo:
      </p>
      <ul className="list-disc pl-6 text-text-secondary font-body mb-4 leading-relaxed space-y-1">
        <li>Confirmar a existência de tratamento e acessar seus dados.</li>
        <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
        <li>Solicitar a anonimização, o bloqueio ou a eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD.</li>
        <li>Solicitar a portabilidade dos dados a outro fornecedor.</li>
        <li>Revogar o consentimento, quando o tratamento for baseado nele.</li>
        <li>Obter informação sobre as entidades públicas e privadas com quem compartilhamos seus dados.</li>
        <li>Apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).</li>
      </ul>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Para exercer qualquer destes direitos, envie sua solicitação para o email
        indicado na seção 11. Responderemos em prazo razoável, observando as
        obrigações legais que possam impedir o atendimento imediato (por exemplo,
        retenção de dados fiscais).
      </p>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">7. Retenção dos dados</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Mantemos seus dados pelo período em que sua conta estiver ativa. Após o
        encerramento da conta — ou após o término operacional do bolão da Copa do Mundo
        FIFA 2026 — os dados podem ser retidos por até{' '}
        <strong className="text-text-primary font-semibold">5 (cinco) anos</strong>{' '}
        para cumprimento de obrigações fiscais e legais, e em seguida são excluídos ou
        anonimizados.
      </p>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">8. Segurança</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Adotamos medidas técnicas e organizacionais razoáveis para proteger seus dados,
        incluindo:
      </p>
      <ul className="list-disc pl-6 text-text-secondary font-body mb-4 leading-relaxed space-y-1">
        <li>Comunicação criptografada via HTTPS em todas as páginas.</li>
        <li>Senhas armazenadas com algoritmos de hash (sem reversibilidade).</li>
        <li>Controle de acesso por linha (Row-Level Security) no banco de dados.</li>
        <li>Princípio de menor privilégio em chaves de API e credenciais de serviço.</li>
        <li>Monitoramento de logs e revisão periódica de configurações.</li>
      </ul>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Apesar de nossos esforços, nenhum sistema é absolutamente imune a incidentes.
        Você também é responsável por manter sua senha em sigilo, usar uma senha forte
        e única, e nos comunicar imediatamente caso suspeite de uso não autorizado da
        sua conta.
      </p>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">9. Cookies</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Utilizamos apenas{' '}
        <strong className="text-text-primary font-semibold">cookies essenciais</strong>{' '}
        para o funcionamento do serviço — basicamente o cookie de sessão de autenticação
        (Supabase) e tokens de proteção contra CSRF. Não utilizamos cookies de
        rastreamento publicitário, nem cookies de terceiros para fins comerciais.
      </p>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">10. Menores de idade</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        O Mala na Copa não é direcionado a menores de 18 anos e não coleta
        deliberadamente dados pessoais de menores. O cadastro exige a declaração de
        maioridade. Caso identifiquemos a criação de conta por menor de idade, a conta
        será cancelada e os dados, eliminados.
      </p>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">11. Encarregado pelo tratamento de dados (DPO)</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Para exercer seus direitos como titular, esclarecer dúvidas sobre esta política
        ou nos comunicar incidentes de segurança envolvendo seus dados, entre em contato
        pelo email{' '}
        <strong className="text-text-primary font-semibold">contato@malanacopa.com.br</strong>.
      </p>

      <h2 className="font-display text-accent mt-10 mb-4 text-2xl">12. Atualização desta política</h2>
      <p className="text-text-secondary font-body mb-4 leading-relaxed">
        Esta Política de Privacidade pode ser atualizada periodicamente para refletir
        mudanças legais, operacionais ou tecnológicas. Atualizações relevantes serão
        comunicadas aos usuários cadastrados, e a data da última revisão consta sempre
        no topo desta página. Recomendamos a leitura periódica.
      </p>
    </main>
  );
}
