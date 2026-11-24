/* Privacy Policy, Terms of Use, Cookies & storage, and Support — in English, Español and Português (Brasil).
   Public routes (no account needed): /privacy, /terms, /cookies, /support. */
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { LANG, type Lang } from '@/lib/i18n';
import { LEGAL } from '@/lib/legal';

type Doc = { title: string; intro: string; sections: [string, string[]][] };
type Docs = Record<'privacy' | 'terms' | 'cookies' | 'support', Doc>;

const C = LEGAL.country;
const mail = LEGAL.email;

const EN: Docs = {
  privacy: {
    title: "Privacy Policy",
    intro: `${LEGAL.app} is a private workspace for content creators. This policy explains what we store, why, where, and the control you have over it. In short: your content is yours, we don't sell it, we don't track you, and you can export or delete everything at any time.`,
    sections: [
      ['Who is responsible', [`${LEGAL.owner} publishes ${LEGAL.app} and is the data controller. Contact: ${mail}.`]],
      ['What we store', [
        'Content you create: ideas, videos and their scripts, shots and checklists, tasks, events, habits, goals, time logs, statistics you enter, Brand Kit items and the files you upload.',
        'Preferences: profile name and handle, language, theme, categories, platforms and similar settings.',
        `If you create an account: your email address and a securely hashed password (managed by our authentication provider), plus a random device identifier used to sync your devices.`,
        'We do not collect contacts, location, advertising identifiers or analytics, and we do not use tracking pixels or third-party trackers.',
      ]],
      ['Where it is stored', [
        `Without an account, everything stays on your device (browser storage). It never leaves it.`,
        'With an account, a copy is stored in our cloud database and file storage, provided by Supabase (our processor), so your devices can sync. Each row is locked to your account; nobody else can read it.',
        'The app itself is served by our hosting provider, which may keep short-lived technical logs (such as IP addresses) for security.',
      ]],
      ['Why (legal basis)', [
        'To provide the service you asked for — your workspace and, if you sign in, syncing it between your devices (performance of a contract).',
        'To keep the service secure and prevent abuse (legitimate interest).',
        'Notifications only after you allow them in your browser or device (consent, which you can withdraw at any time).',
      ]],
      ['How long', [
        'Your data is kept while you use the app. Deleting a record removes it from all your synced devices. Deleting your account (Account & sync → Delete account) permanently deletes your account, synced records and uploaded files from the cloud.',
        'Data stored only on a device stays there until you remove it (Settings → Data → Reset everything) or clear the browser data.',
      ]],
      ['Your rights', [
        'You can access, correct, export (Settings → Data → Export backup), restrict, object to processing of, and delete your data, and you can withdraw consent at any time.',
        `To exercise any right, write to ${mail}. If you think we handle your data unlawfully, you can complain to your data protection authority (in ${C.en}, the AEPD).`,
      ]],
      ['International transfers', ['Our providers may process data outside your country. When they do, they rely on appropriate safeguards such as the European Commission’s Standard Contractual Clauses.']],
      ['Security', ['Connections are encrypted (HTTPS/TLS), passwords are hashed by the authentication provider, and database access rules restrict every row to its owner.']],
      ['Children', ['KROOPY is not directed to children under 16, and we do not knowingly collect their data.']],
      ['Changes', ['If this policy changes in a meaningful way, we will tell you in the app before the change applies.']],
    ],
  },
  terms: {
    title: "Terms of Use",
    intro: `These terms govern your use of ${LEGAL.app}. By using the app you agree to them.`,
    sections: [
      ['The service', [`${LEGAL.app} helps you plan, produce and track content. It works on your device; with an account, it also syncs your data between your devices.`]],
      ['Your account', ['Keep your password safe and tell us if you suspect unauthorised use. You are responsible for activity under your account.']],
      ['Your content', ['Everything you create or upload remains yours. You give us only the permission needed to store, sync and display it to you. You must have the rights to the content you upload.']],
      ['Acceptable use', ['Do not use KROOPY to break the law, infringe others’ rights, upload malware, or try to access other people’s data or disrupt the service.']],
      ['Availability', ['We work to keep KROOPY available and your data safe, but the service is provided “as is”. Keep backups of important work (Settings → Data → Export backup).']],
      ['Liability', ['To the extent permitted by law, we are not liable for indirect damages or loss of data. Nothing in these terms limits rights you have as a consumer.']],
      ['Ending', ['You can stop using KROOPY and delete your account at any time from Account & sync. We may suspend accounts that seriously breach these terms.']],
      ['Law', [`These terms are governed by the laws of ${C.en}. Questions: ${mail}.`]],
    ],
  },
  cookies: {
    title: "Cookies & storage",
    intro: `${LEGAL.app} uses no advertising or analytics cookies and no trackers. It only uses the storage that is strictly necessary to work, which is why it doesn’t ask for cookie consent.`,
    sections: [
      ['What is stored on your device', [
        'IndexedDB: your workspace (records and uploaded files), so the app works offline.',
        'Local storage: preferences (language, theme, sidebar), the sync queue and, if you sign in, your session so you stay signed in.',
        'Service worker cache: the app’s own files, so it opens instantly and offline.',
      ]],
      ['Third parties', ['No third-party cookies are set. Fonts and icons are served from KROOPY itself.']],
      ['Control', ['You can delete all of it from Settings → Data → Reset everything, or by clearing this site’s data in your browser settings.']],
    ],
  },
  support: {
    title: "Support",
    intro: `Need help with ${LEGAL.app}? Write to ${mail} — we usually reply within two working days.`,
    sections: [
      ['Sync between laptop and phone', ['Sign in with the same account on both (Account & sync). Changes appear on the other device within seconds; offline changes sync when you reconnect.']],
      ['Install the app', ['iPhone: open the site in Safari → Share → Add to Home Screen. Android: menu → Install app. Computer: the install icon in the address bar.']],
      ['Export or delete your data', ['Export: Settings → Data → Export backup. Delete your account and cloud data: Account & sync → Delete account.']],
      ['Change the language', ['Settings → Language, or the language button in the sidebar.']],
    ],
  },
};

const ES: Docs = {
  privacy: {
    title: "Política de privacidad",
    intro: `${LEGAL.app} es un espacio de trabajo privado para creadores de contenido. Esta política explica qué guardamos, por qué, dónde y el control que tienes. En resumen: tu contenido es tuyo, no lo vendemos, no te rastreamos y puedes exportarlo o borrarlo todo cuando quieras.`,
    sections: [
      ['Responsable', [`${LEGAL.owner} publica ${LEGAL.app} y es el responsable del tratamiento. Contacto: ${mail}.`]],
      ['Qué guardamos', [
        'El contenido que creas: ideas, vídeos con sus guiones, planos y checklists, tareas, eventos, hábitos, objetivos, registros de tiempo, estadísticas que introduces, elementos del Brand Kit y los archivos que subes.',
        'Preferencias: nombre y usuario del perfil, idioma, tema, categorías, plataformas y ajustes similares.',
        'Si creas una cuenta: tu correo electrónico y una contraseña cifrada de forma segura (gestionada por nuestro proveedor de autenticación), y un identificador aleatorio de dispositivo para sincronizar tus dispositivos.',
        'No recopilamos contactos, ubicación, identificadores publicitarios ni analítica, y no usamos píxeles de seguimiento ni rastreadores de terceros.',
      ]],
      ['Dónde se guarda', [
        'Sin cuenta, todo se queda en tu dispositivo (almacenamiento del navegador). Nunca sale de él.',
        'Con cuenta, se guarda una copia en nuestra base de datos y almacenamiento de archivos en la nube, prestados por Supabase (encargado del tratamiento), para que tus dispositivos se sincronicen. Cada registro está bloqueado a tu cuenta; nadie más puede leerlo.',
        'La aplicación la sirve nuestro proveedor de alojamiento, que puede conservar registros técnicos breves (como direcciones IP) por seguridad.',
      ]],
      ['Para qué (base legal)', [
        'Para prestarte el servicio que pides: tu espacio de trabajo y, si inicias sesión, su sincronización entre dispositivos (ejecución de un contrato).',
        'Para mantener el servicio seguro y evitar abusos (interés legítimo).',
        'Notificaciones solo después de que las permitas en tu navegador o dispositivo (consentimiento, que puedes retirar cuando quieras).',
      ]],
      ['Cuánto tiempo', [
        'Tus datos se conservan mientras uses la app. Borrar un registro lo elimina de todos tus dispositivos sincronizados. Borrar tu cuenta (Cuenta y sincronización → Eliminar cuenta) elimina de forma permanente tu cuenta, los registros sincronizados y los archivos subidos de la nube.',
        'Los datos guardados solo en un dispositivo permanecen allí hasta que los borres (Ajustes → Datos → Restablecer todo) o borres los datos del navegador.',
      ]],
      ['Tus derechos', [
        'Puedes acceder, rectificar, exportar (Ajustes → Datos → Exportar copia), limitar, oponerte al tratamiento y suprimir tus datos, y retirar tu consentimiento en cualquier momento.',
        `Para ejercer cualquier derecho, escribe a ${mail}. Si crees que tratamos tus datos de forma ilícita, puedes reclamar ante la autoridad de protección de datos (en ${C.es}, la AEPD).`,
      ]],
      ['Transferencias internacionales', ['Nuestros proveedores pueden tratar datos fuera de tu país. Cuando lo hacen, se basan en garantías adecuadas como las Cláusulas Contractuales Tipo de la Comisión Europea.']],
      ['Seguridad', ['Las conexiones están cifradas (HTTPS/TLS), el proveedor de autenticación guarda las contraseñas cifradas y las reglas de acceso a la base de datos limitan cada registro a su propietario.']],
      ['Menores', ['KROOPY no está dirigido a menores de 16 años y no recopilamos sus datos de forma consciente.']],
      ['Cambios', ['Si esta política cambia de forma relevante, te lo diremos en la app antes de que se aplique.']],
    ],
  },
  terms: {
    title: "Términos de uso",
    intro: `Estos términos regulan el uso de ${LEGAL.app}. Al usar la app, los aceptas.`,
    sections: [
      ['El servicio', [`${LEGAL.app} te ayuda a planificar, producir y medir tu contenido. Funciona en tu dispositivo; con una cuenta, además sincroniza tus datos entre tus dispositivos.`]],
      ['Tu cuenta', ['Mantén tu contraseña a salvo y avísanos si sospechas un uso no autorizado. Eres responsable de la actividad de tu cuenta.']],
      ['Tu contenido', ['Todo lo que creas o subes sigue siendo tuyo. Solo nos das el permiso necesario para guardarlo, sincronizarlo y mostrártelo. Debes tener los derechos del contenido que subes.']],
      ['Uso aceptable', ['No uses KROOPY para infringir la ley o derechos de terceros, subir malware, intentar acceder a datos de otras personas o interrumpir el servicio.']],
      ['Disponibilidad', ['Trabajamos para que KROOPY esté disponible y tus datos seguros, pero el servicio se ofrece “tal cual”. Guarda copias de tu trabajo importante (Ajustes → Datos → Exportar copia).']],
      ['Responsabilidad', ['En la medida que permita la ley, no respondemos de daños indirectos ni de pérdida de datos. Nada en estos términos limita tus derechos como consumidor.']],
      ['Baja', ['Puedes dejar de usar KROOPY y eliminar tu cuenta cuando quieras desde Cuenta y sincronización. Podemos suspender cuentas que incumplan gravemente estos términos.']],
      ['Ley aplicable', [`Estos términos se rigen por las leyes de ${C.es}. Dudas: ${mail}.`]],
    ],
  },
  cookies: {
    title: "Cookies y almacenamiento",
    intro: `${LEGAL.app} no usa cookies publicitarias ni de analítica, ni rastreadores. Solo usa el almacenamiento estrictamente necesario para funcionar, por eso no pide consentimiento de cookies.`,
    sections: [
      ['Qué se guarda en tu dispositivo', [
        'IndexedDB: tu espacio de trabajo (registros y archivos subidos), para que la app funcione sin conexión.',
        'Almacenamiento local: preferencias (idioma, tema, barra lateral), la cola de sincronización y, si inicias sesión, tu sesión para que sigas conectado.',
        'Caché del service worker: los archivos de la propia app, para que se abra al instante y sin conexión.',
      ]],
      ['Terceros', ['No se instalan cookies de terceros. Las fuentes y los iconos se sirven desde el propio KROOPY.']],
      ['Control', ['Puedes borrarlo todo desde Ajustes → Datos → Restablecer todo, o borrando los datos de este sitio en los ajustes de tu navegador.']],
    ],
  },
  support: {
    title: "Soporte",
    intro: `¿Necesitas ayuda con ${LEGAL.app}? Escribe a ${mail}; solemos responder en dos días laborables.`,
    sections: [
      ['Sincronizar portátil y móvil', ['Inicia sesión con la misma cuenta en ambos (Cuenta y sincronización). Los cambios aparecen en el otro dispositivo en segundos; los cambios sin conexión se sincronizan al volver a conectarte.']],
      ['Instalar la app', ['iPhone: abre la web en Safari → Compartir → Añadir a pantalla de inicio. Android: menú → Instalar app. Ordenador: el icono de instalar en la barra de direcciones.']],
      ['Exportar o borrar tus datos', ['Exportar: Ajustes → Datos → Exportar copia. Eliminar tu cuenta y los datos en la nube: Cuenta y sincronización → Eliminar cuenta.']],
      ['Cambiar el idioma', ['Ajustes → Idioma, o el botón de idioma de la barra lateral.']],
    ],
  },
};

const PT: Docs = {
  privacy: {
    title: "Política de privacidade",
    intro: `${LEGAL.app} é um espaço de trabalho privado para criadores de conteúdo. Esta política explica o que guardamos, por quê, onde e o controle que você tem. Resumindo: seu conteúdo é seu, não o vendemos, não rastreamos você e você pode exportar ou excluir tudo quando quiser.`,
    sections: [
      ['Responsável', [`${LEGAL.owner} publica o ${LEGAL.app} e é o controlador dos dados. Contato: ${mail}.`]],
      ['O que guardamos', [
        'O conteúdo que você cria: ideias, vídeos com roteiros, planos e checklists, tarefas, eventos, hábitos, metas, registros de tempo, estatísticas que você informa, itens do Brand Kit e os arquivos que você envia.',
        'Preferências: nome e usuário do perfil, idioma, tema, categorias, plataformas e ajustes semelhantes.',
        'Se você criar uma conta: seu e-mail e uma senha protegida por hash (gerenciada pelo nosso provedor de autenticação), além de um identificador aleatório de dispositivo usado para sincronizar seus aparelhos.',
        'Não coletamos contatos, localização, identificadores de publicidade nem análises, e não usamos pixels de rastreamento nem rastreadores de terceiros.',
      ]],
      ['Onde fica armazenado', [
        'Sem conta, tudo fica no seu dispositivo (armazenamento do navegador). Nunca sai dele.',
        'Com conta, uma cópia fica no nosso banco de dados e armazenamento de arquivos na nuvem, fornecidos pelo Supabase (operador), para que seus dispositivos sincronizem. Cada registro fica vinculado à sua conta; ninguém mais pode lê-lo.',
        'O app é servido pelo nosso provedor de hospedagem, que pode manter registros técnicos breves (como endereços IP) por segurança.',
      ]],
      ['Para quê (base legal)', [
        'Para prestar o serviço que você pediu: seu espaço de trabalho e, se você entrar na conta, a sincronização entre dispositivos (execução de contrato).',
        'Para manter o serviço seguro e evitar abusos (legítimo interesse).',
        'Notificações só depois que você as permitir no navegador ou no dispositivo (consentimento, que pode ser revogado a qualquer momento).',
      ]],
      ['Por quanto tempo', [
        'Seus dados ficam guardados enquanto você usar o app. Excluir um registro o remove de todos os seus dispositivos sincronizados. Excluir sua conta (Conta e sincronização → Excluir conta) apaga permanentemente sua conta, os registros sincronizados e os arquivos enviados da nuvem.',
        'Dados guardados só em um dispositivo ficam lá até você removê-los (Configurações → Dados → Redefinir tudo) ou limpar os dados do navegador.',
      ]],
      ['Seus direitos', [
        'Você pode acessar, corrigir, exportar (Configurações → Dados → Exportar backup), restringir, se opor ao tratamento e excluir seus dados, e revogar o consentimento a qualquer momento (LGPD e RGPD).',
        `Para exercer qualquer direito, escreva para ${mail}. Se achar que tratamos seus dados de forma ilegal, você pode reclamar à autoridade de proteção de dados (no Brasil, a ANPD).`,
      ]],
      ['Transferências internacionais', ['Nossos provedores podem tratar dados fora do seu país. Quando isso acontece, eles se baseiam em garantias adequadas, como as Cláusulas Contratuais Padrão.']],
      ['Segurança', ['As conexões são criptografadas (HTTPS/TLS), as senhas são protegidas por hash pelo provedor de autenticação e as regras de acesso ao banco limitam cada registro ao seu dono.']],
      ['Crianças', ['O KROOPY não é direcionado a menores de 16 anos, e não coletamos dados deles conscientemente.']],
      ['Alterações', ['Se esta política mudar de forma relevante, avisaremos no app antes que a mudança se aplique.']],
    ],
  },
  terms: {
    title: "Termos de uso",
    intro: `Estes termos regem o uso do ${LEGAL.app}. Ao usar o app, você concorda com eles.`,
    sections: [
      ['O serviço', [`O ${LEGAL.app} ajuda você a planejar, produzir e acompanhar seu conteúdo. Funciona no seu dispositivo; com uma conta, também sincroniza seus dados entre seus aparelhos.`]],
      ['Sua conta', ['Mantenha sua senha segura e nos avise se suspeitar de uso não autorizado. Você é responsável pela atividade na sua conta.']],
      ['Seu conteúdo', ['Tudo o que você cria ou envia continua sendo seu. Você nos dá apenas a permissão necessária para guardar, sincronizar e mostrar esse conteúdo a você. Você precisa ter os direitos sobre o que envia.']],
      ['Uso aceitável', ['Não use o KROOPY para violar a lei ou direitos de terceiros, enviar malware, tentar acessar dados de outras pessoas ou atrapalhar o serviço.']],
      ['Disponibilidade', ['Trabalhamos para manter o KROOPY disponível e seus dados seguros, mas o serviço é oferecido “no estado em que se encontra”. Faça backup do que for importante (Configurações → Dados → Exportar backup).']],
      ['Responsabilidade', ['Na medida permitida por lei, não respondemos por danos indiretos ou perda de dados. Nada nestes termos limita seus direitos como consumidor.']],
      ['Encerramento', ['Você pode parar de usar o KROOPY e excluir sua conta a qualquer momento em Conta e sincronização. Podemos suspender contas que violem gravemente estes termos.']],
      ['Lei aplicável', [`Estes termos são regidos pelas leis de ${C['pt-BR']}, sem prejuízo dos direitos do consumidor no seu país. Dúvidas: ${mail}.`]],
    ],
  },
  cookies: {
    title: "Cookies e armazenamento",
    intro: `O ${LEGAL.app} não usa cookies de publicidade nem de análise, nem rastreadores. Ele só usa o armazenamento estritamente necessário para funcionar, por isso não pede consentimento de cookies.`,
    sections: [
      ['O que fica no seu dispositivo', [
        'IndexedDB: seu espaço de trabalho (registros e arquivos enviados), para o app funcionar offline.',
        'Armazenamento local: preferências (idioma, tema, barra lateral), a fila de sincronização e, se você entrar na conta, sua sessão para continuar conectado.',
        'Cache do service worker: os arquivos do próprio app, para abrir na hora e offline.',
      ]],
      ['Terceiros', ['Nenhum cookie de terceiros é definido. Fontes e ícones são servidos pelo próprio KROOPY.']],
      ['Controle', ['Você pode apagar tudo em Configurações → Dados → Redefinir tudo, ou limpando os dados deste site nas configurações do navegador.']],
    ],
  },
  support: {
    title: "Suporte",
    intro: `Precisa de ajuda com o ${LEGAL.app}? Escreva para ${mail} — costumamos responder em até dois dias úteis.`,
    sections: [
      ['Sincronizar notebook e celular', ['Entre com a mesma conta nos dois (Conta e sincronização). As mudanças aparecem no outro aparelho em segundos; mudanças offline sincronizam quando você se reconecta.']],
      ['Instalar o app', ['iPhone: abra o site no Safari → Compartilhar → Adicionar à Tela de Início. Android: menu → Instalar app. Computador: o ícone de instalar na barra de endereços.']],
      ['Exportar ou excluir seus dados', ['Exportar: Configurações → Dados → Exportar backup. Excluir sua conta e os dados na nuvem: Conta e sincronização → Excluir conta.']],
      ['Mudar o idioma', ['Configurações → Idioma, ou o botão de idioma na barra lateral.']],
    ],
  },
};

const BY_LANG: Record<Lang, Docs> = { en: EN, es: ES, 'pt-BR': PT };
const UPDATED: Record<Lang, string> = { en: 'Last updated', es: 'Última actualización', 'pt-BR': 'Última atualização' };
const BACK: Record<Lang, string> = { en: 'Back to KROOPY', es: 'Volver a KROOPY', 'pt-BR': 'Voltar ao KROOPY' };

export default function LegalPage() {
  const { pathname } = useLocation();
  const key = (pathname.slice(1) || 'privacy') as keyof Docs;
  const doc = BY_LANG[LANG][key] ?? BY_LANG[LANG].privacy;
  const other = (['privacy', 'terms', 'cookies', 'support'] as const).filter((k) => k !== key);
  return (
    <div className="page legal">
      <Link to="/" className="ws__back">
        <ArrowLeft size={15} /> {BACK[LANG]}
      </Link>
      <h1 className="page-title display">
        {doc.title}
        <span className="stop" aria-hidden />
      </h1>
      <p className="subtle legal__date">
        {UPDATED[LANG]}: {LEGAL.updated}
      </p>
      <p className="legal__intro">{doc.intro}</p>
      {doc.sections.map(([h, ps]) => (
        <section key={h} className="legal__section">
          <h2>{h}</h2>
          {ps.length > 1 ? (
            <ul>
              {ps.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            <p>{ps[0]}</p>
          )}
        </section>
      ))}
      <nav className="legal__nav">
        {other.map((k) => (
          <Link key={k} to={`/${k}`} className="link">
            {BY_LANG[LANG][k].title}
          </Link>
        ))}
      </nav>
    </div>
  );
}
